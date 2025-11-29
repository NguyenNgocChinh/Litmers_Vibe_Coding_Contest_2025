import { IsNotEmpty, IsString, MaxLength, IsUUID, IsOptional, IsEnum } from 'class-validator';

export enum ProjectVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
}

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsUUID()
  @IsNotEmpty()
  team_id: string;

  @IsEnum(ProjectVisibility)
  @IsOptional()
  visibility?: ProjectVisibility = ProjectVisibility.PRIVATE;
}
