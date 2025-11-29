import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { PASSWORD_MIN, PASSWORD_MAX } from '../../common/constants/limits';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(PASSWORD_MIN)
  @MaxLength(PASSWORD_MAX)
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}

