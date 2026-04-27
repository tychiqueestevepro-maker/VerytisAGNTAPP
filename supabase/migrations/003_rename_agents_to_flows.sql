-- Rename client_agents to client_flows
alter table if exists public.client_agents rename to client_flows;

-- Rename agent_key column to flow_key
do $$
begin
  if exists (
    select 1 
    from information_schema.columns 
    where table_name = 'client_flows' and column_name = 'agent_key'
  ) then
    alter table public.client_flows rename column agent_key to flow_key;
  end if;
end;
$$;

-- Add workflow_id if not already present (required for flow details)
do $$
begin
  if not exists (
    select 1 
    from information_schema.columns 
    where table_name = 'client_flows' and column_name = 'workflow_id'
  ) then
    alter table public.client_flows add column workflow_id uuid references public.workflows(id);
  end if;
end;
$$;

comment on table public.client_flows is 'Flows activés pour le client. Un flow orchestre plusieurs agents via un workflow.';
