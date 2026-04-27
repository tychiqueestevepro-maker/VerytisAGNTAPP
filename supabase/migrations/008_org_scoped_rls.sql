-- =============================================================================
-- 008_org_scoped_rls.sql
-- Applique le Row-Level Security (RLS) par organisation (client_id) à toutes
-- les tables. Un utilisateur ne voit et ne modifie QUE les données de son org.
-- Le service_role (agents backend) contourne le RLS nativement.
--
-- Pattern :
--   using (
--     client_id = (
--       select client_id from public.profiles
--       where id = auth.uid()
--     )
--   )
--
-- Ce sous-select est mis en cache par Postgres (CTE inlining) donc pas de
-- surcoût par ligne. Pour les tables sans client_id direct (ex: agents),
-- on expose une policy en lecture seule globale.
-- =============================================================================

begin;

-- Helper : renvoie le client_id de l'utilisateur courant.
-- Déclaré ici en security definer pour contourner le RLS de profiles lui-même.
create or replace function public.auth_client_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select client_id from public.profiles where id = auth.uid();
$$;

-- =============================================================================
-- 1. clients
-- =============================================================================
alter table public.clients enable row level security;

drop policy if exists "org: select clients"  on public.clients;
drop policy if exists "org: update clients"  on public.clients;

create policy "org: select clients"
  on public.clients for select
  using (id = public.auth_client_id());

create policy "org: update clients"
  on public.clients for update
  using (id = public.auth_client_id());

-- =============================================================================
-- 2. client_configs (unique par org)
-- =============================================================================
alter table public.client_configs enable row level security;

drop policy if exists "org: select client_configs"  on public.client_configs;
drop policy if exists "org: upsert client_configs"   on public.client_configs;

create policy "org: select client_configs"
  on public.client_configs for select
  using (client_id = public.auth_client_id());

create policy "org: upsert client_configs"
  on public.client_configs for all
  using      (client_id = public.auth_client_id())
  with check (client_id = public.auth_client_id());

-- =============================================================================
-- 3. client_flows (multi-campagnes par org)
-- =============================================================================
alter table public.client_flows enable row level security;

drop policy if exists "org: select client_flows"  on public.client_flows;
drop policy if exists "org: insert client_flows"  on public.client_flows;
drop policy if exists "org: update client_flows"  on public.client_flows;
drop policy if exists "org: delete client_flows"  on public.client_flows;
-- Drop legacy policies from 004
drop policy if exists "Users can view their client's flows"          on public.client_flows;
drop policy if exists "Owners and admins can update their client's flows" on public.client_flows;
drop policy if exists "Users can view their client flows"            on public.client_flows;
drop policy if exists "Users can update their client flows"          on public.client_flows;
drop policy if exists "Users can insert client flows"                on public.client_flows;

create policy "org: select client_flows"
  on public.client_flows for select
  using (client_id = public.auth_client_id());

create policy "org: insert client_flows"
  on public.client_flows for insert
  with check (client_id = public.auth_client_id());

create policy "org: update client_flows"
  on public.client_flows for update
  using      (client_id = public.auth_client_id())
  with check (client_id = public.auth_client_id());

create policy "org: delete client_flows"
  on public.client_flows for delete
  using (client_id = public.auth_client_id());

-- =============================================================================
-- 4. companies
-- =============================================================================
alter table public.companies enable row level security;

drop policy if exists "org: select companies" on public.companies;
drop policy if exists "org: all companies"    on public.companies;

create policy "org: all companies"
  on public.companies for all
  using      (client_id = public.auth_client_id())
  with check (client_id = public.auth_client_id());

-- =============================================================================
-- 5. prospects
-- =============================================================================
alter table public.prospects enable row level security;

drop policy if exists "org: all prospects" on public.prospects;

create policy "org: all prospects"
  on public.prospects for all
  using      (client_id = public.auth_client_id())
  with check (client_id = public.auth_client_id());

-- =============================================================================
-- 6. sources
-- =============================================================================
alter table public.sources enable row level security;

drop policy if exists "org: all sources" on public.sources;

create policy "org: all sources"
  on public.sources for all
  using      (client_id = public.auth_client_id())
  with check (client_id = public.auth_client_id());

-- =============================================================================
-- 7. messages
-- =============================================================================
alter table public.messages enable row level security;

drop policy if exists "org: all messages" on public.messages;

