import { IsString, IsOptional, MinLength, MaxLength, IsNumber, Max, Min } from 'class-validator';
import { LABEL_NAME_MIN, LABEL_NAME_MAX, WIP_LIMIT_MIN, WIP_LIMIT_MAX } from '../../common/constants/limits';

export class UpdateStatusDto {
  @IsString()
  @IsOptional()
  @MinLength(LABEL_NAME_MIN)
  @MaxLength(LABEL_NAME_MAX)
  name?: string;

  @IsString()
  @IsOptional()
  color?: string; // HEX color code

  @IsOptional()
  position?: number;

  @IsNumber()
  @IsOptional()
  @Min(WIP_LIMIT_MIN)
  @Max(WIP_LIMIT_MAX)
  wipLimit?: number | null; // null means unlimited
}

