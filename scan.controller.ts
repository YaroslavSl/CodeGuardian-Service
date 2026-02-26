import {
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { CreateScanDto } from './dto/create-scan.dto';
import { ScanService } from './scan.service';
import { ScanResponseDto } from './dto/scan-response.dto';
import { ScanStatusResponseDto } from './dto/scan-status-response.dto';
import { ScanStatusService } from './scan-status.service';
import { ScanStatus } from './scan-status.enum';

@Controller('api')
export class ScanController {
  private readonly logger = new Logger(ScanController.name);

  constructor(
    private readonly scanService: ScanService,
    private readonly scanStatusService: ScanStatusService,
  ) {}

  @Post('scan')
  async createScan(@Body() dto: CreateScanDto): Promise<ScanResponseDto> {
    this.logger.log(`Received scan request. repoUrl=${dto.repoUrl}`);

    const { scanId, status } = await this.scanService.enqueueScan(dto.repoUrl);
    this.logger.log(
      `Enqueued scan job. scanId=${scanId}, status=${status}, repoUrl=${dto.repoUrl}`,
    );
    return { scanId, status };
  }

  @Get('scan/:scanId')
  getScanStatus(@Param('scanId') scanId: string): ScanStatusResponseDto {
    const entry = this.scanStatusService.getStatus(scanId);
    if (!entry) {
      throw new NotFoundException(`Scan not found: ${scanId}`);
    }
    const response: ScanStatusResponseDto = {
      status: entry.status,
    };
    if (entry.status === ScanStatus.FINISHED && entry.criticalVulnerabilities?.length) {
      response.criticalVulnerabilities = entry.criticalVulnerabilities;
    }
    return response;
  }
}