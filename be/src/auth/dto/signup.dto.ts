import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

export class SignupDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(100)
  password: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;
}
