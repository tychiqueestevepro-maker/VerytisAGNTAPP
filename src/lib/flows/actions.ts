"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserWithProfile } from "@/lib/auth";
import { ClientFlow, Campaign, CampaignStatus, WorkflowStepWithAgent } from "@/types/flows";
import { revalidatePath } from "next/cache";
import {
  getOpenAIKeyForClient,
  qualifyProspectWithLLM,
} from "@/lib/prospecting/qualification";
import { preScoreProspect } from "@/lib/prospecting/scoring";

type ProspectingCampaignConfig = {
  target_icp?: {
    sectors?: string[];
    industries?: string[];
    company_size?: string[];
    company_sizes?: string[];
    locations?: string[];
    geographies?: string[];
  };
  personas?: string[];
  tone?: string;
  sources?: string[];
  source?: string;
  offer?: string;
  target_description?: string;
  prospection?: {
    mode?: string;
    prospects_per_day?: number;
    search_time?: string;
    sector?: string;
    location?: string;
    decision_maker?: string;
  };
  injection?: {
    auto_add?: boolean;
    ignore_duplicates?: boolean;
    prioritize_linkedin?: boolean;
  };
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// GET: All flows for the current client
// ---------------------------------------------------------------------------
export async function getClientFlows(): Promise<{ data: ClientFlow[] | null; error: string | null }> {
  const user = await getUserWithProfile();
  
  if (!user || !user.profile?.client_id) {
    return { data: null, error: "Non authentifié ou client non trouvé" };
  }

  const supabase = await createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from("client_flows")
    .select("*")
    .eq("client_id", user.profile.client_id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching client flows:", error);
    return { data: null, error: "Impossible de charger les flows" };
  }

  return { data, error: null };
}

// ---------------------------------------------------------------------------
// GET: All campaigns for a specific flow
// ---------------------------------------------------------------------------
export async function getFlowCampaigns(flowId: string): Promise<{ data: Campaign[] | null; error: string | null }> {
  const supabase = await createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("flow_id", flowId)
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: "Erreur lors du chargement des campagnes" };
  return { data, error: null };
}

// ---------------------------------------------------------------------------
// GET: Detail of a single campaign + its workflow steps
// ---------------------------------------------------------------------------
export async function getCampaignDetail(campaignId: string): Promise<{ 
  campaign: Campaign | null; 
  steps: WorkflowStepWithAgent[] | null; 
  error: string | null 
}> {
  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id) return { campaign: null, steps: null, error: "Non authentifié" };

  const supabase = await createSupabaseServerClient();

  const { data: campaign, error: campError } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (campError || !campaign) return { campaign: null, steps: null, error: "Campagne non trouvée" };

  if (campaign.sequence_id) {
    const { data: steps, error: stepsError } = await supabase
      .from("sequence_steps")
      .select(`
        *,
        agent:agents (
          name,
          slug,
          role,
          description
        )
      `)
      .eq("sequence_id", campaign.sequence_id)
      .order("step_order", { ascending: true });

    if (stepsError) {
      return { campaign, steps: null, error: "Erreur lors du chargement des étapes" };
    }

    const flattenedSteps = (steps || []).map((s: any) => ({
      ...s,
      agent_name: s.agent?.name,
      agent_slug: s.agent?.slug,
      agent_role: s.agent?.role,
      agent_description: s.agent?.description
    }));

    return { campaign, steps: flattenedSteps, error: null };
  }

  return { campaign, steps: [], error: null };
}

// ---------------------------------------------------------------------------
// ACTIVATE: Update status + full campaign config in client_flows.config
// Does NOT touch client_configs (global, unique per client).
// ---------------------------------------------------------------------------
export async function activateFlow(flowId: string, config: any) {
  const supabase = await createSupabaseServerClient();

  const { error: flowError } = await supabase
    .from("client_flows")
    .update({ 
      status: "active",
      config: config,  // All campaign-specific settings live here
    })
    .eq("id", flowId);

  if (flowError) return { error: "Erreur lors de l'activation du flow" };

  revalidatePath("/app/flows/prospecting");
  return { success: true };
}

