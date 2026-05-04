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
  const type = String(step?.type || step?.action_type || "").toLowerCase();

  if (type === "wait" || type === "condition" || type === "end") return null;

  // View Profile
  if (name.includes("voir") && name.includes("profil")) return "view_profile";
  if (name.includes("visite") && name.includes("profil")) return "view_profile";

  // Connect (without message)
  if (name.includes("ajouter") && name.includes("sans")) return "connect";
  if (name.includes("invitation") && name.includes("sans")) return "connect";

  // Connect with message
  if (name.includes("ajouter") && name.includes("message")) return "connect_with_message";
  if (name.includes("invitation") && name.includes("message")) return "connect_with_message";
  // Default to with message for "Invitation" if not explicitly "sans"
  if (name.includes("invitation") && !name.includes("sans")) return "connect_with_message";

  // Send Message
  if (name.includes("envoyer") && name.includes("message")) return "send_message";
  if (name.includes("relance") && name.includes("message")) return "send_message";
  if (name.includes("suivi") && name.includes("message")) return "send_message";
  if (
    name.includes("message") &&
    (name.includes("suivi") || name.includes("remerciement") || name.includes("question"))
  )
    return "send_message";

  // Default if it's a linkedin type and we didn't match above
  if (type === "linkedin") {
    if (name.includes("message") || name.includes("suivi") || name.includes("relance"))
      return "send_message";
    if (name.includes("ajouter") || name.includes("invitation")) return "connect_with_message";
    if (name.includes("voir") || name.includes("visite")) return "view_profile";
  }

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

function applyTimingConstraints(
  date: Date,
  searchTime: string = "09:00",
  timezone: string = "Europe/Paris",
  selectedDays: number[] = [1, 2, 3, 4, 5],
  endTime: string = "18:00",
) {
  // 1. Helper to get date parts in the target timezone
  const getInTimezone = (d: Date, tz: string) => {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(d);
    const map: any = {};
    parts.forEach((p) => (map[p.type] = p.value));
    return map;
  };

  // 2. Initial target date
  let target = new Date(date);
  const [startH, startM] = searchTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  let attempts = 0;
  while (attempts < 15) {
    const tzParts = getInTimezone(target, timezone);
    const currentH = Number(tzParts.hour);
    const currentM = Number(tzParts.minute);
    const currentDay = target.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

    // Is it a valid day?
    const isValidDay = selectedDays.includes(currentDay);

    // Is it within hours?
    const isTooEarly = currentH < startH || (currentH === startH && currentM < startM);
    const isTooLate = currentH > endH || (currentH === endH && currentM >= endM);

    if (isValidDay && !isTooLate) {
      if (isTooEarly) {
        // Just adjust to start time on the same day
        const diffH = startH - currentH;
        const diffM = startM - currentM;
        target.setHours(target.getHours() + diffH, target.getMinutes() + diffM, 0, 0);
      }
      return target;
    }

    // Move to next day at start time
    target.setDate(target.getDate() + 1);
    const tzNextParts = getInTimezone(target, timezone);
    const nextH = Number(tzNextParts.hour);
    const nextM = Number(tzNextParts.minute);
    
    // Reset to start time in the target timezone
    const diffH = startH - nextH;
    const diffM = startM - nextM;
    target.setHours(target.getHours() + diffH, target.getMinutes() + diffM, 0, 0);

    attempts++;
  }

  return target;
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

  const timing = campaign.config?.prospection || {};
  const searchTime = timing.search_time || "09:00";
  const endTime = timing.end_time || "18:00";
  const timezone = timing.timezone || "Europe/Paris";
  const selectedDays = timing.selected_days || [1, 2, 3, 4, 5];

  const personalizations = personalizedMessagesByStep(
    personalizedSequence ?? prospect.extra_data?.personalized_sequence,
  );
  const flatSteps = flattenSteps(sequenceSteps, prospect);

  // Initialize scheduledAt based on campaign constraints
  let scheduledAt = applyTimingConstraints(new Date(), searchTime, timezone, selectedDays, endTime);

  let created = 0;
  let skipped = 0;

  for (const item of flatSteps) {
    if (item.kind === "wait") {
      // For wait steps, we add days and then re-apply constraints to ensure it lands on a valid day/time
      scheduledAt = addDays(scheduledAt, item.days);
      scheduledAt = applyTimingConstraints(scheduledAt, searchTime, timezone, selectedDays, endTime);
      continue;
    }


    const { step, actionType } = item;
    const stepId = String(step.id);
    const actionDelayMinutes = randomActionDelayMinutes();
    scheduledAt = addMinutes(scheduledAt, actionDelayMinutes);

    let currentActionType = actionType;
    const templateMessage = personalizations[stepId] || step?.config?.message || "";
    const message = replaceVariables(templateMessage, prospect);

    if (currentActionType === "connect_with_message" && !message) {
      currentActionType = "connect";
    }

    const dedupeKeyBase = `${clientId}:${campaign.id}:${prospect.id}:${stepId}:${currentActionType}`;

    const { data: existingActions } = await supabase
      .from("extension_actions")
      .select("id")
      .in("dedupe_key", [dedupeKeyBase, `${dedupeKeyBase}:draft_only`, `${dedupeKeyBase}:auto_send`])
      .not("status", "in", "(cancelled,failed)")
      .limit(1);

    if (existingActions?.length) {
      skipped += 1;
      continue;
    }

    let messageId: string | null = null;
    if (MESSAGE_ACTIONS.has(currentActionType)) {
      if (!message && currentActionType !== "connect") {
        skipped += 1;
        continue;
      }

      const { data: messageRow, error: messageError } = await supabase
        .from("messages")
        .insert({
          client_id: clientId,
          prospect_id: prospect.id,
          channel: "linkedin",
          message_type: currentActionType === "send_message" ? "follow_up" : "outreach",
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
      action_type: currentActionType,
      linkedin_url: linkedinUrl,
      runner_type: RUNNER_TYPE,
      status: "ready",
      scheduled_at: scheduledAt.toISOString(),
      dedupe_key: `${clientId}:${campaign.id}:${prospect.id}:${stepId}:${currentActionType}`,
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
