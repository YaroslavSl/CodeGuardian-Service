import { ScanStatus } from '../scan-status.enum';

export class ScanResponseDto {
  scanId!: string;
  status!: ScanStatus;
}