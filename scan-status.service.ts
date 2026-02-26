import { Injectable } from '@nestjs/common';
import { ScanStatus } from './scan-status.enum';
import { CriticalVulnerabilityDto } from './dto/critical-vulnerability.dto';

export interface ScanStatusEntry {
  status: ScanStatus;
  criticalVulnerabilities?: CriticalVulnerabilityDto[];
}

@Injectable()
export class ScanStatusService {
  private readonly statusMap = new Map<string, ScanStatusEntry>();

  setStatus(
    scanId: string,
    status: ScanStatus,
    criticalVulnerabilities?: CriticalVulnerabilityDto[],
  ): void {
    this.statusMap.set(scanId, {
      status,
      ...(criticalVulnerabilities && criticalVulnerabilities.length > 0
        ? { criticalVulnerabilities }
        : {}),
    });
  }

  getStatus(scanId: string): ScanStatusEntry | undefined {
    return this.statusMap.get(scanId);
  }
}
