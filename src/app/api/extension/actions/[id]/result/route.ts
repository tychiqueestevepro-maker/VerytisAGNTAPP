import { NextResponse } from "next/server";
import { verifyExtensionRequest } from "@/lib/extension/auth";

const CONTACT_ACTIONS = new Set(["connect", "connect_with_message", "send_message"]);

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await verifyExtensionRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await Promise.resolve(context.params);
  const body = await request.json().catch(() => ({}));
  const success = Boolean(body.success);
  const now = new Date().toISOString();

  try {
    const { data: action, error: fetchError } = await auth.supabase
      .from("extension_actions")
      .select("*")
      .eq("id", id)
      .eq("client_id", auth.clientId)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!action) {
      return NextResponse.json({ error: "Action not found" }, { status: 404 });
    }

    const payload = {
      ...((action.payload as Record<string, unknown> | null) || {}),
      last_result: {
        success,
        received_at: now,
        details: body.details || null,
      },
    };

    const { error: updateError } = await auth.supabase
      .from("extension_actions")
      .update({
        status: success ? "completed" : "failed",
        completed_at: success ? now : null,
        locked_until: null,
        error_message: success ? null : body.error_message || "Extension action failed",
        payload,
        updated_at: now,
      })
      .eq("id", action.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (action.message_id) {
      const { data: message } = await auth.supabase
        .from("messages")
        .select("extra_data")
        .eq("id", action.message_id)
        .maybeSingle();

      const messageExtraData = {
        ...((message?.extra_data as Record<string, unknown> | null) || {}),
        ...(success
          ? {
              sent_by_extension_at: now,
              extension_result: body.details || null,
            }
          : { last_extension_error: body.error_message || "Extension action failed" }),
      };

      await auth.supabase
        .from("messages")
        .update({
          ...(success ? { status: "sent", sent_at: now } : {}),
          extra_data: messageExtraData,
          updated_at: now,
        })
        .eq("id", action.message_id);
    }

    if (success && action.prospect_id && CONTACT_ACTIONS.has(action.action_type)) {
      const { data: prospect } = await auth.supabase
        .from("prospects")
        .select("status, extra_data")
        .eq("id", action.prospect_id)
        .maybeSingle();

      const protectedStatuses = new Set(["replied", "not_interested", "converted"]);
      if (!protectedStatuses.has(String(prospect?.status || ""))) {
        await auth.supabase
          .from("prospects")
          .update({
            status: "contacted",
            extra_data: {
              ...((prospect?.extra_data as Record<string, unknown> | null) || {}),
              last_contacted_at: now,
              last_contact_action_type: action.action_type,
              last_extension_action_id: action.id,
            },
            updated_at: now,
          })
          .eq("id", action.prospect_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error, "Unable to save action result") }, { status: 500 });
  }
}
