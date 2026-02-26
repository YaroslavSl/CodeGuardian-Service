import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { v4 as uuidv4 } from 'uuid';
import { ScanStatus } from './scan-status.enum';
import { ScanStatusService } from './scan-status.service';

@Injectable()
export class ScanService {
  private readonly logger = new Logger(ScanService.name);

  constructor(
    @InjectQueue('scan') private readonly scanQueue: Queue,
    private readonly scanStatusService: ScanStatusService,
  ) {}

  async enqueueScan(repoUrl: string): Promise<{ scanId: string; status: ScanStatus }> {
    const scanId = uuidv4();

    this.scanStatusService.setStatus(scanId, ScanStatus.QUEUED);

    // Fire-and-forget enqueue; do not block HTTP response
    this.logger.log(
      `Enqueuing scan job. scanId=${scanId}, repoUrl=${repoUrl}`,
    );
    this.scanQueue
      .add('scan-repo', {
        scanId,
        repoUrl,
      })
      .catch((err) => {
        // Log enqueue failure (but keep API contract non-blocking)
        this.logger.error(
          `Failed to enqueue scan job. scanId=${scanId}, repoUrl=${repoUrl}`,
          err.stack,
        );
      });

    return {
      scanId,
      status: ScanStatus.QUEUED,
    };
  }
}