-- Add color and wip_limit fields to project_statuses
alter table public.project_statuses
  add column if not exists color text default '#6B7280',
  add column if not exists wip_limit integer;

