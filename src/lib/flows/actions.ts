"use server";

import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/server";
import { getUserWithProfile } from "@/lib/auth";
import {
  ClientFlow,
  Campaign,
  CampaignStatus,
  WorkflowStepWithAgent,
} from "@/types/flows";
import { revalidatePath } from "next/cache";
import {
  getOpenAIKeyForClient,
  qualifyProspectWithLLM,
} from "@/lib/prospecting/qualification";
import { preScoreProspect } from "@/lib/prospecting/scoring";
import {
  logCampaignActivity,
  logCampaignActivities,
} from "@/lib/flows/activity";
import { generateSequenceForCampaign } from "./sequences";
import { personalizeSequenceForProspect } from "@/lib/prospecting/personalization";
import { enqueueExtensionActionsForQualifiedProspect } from "@/lib/extension/sequence-runner";
import {
  normalizeProspectionPlaybook,
  type ProspectionPlaybook,
} from "@/lib/prospecting/playbook";

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
    messages_per_day?: number;
    invitations_per_day?: number;
    search_time?: string;
    end_time?: string;
    timezone?: string;
    sector?: string;
    location?: string;
    decision_maker?: string;
    selected_days?: number[];
  };
  injection?: {
    auto_add?: boolean;
    ignore_duplicates?: boolean;
    prioritize_linkedin?: boolean;
  };
  prospection_playbook?: Partial<ProspectionPlaybook>;
  language?: "français" | "english";
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// GET: All flows for the current client
// ---------------------------------------------------------------------------
export async function getClientFlows(): Promise<{
  data: ClientFlow[] | null;
  error: string | null;
}> {
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
export async function getFlowCampaigns(
  flowId: string,
): Promise<{ data: Campaign[] | null; error: string | null }> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("flow_id", flowId)
    .order("created_at", { ascending: false });

  if (error)
    return { data: null, error: "Erreur lors du chargement des campagnes" };
  return { data, error: null };
}

