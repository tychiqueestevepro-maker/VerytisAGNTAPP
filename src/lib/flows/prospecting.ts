"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserWithProfile } from "@/lib/auth";

export async function getProspectingData(campaignId?: string) {
  const user = await getUserWithProfile();
  
  if (!user || !user.profile?.client_id) {
    return { error: "Non authentifié ou client non trouvé" };
  }

  const supabase = await createSupabaseServerClient();
  
  // 1. Fetch the Prospecting Flow ID
  const { data: flow } = await supabase
    .from("client_flows")
    .select("id")
    .eq("client_id", user.profile.client_id)
    .eq("flow_key", "prospecting")
    .single();

  if (!flow) {
    return { campaigns: [], prospects: [], activities: [], error: null };
  }

  // 2. Fetch campaigns for this flow
  const { data: campaigns, error: campaignsError } = await supabase
    .from("campaigns")
    .select("*")
    .eq("flow_id", flow.id)
    .order("created_at", { ascending: false });

  if (campaignsError) {
    return { error: "Erreur lors du chargement des campagnes" };
  }

  // 3. Fetch prospects (scoped to campaign_id if provided)
  let prospectsQuery = supabase
    .from("prospects")
    .select("id, company_name, decision_maker, role, fit_score, status, priority")
    .eq("client_id", user.profile.client_id)
    .order("created_at", { ascending: false })
    .limit(50);
    
  if (campaignId) {
    prospectsQuery = prospectsQuery.eq("campaign_id", campaignId);
  }

  const { data: prospects, error: prospectsError } = await prospectsQuery;

  // 4. Fetch recent activity from agent_runs
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
