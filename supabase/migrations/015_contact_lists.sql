-- =============================================================================
-- 015_contact_lists.sql
-- Implement contact lists and list membership.
-- =============================================================================

begin;

-- 1. Create contact_lists table
create table if not exists public.contact_lists (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  name          text not null,
  description   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Trigger for contact_lists updated_at
drop trigger if exists update_contact_lists_updated_at on public.contact_lists;
create trigger update_contact_lists_updated_at
  before update on public.contact_lists
  for each row execute function public.update_updated_at();

-- RLS for contact_lists
alter table public.contact_lists enable row level security;

create policy "org: all contact lists"
  on public.contact_lists for all
  using (client_id = public.auth_client_id())
  with check (client_id = public.auth_client_id());

-- 2. Create prospect_list_members (Join table)
create table if not exists public.prospect_list_members (
  list_id       uuid not null references public.contact_lists(id) on delete cascade,
  prospect_id   uuid not null references public.prospects(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (list_id, prospect_id)
);

-- RLS for prospect_list_members
alter table public.prospect_list_members enable row level security;

create policy "org: all list members"
  on public.prospect_list_members for all
  using (
    exists (
      select 1 from public.contact_lists l
      where l.id = prospect_list_members.list_id
        and l.client_id = public.auth_client_id()
    )
  )
  with check (
    exists (
      select 1 from public.contact_lists l
      where l.id = prospect_list_members.list_id
        and l.client_id = public.auth_client_id()
    )
  );

-- 3. Update comments
comment on table public.contact_lists is 'Listes de contacts personnalisées au sein de l''organisation.';
comment on table public.prospect_list_members is 'Lien entre prospects et listes de contacts (plusieurs-à-plusieurs).';

commit;
