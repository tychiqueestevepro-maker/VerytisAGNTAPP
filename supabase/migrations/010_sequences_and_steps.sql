-- =============================================================================
-- 010_sequences_and_steps.sql
-- Create sequences and sequence_steps tables for campaign flows.
-- =============================================================================

begin;

-- 1. Create sequences table
create table if not exists public.sequences (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  name         text not null,
  description  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Trigger for sequences updated_at
drop trigger if exists update_sequences_updated_at on public.sequences;
create trigger update_sequences_updated_at
  before update on public.sequences
  for each row execute function public.update_updated_at();

-- Indexes for sequences
create index if not exists idx_sequences_client_id on public.sequences(client_id);

-- RLS for sequences
alter table public.sequences enable row level security;

drop policy if exists "Users can view their client sequences" on public.sequences;
create policy "Users can view their client sequences"
  on public.sequences for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.client_id = sequences.client_id
    )
  );

drop policy if exists "Users can update their client sequences" on public.sequences;
create policy "Users can update their client sequences"
  on public.sequences for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.client_id = sequences.client_id
    )
  );

drop policy if exists "Users can insert client sequences" on public.sequences;
create policy "Users can insert client sequences"
  on public.sequences for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.client_id = sequences.client_id
    )
  );


-- 2. Create sequence_steps table
create table if not exists public.sequence_steps (
  id                uuid primary key default gen_random_uuid(),
  sequence_id       uuid not null references public.sequences(id) on delete cascade,
  agent_id          uuid references public.agents(id) on delete set null,
  step_order        integer not null,
  name              text not null,
  action_type       text not null, -- 'trigger', 'action', 'wait', 'condition'
  description       text,
  config            jsonb not null default '{}'::jsonb,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(sequence_id, step_order)
);

-- Trigger for sequence_steps updated_at
drop trigger if exists update_sequence_steps_updated_at on public.sequence_steps;
create trigger update_sequence_steps_updated_at
  before update on public.sequence_steps
  for each row execute function public.update_updated_at();

-- Indexes for sequence_steps
create index if not exists idx_sequence_steps_sequence_id on public.sequence_steps(sequence_id);

-- RLS for sequence_steps
alter table public.sequence_steps enable row level security;

-- (Policies for sequence_steps are inherited via the sequence's client_id, but we need to join or assume if they can see sequence they can see steps)
-- For simplicity, since sequence_steps doesn't have client_id, we join with sequences
drop policy if exists "Users can view sequence steps" on public.sequence_steps;
create policy "Users can view sequence steps"
  on public.sequence_steps for select
  using (
    exists (
      select 1 from public.sequences s
      join public.profiles p on p.client_id = s.client_id
      where s.id = sequence_steps.sequence_id
        and p.id = auth.uid()
    )
  );

-- 3. Link client_flows to sequence_id
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'client_flows'
      and column_name = 'sequence_id'
  ) then
    alter table public.client_flows add column sequence_id uuid references public.sequences(id) on delete set null;
  end if;
end;
$$;

commit;
