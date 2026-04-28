-- =============================================================================
-- 014_create_prospect_photos_bucket.sql
-- Create a public storage bucket for imported LinkedIn prospect photos
-- =============================================================================

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'prospect-photos',
  'prospect-photos',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- On Supabase hosted projects, storage.objects is owned by Supabase internals,
-- so project migrations should not alter RLS or create policies on it.
-- Public reads are handled by the bucket's public=true flag, and uploads use
-- the server-side service role client in the import route.

commit;
