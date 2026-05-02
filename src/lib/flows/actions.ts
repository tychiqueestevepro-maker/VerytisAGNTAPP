"use server";

import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { getUserWithProfile } from "@/lib/auth";
import { ClientFlow, Campaign, CampaignStatus, WorkflowStepWithAgent } from "@/types/flows";
import { revalidatePath } from "next/cache";
import {
  getOpenAIKeyForClient,
  qualifyProspectWithLLM,
} from "@/lib/prospecting/qualification";
import { preScoreProspect } from "@/lib/prospecting/scoring";
import { logCampaignActivity, logCampaignActivities } from "@/lib/flows/activity";
import { generateSequenceForCampaign } from "./sequences";
import { personalizeSequenceForProspect } from "@/lib/prospecting/personalization";

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
  const serviceClient = createSupabaseServiceClient();

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

  // 3. Immediately seed a default first step so the campaign isn't empty in the UI
  // while the AI generation is running (which can take a few seconds)
  try {
    const { data: seqData } = await serviceClient
      .from("sequences")
      .insert({ client_id: user.profile.client_id, name: `${displayName} Sequence` })
      .select()
      .single();
    
    if (seqData) {
      await serviceClient
        .from("campaigns")
        .update({ sequence_id: seqData.id })
        .eq("id", campaign.id);
        
      await serviceClient.from("sequence_steps").insert({
        sequence_id: seqData.id,
        step_order: 1,
        name: "Initialisation",
        action_type: "linkedin",
        config: { channel: "LinkedIn", message: "Génération de la séquence en cours..." }
      });
    }
  } catch (seedErr) {
    console.error("Seed sequence failed:", seedErr);
  }

  // 4. Auto-generate the full sequence with AI
  const genResult = await generateAndSaveSequence(campaign.id);
  if (genResult.error) {
    console.error("Auto-generation of sequence failed:", genResult.error);
    // If the sequence fails, we might still want to return the campaign 
    // but with a warning or the error itself. 
    // Given the user feedback, it's better to surface the error.
    return { data: campaign, error: `Campagne créée mais la génération de séquence a échoué: ${genResult.error}` };
  }

  revalidatePath(`/flows/prospecting/${campaign.id}`);
  revalidatePath("/flows/prospecting");
  return { data: campaign, error: null };
}

export async function deleteCampaign(campaignId: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  // The DB should handle cascading deletions for sequence_steps, prospects, etc.
  const { error } = await supabase
    .from("campaigns")
    .delete()
    .eq("id", campaignId);

  if (error) {
    console.error("Delete campaign error:", error);
    return { error: "Erreur lors de la suppression de la campagne" };
  }

  revalidatePath("/flows/prospecting");
  return { success: true };
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
  const serviceClient = createSupabaseServiceClient();

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
    const { data: newSeq, error: seqError } = await serviceClient
      .from("sequences")
      .insert({ client_id: user.profile.client_id, name: `${campaign.display_name || 'Campagne'} Sequence` })
      .select()
      .single();
    
    if (seqError || !newSeq) return { error: "Erreur création séquence" };
    seqId = newSeq.id;

    await serviceClient
      .from("campaigns")
      .update({ sequence_id: seqId })
      .eq("id", campaignId);
  }

  // 3. Delete existing steps
  await serviceClient.from("sequence_steps").delete().eq("sequence_id", seqId);

  // 4. Insert new steps. We flatten the root array, preserving nested branches in config JSONB
  if (steps && steps.length > 0) {
    const rows = steps.map((s, index) => ({
      sequence_id: seqId,
      step_order: index + 1,
      name: s.name,
      action_type: s.type,
      config: { ...s.config, channel: s.channel }
    }));

    const { error: insertError } = await serviceClient.from("sequence_steps").insert(rows);
    if (insertError) {
      console.error("Insert steps error:", insertError);
      return { error: "Erreur lors de l'enregistrement des étapes" };
    }
  }

  revalidatePath(`/flows/prospecting/${campaignId}`);
  revalidatePath("/flows/prospecting");
  return { success: true };
}

// ---------------------------------------------------------------------------
// GENERATE & SAVE SEQUENCE: Use AI to generate a sequence and save it
// ---------------------------------------------------------------------------
export async function generateAndSaveSequence(campaignId: string): Promise<{ success?: boolean; error?: string }> {
  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id) return { error: "Non authentifié" };

  const supabase = await createSupabaseServerClient();

  // 1. Get campaign details
  const { data: campaign, error: campError } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (campError || !campaign) return { error: "Campagne introuvable" };

  try {
    // 2. Generate sequence with AI
    const generated = await generateSequenceForCampaign(campaign as Campaign);

    // 3. Save the steps
    return await saveSequenceSteps(campaignId, generated.steps);
  } catch (error: any) {
    console.error("Error generating sequence:", error);
    
    // Check if it's a Zod error (which is what we see in the screenshot)
    if (error.name === "ZodError" || (error.issues && Array.isArray(error.issues))) {
      return { error: "L'IA a généré une séquence au format invalide. Veuillez réessayer (cela arrive parfois)." };
    }
    
    return { error: error.message || "Erreur lors de la génération de la séquence" };
  }
}

