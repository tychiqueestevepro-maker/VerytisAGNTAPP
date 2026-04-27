-- =============================================================================
-- 011_create_csv_imports_bucket.sql
-- Create a storage bucket to archive imported CSV files
-- =============================================================================

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'csv_imports',
  'csv_imports',
  false,
  52428800, -- 50MB
  ARRAY['text/csv', 'application/csv', 'text/plain']::text[]
)
on conflict (id) do nothing;

-- Ensure RLS is enabled for storage.objects if not already
alter table storage.objects enable row level security;

-- Drop existing policies if needed to recreate them safely
drop policy if exists "Authenticated users can upload CSVs" on storage.objects;
drop policy if exists "Authenticated users can read CSVs" on storage.objects;

-- Create basic policies for the csv_imports bucket
create policy "Authenticated users can upload CSVs"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'csv_imports' );

create policy "Authenticated users can read CSVs"
on storage.objects for select
to authenticated
using ( bucket_id = 'csv_imports' );

commit;