// ---------------------------------------------------------------------------
// GET: Detail of a single campaign + its workflow steps
// ---------------------------------------------------------------------------
export async function getCampaignDetail(campaignId: string): Promise<{
  campaign: Campaign | null;
  steps: WorkflowStepWithAgent[] | null;
  error: string | null;
}> {
  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id)
    return { campaign: null, steps: null, error: "Non authentifié" };

  const supabase = await createSupabaseServerClient();

  const { data: campaign, error: campError } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (campError || !campaign)
    return { campaign: null, steps: null, error: "Campagne non trouvée" };

  if (campaign.sequence_id) {
    const { data: steps, error: stepsError } = await supabase
      .from("sequence_steps")
      .select(
        `
        *,
        agent:agents (
          name,
          slug,
          role,
          description
        )
      `,
      )
      .eq("sequence_id", campaign.sequence_id)
      .order("step_order", { ascending: true });

    if (stepsError) {
      return {
        campaign,
        steps: null,
        error: "Erreur lors du chargement des étapes",
      };
    }

    const flattenedSteps = (steps || []).map((s: any) => ({
      ...s,
      agent_name: s.agent?.name,
      agent_slug: s.agent?.slug,
      agent_role: s.agent?.role,
      agent_description: s.agent?.description,
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
      config: config, // All campaign-specific settings live here
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
  config: Partial<ProspectingCampaignConfig> & {
    display_name?: string;
    objective?: string;
  },
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

  if (config.prospection_playbook) {
    merged.prospection_playbook = normalizeProspectionPlaybook(
      {
        ...(current.config?.prospection_playbook ?? {}),
        ...config.prospection_playbook,
      },
      {
        goal: String(config.objective || current.config?.offer || current.config?.target_description || ""),
        offer: String(current.config?.offer || current.config?.target_description || ""),
        tone: String(current.config?.tone || ""),
        roles: current.config?.personas || [],
        industries: current.config?.target_icp?.industries || current.config?.target_icp?.sectors || [],
        companySizes: current.config?.target_icp?.company_size || current.config?.target_icp?.company_sizes || [],
        locations: current.config?.target_icp?.locations || current.config?.target_icp?.geographies || [],
      },
    );
  }

  const updatePayload: Record<string, any> = { config: merged };
  if (config.display_name) updatePayload.display_name = config.display_name;
  if (config.objective) updatePayload.objective = config.objective;

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
  initialConfig?: ProspectingCampaignConfig,
): Promise<{ data: Campaign | null; error: string | null }> {
  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id)
    return { data: null, error: "Non authentifié" };

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
        display_name: "Prospection Linkedin",
        description: "Extraction et engagement autonome de leads qualifiés sur Linkedin.",
        status: "active",

        route: "/flows/prospecting",
      })
      .select()
      .single();
    if (flowErr || !newFlow)
      return { data: null, error: "Impossible de créer le flux parent" };
    flow = newFlow;
  }

  if (!flow) return { data: null, error: "Flux parent introuvable" };

  const { data: clientConfig } = await supabase
    .from("client_configs")
    .select("extra_config")
    .eq("client_id", user.profile.client_id)
    .maybeSingle();

  const baseConfig: ProspectingCampaignConfig = {
    target_icp: { sectors: [], company_size: [], locations: [] },
    personas: [],
    tone: "",
    prospection: {
      mode: "auto",
      prospects_per_day: 17,
      messages_per_day: 7,
      invitations_per_day: 10,
      search_time: "09:00",
      end_time: "18:00",
      timezone: "Europe/Paris",
      sector: "",
      location: "",
      decision_maker: "",
    },
    injection: {
      auto_add: true,
      ignore_duplicates: true,
      prioritize_linkedin: true,
    },
    language: "français",
    ...initialConfig,
  };
  const defaultConfig: ProspectingCampaignConfig = {
    ...baseConfig,
    prospection_playbook: normalizeProspectionPlaybook(
      baseConfig.prospection_playbook ??
      clientConfig?.extra_config?.prospection_playbook_defaults ??
      clientConfig?.extra_config?.prospection_playbook,
      {
        goal: baseConfig.offer || baseConfig.target_description || displayName,
        offer: baseConfig.offer || baseConfig.target_description,
        tone: baseConfig.tone,
        roles: baseConfig.personas || [],
        industries: baseConfig.target_icp?.industries || baseConfig.target_icp?.sectors || [],
        companySizes: baseConfig.target_icp?.company_size || baseConfig.target_icp?.company_sizes || [],
        locations: baseConfig.target_icp?.locations || baseConfig.target_icp?.geographies || [],
      },
    ),
  };

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      flow_id: flow.id,
      organization_id: user.profile.client_id,
      name: displayName,
      display_name: displayName,
      objective: defaultConfig.offer || null,
      target_description:
        defaultConfig.target_description || defaultConfig.offer || null,
      target_roles: defaultConfig.personas || [],
      target_industries:
        defaultConfig.target_icp?.sectors ||
        defaultConfig.target_icp?.industries ||
        [],
      target_locations:
        defaultConfig.target_icp?.locations ||
        defaultConfig.target_icp?.geographies ||
        [],
      target_company_size:
        defaultConfig.target_icp?.company_size ||
        defaultConfig.target_icp?.company_sizes ||
        [],
      tone: defaultConfig.tone || null,
      source: Array.isArray(defaultConfig.sources)
        ? defaultConfig.sources[0]
        : defaultConfig.source || null,
      status: "paused",
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
      .insert({
        client_id: user.profile.client_id,
        name: `${displayName} Sequence`,
      })
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
        config: {
          channel: "LinkedIn",
          message: "Génération de la séquence en cours...",
        },
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
    return {
      data: campaign,
      error: `Campagne créée mais la génération de séquence a échoué: ${genResult.error}`,
    };
  }

  revalidatePath(`/flows/prospecting/${campaign.id}`);
  revalidatePath("/flows/prospecting");
  return { data: campaign, error: null };
}

export async function deleteCampaign(
  campaignId: string,
): Promise<{ success?: boolean; error?: string }> {
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
  status: CampaignStatus,
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
export async function saveSequenceSteps(
  campaignId: string,
  steps: any[],
): Promise<{ success?: boolean; error?: string }> {
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
      .insert({
        client_id: user.profile.client_id,
        name: `${campaign.display_name || "Campagne"} Sequence`,
      })
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
      config: { ...s.config, channel: s.channel },
    }));

    const { error: insertError } = await serviceClient
      .from("sequence_steps")
      .insert(rows);
    if (insertError) {
      console.error("Insert steps error:", insertError);
      return { error: "Erreur lors de l'enregistrement des étapes" };
    }

    // --- SYNC PENDING ACTIONS ---
    try {
      await syncPendingActionsWithNewSteps(supabase, campaignId, steps);
    } catch (syncErr) {
      console.error("Sync pending actions failed:", syncErr);
      // We don't return error here because the steps ARE saved
    }
  }

  revalidatePath(`/flows/prospecting/${campaignId}`);
  revalidatePath("/flows/prospecting");
  return { success: true };
}

