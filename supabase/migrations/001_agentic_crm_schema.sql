-- Agentic CRM schema for Supabase/PostgreSQL.
-- Directly executable in the Supabase SQL editor.

begin;

create extension if not exists pgcrypto;

-- Shared timestamp trigger.
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Root tenant table.
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_name text,
  industry text,
  website text,
  main_contact_name text,
  main_contact_email text,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.clients is 'Clients tenants du CRM agentique. Chaque donnée métier est rattachée à un client.';

create table if not exists public.client_configs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  target_icp jsonb not null default '{}'::jsonb,
  excluded_sectors text[] not null default '{}',
  min_fit_score integer not null default 70 check (min_fit_score between 0 and 100),
  linkedin_required boolean not null default true,
  required_fields text[] not null default '{}',
  tone text,
  offer_type text,
  message_style text,
  crm_mapping jsonb not null default '{}'::jsonb,
  agent_rules jsonb not null default '{}'::jsonb,
  extra_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id)
);

comment on table public.client_configs is 'Configuration personnalisée du client lue par les agents avant exécution.';

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  website text,
  linkedin_url text,
  industry text,
  location text,
  size_range text,
  revenue_range text,
  description text,
  source text,
  confidence_score numeric(5,2) check (confidence_score between 0 and 100),
  extra_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.companies is 'Entreprises détectées, qualifiées ou enrichies par les agents.';

create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  company_name text,
  website text,
  linkedin_url text,
  decision_maker text,
  role text,
  email text,
  phone text,
  location text,
  fit_score integer check (fit_score between 0 and 100),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'discovered'
    check (status in (
      'discovered',
      'qualified',
      'rejected',
      'enriched',
      'blocked_no_linkedin',
      'message_ready',
      'qa_validated',
      'waiting_whatsapp_validation',
      'approved',
      'rejected_by_user',
      'contact_ready',
      'contacted',
      'replied',
      'not_interested',
      'converted'
    )),
  source text,
  source_url text,
  qualification_reason text,
  recommended_offer text,
  confidence_score numeric(5,2) check (confidence_score between 0 and 100),
  extra_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.prospects is 'Prospects suivis par le pipeline multi-agents.';

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  prospect_id uuid references public.prospects(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  source_type text not null,
  source_name text,
  source_url text,
  raw_data jsonb not null default '{}'::jsonb,
  extracted_data jsonb not null default '{}'::jsonb,
  confidence_score numeric(5,2) check (confidence_score between 0 and 100),
  created_at timestamptz not null default now(),
  check (prospect_id is not null or company_id is not null)
);

comment on table public.sources is 'Traçabilité des sources utilisées pour découvrir ou enrichir les données.';

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique
    check (slug in (
      'orchestrator',
      'hunter',
      'qualifier',
      'enrichment',
      'copywriter',
      'qa',
      'whatsapp_validation',
      'extension_ops'
    )),
  role text not null,
  description text,
  system_prompt text,
  model_provider text,
  model_name text,
  temperature numeric(3,2) not null default 0.20 check (temperature between 0 and 2),
  is_active boolean not null default true,
  default_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.agents is 'Catalogue global des agents IA disponibles pour le système.';

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  channel text not null check (channel in ('email', 'linkedin', 'whatsapp', 'phone', 'crm', 'other')),
  message_type text not null default 'outreach'
    check (message_type in ('outreach', 'follow_up', 'reply', 'validation', 'internal_note')),
  subject text,
  body text not null,
  angle text,
  tone text,
  cta text,
  status text not null default 'draft'
    check (status in (
      'draft',
      'qa_pending',
      'qa_rejected',
      'ready_for_validation',
      'approved',
      'rejected',
      'ready_to_send',
      'sent',
      'replied'
    )),
  version integer not null default 1 check (version >= 1),
  generated_by_agent_run_id uuid,
  approved_at timestamptz,
  sent_at timestamptz,
  extra_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.messages is 'Messages générés, validés et envoyés aux prospects.';

create table if not exists public.validations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  validation_channel text not null check (validation_channel in ('app', 'whatsapp', 'email', 'crm')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'modification_requested')),
  feedback text,
  validated_by text,
  validated_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.validations is 'Demandes et résultats de validation humaine des messages ou prospects.';

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete restrict,
  prospect_id uuid references public.prospects(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  run_type text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  token_input integer not null default 0 check (token_input >= 0),
  token_output integer not null default 0 check (token_output >= 0),
  cost_estimate numeric(12,6) not null default 0 check (cost_estimate >= 0),
  created_at timestamptz not null default now()
);

comment on table public.agent_runs is 'Historique d’exécution des agents, avec entrées, sorties, coûts et erreurs.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messages_generated_by_agent_run_id_fkey'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_generated_by_agent_run_id_fkey
      foreign key (generated_by_agent_run_id)
      references public.agent_runs(id)
      on delete set null;
  end if;
