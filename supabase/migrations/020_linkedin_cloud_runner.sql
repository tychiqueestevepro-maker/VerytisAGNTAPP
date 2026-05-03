-- Adds cloud-runner metadata for LinkedIn sequence execution.
-- The runner is intentionally separate from the local Chrome extension:
-- extension_actions remains the queue table, while runner_type decides who executes.

alter table public.extension_actions
  add column if not exists runner_type text not null default 'cloud'
    check (runner_type in ('extension', 'cloud')),
  add column if not exists runner_last_heartbeat_at timestamp with time zone;

create index if not exists idx_extension_actions_cloud_ready
  on public.extension_actions(client_id, status, scheduled_at)
  where runner_type = 'cloud' and status = 'ready';

create table if not exists public.linkedin_cloud_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  integration_id uuid references public.integrations(id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'expired', 'error', 'revoked')),
  storage_state_ciphertext text not null,
  storage_state_iv text not null,
  storage_state_tag text not null,
  linkedin_account_name text,
  linkedin_account_url text,
  last_verified_at timestamp with time zone,
  error_message text,
  extra_data jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (client_id)
);

comment on table public.linkedin_cloud_sessions is 'Encrypted Playwright storage states used by the cloud LinkedIn runner.';

create index if not exists idx_linkedin_cloud_sessions_client_status
  on public.linkedin_cloud_sessions(client_id, status);

alter table public.linkedin_cloud_sessions enable row level security;

drop policy if exists "org: all linkedin_cloud_sessions" on public.linkedin_cloud_sessions;

create policy "org: all linkedin_cloud_sessions"
  on public.linkedin_cloud_sessions for all
  using      (client_id = public.auth_client_id())
  with check (client_id = public.auth_client_id());
