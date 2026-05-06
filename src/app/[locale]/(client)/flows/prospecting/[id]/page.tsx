import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserWithProfile } from "@/lib/auth";
import { getCampaignDetail } from "@/lib/flows/actions";
import { TopLine } from "@/components/layout/top-line";
import { CampaignDashboardView } from "@/components/flows/campaign-dashboard-view";
import { getTranslations } from "next-intl/server";

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string;
  created_at: string;
  type?: string;
  detail?: string;
  photos?: string[];
  count?: number;
  action_raw?: string;
  groupNames: string[];
}

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const user = await getUserWithProfile();
  if (!user?.profile?.client_id) return { title: "Campagne" };

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("campaigns")
    .select("display_name")
    .eq("id", id)
    .single();

  return { title: `${data?.display_name ?? "Campagne"} — Prospection Flow` };
}

export default async function CampaignDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getUserWithProfile();
  const tAct = await getTranslations("Activities");

  if (!user?.profile?.client_id) notFound();

  const supabase = await createSupabaseServerClient();

  // Load the specific campaign and its steps
  const {
    campaign,
    steps: sequenceSteps,
    error: campaignError,
  } = await getCampaignDetail(id);

  if (campaignError || !campaign) notFound();

  // Load prospects for this campaign
  const { data: prospects } = await supabase
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
    .eq("campaign_id", id)
    .order("created_at", { ascending: false })
    .limit(1000);

  // NEW MODEL: Activity feed is driven 100% by audit_logs for consistency
  const normalizedId = String(id).toLowerCase().trim();

  // Fetch a larger set of logs for the client to ensure we catch recent campaign activities
  // Filtering in JS is more reliable than complex JSONB queries in PostgREST for this specific view
  const { data: rawAuditActivities, error: auditError } = await supabase
    .from("audit_logs")
    .select(
      `
      id, 
      action, 
      entity_type, 
      entity_id, 
      created_at, 
      metadata
    `,
    )
    .eq("client_id", user.profile.client_id)
    .order("created_at", { ascending: false })
    .limit(500);

  if (auditError) {
    console.error("Audit logs fetch error:", auditError);
  }

  // Filter in memory with high tolerance
  const auditActivitiesFiltered = (rawAuditActivities ?? []).filter((act: any) => {
    const meta = (act.metadata ?? {}) as any;
    // Check various possible keys for campaign ID in metadata
    const cid = meta.campaign_id || meta.campaignId || meta.campaign_ID;
    if (!cid) return false;
    return String(cid).toLowerCase().trim() === normalizedId;
  });

  // Manual Join: Fetch prospects mentioned in these logs to restore names/photos
  const prospectIds = Array.from(
    new Set(
      auditActivitiesFiltered
        .filter((act: any) => act.entity_type === "prospect" && act.entity_id)
        .map((act: any) => act.entity_id),
    ),
  );

  let prospectsMap: Record<string, any> = {};
  if (prospectIds.length > 0) {
    const { data: prospectDetails } = await supabase
      .from("prospects")
      .select("id, decision_maker, photo_url, company_name")
      .in("id", prospectIds);

    if (prospectDetails) {
      prospectsMap = prospectDetails.reduce<Record<string, any>>(
        (acc: Record<string, any>, p: any) => ({ ...acc, [p.id]: p }),
        {},
      );
    }
  }

  const auditActivities = auditActivitiesFiltered.map((act: any) => ({
    ...act,
    prospect: act.entity_id ? prospectsMap[act.entity_id] : null,
  }));

  const groupedAudit: ActivityLog[] = [];
  const windowMs = 60 * 1000; // 60s grouping window

  const sortedAudit = (auditActivities ?? []).sort(
    (a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  for (const act of sortedAudit) {
    const metadata = (act.metadata || {}) as any;
    const prospect = (act as any).prospect;
    const prospectName =
      prospect?.decision_maker?.split(/[,|•-]/)[0].trim() ||
      metadata.prospect_name ||
      "un prospect";
    const companyName = prospect?.company_name || metadata.company_name;
    const companySuffix = companyName ? ` (@${companyName})` : "";
    const photoUrl = prospect?.photo_url;

    const last = groupedAudit[groupedAudit.length - 1];
    const isWithinWindow =
      last &&
      new Date(last.created_at).getTime() - new Date(act.created_at).getTime() <
        windowMs;

    // Grouping logic for high-volume events
    const groupableActions = [
      "prospect.imported.extension",
      "prospect.imported.document",
      "prospect.deleted",
    ];

    if (
      isWithinWindow &&
      last.action_raw === act.action &&
      groupableActions.includes(act.action)
    ) {
      last.count = (last.count || 1) + 1;
      if (prospectName) last.groupNames.push(prospectName);
      if (photoUrl) {
        last.photos = last.photos || [];
        last.photos.push(photoUrl);
      }

      const name1 = last.groupNames[0].split(" ")[0];
      const name2 = last.groupNames[1] ? last.groupNames[1].split(" ")[0] : "";

      if (act.action.includes("imported")) {
        const sourceStr = act.action.includes("extension")
          ? "extension"
          : "document";
        
        const names = `${name1}${name2 ? ` & ${name2}` : ""}${last.count > 2 ? ` + ${last.count - 2}` : ""}`;
        
        last.action = tAct("profiles_imported_via", { source: sourceStr, names });
        last.detail = tAct("contacts_added_count", { count: last.count });
      } else if (act.action.includes("deleted")) {
        last.action = tAct("n_contacts_deleted", { count: last.count });
        last.detail = tAct("contacts_removed");
      }
    } else {
      let actionLabel = act.action;
      let detail = "Action enregistrée.";
      let type = act.action;

      // Manual User Actions Mapping
      if (act.action === "prospect.imported.extension") {
        actionLabel = tAct("imported_via_extension", { name: `${prospectName}${companySuffix}` });
        detail = tAct("profile_added");
      } else if (act.action === "prospect.imported.document") {
        actionLabel = tAct("imported_via_document", { name: `${prospectName}${companySuffix}` });
        detail = tAct("contact_added_from_file");
      } else if (act.action === "prospect.qualified") {
        const level = metadata.qualification_level
          ? `ICP ${metadata.qualification_level}`
          : "qualification terminée";
        const scoreStr = metadata.fit_score
          ? ` (Score ICP: ${metadata.fit_score}/100)`
          : "";
        actionLabel = tAct("qualification_done_for", { name: `${prospectName}${companySuffix}` });
        detail = tAct("qualification_result", { level, scoreStr });
      } else if (act.action === "prospect.sequence.confirmed") {
        actionLabel = tAct("sequence_confirmed_for", { name: `${prospectName}${companySuffix}` });
        detail = tAct("linkedin_actions_added", { count: metadata.extension_actions_created || 0 });
      } else if (act.action === "prospect.sequence.paused") {
        actionLabel = tAct("sequence_paused_for", { name: `${prospectName}${companySuffix}` });
        detail = tAct("pending_actions_cancelled", { count: metadata.cancelled_actions || 0 });
      } else if (act.action === "prospect.sequence.removed") {
        actionLabel = tAct("prospect_removed_name", { name: prospectName });
        detail = tAct("pending_actions_cancelled", { count: metadata.cancelled_actions || 0 });
      } else if (act.action === "prospect.deleted") {
        actionLabel = tAct("contact_deleted_name", { name: prospectName });
        detail = tAct("prospect_removed_from_campaign");
      }
      // Agent Task Actions Mapping
      else if (act.action.startsWith("task.")) {
        const agentName = metadata.agent_slug
          ? metadata.agent_slug.charAt(0).toUpperCase() +
            metadata.agent_slug.slice(1)
          : "Agent";
        const runType = metadata.run_type || "action";

        if (act.action.endsWith(".completed")) {
          if (runType === "enrichment") {
            actionLabel = tAct("agent_enriched", { agent: agentName, name: `${prospectName}${companySuffix}` });
            detail = tAct("enrichment_success");
          } else if (runType === "qualifier") {
            actionLabel = tAct("agent_qualified", { agent: agentName, name: `${prospectName}${companySuffix}` });
            detail = tAct("qualification_success");
          } else {
            actionLabel = tAct("agent_finished_step", { agent: agentName, step: runType });
            detail = tAct("step_completed_duration", { duration: metadata.duration_ms || "?" });
          }
        } else if (act.action.endsWith(".failed")) {
          actionLabel = tAct("step_failed_for", { step: runType, name: prospectName });
          detail =
            metadata.error || tAct("processing_error");
        } else {
          // Skip started logs to avoid clutter, unless specifically needed
          continue;
        }
        type = runType;
      }

      groupedAudit.push({
        ...act,
        action_raw: act.action,
        type,
        action: actionLabel,
        detail,
        count: 1,
        groupNames: [prospectName],
        photos: photoUrl ? [photoUrl] : [],
      });
    }
  }

  const mappedActivities = groupedAudit.slice(0, 20);

  const mappedProspects = (prospects ?? []).map((p: any) => ({
    ...p,
    company: Array.isArray(p.company)
      ? p.company[0] || null
      : p.company || null,
  }));

  const { data: extensionIntegration } = await supabase
    .from("integrations")
    .select("status, last_sync_at, extra_data")
    .eq("client_id", user.profile.client_id)
    .eq("integration_type", "chrome_extension")
    .maybeSingle();

  const { data: cloudSession } = await supabase
    .from("linkedin_cloud_sessions")
    .select("status, last_verified_at, error_message")
    .eq("client_id", user.profile.client_id)
    .maybeSingle();

  const { data: extensionActions } = await supabase
    .from("extension_actions")
    .select("status, action_type, prospect_id, payload, scheduled_at")
    .eq("client_id", user.profile.client_id)
    .eq("campaign_id", id);

  const contactActionTypes = new Set([
    "connect",
    "connect_with_message",
    "send_message",
  ]);
  const repliedCount = (prospects ?? []).filter(
    (prospect) => prospect.status === "replied",
  ).length;
  const actionStats = (extensionActions ?? []).reduce(
    (acc: any, action: any) => {
      const status = action.status || "unknown";

      acc.total += 1;
      acc[status] = (acc[status] || 0) + 1;

      if (
        status === "completed" &&
        contactActionTypes.has(action.action_type || "")
      ) {
        acc.sent += 1;
      }

      return acc;
    },
    { total: 0, sent: 0, replies: repliedCount } as Record<string, number>,
  );

  // Calculate Step Counts
  const stepCounts: Record<string, number> = {};
  let completedCount = 0;

  if (extensionActions && extensionActions.length > 0) {
    const actionsByProspect = (extensionActions as any[]).reduce(
      (acc: any, action: any) => {
        const pid = action.prospect_id;
        if (!acc[pid]) acc[pid] = [];
        acc[pid].push(action);
        return acc;
      },
      {} as Record<string, any[]>,
    );

    for (const pid in actionsByProspect) {
      const pActions = actionsByProspect[pid].sort(
        (a: any, b: any) =>
          new Date(a.scheduled_at).getTime() -
          new Date(b.scheduled_at).getTime(),
      );

      // Current step is the first one that is NOT finished
      const currentAction = pActions.find(
        (a: any) => !["completed", "cancelled", "failed"].includes(a.status),
      );

      if (currentAction) {
        const stepId = currentAction.payload?.step_id;
        if (stepId) {
          stepCounts[stepId] = (stepCounts[stepId] || 0) + 1;
        }
      } else {
        // If all actions are finished, and at least one was completed
        const hasCompleted = pActions.some((a: any) => a.status === "completed");
        if (hasCompleted) {
          completedCount++;
        }
      }
    }
  }

  const integrationExtraData =
    (extensionIntegration?.extra_data as Record<string, unknown> | null) || {};
  const runnerType =
    cloudSession || integrationExtraData.runner_type === "cloud"
      ? "cloud"
      : "extension";
  const lastSyncAt =
    runnerType === "cloud"
      ? cloudSession?.last_verified_at ||
        extensionIntegration?.last_sync_at ||
        null
      : extensionIntegration?.last_sync_at || null;
  const lastSyncMs = lastSyncAt ? new Date(lastSyncAt).getTime() : 0;
  const cloudVerificationFresh =
    lastSyncMs > 0 && Date.now() - lastSyncMs < 3 * 60 * 60 * 1000;
  const isRunnerOnline =
    runnerType === "cloud"
      ? cloudSession?.status === "active" && cloudVerificationFresh
      : extensionIntegration?.status === "connected" &&
        lastSyncMs > 0 &&
        Date.now() - lastSyncMs < 2 * 60 * 1000;

  return (
    <>
      <CampaignDashboardView
        campaign={campaign}
        prospects={mappedProspects as any}
        activities={mappedActivities as any}
        sequenceSteps={sequenceSteps ?? []}
        extensionOverview={{
          status: extensionIntegration?.status || "pending",
          last_sync_at: lastSyncAt,
          is_online: isRunnerOnline,
          runner_type: runnerType,
          cloud_session_status: cloudSession?.status || null,
          action_stats: actionStats,
        }}
        stepCounts={stepCounts}
        completedCount={completedCount}
      />
    </>
  );
}
