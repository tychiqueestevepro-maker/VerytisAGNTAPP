-- =============================================================================
-- 013_add_prospect_photo_url.sql
-- Add photo_url column to prospects table
-- =============================================================================

begin;

alter table public.prospects add column if not exists photo_url text;

comment on column public.prospects.photo_url is 'URL de la photo de profil LinkedIn du prospect.';

commit;
