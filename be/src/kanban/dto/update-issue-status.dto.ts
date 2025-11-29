import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateIssueStatusDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  status: string;
}