end;
$$;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  prospect_id uuid references public.prospects(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  assigned_agent_id uuid references public.agents(id) on delete set null,
  task_type text not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tasks is 'File de tâches planifiées ou exécutées par les agents.';

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  integration_type text not null
    check (integration_type in (
      'hubspot',
      'pipedrive',
      'notion',
      'airtable',
      'google_sheets',
      'whatsapp',
      'chrome_extension',
      'email_provider'
    )),
  name text not null,
  status text not null default 'pending'
    check (status in ('pending', 'connected', 'disconnected', 'error', 'paused')),
  credentials_ref text,
  mapping_config jsonb not null default '{}'::jsonb,
  sync_config jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  extra_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.integrations is 'Connexions client vers CRM, messagerie, feuilles et extension Chrome.';

create table if not exists public.extension_actions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  prospect_id uuid references public.prospects(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  action_type text not null,
  linkedin_url text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'completed', 'failed', 'cancelled')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.extension_actions is 'Actions confiées à l’extension navigateur, notamment LinkedIn.';

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  channel text not null check (channel in ('email', 'linkedin', 'whatsapp', 'phone', 'crm', 'other')),
  external_thread_id text,
  status text not null default 'open'
    check (status in ('open', 'waiting', 'closed', 'converted', 'archived')),
  last_message_at timestamptz,
  summary text,
  extra_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.conversations is 'Conversations suivies par prospect et par canal.';

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  channel text not null check (channel in ('email', 'linkedin', 'whatsapp', 'phone', 'crm', 'other')),
  body text not null,
  external_message_id text,
  sent_at timestamptz,
  received_at timestamptz,
  extra_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.conversation_messages is 'Messages entrants et sortants rattachés aux conversations.';

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  actor_type text not null check (actor_type in ('user', 'agent', 'system', 'integration')),
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is 'Journal d’audit des modifications importantes et décisions agentiques.';

create table if not exists public.cost_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  provider text not null,
  model text not null,
  token_input integer not null default 0 check (token_input >= 0),
  token_output integer not null default 0 check (token_output >= 0),
  cost numeric(12,6) not null default 0 check (cost >= 0),
  currency text not null default 'USD',
  created_at timestamptz not null default now()
);

comment on table public.cost_logs is 'Coûts IA par exécution, fournisseur et modèle.';

create table if not exists public.daily_limits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete cascade,
  limit_type text not null check (limit_type in ('cost', 'tokens', 'prospects', 'messages', 'extension_actions', 'agent_runs')),
  limit_value integer not null check (limit_value >= 0),
  current_value integer not null default 0 check (current_value >= 0),
  reset_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, agent_id, limit_type)
);

comment on table public.daily_limits is 'Limites quotidiennes de coûts, volumes et actions par client ou agent.';

-- updated_at triggers.
drop trigger if exists update_clients_updated_at on public.clients;
create trigger update_clients_updated_at
before update on public.clients
for each row execute function public.update_updated_at();

drop trigger if exists update_client_configs_updated_at on public.client_configs;
create trigger update_client_configs_updated_at
before update on public.client_configs
for each row execute function public.update_updated_at();

drop trigger if exists update_companies_updated_at on public.companies;
create trigger update_companies_updated_at
before update on public.companies
for each row execute function public.update_updated_at();

drop trigger if exists update_prospects_updated_at on public.prospects;
create trigger update_prospects_updated_at
before update on public.prospects
for each row execute function public.update_updated_at();

drop trigger if exists update_agents_updated_at on public.agents;
create trigger update_agents_updated_at
before update on public.agents
for each row execute function public.update_updated_at();

drop trigger if exists update_messages_updated_at on public.messages;
create trigger update_messages_updated_at
before update on public.messages
for each row execute function public.update_updated_at();

drop trigger if exists update_tasks_updated_at on public.tasks;
create trigger update_tasks_updated_at
before update on public.tasks
for each row execute function public.update_updated_at();

drop trigger if exists update_integrations_updated_at on public.integrations;
create trigger update_integrations_updated_at
before update on public.integrations
for each row execute function public.update_updated_at();

drop trigger if exists update_extension_actions_updated_at on public.extension_actions;
create trigger update_extension_actions_updated_at
before update on public.extension_actions
for each row execute function public.update_updated_at();

drop trigger if exists update_conversations_updated_at on public.conversations;
create trigger update_conversations_updated_at
before update on public.conversations
for each row execute function public.update_updated_at();

drop trigger if exists update_daily_limits_updated_at on public.daily_limits;
create trigger update_daily_limits_updated_at
before update on public.daily_limits
for each row execute function public.update_updated_at();

