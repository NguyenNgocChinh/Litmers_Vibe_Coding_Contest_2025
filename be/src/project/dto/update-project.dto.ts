import { IsString, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { ProjectVisibility } from './create-project.dto';

export class UpdateProjectDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsEnum(ProjectVisibility)
  @IsOptional()
  visibility?: ProjectVisibility;
}