create policy "org: all messages"
  on public.messages for all
  using      (client_id = public.auth_client_id())
  with check (client_id = public.auth_client_id());

-- =============================================================================
-- 8. validations
-- =============================================================================
alter table public.validations enable row level security;

drop policy if exists "org: all validations" on public.validations;

create policy "org: all validations"
  on public.validations for all
  using      (client_id = public.auth_client_id())
  with check (client_id = public.auth_client_id());

-- =============================================================================
-- 9. agent_runs
-- =============================================================================
alter table public.agent_runs enable row level security;

drop policy if exists "org: select agent_runs" on public.agent_runs;

-- lecture seule pour les users (les agents écrivent en service_role)
create policy "org: select agent_runs"
  on public.agent_runs for select
  using (client_id = public.auth_client_id());

-- =============================================================================
-- 10. tasks
-- =============================================================================
alter table public.tasks enable row level security;

drop policy if exists "org: all tasks" on public.tasks;

create policy "org: all tasks"
  on public.tasks for all
  using      (client_id = public.auth_client_id())
  with check (client_id = public.auth_client_id());

-- =============================================================================
-- 11. integrations
-- =============================================================================
alter table public.integrations enable row level security;

drop policy if exists "org: all integrations" on public.integrations;

create policy "org: all integrations"
  on public.integrations for all
  using      (client_id = public.auth_client_id())
  with check (client_id = public.auth_client_id());

-- =============================================================================
-- 12. extension_actions
-- =============================================================================
alter table public.extension_actions enable row level security;

drop policy if exists "org: all extension_actions" on public.extension_actions;

create policy "org: all extension_actions"
  on public.extension_actions for all
  using      (client_id = public.auth_client_id())
  with check (client_id = public.auth_client_id());

-- =============================================================================
-- 13. conversations
-- =============================================================================
alter table public.conversations enable row level security;

drop policy if exists "org: all conversations" on public.conversations;

create policy "org: all conversations"
  on public.conversations for all
  using      (client_id = public.auth_client_id())
  with check (client_id = public.auth_client_id());

-- =============================================================================
-- 14. conversation_messages
-- =============================================================================
alter table public.conversation_messages enable row level security;

drop policy if exists "org: all conversation_messages" on public.conversation_messages;

create policy "org: all conversation_messages"
  on public.conversation_messages for all
  using      (client_id = public.auth_client_id())
  with check (client_id = public.auth_client_id());

-- =============================================================================
-- 15. audit_logs (lecture seule pour users)
-- =============================================================================
alter table public.audit_logs enable row level security;

drop policy if exists "org: select audit_logs" on public.audit_logs;

create policy "org: select audit_logs"
  on public.audit_logs for select
  using (client_id = public.auth_client_id());

-- =============================================================================
-- 16. cost_logs (lecture seule pour users)
-- =============================================================================
alter table public.cost_logs enable row level security;

drop policy if exists "org: select cost_logs" on public.cost_logs;

create policy "org: select cost_logs"
  on public.cost_logs for select
  using (client_id = public.auth_client_id());

-- =============================================================================
-- 17. daily_limits
-- =============================================================================
alter table public.daily_limits enable row level security;

drop policy if exists "org: select daily_limits" on public.daily_limits;

create policy "org: select daily_limits"
  on public.daily_limits for select
  using (client_id = public.auth_client_id());

-- =============================================================================
-- 18. agents — table globale (pas de client_id), lecture seule pour tous
-- =============================================================================
alter table public.agents enable row level security;

drop policy if exists "global: select active agents" on public.agents;

create policy "global: select active agents"
  on public.agents for select
  using (is_active = true);

-- =============================================================================
-- 19. profiles — chaque user voit/modifie UNIQUEMENT son propre profil
-- =============================================================================
-- (déjà en place dans 002, on s'assure juste qu'il n'y a pas de fuite)
drop policy if exists "Users can view their own profile"   on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;

create policy "Users can view their own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Users can update their own profile"
  on public.profiles for update
  using (id = auth.uid());

-- =============================================================================
-- 20. global_configs — lecture seule pour tous les users authentifiés
-- =============================================================================
alter table public.global_configs enable row level security;

drop policy if exists "authenticated: select global_configs" on public.global_configs;

create policy "authenticated: select global_configs"
  on public.global_configs for select
  using (auth.role() = 'authenticated');

commit;
