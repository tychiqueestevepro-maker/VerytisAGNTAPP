-- =============================================================================
-- 007_multi_campaign_prospecting.sql
-- Support plusieurs campagnes de prospection par client (org).
-- La config ICP/targeting est stockée dans client_flows.config (JSONB)
-- au lieu de client_configs (qui reste globale et unique par client).
-- =============================================================================

begin;

-- 1. Supprimer la table client_flows si elle n'existe pas encore (idempotence).
--    Elle a été créée par 003_rename_agents_to_flows.sql (rename de client_agents).
--    On la crée ici avec tous les champs nécessaires si elle n'existe pas.
create table if not exists public.client_flows (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  flow_key     text not null,
  display_name text not null,
  description  text,
  status       text not null default 'setup_required'
    check (status in ('setup_required', 'active', 'paused', 'disabled')),
  route        text,
  config       jsonb not null default '{}'::jsonb,
  workflow_id  uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 2. Ajouter les colonnes manquantes si la table existait déjà (idempotence).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'client_flows'
      and column_name = 'display_name'
  ) then
    alter table public.client_flows add column display_name text not null default 'Campagne';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'client_flows'
      and column_name = 'route'
  ) then
    alter table public.client_flows add column route text;
  end if;
end;
$$;

-- 3. Trigger updated_at sur client_flows
drop trigger if exists update_client_flows_updated_at on public.client_flows;
create trigger update_client_flows_updated_at
  before update on public.client_flows
  for each row execute function public.update_updated_at();

-- 4. Index utiles
create index if not exists idx_client_flows_client_id        on public.client_flows(client_id);
create index if not exists idx_client_flows_flow_key         on public.client_flows(flow_key);
create index if not exists idx_client_flows_client_flow_key  on public.client_flows(client_id, flow_key);
create index if not exists idx_client_flows_status           on public.client_flows(status);
create index if not exists idx_client_flows_config_gin       on public.client_flows using gin(config);

-- 5. RLS
alter table public.client_flows enable row level security;

-- Policy : un utilisateur peut voir les flows de son client
drop policy if exists "Users can view their client flows" on public.client_flows;
create policy "Users can view their client flows"
  on public.client_flows for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.client_id = client_flows.client_id
    )
  );

-- Policy : un utilisateur peut modifier les flows de son client
drop policy if exists "Users can update their client flows" on public.client_flows;
create policy "Users can update their client flows"
  on public.client_flows for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.client_id = client_flows.client_id
    )
  );

-- Policy : un utilisateur peut créer des flows pour son client
drop policy if exists "Users can insert client flows" on public.client_flows;
create policy "Users can insert client flows"
  on public.client_flows for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.client_id = client_flows.client_id
    )
  );

-- 6. Lier les prospects à une campagne spécifique (optionnel, non breaking)
--    On ajoute une FK nullable vers client_flows.id
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'prospects'
      and column_name = 'flow_id'
  ) then
    alter table public.prospects
      add column flow_id uuid references public.client_flows(id) on delete set null;

    create index if not exists idx_prospects_flow_id on public.prospects(flow_id);
  end if;
end;
$$;

-- 7. Commentaires
comment on table public.client_flows is 
  'Flows/campagnes activés pour le client. Plusieurs campagnes de type "prospecting" peuvent coexister par client. La config spécifique (ICP, secteurs, personas, volume, heure) est stockée dans la colonne config (JSONB). client_configs reste pour les réglages globaux (tone, offer_type) non liés à une campagne précise.';

comment on column public.client_flows.config is
  E'Configuration JSONB de la campagne.\n'
  'Exemple pour une campagne de prospection:\n'
  '{\n'
  '  "target_icp": { "sectors": ["SaaS B2B", "Fintech"], "company_size": ["PME", "ETI"], "locations": ["France", "Belgique"] },\n'
  '  "personas": ["CEO", "VP Sales"],\n'
  '  "tone": "Professionnel et direct",\n'
  '  "prospection": { "mode": "auto", "prospects_per_day": 20, "search_time": "09:00", "sector": "Avocats", "location": "Lyon", "decision_maker": "Associé" },\n'
  '  "injection": { "auto_add": true, "ignore_duplicates": true, "prioritize_linkedin": true }\n'
  '}';

commit;
