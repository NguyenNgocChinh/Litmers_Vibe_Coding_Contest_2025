import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class UpdateLabelDto {
  @IsString()
  @IsOptional()
  @MaxLength(30)
  name?: string;

  @IsString()
  @IsOptional()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'Color must be a valid HEX color code (e.g., #FF5733 or #F57)',
  })
  color?: string;
}

