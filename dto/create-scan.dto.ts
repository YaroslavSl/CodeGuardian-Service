import { IsString, IsUrl } from 'class-validator';

export class CreateScanDto {
  @IsString()
  @IsUrl()
  repoUrl!: string;
}