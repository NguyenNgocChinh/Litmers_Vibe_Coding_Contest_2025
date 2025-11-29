import { IsNotEmpty, IsString, MaxLength, IsUUID, IsOptional, IsEnum, IsInt, Min, Max, IsArray, ArrayMaxSize } from 'class-validator';

export enum IssuePriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum IssueStatus {
  BACKLOG = 'Backlog',
  IN_PROGRESS = 'In Progress',
  DONE = 'Done',
}

export class CreateIssueDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  description?: string;

  @IsUUID()
  @IsNotEmpty()
  project_id: string;

  @IsEnum(IssuePriority)
  @IsOptional()
  priority?: IssuePriority = IssuePriority.MEDIUM;

  @IsEnum(IssueStatus)
  @IsOptional()
  status?: IssueStatus = IssueStatus.BACKLOG;

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
