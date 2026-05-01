-- 017_campaign_pre_scoring_qualification.sql
-- Ajoute les champs normalisés campagne + pré-notation et qualification explicite côté prospect.

alter table public.campaigns
  add column if not exists organization_id uuid references public.clients(id) on delete cascade,
  add column if not exists name text,
  add column if not exists objective text,
  add column if not exists target_description text,
  add column if not exists target_roles text[] not null default '{}'::text[],
  add column if not exists target_industries text[] not null default '{}'::text[],
  add column if not exists target_locations text[] not null default '{}'::text[],
  add column if not exists target_company_size text[] not null default '{}'::text[],
  add column if not exists tone text,
  add column if not exists source text;

update public.campaigns c
set organization_id = cf.client_id
from public.client_flows cf
where c.flow_id = cf.id
  and c.organization_id is null;

update public.campaigns
set
  name = coalesce(name, display_name),
  objective = coalesce(objective, description, config->>'offer'),
  target_description = coalesce(target_description, description, config->>'offer'),
  target_roles = case
    when target_roles = '{}'::text[] and jsonb_typeof(config->'personas') = 'array'
      then array(select jsonb_array_elements_text(config->'personas'))
    else target_roles
  end,
  target_industries = case
    when target_industries = '{}'::text[] and jsonb_typeof(config#>'{target_icp,sectors}') = 'array'
      then array(select jsonb_array_elements_text(config#>'{target_icp,sectors}'))
    when target_industries = '{}'::text[] and jsonb_typeof(config#>'{target_icp,industries}') = 'array'
      then array(select jsonb_array_elements_text(config#>'{target_icp,industries}'))
    else target_industries
  end,
  target_locations = case
    when target_locations = '{}'::text[] and jsonb_typeof(config#>'{target_icp,locations}') = 'array'
      then array(select jsonb_array_elements_text(config#>'{target_icp,locations}'))
    when target_locations = '{}'::text[] and jsonb_typeof(config#>'{target_icp,geographies}') = 'array'
      then array(select jsonb_array_elements_text(config#>'{target_icp,geographies}'))
    else target_locations
  end,
  target_company_size = case
    when target_company_size = '{}'::text[] and jsonb_typeof(config#>'{target_icp,company_size}') = 'array'
      then array(select jsonb_array_elements_text(config#>'{target_icp,company_size}'))
    when target_company_size = '{}'::text[] and jsonb_typeof(config#>'{target_icp,company_sizes}') = 'array'
      then array(select jsonb_array_elements_text(config#>'{target_icp,company_sizes}'))
    else target_company_size
  end,
  tone = coalesce(tone, config->>'tone'),
  source = coalesce(source, config->>'source', config->'sources'->>0);

alter table public.prospects
  add column if not exists full_name text,
  add column if not exists role_title text,
  add column if not exists company_description text,
  add column if not exists profile_url text,
  add column if not exists website_url text,
  add column if not exists raw_data jsonb not null default '{}'::jsonb,
  add column if not exists pre_score integer check (pre_score between 0 and 100),
  add column if not exists pre_score_level text check (pre_score_level in ('high', 'medium', 'low')),
  add column if not exists qualification_status text not null default 'collected'
    check (qualification_status in ('collected', 'pre_scored', 'to_qualify', 'qualified', 'rejected')),
  add column if not exists qualification_level text check (qualification_level in ('high', 'medium', 'low')),
  add column if not exists suggested_message text;

update public.prospects
set
  full_name = coalesce(full_name, decision_maker),
  role_title = coalesce(role_title, role),
  profile_url = coalesce(profile_url, linkedin_url),
  website_url = coalesce(website_url, website),
  raw_data = case
    when raw_data = '{}'::jsonb then extra_data
    else raw_data
  end,
  pre_score = coalesce(pre_score, fit_score),
  pre_score_level = coalesce(
    pre_score_level,
    case
      when fit_score >= 70 then 'high'
      when fit_score >= 40 then 'medium'
      when fit_score is not null then 'low'
      else null
    end
  ),
  qualification_status = case
    when qualification_status is not null and qualification_status <> 'collected' then qualification_status
    when status = 'qualified' then 'qualified'
    when status = 'rejected' then 'rejected'
    when fit_score is not null then 'pre_scored'
    else qualification_status
  end;

create index if not exists idx_prospects_campaign_pre_score_level
  on public.prospects(campaign_id, pre_score_level);

create index if not exists idx_prospects_qualification_status
  on public.prospects(qualification_status);

comment on column public.prospects.pre_score is 'Score automatique interne 0-100 calcule sans LLM.';
comment on column public.prospects.pre_score_level is 'Niveau de pre-pertinence affiche a l utilisateur: high, medium ou low.';
comment on column public.prospects.qualification_status is 'Etat de qualification separe du statut de workflow.';
comment on column public.prospects.suggested_message is 'Message court propose par le LLM apres clic utilisateur.';
