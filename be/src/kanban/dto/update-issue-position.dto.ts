import { IsNumber, IsOptional } from 'class-validator';

export class UpdateIssuePositionDto {
  @IsNumber()
  position: number;
}

