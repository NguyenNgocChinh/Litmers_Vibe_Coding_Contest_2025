import { IsString, IsOptional, MinLength, MaxLength, IsUrl } from 'class-validator';
import { USER_NAME_MIN, USER_NAME_MAX } from '../../common/constants/limits';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  @MinLength(USER_NAME_MIN)
  @MaxLength(USER_NAME_MAX)
  name?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  profileImage?: string; // URL for now, file upload can be added later
}

