import { IsEnum, IsNotEmpty } from 'class-validator';

export enum TeamRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export class UpdateMemberRoleDto {
  @IsEnum(TeamRole)
  @IsNotEmpty()
  role: TeamRole;
}
