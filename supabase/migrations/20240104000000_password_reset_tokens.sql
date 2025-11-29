-- Password reset tokens table
create table public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  token text unique not null,
  expires_at timestamptz not null,
  used boolean default false,
  created_at timestamptz default now()
);

create index idx_password_reset_tokens_token on public.password_reset_tokens(token);
create index idx_password_reset_tokens_user on public.password_reset_tokens(user_id);

alter table public.password_reset_tokens enable row level security;

-- Only system can insert/update/delete password reset tokens
create policy "System can manage password reset tokens"
  on public.password_reset_tokens for all
  using (true)
  with check (true);

