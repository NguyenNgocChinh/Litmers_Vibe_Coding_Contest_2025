-- Notifications table
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  type text not null, -- 'ISSUE_ASSIGNED', 'COMMENT_ADDED', 'DUE_DATE_APPROACHING', 'DUE_DATE_TODAY', 'TEAM_INVITE', 'ROLE_CHANGED'
  title text not null,
  message text not null,
  related_entity_type text, -- 'ISSUE', 'TEAM', 'PROJECT'
  related_entity_id uuid,
  is_read boolean default false,
  created_at timestamptz default now()
);

create index idx_notifications_user on public.notifications(user_id);
create index idx_notifications_read on public.notifications(user_id, is_read);
create index idx_notifications_created on public.notifications(created_at desc);

alter table public.notifications enable row level security;

-- Users can view their own notifications
create policy "Users can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

-- Users can update their own notifications
create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

-- System can insert notifications (handled by backend)
create policy "System can insert notifications"
  on public.notifications for insert
  with check (true);

