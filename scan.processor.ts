import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { tmpdir } from 'os';
import { join } from 'path';
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/Pick';
import { streamValues } from 'stream-json/streamers/StreamValues';
import { ScanStatusService } from './scan-status.service';
import { ScanStatus } from './scan-status.enum';
import { CriticalVulnerabilityDto } from './dto/critical-vulnerability.dto';

/** Trivy report root: { SchemaVersion, CreatedAt, ArtifactName, Results: TrivyResult[] } */
interface TrivyResult {
  Target: string;
  Class?: string;
  Type?: string;
  Vulnerabilities?: TrivyVulnerability[];
}

/** Single entry in Results[].Vulnerabilities[] - only store when Severity === "CRITICAL" */
interface TrivyVulnerability {
  VulnerabilityID?: string;
  PkgID?: string;
  PkgName?: string;
  InstalledVersion?: string;
  FixedVersion?: string;
  Title?: string;
  Description?: string;
  Severity?: string;
  PrimaryURL?: string;
  [key: string]: unknown;
}

@Processor('scan')
export class ScanProcessor {
  private readonly logger = new Logger(ScanProcessor.name);

  constructor(private readonly scanStatusService: ScanStatusService) {}

  @Process('scan-repo')
  async handleScan(job: Job<{ scanId: string; repoUrl: string }>): Promise<void> {
    const { scanId, repoUrl } = job.data;

    this.scanStatusService.setStatus(scanId, ScanStatus.SCANNING);
    this.logger.log(`Starting scan. scanId=${scanId}, repoUrl=${repoUrl}`);

    let workspaceDir: string | undefined;

    try {
      // 1. Prepare temporary workspace (repo + report path)
      const { baseDir, repoDir, reportPath } =
        await this.createTempWorkspace(scanId);
      workspaceDir = baseDir;

      // 2. Clone the repository into the temp folder
      await this.cloneRepository(repoUrl, repoDir);

      // 3. Run Trivy against the cloned repo, outputting to a JSON file
      await this.runTrivyScan(repoDir, reportPath);

      // 4. Stream-parse the huge JSON file and extract only CRITICAL vulnerabilities
      const criticalVulnerabilities =
        await this.extractCriticalVulnerabilities(reportPath);

      this.scanStatusService.setStatus(
        scanId,
        ScanStatus.FINISHED,
        criticalVulnerabilities,
      );
      this.logger.log(
        `Finished scan. scanId=${scanId}, repoUrl=${repoUrl}, criticalCount=${criticalVulnerabilities.length}`,
      );
    } catch (err) {
      this.scanStatusService.setStatus(scanId, ScanStatus.FAILED);
      this.logger.error(
        `Scan failed. scanId=${scanId}, repoUrl=${repoUrl}`,
        (err as Error)?.stack,
      );
      throw err;
    } finally {
      // 5. Cleanup: remove cloned repo and JSON file
      if (workspaceDir) {
        await this.cleanupWorkspace(workspaceDir);
      }
    }
  }

  private async createTempWorkspace(scanId: string): Promise<{
    baseDir: string;
    repoDir: string;
    reportPath: string;
  }> {
    const baseDir = await fs.mkdtemp(join('../stats', `codeguardian-${scanId}-`));
    const repoDir = join(baseDir, 'repo');
    const reportPath = join(baseDir, 'trivy-report.json');
    return { baseDir, repoDir, reportPath };
  }

  private async cloneRepository(repoUrl: string, targetDir: string): Promise<void> {
    this.logger.log(`Cloning repository ${repoUrl} into ${targetDir}`);
    await this.runCommand('git', ['clone', '--depth', '1', repoUrl, targetDir]);
  }

  private async runTrivyScan(
    repoDir: string,
    outputPath: string,
  ): Promise<void> {
    this.logger.log(
      `Running Trivy scan for repo at ${repoDir}, output: ${outputPath}`,
    );
    await this.runCommand('trivy', [
      'fs',
      '--scanners',
      'vuln',
      '--format',
      'json',
      '--output',
      outputPath,
      repoDir,
    ]);
  }

  /**
   * Stream-parse Trivy JSON report (safe for 500MB+).
   * Trivy structure: { Results: [ { Target, Vulnerabilities: [ { VulnerabilityID, Title, Description, Severity, ... } ] } ] }
   * We pick each Results[i] object, then keep only vulnerability objects with "Severity": "CRITICAL".
   */
  private async extractCriticalVulnerabilities(
    reportPath: string,
  ): Promise<CriticalVulnerabilityDto[]> {
    this.logger.log(
      `Extracting CRITICAL vulnerabilities from Trivy report: ${reportPath}`,
    );

    const criticalVulnerabilities: CriticalVulnerabilityDto[] = [];

    await new Promise<void>((resolve, reject) => {
      const fileStream = createReadStream(reportPath);
      // Pick only Results[i] objects (each has Target + Vulnerabilities)
      const isResultObject = (stack: unknown[]) =>
        stack.length === 2 &&
        stack[0] === 'Results' &&
        typeof stack[1] === 'number';

      const pipeline = fileStream
        .pipe(parser())
        .pipe(pick({ filter: isResultObject }))
        .pipe(streamValues());

      pipeline.on('data', (data: { key: number; value: unknown }) => {
        const result = data.value as TrivyResult;
        if (!result || typeof result !== 'object') return;

        const target = typeof result.Target === 'string' ? result.Target : undefined;
        const vulns = Array.isArray(result.Vulnerabilities)
          ? result.Vulnerabilities
          : [];

        for (const vuln of vulns) {
          if (!vuln || (vuln as TrivyVulnerability).Severity !== 'CRITICAL') {
            continue;
          }
          const v = vuln as TrivyVulnerability;
          const id = String(v.VulnerabilityID ?? v.Title ?? 'unknown').trim();
          const title = String(v.Title ?? id).trim();
          const description =
            typeof v.Description === 'string' ? v.Description : undefined;

          criticalVulnerabilities.push({
            id,
            title,
            severity: 'Critical',
            description,
            file: target,
          });
        }
      });

      pipeline.on('error', (err: Error) => reject(err));
      pipeline.on('end', () => resolve());
    });

    this.logger.log(
      `Extracted ${criticalVulnerabilities.length} CRITICAL vulnerabilities`,
    );
    return criticalVulnerabilities;
  }

  private async cleanupWorkspace(baseDir: string): Promise<void> {
    try {
      this.logger.log(`Cleaning up workspace at ${baseDir}`);
      await fs.rm(baseDir, { recursive: true, force: true });
    } catch (err) {
      this.logger.warn(
        `Failed to clean up workspace at ${baseDir}`,
        (err as Error)?.stack,
      );
    }
  }

  private async runCommand(
    command: string,
    args: string[],
    cwd?: string,
  ): Promise<void> {
    this.logger.log(
      `Executing command: ${command} ${args.join(' ')}${
        cwd ? ` (cwd: ${cwd})` : ''
      }`,
    );

    return new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        stdio: 'inherit',
      });

      child.on('error', (err) => {
        reject(err);
      });

      child.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              `${command} ${args.join(' ')} exited with code ${code ?? 'null'}`,
            ),
          );
        }
      });
    });
  }
}