// ---------------------------------------------------------------------------
// UPDATE CAMPAIGN CONFIG: Save settings without changing status
// All campaign-specific data goes into client_flows.config (JSONB).
// Structure expected in config:
// {
//   target_icp: { sectors, company_size, locations },
//   personas: string[],
//   tone: string,
//   prospection: { mode, prospects_per_day, search_time, sector, location, decision_maker },
//   injection: { auto_add, ignore_duplicates, prioritize_linkedin }
// }
// ---------------------------------------------------------------------------
export async function updateCampaignConfig(
  campaignId: string,
  config: {
    target_icp?: { sectors?: string[]; company_size?: string[]; locations?: string[] };
    personas?: string[];
    tone?: string;
    prospection?: {
      mode?: "auto" | "manual";
      prospects_per_day?: number;
      search_time?: string;
      sector?: string;
      location?: string;
      decision_maker?: string;
    };
    injection?: {
      auto_add?: boolean;
      ignore_duplicates?: boolean;
      prioritize_linkedin?: boolean;
    };
    display_name?: string;
    objective?: string;
  }
): Promise<{ success?: boolean; error?: string }> {
  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id) return { error: "Non authentifié" };

  const supabase = await createSupabaseServerClient();

  const { data: current, error: fetchError } = await supabase
    .from("campaigns")
    .select("config, id")
    .eq("id", campaignId)
    .single();

  if (fetchError || !current) return { error: "Campagne introuvable" };

  const merged = {
    ...(current.config ?? {}),
    ...config,
    prospection: {
      ...(current.config?.prospection ?? {}),
      ...(config.prospection ?? {}),
    },
    injection: {
      ...(current.config?.injection ?? {}),
      ...(config.injection ?? {}),
    },
    target_icp: {
      ...(current.config?.target_icp ?? {}),
      ...(config.target_icp ?? {}),
    },
  };

  const updatePayload: Record<string, any> = { config: merged };
  if (config.display_name) updatePayload.display_name = config.display_name;

  const { error: updateError } = await supabase
    .from("campaigns")
    .update(updatePayload)
    .eq("id", campaignId);

  if (updateError) return { error: "Erreur lors de la mise à jour" };

  revalidatePath("/flows/prospecting");
  return { success: true };
}

// ---------------------------------------------------------------------------
// CREATE: Create a new prospecting campaign for the current client
// ---------------------------------------------------------------------------
export async function createProspectingCampaign(
  displayName: string,
  initialConfig?: ProspectingCampaignConfig
): Promise<{ data: Campaign | null; error: string | null }> {
  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id) return { data: null, error: "Non authentifié" };

  const supabase = await createSupabaseServerClient();

  // 1. Ensure the Prospecting Flow exists for this org
  let { data: flow } = await supabase
    .from("client_flows")
    .select("id")
    .eq("client_id", user.profile.client_id)
    .eq("flow_key", "prospecting")
    .single();

  if (!flow) {
    const { data: newFlow, error: flowErr } = await supabase
      .from("client_flows")
      .insert({
        client_id: user.profile.client_id,
        flow_key: "prospecting",
        display_name: "Prospection IA",
        status: "active",
        route: "/flows/prospecting"
      })
      .select()
      .single();
    if (flowErr || !newFlow) return { data: null, error: "Impossible de créer le flux parent" };
    flow = newFlow;
  }

  if (!flow) return { data: null, error: "Flux parent introuvable" };

  const defaultConfig: ProspectingCampaignConfig = {
    target_icp: { sectors: [], company_size: [], locations: [] },
    personas: [],
    tone: "",
    prospection: {
      mode: "auto",
      prospects_per_day: 20,
      search_time: "09:00",
      sector: "",
      location: "",
      decision_maker: "",
    },
    injection: {
      auto_add: true,
      ignore_duplicates: true,
      prioritize_linkedin: true,
    },
    ...initialConfig,
  };

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      flow_id: flow.id,
      organization_id: user.profile.client_id,
      name: displayName,
      display_name: displayName,
      objective: defaultConfig.offer || null,
      target_description: defaultConfig.target_description || defaultConfig.offer || null,
      target_roles: defaultConfig.personas || [],
      target_industries: defaultConfig.target_icp?.sectors || defaultConfig.target_icp?.industries || [],
      target_locations: defaultConfig.target_icp?.locations || defaultConfig.target_icp?.geographies || [],
      target_company_size: defaultConfig.target_icp?.company_size || defaultConfig.target_icp?.company_sizes || [],
      tone: defaultConfig.tone || null,
      source: Array.isArray(defaultConfig.sources) ? defaultConfig.sources[0] : defaultConfig.source || null,
      status: "active",
      config: defaultConfig,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating campaign:", error);
    return { data: null, error: error.message };
  }

  revalidatePath("/flows/prospecting");
  return { data: campaign, error: null };
}

// ---------------------------------------------------------------------------
// PAUSE / RESUME / DELETE campaign
// ---------------------------------------------------------------------------
export async function setCampaignStatus(
  campaignId: string,
  status: CampaignStatus
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("campaigns")
    .update({ status })
    .eq("id", campaignId);

  if (error) return { error: "Erreur lors de la mise à jour du statut" };

  revalidatePath("/flows/prospecting");
  return { success: true };
}

