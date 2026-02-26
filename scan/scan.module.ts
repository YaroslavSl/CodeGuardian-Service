import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ScanController } from '../scan.controller';
import { ScanService } from '../scan.service';
import { ScanProcessor } from '../scan.processor';
import { ScanStatusService } from '../scan-status.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'scan',
    }),
  ],
  controllers: [ScanController],
  providers: [ScanService, ScanProcessor, ScanStatusService],
})
export class ScanModule {}