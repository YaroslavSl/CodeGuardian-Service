import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ScanModule } from './scan/scan.module';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    ScanModule,
  ],
})
export class AppModule {}