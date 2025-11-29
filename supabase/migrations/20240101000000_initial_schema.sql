-- Enable UUID extension (Supabase has this by default, but keeping for compatibility)
-- Supabase uses gen_random_uuid() instead of uuid_generate_v4()

-- Users table (managed by Supabase Auth, but we mirror it or link to it)
-- Note: In a real Supabase app, we often use public.users to extend auth.users
-- For this requirement, we'll assume a public.users table that might be synced with auth.users via triggers
create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

-- Teams table
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references public.users(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

-- Team Members table
create type public.team_role as enum ('OWNER', 'ADMIN', 'MEMBER');

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  role public.team_role not null default 'MEMBER',
  joined_at timestamptz default now(),
  unique(team_id, user_id)
);

-- Projects table
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade not null,
  owner_id uuid references public.users(id) not null,
  name text not null,
  description text,
  is_archived boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

-- Project Favorites (User specific)
create table public.project_favorites (
  user_id uuid references public.users(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (user_id, project_id)
);

-- Project Custom Statuses
create table public.project_statuses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  name text not null,
  position integer not null default 0,
  created_at timestamptz default now()
);

-- Issues table
create type public.issue_priority as enum ('HIGH', 'MEDIUM', 'LOW');
-- Note: Status is stored as text to support custom statuses. 
-- Default values: 'Backlog', 'In Progress', 'Done'

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  description text,
  status text not null default 'Backlog',
  priority public.issue_priority not null default 'MEDIUM',
  assignee_id uuid references public.users(id),
  due_date timestamptz,
  position integer default 0, -- for ordering in column
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

-- Labels table
create table public.labels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  name text not null,
  color text not null,
  created_at timestamptz default now()
);

-- Issue Labels (Many-to-Many)
create table public.issue_labels (
  issue_id uuid references public.issues(id) on delete cascade not null,
  label_id uuid references public.labels(id) on delete cascade not null,
  primary key (issue_id, label_id)
);

-- Subtasks table
create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid references public.issues(id) on delete cascade not null,
  title text not null,
  is_completed boolean default false,
  position integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Comments table
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid references public.issues(id) on delete cascade not null,
  user_id uuid references public.users(id) not null,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

-- Issue Activities (History)
create table public.issue_activities (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid references public.issues(id) on delete cascade not null,
  actor_id uuid references public.users(id) not null,
  action_type text not null, -- e.g., 'STATUS_CHANGE', 'ASSIGN_CHANGE'
  old_value text,
  new_value text,
  created_at timestamptz default now()
);

-- Indexes
create index idx_team_members_user on public.team_members(user_id);
create index idx_projects_team on public.projects(team_id);
create index idx_issues_project on public.issues(project_id);
create index idx_issues_assignee on public.issues(assignee_id);
create index idx_comments_issue on public.comments(issue_id);

-- RLS Policies (Examples - to be refined)
alter table public.users enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.projects enable row level security;
alter table public.issues enable row level security;
alter table public.comments enable row level security;

-- Basic RLS: Users can see teams they are members of
create policy "Users can view teams they belong to"
  on public.teams for select
  using (
    exists (
      select 1 from public.team_members
      where team_members.team_id = teams.id
      and team_members.user_id = auth.uid() -- Assuming auth.uid() maps to public.users.id
    )
  );

-- ... (More policies would be added here for full security)