-- Useful indexes.
create index if not exists idx_client_configs_client_id on public.client_configs(client_id);

create index if not exists idx_companies_client_id on public.companies(client_id);
create index if not exists idx_companies_client_name on public.companies(client_id, name);
create index if not exists idx_companies_client_website on public.companies(client_id, website);

create index if not exists idx_prospects_client_id on public.prospects(client_id);
create index if not exists idx_prospects_company_id on public.prospects(company_id);
create index if not exists idx_prospects_status on public.prospects(status);
create index if not exists idx_prospects_client_status on public.prospects(client_id, status);
create index if not exists idx_prospects_client_priority on public.prospects(client_id, priority);
create index if not exists idx_prospects_email on public.prospects(email);

create index if not exists idx_sources_client_id on public.sources(client_id);
create index if not exists idx_sources_prospect_id on public.sources(prospect_id);
create index if not exists idx_sources_company_id on public.sources(company_id);

create index if not exists idx_messages_client_id on public.messages(client_id);
create index if not exists idx_messages_prospect_id on public.messages(prospect_id);
create index if not exists idx_messages_status on public.messages(status);
create index if not exists idx_messages_generated_by_agent_run_id on public.messages(generated_by_agent_run_id);

create index if not exists idx_validations_client_id on public.validations(client_id);
create index if not exists idx_validations_prospect_id on public.validations(prospect_id);
create index if not exists idx_validations_message_id on public.validations(message_id);
create index if not exists idx_validations_status on public.validations(status);

create index if not exists idx_agents_slug on public.agents(slug);
create index if not exists idx_agents_is_active on public.agents(is_active);

create index if not exists idx_agent_runs_client_id on public.agent_runs(client_id);
create index if not exists idx_agent_runs_agent_id on public.agent_runs(agent_id);
create index if not exists idx_agent_runs_prospect_id on public.agent_runs(prospect_id);
create index if not exists idx_agent_runs_company_id on public.agent_runs(company_id);
create index if not exists idx_agent_runs_message_id on public.agent_runs(message_id);
create index if not exists idx_agent_runs_status on public.agent_runs(status);
create index if not exists idx_agent_runs_created_at on public.agent_runs(created_at desc);

create index if not exists idx_tasks_client_id on public.tasks(client_id);
create index if not exists idx_tasks_prospect_id on public.tasks(prospect_id);
create index if not exists idx_tasks_company_id on public.tasks(company_id);
create index if not exists idx_tasks_message_id on public.tasks(message_id);
create index if not exists idx_tasks_assigned_agent_id on public.tasks(assigned_agent_id);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_scheduled_at on public.tasks(scheduled_at);

create index if not exists idx_integrations_client_id on public.integrations(client_id);
create index if not exists idx_integrations_status on public.integrations(status);
create index if not exists idx_integrations_type on public.integrations(integration_type);

create index if not exists idx_extension_actions_client_id on public.extension_actions(client_id);
create index if not exists idx_extension_actions_prospect_id on public.extension_actions(prospect_id);
create index if not exists idx_extension_actions_message_id on public.extension_actions(message_id);
create index if not exists idx_extension_actions_status on public.extension_actions(status);

create index if not exists idx_conversations_client_id on public.conversations(client_id);
create index if not exists idx_conversations_prospect_id on public.conversations(prospect_id);
create index if not exists idx_conversations_status on public.conversations(status);
create index if not exists idx_conversations_last_message_at on public.conversations(last_message_at desc);

create index if not exists idx_conversation_messages_client_id on public.conversation_messages(client_id);
create index if not exists idx_conversation_messages_conversation_id on public.conversation_messages(conversation_id);
create index if not exists idx_conversation_messages_prospect_id on public.conversation_messages(prospect_id);
create index if not exists idx_conversation_messages_direction on public.conversation_messages(direction);

create index if not exists idx_audit_logs_client_id on public.audit_logs(client_id);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);

create index if not exists idx_cost_logs_client_id on public.cost_logs(client_id);
create index if not exists idx_cost_logs_agent_run_id on public.cost_logs(agent_run_id);
create index if not exists idx_cost_logs_created_at on public.cost_logs(created_at desc);

create index if not exists idx_daily_limits_client_id on public.daily_limits(client_id);
create index if not exists idx_daily_limits_agent_id on public.daily_limits(agent_id);
create index if not exists idx_daily_limits_reset_at on public.daily_limits(reset_at);

-- JSONB indexes for flexible agent data.
create index if not exists idx_client_configs_agent_rules_gin on public.client_configs using gin(agent_rules);
create index if not exists idx_companies_extra_data_gin on public.companies using gin(extra_data);
create index if not exists idx_prospects_extra_data_gin on public.prospects using gin(extra_data);
create index if not exists idx_agent_runs_input_gin on public.agent_runs using gin(input);
create index if not exists idx_agent_runs_output_gin on public.agent_runs using gin(output);