// ---------------------------------------------------------------------------
// GENERATE & SAVE SEQUENCE: Use AI to generate a sequence and save it
// ---------------------------------------------------------------------------
export async function generateAndSaveSequence(
  campaignId: string,
): Promise<{ success?: boolean; error?: string }> {
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
    if (
      error.name === "ZodError" ||
      (error.issues && Array.isArray(error.issues))
    ) {
      return {
        error:
          "L'IA a généré une séquence au format invalide. Veuillez réessayer (cela arrive parfois).",
      };
    }

    return {
      error: error.message || "Erreur lors de la génération de la séquence",
    };
  }
}

export async function deleteProspects(
  ids: string[],
): Promise<{ success: boolean; error?: string }> {
  if (!ids || ids.length === 0)
    return { success: false, error: "Aucun ID fourni" };

  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id)
    return { success: false, error: "Non authentifié" };
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
    await logCampaignActivities(
      prospects.map((p) => ({
        clientId,
        campaignId: p.campaign_id,
        action: "prospect.deleted",
        entityType: "prospect",
        entityId: p.id,
        actorType: "user",
        metadata: {
          prospect_name: p.decision_maker || "un prospect",
          campaign_id: p.campaign_id,
        },
      })),
    );

    // Revalidate specific campaign pages
    const uniqueCampaignIds = Array.from(
      new Set(prospects.map((p) => p.campaign_id).filter(Boolean)),
    );
    uniqueCampaignIds.forEach((cid) => {
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
  apiKey: string,
) {
  const { data: prospect, error: prospectError } = await supabase
    .from("prospects")
    .select(
      `
      *,
      company:companies (
        industry,
        size_range,
        description,
        website,
        linkedin_url,
        location
      )
    `,
    )
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
    apiKey,
  );

  const finalQualificationStatus = "qualified";

  // Personalize sequence after qualification. Human confirmation decides whether
  // the runner is allowed to enqueue and execute the sequence.
  let personalizedSequence = null;
  if (sequenceSteps.length > 0) {
    try {
      personalizedSequence = await personalizeSequenceForProspect(
        prospect,
        campaign,
        sequenceSteps,
        qualification,
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
      company_description:
        prospect.company_description ||
        prospect.company?.description ||
        prospect.extra_data?.about ||
        null,
      profile_url: prospect.profile_url || prospect.linkedin_url,
      website_url: prospect.website_url || prospect.website,
      raw_data:
        prospect.raw_data && Object.keys(prospect.raw_data).length > 0
          ? prospect.raw_data
          : prospect.extra_data || {},
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
          recent_serp_sources: qualification.recent_serp_sources || [],
          recent_serp_context: qualification.recent_serp_context || null,
          qualified_at: new Date().toISOString(),
        },
        sequence_decision: {
          status: "pending",
          decided_at: null,
        },
        personalized_sequence: personalizedSequence,
      },
      status: finalQualificationStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", prospectId)
    .eq("client_id", clientId)
    .select(
      `
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
    `,
    )
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
      prospect_name:
        updated.decision_maker || updated.full_name || "un prospect",
      company_name: updated.company_name || null,
      qualification_level: updated.qualification_level,
      qualification_status: updated.qualification_status,
      fit_score: updated.fit_score,
      sequence_decision: "pending",
      extension_actions_created: 0,
      extension_actions_skipped: 0,
    },
  });

  return updated;
}

export async function qualifyProspect(
  prospectId: string,
): Promise<{ data: any | null; error: string | null }> {
  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id)
    return { data: null, error: "Non authentifié" };

  try {
    const apiKey = await getOpenAIKeyForClient(user.profile.client_id);
    const supabase = await createSupabaseServerClient();
    const data = await qualifyProspectRecord(
      supabase,
      user.profile.client_id,
      prospectId,
      apiKey,
    );

    revalidatePath("/flows/prospecting");
    if (data.campaign_id)
      revalidatePath(`/flows/prospecting/${data.campaign_id}`);

    return { data, error: null };
  } catch (error: any) {
    return {
      data: null,
      error: error.message || "Erreur lors de la qualification",
    };
  }
}

