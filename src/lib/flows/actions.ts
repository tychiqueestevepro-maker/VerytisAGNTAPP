"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserWithProfile } from "@/lib/auth";
import { ClientFlow, WorkflowStepWithAgent } from "@/types/flows";
import { revalidatePath } from "next/cache";

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
    .in("status", ["setup_required", "active", "paused"])
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching client flows:", error);
    return { data: null, error: "Impossible de charger les flows" };
  }

  return { data, error: null };
}

// ---------------------------------------------------------------------------
// GET: Detail of a single flow + its workflow steps
// ---------------------------------------------------------------------------
export async function getFlowDetail(flowKey: string): Promise<{ 
  flow: ClientFlow | null; 
  steps: WorkflowStepWithAgent[] | null; 
  error: string | null 
}> {
  const user = await getUserWithProfile();
  
  if (!user || !user.profile?.client_id) {
    return { flow: null, steps: null, error: "Non authentifié" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: flow, error: flowError } = await supabase
    .from("client_flows")
    .select("*")
    .eq("client_id", user.profile.client_id)
    .eq("flow_key", flowKey)
    .single();

  if (flowError || !flow) {
    return { flow: null, steps: null, error: "Flow non trouvé" };
  }

  if (flow.workflow_id) {
    const { data: steps, error: stepsError } = await supabase
      .from("workflow_steps")
      .select(`
        *,
        agent:agents (
          name,
          slug,
          role,
          description
        )
      `)
      .eq("workflow_id", flow.workflow_id)
      .order("step_order", { ascending: true });

    if (stepsError) {
      return { flow, steps: null, error: "Erreur lors du chargement des étapes" };
    }

    const flattenedSteps = steps.map((s: any) => ({
      ...s,
      agent_name: s.agent.name,
      agent_slug: s.agent.slug,
      agent_role: s.agent.role,
      agent_description: s.agent.description
    }));

    return { flow, steps: flattenedSteps, error: null };
  }

  return { flow, steps: [], error: null };
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
  flowId: string,
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

  if (!user || !user.profile?.client_id) {
    return { error: "Non authentifié" };
  }

  const supabase = await createSupabaseServerClient();

  // Fetch the current row to deep-merge (preserve existing keys not in the update)
  const { data: current, error: fetchError } = await supabase
    .from("client_flows")
    .select("config, client_id")
    .eq("id", flowId)
    .eq("client_id", user.profile.client_id)  // RLS guard
    .single();

  if (fetchError || !current) {
    return { error: "Campagne introuvable" };
  }

  const merged = {
    ...(current.config ?? {}),
    ...config,
    // Deep merge sub-objects
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
    .from("client_flows")
    .update(updatePayload)
    .eq("id", flowId)
    .eq("client_id", user.profile.client_id);

  if (updateError) return { error: "Erreur lors de la mise à jour" };

  revalidatePath("/app/flows/prospecting");
  return { success: true };
}

// ---------------------------------------------------------------------------
// CREATE: Create a new prospecting campaign for the current client
// ---------------------------------------------------------------------------
export async function createProspectingCampaign(
  displayName: string,
  initialConfig?: Record<string, any>
): Promise<{ data: ClientFlow | null; error: string | null }> {
  const user = await getUserWithProfile();

  if (!user || !user.profile?.client_id) {
    return { data: null, error: "Non authentifié" };
  }

  const supabase = await createSupabaseServerClient();

  const defaultConfig = {
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

  const { data, error } = await supabase
    .from("client_flows")
    .insert({
      client_id: user.profile.client_id,
      flow_key: "prospecting",
      display_name: displayName,
      status: "active",
      route: "/app/flows/prospecting",
      config: defaultConfig,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating campaign:", error);
    return { data: null, error: error.message };
  }

  revalidatePath("/app/flows/prospecting");
  return { data, error: null };
}

// ---------------------------------------------------------------------------
// PAUSE / RESUME / DELETE campaign
// ---------------------------------------------------------------------------
export async function setCampaignStatus(
  flowId: string,
  status: "active" | "paused" | "disabled"
): Promise<{ success?: boolean; error?: string }> {
  const user = await getUserWithProfile();

  if (!user || !user.profile?.client_id) {
    return { error: "Non authentifié" };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("client_flows")
    .update({ status })
    .eq("id", flowId)
    .eq("client_id", user.profile.client_id);

  if (error) return { error: "Erreur lors de la mise à jour du statut" };

  revalidatePath("/app/flows/prospecting");
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
    .from("client_flows")
    .select("sequence_id, display_name")
    .eq("id", campaignId)
    .eq("client_id", user.profile.client_id)
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
      .from("client_flows")
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
