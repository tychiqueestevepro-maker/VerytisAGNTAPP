-- =============================================================================
-- 016_prospect_unique_constraint.sql
-- Ajoute une contrainte d'unicité sur linkedin_url par client pour permettre
-- les upserts propres lors de l'importation de leads.
-- =============================================================================

begin;

-- 1. Nettoyer les doublons potentiels avant d'ajouter la contrainte
-- On garde le prospect le plus récent pour chaque couple (client_id, linkedin_url)
delete from public.prospects p1
where p1.id not in (
  select distinct on (client_id, linkedin_url) id
  from public.prospects
  where linkedin_url is not null
  order by client_id, linkedin_url, created_at desc
)
and p1.linkedin_url is not null;

-- 2. Ajouter la contrainte d'unicité
-- Note: On utilise un index unique qui gère aussi les NULL (bien que linkedin_url soit généralement présent)
create unique index if not exists idx_prospects_client_linkedin_url_unique 
  on public.prospects (client_id, linkedin_url) 
  where (linkedin_url is not null);

-- 3. Ajouter une contrainte de table pour être explicite (nécessaire pour PostgREST upsert)
alter table public.prospects 
  add constraint prospects_client_linkedin_url_key 
  unique (client_id, linkedin_url);

commit;