export async function deleteProspects(ids: string[]): Promise<{ success: boolean; error?: string }> {
  if (!ids || ids.length === 0) return { success: false, error: "Aucun ID fourni" };
  
  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id) return { success: false, error: "Non authentifié" };
  const clientId = user.profile.client_id;

  const supabase = await createSupabaseServerClient();

  // Fetch names before deletion for logging
  const { data: prospects } = await supabase
    .from("prospects")
    .select("id, decision_maker, campaign_id")
    .in("id", ids);

  const { error } = await supabase.from("prospects").delete().in("id", ids);

  if (error) {
    console.error("Delete prospects error:", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }

  // Log activities
  if (prospects && prospects.length > 0) {
    await logCampaignActivities(prospects.map(p => ({
      clientId,
      campaignId: p.campaign_id,
      action: "prospect.deleted",
      entityType: "prospect",
      entityId: p.id,
      actorType: "user",
      metadata: {
        prospect_name: p.decision_maker || "un prospect",
        campaign_id: p.campaign_id
      }
    })));

    // Revalidate specific campaign pages
    const uniqueCampaignIds = Array.from(new Set(prospects.map(p => p.campaign_id).filter(Boolean)));
    uniqueCampaignIds.forEach(cid => {
      revalidatePath(`/flows/prospecting/${cid}`);
    });
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
        website,
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

  // Fetch sequence steps
  let sequenceSteps: any[] = [];
  if (campaign.sequence_id) {
    const { data: steps } = await supabase
      .from("sequence_steps")
      .select("*")
      .eq("sequence_id", campaign.sequence_id)
      .order("step_order", { ascending: true });
    sequenceSteps = steps || [];
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

  // Personalize sequence if qualified
  let personalizedSequence = null;
  if (finalQualificationStatus === "qualified" && sequenceSteps.length > 0) {
    try {
      personalizedSequence = await personalizeSequenceForProspect(
        prospect,
        campaign,
        sequenceSteps,
        qualification
      );
    } catch (err) {
      console.error("Error personalizing sequence:", err);
    }
  }

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
      extra_data: {
        ...(prospect.extra_data || {}),
        qualification: {
          result: qualification,
          personalization_hooks: qualification.personalization_hooks,
          qualified_at: new Date().toISOString(),
        },
        personalized_sequence: personalizedSequence,
      },
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
      company:companies (
        industry,
        size_range,
        description,
        website,
        linkedin_url,
        location
      )
    `)
    .single();

  if (updateError || !updated) {
    throw new Error("Impossible d'enregistrer la qualification");
  }

  await logCampaignActivity({
    clientId,
    campaignId: updated.campaign_id,
    action: "prospect.qualified",
    entityType: "prospect",
    entityId: updated.id,
    actorType: "user",
    metadata: {
      prospect_name: updated.decision_maker || updated.full_name || "un prospect",
      company_name: updated.company_name || null,
      qualification_level: updated.qualification_level,
      qualification_status: updated.qualification_status,
      fit_score: updated.fit_score,
    },
  });

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
        website,
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
          website,
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

// ---------------------------------------------------------------------------
// UPDATE PROSPECT PERSONALIZATION: Save manual edits to the sequence
// ---------------------------------------------------------------------------
export async function updateProspectPersonalization(
  prospectId: string,
  personalizedSequence: any
): Promise<{ success?: boolean; error?: string }> {
  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id) return { error: "Non authentifié" };

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("prospects")
    .update({
      extra_data: {
        personalized_sequence: personalizedSequence
      }
    })
    .eq("id", prospectId)
    .eq("client_id", user.profile.client_id);

  if (error) {
    console.error("Error updating personalization:", error);
    return { error: "Impossible de sauvegarder la personnalisation" };
  }

  revalidatePath("/flows/prospecting");
  return { success: true };
}
export async function bulkUpdateProspectPersonalizations(
  updates: { prospectId: string, personalizedSequence: any }[]
): Promise<{ success?: boolean; error?: string }> {
  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id) return { error: "Non authentifié" };

  const supabase = await createSupabaseServerClient();

  // We do multiple updates. In a production app, we'd use a RPC or a more optimized approach.
  // For now, since it's human interaction volume, a loop is fine.
  for (const update of updates) {
    // 1. Fetch current extra_data to preserve other keys (like photo_url)
    const { data: prospect } = await supabase
      .from("prospects")
      .select("extra_data")
      .eq("id", update.prospectId)
      .single();

    const newExtraData = {
      ...(prospect?.extra_data || {}),
      personalized_sequence: update.personalizedSequence
    };

    const { error } = await supabase
      .from("prospects")
      .update({
        extra_data: newExtraData
      })
      .eq("id", update.prospectId)
      .eq("client_id", user.profile.client_id);

    if (error) {
      console.error(`Error updating personalization for ${update.prospectId}:`, error);
    }
  }

  revalidatePath("/flows/prospecting");
  return { success: true };
}
