import { IsString, IsNotEmpty, MinLength, MaxLength, IsOptional, IsHexColor } from 'class-validator';
import { LABEL_NAME_MIN, LABEL_NAME_MAX } from '../../common/constants/limits';

export class CreateStatusDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(LABEL_NAME_MIN)
  @MaxLength(LABEL_NAME_MAX)
  name: string;

  @IsString()
  @IsOptional()
  color?: string; // HEX color code

  @IsOptional()
  position?: number;
}

