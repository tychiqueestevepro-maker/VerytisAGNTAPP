"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserWithProfile } from "@/lib/auth";

export async function getProspectingData(flowId?: string) {
  const user = await getUserWithProfile();
  
  if (!user || !user.profile?.client_id) {
    return { error: "Non authentifié ou client non trouvé" };
  }

  const supabase = await createSupabaseServerClient();
  
  // 1. Fetch campaigns (flows with flow_key = 'prospecting')
  const { data: campaigns, error: campaignsError } = await supabase
    .from("client_flows")
    .select("*")
    .eq("client_id", user.profile.client_id)
    .eq("flow_key", "prospecting")
    .order("created_at", { ascending: false });

  if (campaignsError) {
    return { error: "Erreur lors du chargement des campagnes" };
  }

  // 2. Fetch prospects (scoped to flow_id if provided)
  let prospectsQuery = supabase
    .from("prospects")
    .select("id, company_name, decision_maker, role, fit_score, status, priority")
    .eq("client_id", user.profile.client_id)
    .order("created_at", { ascending: false })
    .limit(50);
    
  if (flowId) {
    prospectsQuery = prospectsQuery.eq("flow_id", flowId);
  }

  const { data: prospects, error: prospectsError } = await prospectsQuery;

  // 3. Fetch recent activity from agent_runs
  const { data: activities, error: actError } = await supabase
    .from("agent_runs")
    .select("id, action:run_type, entity_type:status, created_at")
    .eq("client_id", user.profile.client_id)
    .order("created_at", { ascending: false })
    .limit(10);

  return {
    campaigns: campaigns || [],
    prospects: prospects || [],
    activities: activities || [],
    error: null
  };
}
