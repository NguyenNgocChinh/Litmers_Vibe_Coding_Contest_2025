import { IsString, MaxLength, IsOptional, IsEnum, IsUUID, IsArray, ArrayMaxSize } from 'class-validator';
import { IssuePriority, IssueStatus } from './create-issue.dto';

export class UpdateIssueDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  description?: string;

  @IsEnum(IssuePriority)
  @IsOptional()
  priority?: IssuePriority;

  @IsEnum(IssueStatus)
  @IsOptional()
  status?: IssueStatus;

  @IsUUID()
  @IsOptional()
  assignee_id?: string;

  @IsString()
  @IsOptional()
  start_date?: string;

  @IsString()
  @IsOptional()
  due_date?: string;

  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  @ArrayMaxSize(5, { message: 'Maximum 5 labels per issue' })
  label_ids?: string[];
}
