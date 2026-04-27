-- Create profiles table to link auth.users and public.clients
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  first_name text,
  last_name text,
  avatar_url text,
  role text default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Profils utilisateurs liés au système Auth et aux tenants (clients).';

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger for updated_at
create trigger update_profiles_updated_at
before update on public.profiles
for each row execute function public.update_updated_at();

-- Function to handle new user signup: Creates Client + Profile (Owner) + Config
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_client_id uuid;
begin
  -- 1. Créer le client (tenant) automatique
  insert into public.clients (name, company_name, status)
  values (
    coalesce(new.raw_user_meta_data->>'company_name', 'Nouvelle Entreprise'),
    new.raw_user_meta_data->>'company_name',
    'active'
  )
  returning id into new_client_id;

  -- 2. Créer le profil utilisateur (Le créateur est 'owner')
  insert into public.profiles (id, client_id, first_name, last_name, role)
  values (
    new.id,
    new_client_id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    'owner'
  );

  -- 3. Activer la configuration par défaut (Agent Prospection)
  insert into public.client_configs (client_id, agent_rules)
  values (
    new_client_id,
    '{"prospection_enabled": true, "auto_activation": true}'::jsonb
  );

  return new;
end;
$$;

-- Trigger for new user signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