// ---------------------------------------------------------------------------
// SAVE SEQUENCE STEPS: Map frontend tree steps to DB sequence_steps
// ---------------------------------------------------------------------------
export async function saveSequenceSteps(campaignId: string, steps: any[]): Promise<{ success?: boolean; error?: string }> {
  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id) return { error: "Non authentifié" };

  const supabase = await createSupabaseServerClient();

  // 1. Get campaign and sequence_id
  const { data: campaign, error: campError } = await supabase
    .from("campaigns")
    .select("sequence_id, display_name")
    .eq("id", campaignId)
    .single();

  if (campError || !campaign) return { error: "Campagne introuvable" };

  let seqId = campaign.sequence_id;

  // 2. Create sequence if missing
  if (!seqId) {
    const { data: newSeq, error: seqError } = await supabase
      .from("sequences")
      .insert({ client_id: user.profile.client_id, name: `${campaign.display_name || 'Campagne'} Sequence` })
      .select()
      .single();
    
    if (seqError || !newSeq) return { error: "Erreur création séquence" };
    seqId = newSeq.id;

    await supabase
      .from("campaigns")
      .update({ sequence_id: seqId })
      .eq("id", campaignId);
  }

  // 3. Delete existing steps
  await supabase.from("sequence_steps").delete().eq("sequence_id", seqId);

  // 4. Insert new steps. We flatten the root array, preserving nested branches in config JSONB
  if (steps && steps.length > 0) {
    const rows = steps.map((s, index) => ({
      sequence_id: seqId,
      step_order: index + 1,
      name: s.name,
      action_type: s.type,
      config: { ...s.config, channel: s.channel }
    }));

    const { error: insertError } = await supabase.from("sequence_steps").insert(rows);
    if (insertError) {
      console.error("Insert steps error:", insertError);
      return { error: "Erreur lors de l'enregistrement des étapes" };
    }
  }

  revalidatePath("/app/flows/prospecting");
  return { success: true };
}

