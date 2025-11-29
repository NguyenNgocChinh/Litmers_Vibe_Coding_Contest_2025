import { IsOptional, IsString, IsEnum, IsUUID, IsBoolean, IsArray, IsDateString } from 'class-validator';
import { IssuePriority, IssueStatus } from './create-issue.dto';
import { Transform } from 'class-transformer';

export enum SortField {
  CREATED_AT = 'created_at',
  DUE_DATE = 'due_date',
  PRIORITY = 'priority',
  UPDATED_AT = 'updated_at',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class FilterIssuesDto {
  @IsString()
  @IsOptional()
  search?: string; // Title text search

  @IsArray()
  @IsEnum(IssueStatus, { each: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    return Array.isArray(value) ? value : [value];
  })
  status?: IssueStatus[];

  @IsUUID()
  @IsOptional()
  assignee_id?: string;

  @IsArray()
  @IsEnum(IssuePriority, { each: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    return Array.isArray(value) ? value : [value];
  })
  priority?: IssuePriority[];

  @IsUUID()
  @IsOptional()
  label_id?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  has_due_date?: boolean;

  @IsDateString()
  @IsOptional()
  due_date_from?: string;

  @IsDateString()
  @IsOptional()
  due_date_to?: string;

  @IsEnum(SortField)
  @IsOptional()
  sort_by?: SortField = SortField.CREATED_AT;

  @IsEnum(SortOrder)
  @IsOptional()
  sort_order?: SortOrder = SortOrder.DESC;
}

