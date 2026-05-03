import { NextResponse } from "next/server";
import { verifyExtensionRequest } from "@/lib/extension/auth";

const LOCK_MINUTES = 5;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function GET(request: Request) {
  const auth = await verifyExtensionRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const now = new Date();
  const nowIso = now.toISOString();

  try {
    const { data: actions, error } = await auth.supabase
      .from("extension_actions")
      .select("*")
      .eq("client_id", auth.clientId)
      .eq("runner_type", "extension")
      .eq("status", "ready")
      .lte("scheduled_at", nowIso)
      .or(`locked_until.is.null,locked_until.lt.${nowIso}`)
      .order("scheduled_at", { ascending: true })
      .limit(10);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    for (const action of actions || []) {
      const [{ data: campaign }, { data: prospect }] = await Promise.all([
        action.campaign_id
          ? auth.supabase.from("campaigns").select("id, status").eq("id", action.campaign_id).maybeSingle()
          : Promise.resolve({ data: null }),
        action.prospect_id
          ? auth.supabase.from("prospects").select("id, status").eq("id", action.prospect_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (campaign?.status === "paused" || prospect?.status === "replied") {
        continue;
      }

      const lockedUntil = new Date(now.getTime() + LOCK_MINUTES * 60 * 1000).toISOString();
      const { data: locked, error: lockError } = await auth.supabase
        .from("extension_actions")
        .update({
          locked_until: lockedUntil,
          attempt_count: Number(action.attempt_count || 0) + 1,
          updated_at: nowIso,
        })
        .eq("id", action.id)
        .eq("status", "ready")
        .select("*")
        .single();

      if (lockError || !locked) {
        continue;
      }

      const payload = (locked.payload || {}) as Record<string, unknown>;
      return NextResponse.json({
        success: true,
        action: {
          id: locked.id,
          action_type: locked.action_type,
          linkedin_url: locked.linkedin_url,
          message: typeof payload.message === "string" ? payload.message : null,
          execution_mode: "auto_send",
          prospect_id: locked.prospect_id,
          message_id: locked.message_id,
        },
      });
    }

    return NextResponse.json({ success: true, action: null });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error, "Unable to fetch next action") }, { status: 500 });
  }
}
