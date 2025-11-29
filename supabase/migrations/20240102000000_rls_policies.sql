-- RLS Policies for Litmers Project Management System
-- This migration adds comprehensive Row Level Security policies

-- Drop existing policies first (from initial migration)
drop policy if exists "Users can view teams they belong to" on public.teams;

-- ============================================
-- USERS TABLE POLICIES
-- ============================================

-- Users can view their own profile
create policy "Users can view own profile"
  on public.users for select
  using (auth.uid() = id);

-- Users can update their own profile
create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

-- ============================================
-- TEAMS TABLE POLICIES
-- ============================================

-- Users can view teams they are members of
create policy "Users can view teams they belong to"
  on public.teams for select
  using (
    exists (
      select 1 from public.team_members
      where team_members.team_id = teams.id
      and team_members.user_id = auth.uid()
    )
  );

-- Users can create teams (they become owner)
create policy "Users can create teams"
  on public.teams for insert
  with check (auth.uid() = owner_id);

-- Only owners can update teams
create policy "Owners can update teams"
  on public.teams for update
  using (
    exists (
      select 1 from public.team_members
      where team_members.team_id = teams.id
      and team_members.user_id = auth.uid()
      and team_members.role = 'OWNER'
    )
  );

-- Only owners can delete teams
create policy "Owners can delete teams"
  on public.teams for delete
  using (
    exists (
      select 1 from public.team_members
      where team_members.team_id = teams.id
      and team_members.user_id = auth.uid()
      and team_members.role = 'OWNER'
    )
  );

-- ============================================
-- TEAM_MEMBERS TABLE POLICIES
-- ============================================

-- Team members can view other members in their teams
create policy "Team members can view team members"
  on public.team_members for select
  using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = team_members.team_id
      and tm.user_id = auth.uid()
    )
  );

-- Owners and admins can add members
create policy "Owners and admins can add members"
  on public.team_members for insert
  with check (
    exists (
      select 1 from public.team_members
      where team_members.team_id = team_id
      and team_members.user_id = auth.uid()
      and team_members.role in ('OWNER', 'ADMIN')
    )
  );

-- Owners and admins can remove members (except themselves)
create policy "Owners and admins can remove members"
  on public.team_members for delete
  using (
    team_members.user_id != auth.uid() -- Cannot remove self
    and exists (
      select 1 from public.team_members tm
      where tm.team_id = team_members.team_id
      and tm.user_id = auth.uid()
      and tm.role in ('OWNER', 'ADMIN')
    )
  );

-- Owners can update member roles
create policy "Owners can update member roles"
  on public.team_members for update
  using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = team_members.team_id
      and tm.user_id = auth.uid()
      and tm.role = 'OWNER'
    )
  );

-- ============================================
-- PROJECTS TABLE POLICIES
-- ============================================

-- Team members can view projects in their teams
create policy "Team members can view projects"
  on public.projects for select
  using (
    exists (
      select 1 from public.team_members
      where team_members.team_id = projects.team_id
      and team_members.user_id = auth.uid()
    )
  );

-- Team members can create projects in their teams
create policy "Team members can create projects"
  on public.projects for insert
  with check (
    exists (
      select 1 from public.team_members
      where team_members.team_id = team_id
      and team_members.user_id = auth.uid()
    )
  );

-- Project owners and team owners/admins can update projects
create policy "Owners and admins can update projects"
  on public.projects for update
  using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.team_members
      where team_members.team_id = projects.team_id
      and team_members.user_id = auth.uid()
      and team_members.role in ('OWNER', 'ADMIN')
    )
  );

-- Project owners and team owners can delete projects
create policy "Owners can delete projects"
  on public.projects for delete
  using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.team_members
      where team_members.team_id = projects.team_id
      and team_members.user_id = auth.uid()
      and team_members.role = 'OWNER'
    )
  );

-- ============================================
-- ISSUES TABLE POLICIES
-- ============================================

-- Team members can view issues in their team's projects
create policy "Team members can view issues"
  on public.issues for select
  using (
    exists (
      select 1 from public.projects p
      join public.team_members tm on tm.team_id = p.team_id
      where p.id = issues.project_id
      and tm.user_id = auth.uid()
    )
  );

-- Team members can create issues in their team's projects
create policy "Team members can create issues"
  on public.issues for insert
  with check (
    exists (
      select 1 from public.projects p
      join public.team_members tm on tm.team_id = p.team_id
      where p.id = project_id
      and tm.user_id = auth.uid()
    )
  );

-- Team members can update issues in their team's projects
create policy "Team members can update issues"
  on public.issues for update
  using (
    exists (
      select 1 from public.projects p
      join public.team_members tm on tm.team_id = p.team_id
      where p.id = issues.project_id
      and tm.user_id = auth.uid()
    )
  );

-- Team members can delete issues in their team's projects
create policy "Team members can delete issues"
  on public.issues for delete
  using (
    exists (
      select 1 from public.projects p
      join public.team_members tm on tm.team_id = p.team_id
      where p.id = issues.project_id
      and tm.user_id = auth.uid()
    )
  );

-- ============================================
-- SUBTASKS TABLE POLICIES
-- ============================================

alter table public.subtasks enable row level security;

-- Team members can view subtasks
create policy "Team members can view subtasks"
  on public.subtasks for select
  using (
    exists (
      select 1 from public.issues i
      join public.projects p on p.id = i.project_id
      join public.team_members tm on tm.team_id = p.team_id
      where i.id = subtasks.issue_id
      and tm.user_id = auth.uid()
    )
  );

-- Team members can create subtasks
create policy "Team members can create subtasks"
  on public.subtasks for insert
  with check (
    exists (
      select 1 from public.issues i
      join public.projects p on p.id = i.project_id
      join public.team_members tm on tm.team_id = p.team_id
      where i.id = issue_id
      and tm.user_id = auth.uid()
    )
  );