export async function qualifyProspects(prospectIds: string[]): Promise<{
  data: any[];
  errors: { id: string; error: string }[];
  success: boolean;
}> {
  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id) {
    return {
      data: [],
      errors: prospectIds.map((id) => ({ id, error: "Non authentifié" })),
      success: false,
    };
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
      errors: ids.map((id) => ({
        id,
        error: error.message || "Clé OpenAI introuvable",
      })),
      success: false,
    };
  }

  const data: any[] = [];
  const errors: { id: string; error: string }[] = [];

  for (const id of ids) {
    try {
      data.push(
        await qualifyProspectRecord(
          supabase,
          user.profile.client_id,
          id,
          apiKey,
        ),
      );
    } catch (error: any) {
      errors.push({
        id,
        error: error.message || "Erreur lors de la qualification",
      });
    }
  }

  revalidatePath("/flows/prospecting");
  data.forEach((prospect) => {
    if (prospect.campaign_id)
      revalidatePath(`/flows/prospecting/${prospect.campaign_id}`);
  });

  return { data, errors, success: errors.length === 0 };
}

// ---------------------------------------------------------------------------
// HELPER: Sync pending actions with updated sequence steps
// ---------------------------------------------------------------------------
async function syncPendingActionsWithNewSteps(
  supabase: any,
  campaignId: string,
  steps: any[],
) {
  // 1. Create a map of stepId -> template message
  const messageTemplates: Record<string, string> = {};

  function collectTemplates(items: any[]) {
    for (const item of items || []) {
      if (item.id && item.config?.message) {
        messageTemplates[String(item.id)] = item.config.message;
      }
      if (item.config?.yesBranch) collectTemplates(item.config.yesBranch);
      if (item.config?.noBranch) collectTemplates(item.config.noBranch);
    }
  }
  collectTemplates(steps);

  // 2. Fetch all ready/pending actions for this campaign
  const { data: actions } = await supabase
    .from("extension_actions")
    .select("id, message_id, prospect_id, payload")
    .eq("campaign_id", campaignId)
    .in("status", ["pending", "ready"]);

  if (!actions || actions.length === 0) return;

  // 3. Update each action if its step exists in our templates
  for (const action of actions) {
    const payload = (action.payload || {}) as any;
    const stepId = payload.step_id;
    const newTemplate = messageTemplates[String(stepId)];

    if (newTemplate) {
      // Fetch prospect for variables replacement and personalization check
      const { data: prospect } = await supabase
        .from("prospects")
        .select("id, full_name, decision_maker, company_name, role, role_title, location, extra_data")
        .eq("id", action.prospect_id)
        .single();

      if (!prospect) continue;

      // --- CHECK FOR PERSONALIZATION ---
      const personalizations = prospect.extra_data?.personalized_sequence?.steps || prospect.extra_data?.personalized_sequence || [];
      const personalizedStep = Array.isArray(personalizations) 
        ? personalizations.find((ps: any) => String(ps.step_id || ps.id) === String(stepId))
        : null;

      const hasPersonalizedMessage = personalizedStep && (personalizedStep.personalized_message || personalizedStep.message);

      if (hasPersonalizedMessage) {
        // Skip updating this action as it has a specific personalization
        continue;
      }

      // Simple variable replacement
      const fullName = prospect.full_name || prospect.decision_maker || "";
      const [firstName = "", ...rest] = String(fullName).trim().split(/\s+/);
      const lastName = rest.join(" ");

      const newMessage = newTemplate
        .replace(/{{first_name}}/g, firstName)
        .replace(/{{last_name}}/g, lastName)
        .replace(/{{company}}/g, prospect.company_name || "")
        .replace(/{{role}}/g, prospect.role_title || prospect.role || "")
        .replace(/{{location}}/g, prospect.location || "")
        .trim();

      // Update extension_actions payload
      await supabase
        .from("extension_actions")
        .update({
          payload: {
            ...payload,
            message: newMessage,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", action.id);

      // Update associated message if exists
      if (action.message_id) {
        await supabase
          .from("messages")
          .update({
            body: newMessage,
            updated_at: new Date().toISOString(),
          })
          .eq("id", action.message_id);
      }
    }
  }
}

type ProspectSequenceDecision = "confirmed" | "paused" | "removed";

const PROSPECT_WITH_COMPANY_SELECT = `
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
`;

async function cancelPendingSequenceActions(
  supabase: any,
  clientId: string,
  prospectId: string,
  campaignId?: string | null,
) {
  let actionQuery = supabase
    .from("extension_actions")
    .select("id, message_id")
    .eq("client_id", clientId)
    .eq("prospect_id", prospectId)
    .in("status", ["pending", "ready"]);

  if (campaignId) actionQuery = actionQuery.eq("campaign_id", campaignId);

  const { data: actions } = await actionQuery;
  const actionIds = (actions || [])
    .map((action: any) => action.id)
    .filter(Boolean);
  const messageIds = (actions || [])
    .map((action: any) => action.message_id)
    .filter(Boolean);

  if (actionIds.length > 0) {
    await supabase
      .from("extension_actions")
      .update({
        status: "cancelled",
        dedupe_key: null,
        error_message: "Sequence mise en pause ou retiree par l'utilisateur",
        updated_at: new Date().toISOString(),
      })
      .in("id", actionIds);
  }

  if (messageIds.length > 0) {
    await supabase
      .from("messages")
      .update({
        status: "rejected",
        updated_at: new Date().toISOString(),
      })
      .in("id", messageIds)
      .eq("client_id", clientId)
      .eq("status", "ready_to_send");
  }

  return actionIds.length;
}

export async function setProspectSequenceDecision(
  prospectId: string,
  decision: ProspectSequenceDecision,
): Promise<{
  success: boolean;
  data?: any;
  removed?: boolean;
  created?: number;
  skipped?: number;
  cancelled?: number;
  error?: string;
}> {
  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id)
    return { success: false, error: "Non authentifié" };

  const clientId = user.profile.client_id;
  const supabase = await createSupabaseServerClient();

  const { data: prospect, error: prospectError } = await supabase
    .from("prospects")
    .select(
      "*, company:companies (industry, size_range, description, website, linkedin_url, location)",
    )
    .eq("id", prospectId)
    .eq("client_id", clientId)
    .single();

  if (prospectError || !prospect) {
    return { success: false, error: "Prospect introuvable" };
  }

  const campaignId = prospect.campaign_id;
  const decidedAt = new Date().toISOString();
  const currentExtraData = prospect.extra_data || {};

  try {
    if (decision === "removed") {
      const cancelled = await cancelPendingSequenceActions(
        supabase,
        clientId,
        prospectId,
        campaignId,
      );

      const { error } = await supabase
        .from("prospects")
        .update({
          campaign_id: null,
          status: "rejected_by_user",
          extra_data: {
            ...currentExtraData,
            sequence_decision: {
              status: "removed",
              decided_at: decidedAt,
            },
          },
          updated_at: decidedAt,
        })
        .eq("id", prospectId)
        .eq("client_id", clientId);

      if (error) throw new Error(error.message);

      if (campaignId) {
        await logCampaignActivity({
          clientId,
          campaignId,
          action: "prospect.sequence.removed",
          entityType: "prospect",
          entityId: prospectId,
          actorType: "user",
          metadata: {
            prospect_name:
              prospect.decision_maker || prospect.full_name || "un prospect",
            campaign_id: campaignId,
            cancelled_actions: cancelled,
          },
        });
        revalidatePath(`/flows/prospecting/${campaignId}`);
      }
      revalidatePath("/flows/prospecting");
      return { success: true, removed: true, cancelled };
    }

    if (!campaignId) {
      return {
        success: false,
        error: "Ce prospect n'est rattaché à aucune campagne",
      };
    }

    const cancelled =
      decision === "paused"
        ? await cancelPendingSequenceActions(
            supabase,
            clientId,
            prospectId,
            campaignId,
          )
        : 0;

    const sequenceDecision = {
      status: decision,
      decided_at: decidedAt,
    };

    const { data: updated, error: updateError } = await supabase
      .from("prospects")
      .update({
        status: "qualified",
        qualification_status: "qualified",
        extra_data: {
          ...currentExtraData,
          sequence_decision: sequenceDecision,
        },
        updated_at: decidedAt,
      })
      .eq("id", prospectId)
      .eq("client_id", clientId)
      .select(PROSPECT_WITH_COMPANY_SELECT)
      .single();

    if (updateError || !updated) {
      throw new Error(
        updateError?.message || "Impossible de mettre à jour le prospect",
      );
    }

    let created = 0;
    let skipped = 0;

    if (decision === "confirmed") {
      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", campaignId)
        .single();

      if (campaignError || !campaign) throw new Error("Campagne introuvable");

      let sequenceSteps: any[] = [];
      if (campaign.sequence_id) {
        const { data: steps } = await supabase
          .from("sequence_steps")
          .select("*")
          .eq("sequence_id", campaign.sequence_id)
          .order("step_order", { ascending: true });
        sequenceSteps = steps || [];
      }

      const enqueueResult = await enqueueExtensionActionsForQualifiedProspect({
        supabase,
        clientId,
        prospect: {
          ...updated,
          client_id: clientId,
        },
        campaign,
        sequenceSteps,
        personalizedSequence: updated.extra_data?.personalized_sequence,
      });
      created = enqueueResult.created;
      skipped = enqueueResult.skipped;
    }

    await logCampaignActivity({
      clientId,
      campaignId,
      action: `prospect.sequence.${decision}`,
      entityType: "prospect",
      entityId: prospectId,
      actorType: "user",
      metadata: {
        prospect_name:
          updated.decision_maker || updated.full_name || "un prospect",
        campaign_id: campaignId,
        sequence_decision: decision,
        extension_actions_created: created,
        extension_actions_skipped: skipped,
        cancelled_actions: cancelled,
      },
    });

    revalidatePath("/flows/prospecting");
    revalidatePath(`/flows/prospecting/${campaignId}`);
    return { success: true, data: updated, created, skipped, cancelled };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Erreur lors de la mise à jour de la séquence",
    };
  }
}

// ---------------------------------------------------------------------------
// GET: All prospects for the current organization (client)
// ---------------------------------------------------------------------------
export async function getOrganizationProspects(): Promise<{
  data: any[] | null;
  error: string | null;
}> {
  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id)
    return { data: null, error: "Non authentifié" };

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("prospects")
    .select(
      `
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
    `,
    )
    .eq("client_id", user.profile.client_id)
    .order("created_at", { ascending: false });

  if (error)
    return {
      data: null,
      error: "Erreur lors du chargement des prospects de l'organisation",
    };
  return { data, error: null };
}

