-- Add reporter_id column to issues table
alter table public.issues
  add column if not exists reporter_id uuid references public.users(id) on delete set null;

-- Create index for reporter_id
create index if not exists idx_issues_reporter on public.issues(reporter_id);

-- For existing issues without reporter_id, we can't determine the original reporter
-- So we'll leave them as null (they will be set for new issues going forward)