-- Team members can update subtasks
create policy "Team members can update subtasks"
  on public.subtasks for update
  using (
    exists (
      select 1 from public.issues i
      join public.projects p on p.id = i.project_id
      join public.team_members tm on tm.team_id = p.team_id
      where i.id = subtasks.issue_id
      and tm.user_id = auth.uid()
    )
  );

-- Team members can delete subtasks
create policy "Team members can delete subtasks"
  on public.subtasks for delete
  using (
    exists (
      select 1 from public.issues i
      join public.projects p on p.id = i.project_id
      join public.team_members tm on tm.team_id = p.team_id
      where i.id = subtasks.issue_id
      and tm.user_id = auth.uid()
    )
  );

-- ============================================
-- COMMENTS TABLE POLICIES
-- ============================================

-- Team members can view comments
create policy "Team members can view comments"
  on public.comments for select
  using (
    exists (
      select 1 from public.issues i
      join public.projects p on p.id = i.project_id
      join public.team_members tm on tm.team_id = p.team_id
      where i.id = comments.issue_id
      and tm.user_id = auth.uid()
    )
  );

-- Team members can create comments
create policy "Team members can create comments"
  on public.comments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.issues i
      join public.projects p on p.id = i.project_id
      join public.team_members tm on tm.team_id = p.team_id
      where i.id = issue_id
      and tm.user_id = auth.uid()
    )
  );

-- Users can update their own comments
create policy "Users can update own comments"
  on public.comments for update
  using (auth.uid() = user_id);

-- Users can delete their own comments
create policy "Users can delete own comments"
  on public.comments for delete
  using (auth.uid() = user_id);

-- ============================================
-- LABELS TABLE POLICIES
-- ============================================

alter table public.labels enable row level security;

-- Team members can view labels
create policy "Team members can view labels"
  on public.labels for select
  using (
    exists (
      select 1 from public.projects p
      join public.team_members tm on tm.team_id = p.team_id
      where p.id = labels.project_id
      and tm.user_id = auth.uid()
    )
  );

-- Team members can create labels
create policy "Team members can create labels"
  on public.labels for insert
  with check (
    exists (
      select 1 from public.projects p
      join public.team_members tm on tm.team_id = p.team_id
      where p.id = project_id
      and tm.user_id = auth.uid()
    )
  );

-- Team members can update labels
create policy "Team members can update labels"
  on public.labels for update
  using (
    exists (
      select 1 from public.projects p
      join public.team_members tm on tm.team_id = p.team_id
      where p.id = labels.project_id
      and tm.user_id = auth.uid()
    )
  );

-- Team members can delete labels
create policy "Team members can delete labels"
  on public.labels for delete
  using (
    exists (
      select 1 from public.projects p
      join public.team_members tm on tm.team_id = p.team_id
      where p.id = labels.project_id
      and tm.user_id = auth.uid()
    )
  );

-- ============================================
-- ISSUE_LABELS TABLE POLICIES
-- ============================================

alter table public.issue_labels enable row level security;

-- Team members can view issue labels
create policy "Team members can view issue labels"
  on public.issue_labels for select
  using (
    exists (
      select 1 from public.issues i
      join public.projects p on p.id = i.project_id
      join public.team_members tm on tm.team_id = p.team_id
      where i.id = issue_labels.issue_id
      and tm.user_id = auth.uid()
    )
  );

-- Team members can manage issue labels
create policy "Team members can manage issue labels"
  on public.issue_labels for all
  using (
    exists (
      select 1 from public.issues i
      join public.projects p on p.id = i.project_id
      join public.team_members tm on tm.team_id = p.team_id
      where i.id = issue_labels.issue_id
      and tm.user_id = auth.uid()
    )
  );

-- ============================================
-- PROJECT_FAVORITES TABLE POLICIES
-- ============================================

alter table public.project_favorites enable row level security;

-- Users can view their own favorites
create policy "Users can view own favorites"
  on public.project_favorites for select
  using (auth.uid() = user_id);

-- Users can add their own favorites
create policy "Users can add own favorites"
  on public.project_favorites for insert
  with check (auth.uid() = user_id);

-- Users can remove their own favorites
create policy "Users can remove own favorites"
  on public.project_favorites for delete
  using (auth.uid() = user_id);

-- ============================================
-- PROJECT_STATUSES TABLE POLICIES
-- ============================================

alter table public.project_statuses enable row level security;

-- Team members can view project statuses
create policy "Team members can view project statuses"
  on public.project_statuses for select
  using (
    exists (
      select 1 from public.projects p
      join public.team_members tm on tm.team_id = p.team_id
      where p.id = project_statuses.project_id
      and tm.user_id = auth.uid()
    )
  );

-- Team members can manage project statuses
create policy "Team members can manage project statuses"
  on public.project_statuses for all
  using (
    exists (
      select 1 from public.projects p
      join public.team_members tm on tm.team_id = p.team_id
      where p.id = project_statuses.project_id
      and tm.user_id = auth.uid()
    )
  );

-- ============================================
-- ISSUE_ACTIVITIES TABLE POLICIES
-- ============================================

alter table public.issue_activities enable row level security;

-- Team members can view issue activities
create policy "Team members can view issue activities"
  on public.issue_activities for select
  using (
    exists (
      select 1 from public.issues i
      join public.projects p on p.id = i.project_id
      join public.team_members tm on tm.team_id = p.team_id
      where i.id = issue_activities.issue_id
      and tm.user_id = auth.uid()
    )
  );

-- System can insert activities (handled by backend)
create policy "System can insert issue activities"
  on public.issue_activities for insert
  with check (true);
