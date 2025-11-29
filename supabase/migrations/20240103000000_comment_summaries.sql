-- Comment Summaries Cache Table
create table if not exists public.comment_summaries (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid references public.issues(id) on delete cascade not null unique,
  summary text not null,
  key_decisions jsonb default '[]'::jsonb,
  comment_count integer not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- AI Issue Summaries and Suggestions Cache Table
create table if not exists public.ai_issue_cache (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid references public.issues(id) on delete cascade not null,
  cache_type text not null, -- 'summary' or 'suggestion'
  content text not null,
  description_hash text not null, -- hash of description to detect changes
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(issue_id, cache_type)
);

-- Indexes for faster lookups
create index idx_comment_summaries_issue on public.comment_summaries(issue_id);
create index idx_ai_issue_cache_issue on public.ai_issue_cache(issue_id);

-- RLS Policies
alter table public.comment_summaries enable row level security;

-- Team members can view comment summaries
create policy "Team members can view comment summaries"
  on public.comment_summaries for select
  using (
    exists (
      select 1 from public.issues i
      join public.projects p on p.id = i.project_id
      join public.team_members tm on tm.team_id = p.team_id
      where i.id = comment_summaries.issue_id
      and tm.user_id = auth.uid()
    )
  );

-- Team members can manage comment summaries (for cache updates)
create policy "Team members can manage comment summaries"
  on public.comment_summaries for all
  using (
    exists (
      select 1 from public.issues i
      join public.projects p on p.id = i.project_id
      join public.team_members tm on tm.team_id = p.team_id
      where i.id = comment_summaries.issue_id
      and tm.user_id = auth.uid()
    )
  );

-- ============================================
-- AI ISSUE CACHE TABLE POLICIES
-- ============================================

alter table public.ai_issue_cache enable row level security;

-- Team members can view AI cache
create policy "Team members can view AI cache"
  on public.ai_issue_cache for select
  using (
    exists (
      select 1 from public.issues i
      join public.projects p on p.id = i.project_id
      join public.team_members tm on tm.team_id = p.team_id
      where i.id = ai_issue_cache.issue_id
      and tm.user_id = auth.uid()
    )
  );

-- Team members can manage AI cache (for cache updates)
create policy "Team members can manage AI cache"
  on public.ai_issue_cache for all
  using (
    exists (
      select 1 from public.issues i
      join public.projects p on p.id = i.project_id
      join public.team_members tm on tm.team_id = p.team_id
      where i.id = ai_issue_cache.issue_id
      and tm.user_id = auth.uid()
    )
  );

