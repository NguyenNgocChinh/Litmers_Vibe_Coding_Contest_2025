import { IsString, MaxLength, IsOptional, IsBoolean } from 'class-validator';

export class UpdateSubtaskDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @IsBoolean()
  @IsOptional()
  is_completed?: boolean;
}
