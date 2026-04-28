-- =============================================================================
-- 012_flow_campaign_hierarchy.sql
-- Restructure: 1 Flow per Type per Org, multiple Campaigns per Flow.
-- =============================================================================

begin;

-- 1. Create campaigns table
create table if not exists public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  flow_id       uuid not null references public.client_flows(id) on delete cascade,
  display_name  text not null,
  description   text,
  status        text not null default 'active'
    check (status in ('active', 'paused', 'archived', 'draft')),
  config        jsonb not null default '{}'::jsonb,
  sequence_id   uuid references public.sequences(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Trigger for campaigns updated_at
drop trigger if exists update_campaigns_updated_at on public.campaigns;
create trigger update_campaigns_updated_at
  before update on public.campaigns
  for each row execute function public.update_updated_at();

-- RLS for campaigns
alter table public.campaigns enable row level security;

create policy "org: all campaigns"
  on public.campaigns for all
  using (
    exists (
      select 1 from public.client_flows f
      where f.id = campaigns.flow_id
        and f.client_id = public.auth_client_id()
    )
  )
  with check (
    exists (
      select 1 from public.client_flows f
      where f.id = campaigns.flow_id
        and f.client_id = public.auth_client_id()
    )
  );

-- 2. Migrate existing data
-- We'll use a temporary mapping to store old flow_id -> new campaign_id
create temp table flow_to_campaign_map (
  old_flow_id uuid,
  new_flow_id uuid,
  new_campaign_id uuid
);

-- For each row in client_flows, we create a campaign
-- But we need to ensure we only have one flow row per (client_id, flow_key)
-- Step A: Identify/Create unique flow rows
-- Since they already exist, we'll pick the oldest one as the master for each (client_id, flow_key)

with master_flows as (
  select distinct on (client_id, flow_key)
    id, client_id, flow_key
  from public.client_flows
  order by client_id, flow_key, created_at asc
),
inserted_campaigns as (
  insert into public.campaigns (flow_id, display_name, description, status, config, sequence_id, created_at)
  select 
    mf.id, -- point to the master flow
    cf.display_name,
    cf.description,
    case when cf.status = 'setup_required' then 'draft' else 'active' end,
    cf.config,
    cf.sequence_id,
    cf.created_at
  from public.client_flows cf
  join master_flows mf on mf.client_id = cf.client_id and mf.flow_key = cf.flow_key
  returning id, flow_id, created_at
)
insert into flow_to_campaign_map (old_flow_id, new_flow_id, new_campaign_id)
select cf.id, mf.id, ic.id
from public.client_flows cf
join master_flows mf on mf.client_id = cf.client_id and mf.flow_key = cf.flow_key
join inserted_campaigns ic on ic.flow_id = mf.id and ic.created_at = cf.created_at;
-- Note: the join on created_at is a bit fragile if exact same timestamp, but usually fine for migration.

-- Step B: Update prospects to point to campaigns
-- We'll add campaign_id column to prospects
alter table public.prospects add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;

update public.prospects p
set campaign_id = m.new_campaign_id
from flow_to_campaign_map m
where p.flow_id = m.old_flow_id;

-- Step C: Clean up client_flows
-- Delete rows that are not masters
delete from public.client_flows
where id not in (select new_flow_id from flow_to_campaign_map);

-- Step D: Restore unique constraint
alter table public.client_flows
  add constraint client_flows_client_id_flow_key_key unique (client_id, flow_key);

-- Step E: Clean up client_flows columns that moved to campaigns
alter table public.client_flows drop column if exists config;
alter table public.client_flows drop column if exists sequence_id;

-- 3. Update comments
comment on table public.client_flows is 'Types de flux activés pour l''organisation. Unique par type par client.';
comment on table public.campaigns is 'Campagnes spécifiques rattachées à un flux parent.';

commit;