-- Row Level Security.
alter table public.clients enable row level security;
alter table public.client_configs enable row level security;
alter table public.companies enable row level security;
alter table public.prospects enable row level security;
alter table public.sources enable row level security;
alter table public.messages enable row level security;
alter table public.validations enable row level security;
alter table public.agents enable row level security;
alter table public.agent_runs enable row level security;
alter table public.tasks enable row level security;
alter table public.integrations enable row level security;
alter table public.extension_actions enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.audit_logs enable row level security;
alter table public.cost_logs enable row level security;
alter table public.daily_limits enable row level security;

-- Example policies. Adapt to the auth model before enabling in production.
-- Expected JWT claim example: auth.jwt() ->> 'client_id'.
--
-- create policy "client tenant read prospects"
-- on public.prospects
-- for select
-- using (client_id::text = auth.jwt() ->> 'client_id');
--
-- create policy "client tenant write prospects"
-- on public.prospects
-- for all
-- using (client_id::text = auth.jwt() ->> 'client_id')
-- with check (client_id::text = auth.jwt() ->> 'client_id');
--
-- Agents are global. Public read can be exposed if needed:
-- create policy "read active agents"
-- on public.agents
-- for select
-- using (is_active = true);

-- Seed base agents.
insert into public.agents (
  name,
  slug,
  role,
  description,
  system_prompt,
  model_provider,
  model_name,
  temperature,
  is_active,
  default_config
)
values
  (
    'Orchestrateur',
    'orchestrator',
    'Coordination',
    'Planifie et coordonne les agents spécialisés.',
    'Coordonner les étapes de prospection, déléguer les tâches et consolider les résultats.',
    'openai',
    'gpt-4.1',
    0.20,
    true,
    '{"max_parallel_tasks": 5}'::jsonb
  ),
  (
    'Chasseur',
    'hunter',
    'Recherche',
    'Trouve des entreprises et prospects correspondant à l’ICP.',
    'Identifier des entreprises et prospects pertinents selon la configuration client.',
    'openai',
    'gpt-4.1-mini',
    0.30,
    true,
    '{"sources": ["web", "linkedin", "crm"]}'::jsonb
  ),
  (
    'Qualificateur',
    'qualifier',
    'Qualification',
    'Évalue le fit ICP, la priorité et les raisons de qualification.',
    'Qualifier les prospects selon les critères client et produire un score explicable.',
    'openai',
    'gpt-4.1-mini',
    0.10,
    true,
    '{"min_confidence_score": 70}'::jsonb
  ),
  (
    'Enrichissement',
    'enrichment',
    'Enrichissement',
    'Complète les données entreprise et contact.',
    'Enrichir les informations manquantes avec sources et niveaux de confiance.',
    'openai',
    'gpt-4.1-mini',
    0.10,
    true,
    '{"required_source_count": 1}'::jsonb
  ),
  (
    'Rédacteur',
    'copywriter',
    'Rédaction',
    'Rédige les messages personnalisés.',
    'Créer des messages clairs, personnalisés et alignés avec le ton client.',
    'openai',
    'gpt-4.1',
    0.45,
    true,
    '{"default_channel": "linkedin"}'::jsonb
  ),
  (
    'Contrôle qualité',
    'qa',
    'Validation IA',
    'Vérifie cohérence, ton, conformité et personnalisation.',
    'Contrôler les messages avant validation humaine ou envoi.',
    'openai',
    'gpt-4.1',
    0.10,
    true,
    '{"strict_mode": true}'::jsonb
  ),
  (
    'Validation WhatsApp',
    'whatsapp_validation',
    'Validation humaine',
    'Prépare et suit les validations via WhatsApp.',
    'Envoyer les demandes de validation et interpréter les retours utilisateur.',
    'openai',
    'gpt-4.1-mini',
    0.20,
    true,
    '{"channel": "whatsapp"}'::jsonb
  ),
  (
    'Opérations extension',
    'extension_ops',
    'Exécution navigateur',
    'Prépare les actions pour extension Chrome et LinkedIn.',
    'Transformer les actions approuvées en payloads exécutables par extension navigateur.',
    'openai',
    'gpt-4.1-mini',
    0.10,
    true,
    '{"requires_linkedin_url": true}'::jsonb
  )
on conflict (slug) do update set
  name = excluded.name,
  role = excluded.role,
  description = excluded.description,
  system_prompt = excluded.system_prompt,
  model_provider = excluded.model_provider,
  model_name = excluded.model_name,
  temperature = excluded.temperature,
  is_active = excluded.is_active,
  default_config = excluded.default_config,
  updated_at = now();

commit;