// ---------------------------------------------------------------------------
// GET: All contact lists for the current organization
// ---------------------------------------------------------------------------
export async function getContactLists(): Promise<{
  data: any[] | null;
  error: string | null;
}> {
  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id)
    return { data: null, error: "Non authentifié" };

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("contact_lists")
    .select("*")
    .eq("client_id", user.profile.client_id)
    .order("created_at", { ascending: false });

  if (error)
    return { data: null, error: "Erreur lors du chargement des listes" };
  return { data, error: null };
}

// ---------------------------------------------------------------------------
// GET: Prospects for a specific contact list
// ---------------------------------------------------------------------------
export async function getProspectsByList(
  listId: string,
): Promise<{ data: any[] | null; error: string | null }> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("prospect_list_members")
    .select(
      `
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
    `,
    )
    .eq("list_id", listId);

  if (error)
    return {
      data: null,
      error: "Erreur lors du chargement des prospects de la liste",
    };

  const flattened = (data || [])
    .map((item: any) => item.prospect)
    .filter(Boolean);
  return { data: flattened, error: null };
}

// ---------------------------------------------------------------------------
export async function createContactList(
  name: string,
  description?: string,
): Promise<{ success: boolean; data?: any; error?: string }> {
  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id)
    return { success: false, error: "Non authentifié" };

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("contact_lists")
    .insert({
      client_id: user.profile.client_id,
      name,
      description,
    })
    .select()
    .single();

  if (error) {
    console.error("Create list error:", error);
    return { success: false, error: "Erreur lors de la création de la liste" };
  }

  revalidatePath("/flows/prospecting");
  return { success: true, data };
}