export async function deleteProspects(ids: string[]): Promise<{ success: boolean; error?: string }> {
  if (!ids || ids.length === 0) return { success: false, error: "Aucun ID fourni" };
  
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("prospects").delete().in("id", ids);

  if (error) {
    console.error("Delete prospects error:", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }

  revalidatePath("/flows/prospecting");
  return { success: true };
}

async function qualifyProspectRecord(
  supabase: any,
  clientId: string,
  prospectId: string,
  apiKey: string
) {
  const { data: prospect, error: prospectError } = await supabase
    .from("prospects")
    .select(`
      *,
      company:companies (
        industry,
        size_range,
        description,
        linkedin_url,
        location
      )
    `)
    .eq("id", prospectId)
    .eq("client_id", clientId)
    .single();

  if (prospectError || !prospect) {
    throw new Error("Prospect introuvable");
  }

  if (!prospect.campaign_id) {
    throw new Error("Ce prospect n'est rattaché à aucune campagne");
  }

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", prospect.campaign_id)
    .single();

  if (campaignError || !campaign) {
    throw new Error("Campagne introuvable");
  }

  const preScore = preScoreProspect(prospect, campaign);
  const qualification = await qualifyProspectWithLLM(
    {
      ...prospect,
      pre_score: preScore.score,
      pre_score_level: preScore.level,
    },
    campaign,
    apiKey
  );

  const finalQualificationStatus = qualification.qualification_level === "low" ? "rejected" : "qualified";

  const { data: updated, error: updateError } = await supabase
    .from("prospects")
    .update({
      full_name: prospect.full_name || prospect.decision_maker,
      role_title: prospect.role_title || prospect.role,
      company_description: prospect.company_description || prospect.company?.description || prospect.extra_data?.about || null,
      profile_url: prospect.profile_url || prospect.linkedin_url,
      website_url: prospect.website_url || prospect.website,
      raw_data: prospect.raw_data && Object.keys(prospect.raw_data).length > 0 ? prospect.raw_data : prospect.extra_data || {},
      pre_score: preScore.score,
      pre_score_level: preScore.level,
      fit_score: preScore.score,
      qualification_status: finalQualificationStatus,
      qualification_level: qualification.qualification_level,
      qualification_reason: qualification.qualification_reason,
      suggested_message: qualification.suggested_message,
      status: finalQualificationStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", prospectId)
    .eq("client_id", clientId)
    .select(`
      id,
      campaign_id,
      company_name,
      decision_maker,
      role,
      fit_score,
      status,
      priority,
      photo_url,
      website,
      location,
      linkedin_url,
      email,
      phone,
      source,
      extra_data,
      created_at,
      full_name,
      role_title,
      company_description,
      profile_url,
      website_url,
      raw_data,
      pre_score,
      pre_score_level,
      qualification_status,
      qualification_level,
      qualification_reason,
      suggested_message,
      company:companies (
        industry,
        size_range,
        description,
        linkedin_url,
        location
      )
    `)
    .single();

  if (updateError || !updated) {
    throw new Error("Impossible d'enregistrer la qualification");
  }

  return updated;
}

export async function qualifyProspect(prospectId: string): Promise<{ data: any | null; error: string | null }> {
  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id) return { data: null, error: "Non authentifié" };

  try {
    const apiKey = await getOpenAIKeyForClient(user.profile.client_id);
    const supabase = await createSupabaseServerClient();
    const data = await qualifyProspectRecord(supabase, user.profile.client_id, prospectId, apiKey);

    revalidatePath("/flows/prospecting");
    if (data.campaign_id) revalidatePath(`/flows/prospecting/${data.campaign_id}`);

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Erreur lors de la qualification" };
  }
}

export async function qualifyProspects(prospectIds: string[]): Promise<{
  data: any[];
  errors: { id: string; error: string }[];
  success: boolean;
}> {
  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id) {
    return { data: [], errors: prospectIds.map((id) => ({ id, error: "Non authentifié" })), success: false };
  }

  const ids = Array.from(new Set(prospectIds)).filter(Boolean);
  if (ids.length === 0) return { data: [], errors: [], success: false };

  const supabase = await createSupabaseServerClient();
  let apiKey: string;
  try {
    apiKey = await getOpenAIKeyForClient(user.profile.client_id);
  } catch (error: any) {
    return {
      data: [],
      errors: ids.map((id) => ({ id, error: error.message || "Clé OpenAI introuvable" })),
      success: false,
    };
  }

  const data: any[] = [];
  const errors: { id: string; error: string }[] = [];

  for (const id of ids) {
    try {
      data.push(await qualifyProspectRecord(supabase, user.profile.client_id, id, apiKey));
    } catch (error: any) {
      errors.push({ id, error: error.message || "Erreur lors de la qualification" });
    }
  }

  revalidatePath("/flows/prospecting");
  data.forEach((prospect) => {
    if (prospect.campaign_id) revalidatePath(`/flows/prospecting/${prospect.campaign_id}`);
  });

  return { data, errors, success: errors.length === 0 };
}

// ---------------------------------------------------------------------------
// GET: All prospects for the current organization (client)
// ---------------------------------------------------------------------------
export async function getOrganizationProspects(): Promise<{ data: any[] | null; error: string | null }> {
  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id) return { data: null, error: "Non authentifié" };

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("prospects")
    .select(`
      id, 
      campaign_id,
      company_name, 
      decision_maker, 
      role, 
      fit_score, 
      status, 
      priority, 
      photo_url,
      website,
      location,
      linkedin_url,
      email,
      phone,
      source,
      extra_data,
      created_at,
      full_name,
      role_title,
      company_description,
      profile_url,
      website_url,
      raw_data,
      pre_score,
      pre_score_level,
      qualification_status,
      qualification_level,
      qualification_reason,
      suggested_message,
      company:companies (
        industry,
        size_range,
        description,
        linkedin_url,
        location
      )
    `)
    .eq("client_id", user.profile.client_id)
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: "Erreur lors du chargement des prospects de l'organisation" };
  return { data, error: null };
}

// ---------------------------------------------------------------------------
// GET: All contact lists for the current organization
// ---------------------------------------------------------------------------
export async function getContactLists(): Promise<{ data: any[] | null; error: string | null }> {
  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id) return { data: null, error: "Non authentifié" };

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("contact_lists")
    .select("*")
    .eq("client_id", user.profile.client_id)
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: "Erreur lors du chargement des listes" };
  return { data, error: null };
}

// ---------------------------------------------------------------------------
// GET: Prospects for a specific contact list
// ---------------------------------------------------------------------------
export async function getProspectsByList(listId: string): Promise<{ data: any[] | null; error: string | null }> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("prospect_list_members")
    .select(`
      prospect:prospects (
        id, 
        campaign_id,
        company_name, 
        decision_maker, 
        role, 
        fit_score, 
        status, 
        priority, 
        photo_url,
        website,
        location,
        linkedin_url,
        email,
        phone,
        source,
        extra_data,
        created_at,
        full_name,
        role_title,
        company_description,
        profile_url,
        website_url,
        raw_data,
        pre_score,
        pre_score_level,
        qualification_status,
        qualification_level,
        qualification_reason,
        suggested_message,
        company:companies (
          industry,
          size_range,
          description,
          linkedin_url,
          location
        )
      )
    `)
    .eq("list_id", listId);

  if (error) return { data: null, error: "Erreur lors du chargement des prospects de la liste" };
  
  const flattened = (data || []).map((item: any) => item.prospect).filter(Boolean);
  return { data: flattened, error: null };
}
