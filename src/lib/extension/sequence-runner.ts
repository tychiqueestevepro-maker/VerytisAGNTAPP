/* eslint-disable @typescript-eslint/no-explicit-any */

type SupabaseLike = any;

type EnqueueInput = {
  supabase: SupabaseLike;
  clientId: string;
  prospect: any;
  campaign: any;
  sequenceSteps: any[];
  personalizedSequence?: any;
};

type FlatStep =
  | { kind: "wait"; days: number }
  | { kind: "action"; step: any; actionType: string };

const MESSAGE_ACTIONS = new Set(["send_message", "connect_with_message"]);
const EXECUTION_MODE = "auto_send";
const RUNNER_TYPE = "cloud";
const DELAY_OPTIONS_MINUTES = [5, 10, 15];

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function actionTypeForStep(step: any) {
  const name = stripAccents(String(step?.name || "").toLowerCase());

  if (name.includes("voir") && name.includes("profil")) return "view_profile";
  if (name.includes("ajouter") && name.includes("sans")) return "connect";
  if (name.includes("ajouter") && name.includes("message")) return "connect_with_message";
  if (name.includes("envoyer") && name.includes("message")) return "send_message";
  if (name.includes("relance") && name.includes("message")) return "send_message";

  return null;
}

function personalizedMessagesByStep(personalizedSequence: any) {
  const map: Record<string, string> = {};
  const steps = Array.isArray(personalizedSequence?.steps)
    ? personalizedSequence.steps
    : Array.isArray(personalizedSequence)
      ? personalizedSequence
      : [];

  for (const step of steps) {
    const stepId = step?.step_id || step?.id;
    const message = step?.personalized_message || step?.message;
    if (stepId && typeof message === "string" && message.trim()) {
      map[String(stepId)] = message.trim();
    }
  }

  return map;
}

function replaceVariables(template: string, prospect: any) {
  const fullName = prospect.full_name || prospect.decision_maker || "";
  const [firstName = "", ...rest] = String(fullName).trim().split(/\s+/);
  const lastName = rest.join(" ");

  return template
    .replace(/{{first_name}}/g, firstName)
    .replace(/{{last_name}}/g, lastName)
    .replace(/{{company}}/g, prospect.company_name || "")
    .replace(/{{role}}/g, prospect.role_title || prospect.role || "")
    .replace(/{{location}}/g, prospect.location || "")
    .trim();
}

function branchForCondition(step: any, prospect: any) {
  const name = stripAccents(String(step?.name || "").toLowerCase());
  const yesBranch = step?.config?.yesBranch || [];
  const noBranch = step?.config?.noBranch || [];

  if (name.includes("linkedin")) {
    return prospect.linkedin_url || prospect.profile_url ? yesBranch : noBranch;
  }

  if (name.includes("repon")) {
    return prospect.status === "replied" ? yesBranch : noBranch;
  }

  return yesBranch.length > 0 ? yesBranch : noBranch;
}

function flattenSteps(steps: any[], prospect: any): FlatStep[] {
  const flat: FlatStep[] = [];

  for (const step of steps || []) {
    const type = String(step?.type || step?.action_type || "").toLowerCase();

    if (type === "wait") {
      flat.push({ kind: "wait", days: Math.max(1, Number(step?.config?.days || 1)) });
      continue;
    }

    if (type === "condition") {
      flat.push(...flattenSteps(branchForCondition(step, prospect), prospect));
      continue;
    }

    if (type === "end") continue;

    const actionType = actionTypeForStep(step);
    if (actionType) flat.push({ kind: "action", step, actionType });
  }

  return flat;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMinutes(date: Date, minutes: number) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

function randomActionDelayMinutes() {
  const index = Math.floor(Math.random() * DELAY_OPTIONS_MINUTES.length);
  return DELAY_OPTIONS_MINUTES[index] || 10;
}

export async function enqueueExtensionActionsForQualifiedProspect(input: EnqueueInput) {
  const { supabase, clientId, prospect, campaign, sequenceSteps, personalizedSequence } = input;
  const linkedinUrl = prospect.linkedin_url || prospect.profile_url;

  if (!linkedinUrl) {
    return { created: 0, skipped: 0, reason: "no_linkedin_url" };
  }

  const personalizations = personalizedMessagesByStep(
    personalizedSequence ?? prospect.extra_data?.personalized_sequence,
  );
  const flatSteps = flattenSteps(sequenceSteps, prospect);
  let scheduledAt = new Date();
  let created = 0;
  let skipped = 0;

  for (const item of flatSteps) {
    if (item.kind === "wait") {
      scheduledAt = addDays(scheduledAt, item.days);
      continue;
    }

    const { step, actionType } = item;
    const actionDelayMinutes = randomActionDelayMinutes();
    scheduledAt = addMinutes(scheduledAt, actionDelayMinutes);

    const stepId = String(step.id);
    const dedupeKeyBase = `${clientId}:${campaign.id}:${prospect.id}:${stepId}:${actionType}`;
    const dedupeKey = dedupeKeyBase;

    const { data: existingActions } = await supabase
      .from("extension_actions")
      .select("id")
      .in("dedupe_key", [dedupeKeyBase, `${dedupeKeyBase}:draft_only`, `${dedupeKeyBase}:auto_send`])
      .limit(1);

    if (existingActions?.length) {
      skipped += 1;
      continue;
    }

    const templateMessage = personalizations[stepId] || step?.config?.message || "";
    const message = replaceVariables(templateMessage, prospect);
    let messageId: string | null = null;

    if (MESSAGE_ACTIONS.has(actionType)) {
      if (!message) {
        skipped += 1;
        continue;
      }

      const { data: messageRow, error: messageError } = await supabase
        .from("messages")
        .insert({
          client_id: clientId,
          prospect_id: prospect.id,
          channel: "linkedin",
          message_type: actionType === "send_message" ? "follow_up" : "outreach",
          body: message,
          status: "ready_to_send",
          extra_data: {
            execution_mode: EXECUTION_MODE,
            runner_type: RUNNER_TYPE,
            campaign_id: campaign.id,
            sequence_step_id: stepId,
            sequence_step_name: step.name,
          },
        })
        .select("id")
        .single();

      if (messageError) throw new Error(messageError.message);
      messageId = messageRow.id;
    }

    const { error: actionError } = await supabase.from("extension_actions").insert({
      client_id: clientId,
      campaign_id: campaign.id,
      prospect_id: prospect.id,
      message_id: messageId,
      action_type: actionType,
      linkedin_url: linkedinUrl,
      runner_type: RUNNER_TYPE,
      status: "ready",
      scheduled_at: scheduledAt.toISOString(),
      dedupe_key: dedupeKey,
      payload: {
        execution_mode: EXECUTION_MODE,
        runner_type: RUNNER_TYPE,
        daily_action_limit: 30,
        delay_minutes: actionDelayMinutes,
        step_id: stepId,
        step_name: step.name,
        message,
        prospect_name: prospect.full_name || prospect.decision_maker || "",
        campaign_name: campaign.display_name || campaign.name || "",
      },
    });

    if (actionError) throw new Error(actionError.message);
    created += 1;
  }

  return { created, skipped };
}