// DELETE: A contact list
// ---------------------------------------------------------------------------
export async function deleteContactList(
  listId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id)
    return { success: false, error: "Non authentifié" };

  const supabase = await createSupabaseServerClient();

  // 1. Members will be deleted by DB cascade if configured, 
  // but let's be explicit if not sure about cascade rules on this specific junction.
  await supabase.from("prospect_list_members").delete().eq("list_id", listId);

  const { error } = await supabase
    .from("contact_lists")
    .delete()
    .eq("id", listId)
    .eq("client_id", user.profile.client_id);

  if (error) {
    console.error("Delete list error:", error);
    return { success: false, error: "Erreur lors de la suppression de la liste" };
  }

  revalidatePath("/flows/prospecting");
  return { success: true };
}

// ---------------------------------------------------------------------------
// UPDATE PROSPECT PERSONALIZATION: Save manual edits to the sequence
// ---------------------------------------------------------------------------
export async function updateProspectPersonalization(
  prospectId: string,
  personalizedSequence: any,
): Promise<{ success?: boolean; error?: string }> {
  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id) return { error: "Non authentifié" };

  const supabase = await createSupabaseServerClient();

  const { data: prospect } = await supabase
    .from("prospects")
    .select("extra_data")
    .eq("id", prospectId)
    .eq("client_id", user.profile.client_id)
    .single();

  const { error } = await supabase
    .from("prospects")
    .update({
      extra_data: {
        ...(prospect?.extra_data || {}),
        personalized_sequence: personalizedSequence,
      },
    })
    .eq("id", prospectId)
    .eq("client_id", user.profile.client_id);

  if (error) {
    console.error("Error updating personalization:", error);
    return { error: "Impossible de sauvegarder la personnalisation" };
  }

  // --- SYNC WITH QUEUE ---
  try {
    await syncProspectActionsWithPersonalization(supabase, prospectId, personalizedSequence);
  } catch (syncErr) {
    console.error("Sync personalization with queue failed:", syncErr);
  }

  revalidatePath("/flows/prospecting");
  return { success: true };
}
export async function bulkUpdateProspectPersonalizations(
  updates: { prospectId: string; personalizedSequence: any }[],
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
      personalized_sequence: update.personalizedSequence,
    };

    const { error } = await supabase
      .from("prospects")
      .update({
        extra_data: newExtraData,
      })
      .eq("id", update.prospectId)
      .eq("client_id", user.profile.client_id);

    if (error) {
      console.error(
        `Error updating personalization for ${update.prospectId}:`,
        error,
      );
    } else {
      // --- SYNC WITH QUEUE ---
      try {
        await syncProspectActionsWithPersonalization(supabase, update.prospectId, update.personalizedSequence);
      } catch (syncErr) {
        console.error(`Sync for ${update.prospectId} failed:`, syncErr);
      }
    }
  }

  revalidatePath("/flows/prospecting");
  return { success: true };
}

