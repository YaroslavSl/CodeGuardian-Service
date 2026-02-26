import { ScanStatus } from '../scan-status.enum';
import { CriticalVulnerabilityDto } from './critical-vulnerability.dto';

export class ScanStatusResponseDto {
  status!: ScanStatus;
  criticalVulnerabilities?: CriticalVulnerabilityDto[];
}
