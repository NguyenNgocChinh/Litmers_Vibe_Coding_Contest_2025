-- Team activities table for activity log
create table public.team_activities (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade not null,
  actor_id uuid references public.users(id) not null,
  action_type text not null, -- e.g., 'MEMBER_JOIN', 'MEMBER_LEAVE', 'MEMBER_KICK', 'ROLE_CHANGE', 'PROJECT_CREATE', 'PROJECT_DELETE', 'PROJECT_ARCHIVE', 'TEAM_UPDATE'
  target_type text, -- e.g., 'MEMBER', 'PROJECT', 'TEAM'
  target_id uuid, -- ID of the target (member_id, project_id, etc.)
  old_value text,
  new_value text,
  description text, -- Human-readable description
  created_at timestamptz default now()
);

create index idx_team_activities_team on public.team_activities(team_id);
create index idx_team_activities_actor on public.team_activities(actor_id);
create index idx_team_activities_created on public.team_activities(created_at desc);

alter table public.team_activities enable row level security;

-- Team members can view activities of their teams
create policy "Team members can view team activities"
  on public.team_activities for select
  using (
    exists (
      select 1 from public.team_members
      where team_members.team_id = team_activities.team_id
      and team_members.user_id = auth.uid()
    )
  );

-- System can insert activities (handled by backend)
create policy "System can insert team activities"
  on public.team_activities for insert
  with check (true);

