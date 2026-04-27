-- =============================================================================
-- 009_allow_multi_campaign.sql
-- Supprime la contrainte d'unicité qui empêchait d'avoir plusieurs 
-- campagnes du même type (flow_key) par client.
-- =============================================================================

begin;

-- La contrainte peut s'appeler client_agents_client_id_agent_key_key 
-- ou client_flows_client_id_flow_key_key selon le moment du renommage.

alter table public.client_flows 
  drop constraint if exists client_agents_client_id_agent_key_key;

alter table public.client_flows 
  drop constraint if exists client_flows_client_id_flow_key_key;

-- On s'assure aussi que la colonne flow_key n'est pas unique par elle-même (normalement non)
-- On garde les index de performance mais sans l'unicité.

comment on table public.client_flows is 'Flows/campagnes activés pour le client. Plusieurs campagnes par type sont désormais autorisées.';

commit;
