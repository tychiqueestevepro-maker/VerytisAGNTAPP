-- Enable RLS on client_flows
alter table public.client_flows enable row level security;

-- Drop existing policies if any (to avoid conflicts)
drop policy if exists "Users can view their client's flows" on public.client_flows;

-- Create policy: A user can see flows if the flow's client_id matches the user's profile client_id
create policy "Users can view their client's flows"
  on public.client_flows for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.client_id = client_flows.client_id
    )
  );

-- Owner/Admin can update flows (optionnel)
create policy "Owners and admins can update their client's flows"
  on public.client_flows for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.client_id = client_flows.client_id
      and profiles.role in ('owner', 'admin')
    )
  );
