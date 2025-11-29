import { IsString, IsOptional } from 'class-validator';

export class DeleteAccountDto {
  @IsString()
  @IsOptional()
  password?: string; // Required for non-OAuth users, optional for OAuth users
}

