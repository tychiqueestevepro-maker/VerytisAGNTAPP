-- 019_extension_runner.sql
-- Adds the minimum metadata needed for the browser-extension runner queue.

alter table public.extension_actions
  add column if not exists campaign_id uuid references public.campaigns(id) on delete cascade,
  add column if not exists scheduled_at timestamp with time zone not null default now(),
  add column if not exists locked_until timestamp with time zone,
  add column if not exists attempt_count integer not null default 0 check (attempt_count >= 0),
  add column if not exists dedupe_key text;

create unique index if not exists idx_extension_actions_dedupe_key
  on public.extension_actions(dedupe_key)
  where dedupe_key is not null;

create index if not exists idx_extension_actions_campaign_id
  on public.extension_actions(campaign_id);

create index if not exists idx_extension_actions_ready_schedule
  on public.extension_actions(client_id, status, scheduled_at)
  where status = 'ready';

create index if not exists idx_extension_actions_locked_until
  on public.extension_actions(locked_until);