// ---------------------------------------------------------------------------
// HELPER: Sync a single prospect's actions with their personalization
// ---------------------------------------------------------------------------
async function syncProspectActionsWithPersonalization(
  supabase: any,
  prospectId: string,
  personalizedSequence: any,
) {
  const steps = Array.isArray(personalizedSequence?.steps) 
    ? personalizedSequence.steps 
    : Array.isArray(personalizedSequence) ? personalizedSequence : [];
  
  if (steps.length === 0) return;

  // 1. Fetch ready/pending actions
  const { data: actions } = await supabase
    .from("extension_actions")
    .select("id, message_id, payload")
    .eq("prospect_id", prospectId)
    .in("status", ["pending", "ready"]);

  if (!actions || actions.length === 0) return;

  // 2. Update actions
  for (const action of actions) {
    const payload = (action.payload || {}) as any;
    const stepId = payload.step_id;
    const personalizedStep = steps.find((s: any) => String(s.step_id || s.id) === String(stepId));
    
    const newMessage = personalizedStep?.personalized_message || personalizedStep?.message;

    if (newMessage && typeof newMessage === "string" && newMessage.trim()) {
      // Update extension_actions
      await supabase
        .from("extension_actions")
        .update({
          payload: {
            ...payload,
            message: newMessage.trim(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", action.id);

      // Update messages table
      if (action.message_id) {
        await supabase
          .from("messages")
          .update({
            body: newMessage.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", action.message_id);
      }
    }
  }
}


// ---------------------------------------------------------------------------
// MOVE: Move prospects to another campaign
// ---------------------------------------------------------------------------
export async function moveProspectsToCampaign(
  prospectIds: string[],
  targetCampaignId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!prospectIds.length)
    return { success: false, error: "Aucun prospect sélectionné" };

  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id)
    return { success: false, error: "Non authentifié" };

  const supabase = await createSupabaseServerClient();

  // 1. Update campaign_id and reset ICP context for these prospects
  const { error } = await supabase
    .from("prospects")
    .update({
      campaign_id: targetCampaignId,
      fit_score: null,
      pre_score: null,
      pre_score_level: null,
      qualification_status: "collected",
      qualification_level: null,
      qualification_reason: null,
      updated_at: new Date().toISOString(),
    })
    .in("id", prospectIds)
    .eq("client_id", user.profile.client_id);

  if (error) {
    console.error("Move prospects error:", error);
    return {
      success: false,
      error: "Erreur lors du déplacement des prospects",
    };
  }

  // 2. Log activity
  await logCampaignActivity({
    clientId: user.profile.client_id,
    campaignId: targetCampaignId,
    action: "prospects.moved",
    entityType: "campaign",
    entityId: targetCampaignId,
    actorType: "user",
    metadata: {
      count: prospectIds.length,
      target_campaign_id: targetCampaignId,
    },
  });

  revalidatePath("/flows/prospecting");
  revalidatePath(`/flows/prospecting/${targetCampaignId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// ADD: Add prospects to a list
// ---------------------------------------------------------------------------
export async function addProspectsToList(
  prospectIds: string[],
  listId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!prospectIds.length)
    return { success: false, error: "Aucun prospect sélectionné" };

  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id)
    return { success: false, error: "Non authentifié" };

  const supabase = await createSupabaseServerClient();

  const rows = prospectIds.map((pid) => ({
    prospect_id: pid,
    list_id: listId,
  }));

  const { error } = await supabase
    .from("prospect_list_members")
    .upsert(rows, { onConflict: "prospect_id,list_id" });

  if (error) {
    console.error("Add prospects to list error:", error);
    return { success: false, error: "Erreur lors de l'ajout à la liste" };
  }

  revalidatePath("/flows/prospecting");
  return { success: true };
}

// ---------------------------------------------------------------------------
// GET: All campaigns for the organization (across all flows)
// ---------------------------------------------------------------------------
export async function getOrganizationCampaigns(): Promise<{
  data: Campaign[] | null;
  error: string | null;
}> {
  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id)
    return { data: null, error: "Non authentifié" };

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("organization_id", user.profile.client_id)
    .order("created_at", { ascending: false });

  if (error)
    return { data: null, error: "Erreur lors du chargement des campagnes" };
  return { data, error: null };
}

export async function getProspectsMembership(prospectIds: string[]): Promise<{
  campaigns: Record<string, string[]>;
  lists: Record<string, string[]>;
}> {
  const supabase = await createSupabaseServerClient();

  const { data: campaignData } = await supabase
    .from("prospects")
    .select("id, campaign_id")
    .in("id", prospectIds);

  const campaigns: Record<string, string[]> = {};
  (campaignData || []).forEach((p) => {
    if (p.campaign_id) {
      if (!campaigns[p.campaign_id]) campaigns[p.campaign_id] = [];
      campaigns[p.campaign_id].push(p.id);
    }
  });

  const { data: listData } = await supabase
    .from("prospect_list_members")
    .select("prospect_id, list_id")
    .in("prospect_id", prospectIds);

  const lists: Record<string, string[]> = {};
  (listData || []).forEach((m) => {
    if (!lists[m.list_id]) lists[m.list_id] = [];
    lists[m.list_id].push(m.prospect_id);
  });

  return { campaigns, lists };
}

// ---------------------------------------------------------------------------
// REMOVE: Remove prospects from a list
// ---------------------------------------------------------------------------
export async function removeFromList(
  prospectIds: string[],
  listId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!prospectIds.length)
    return { success: false, error: "Aucun prospect sélectionné" };

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("prospect_list_members")
    .delete()
    .in("prospect_id", prospectIds)
    .eq("list_id", listId);

  if (error) {
    console.error("Remove prospects from list error:", error);
    return { success: false, error: "Erreur lors du retrait de la liste" };
  }

  revalidatePath("/flows/prospecting");
  return { success: true };
}

// ---------------------------------------------------------------------------
// REMOVE: Remove prospects from campaign
// ---------------------------------------------------------------------------
export async function removeFromCampaign(
  prospectIds: string[],
): Promise<{ success: boolean; error?: string }> {
  if (!prospectIds.length)
    return { success: false, error: "Aucun prospect sélectionné" };

  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id)
    return { success: false, error: "Non authentifié" };

  const supabase = await createSupabaseServerClient();
  const clientId = user.profile.client_id;

  const { data: prospects } = await supabase
    .from("prospects")
    .select("id, campaign_id")
    .in("id", prospectIds)
    .eq("client_id", clientId);

  for (const prospect of prospects || []) {
    await cancelPendingSequenceActions(
      supabase,
      clientId,
      prospect.id,
      prospect.campaign_id,
    );
  }

  const { error } = await supabase
    .from("prospects")
    .update({
      campaign_id: null,
      status: "rejected_by_user",
      updated_at: new Date().toISOString(),
    })
    .in("id", prospectIds)
    .eq("client_id", clientId);

  if (error) {
    console.error("Remove prospects from campaign error:", error);
    return { success: false, error: "Erreur lors du retrait de la campagne" };
  }

  revalidatePath("/flows/prospecting");
  return { success: true };
}
