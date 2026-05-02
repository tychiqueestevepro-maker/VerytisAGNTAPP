import { createSupabaseServiceClient } from "@/lib/supabase/server";

type CampaignActivityInput = {
  clientId: string;
  campaignId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string | null;
  actorType?: "user" | "agent" | "system" | "integration";
  metadata?: Record<string, unknown>;
};

export async function logCampaignActivity(input: CampaignActivityInput) {
  try {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.from("audit_logs").insert({
      client_id: input.clientId,
      actor_type: input.actorType ?? "system",
      action: input.action,
      entity_type: input.entityType ?? "prospect",
      entity_id: input.entityId ?? null,
      metadata: {
        ...(input.metadata ?? {}),
        campaign_id: input.campaignId ?? null,
      },
    });

    if (error) {
      console.warn("[Activity] Unable to write audit log:", error.message);
    }
  } catch (error) {
    console.warn("[Activity] Unable to write audit log:", error);
  }
}

export async function logCampaignActivities(inputs: CampaignActivityInput[]) {
  const rows = inputs
    .filter((input) => input.clientId && input.action)
    .map((input) => ({
      client_id: input.clientId,
      actor_type: input.actorType ?? "system",
      action: input.action,
      entity_type: input.entityType ?? "prospect",
      entity_id: input.entityId ?? null,
      metadata: {
        ...(input.metadata ?? {}),
        campaign_id: input.campaignId ?? null,
      },
    }));

  if (rows.length === 0) return;

  try {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.from("audit_logs").insert(rows);
    if (error) {
      console.warn("[Activity] Unable to write audit logs:", error.message);
    }
  } catch (error) {
    console.warn("[Activity] Unable to write audit logs:", error);
  }
}
