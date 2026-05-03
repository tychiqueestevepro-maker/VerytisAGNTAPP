import { NextResponse } from "next/server";
import { verifyExtensionRequest } from "@/lib/extension/auth";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function POST(request: Request) {
  const auth = await verifyExtensionRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const now = new Date().toISOString();
    const extraData = {
      ...((auth.integration.extra_data as Record<string, unknown> | null) || {}),
      extension_version: body.extension_version || null,
      extension_status: "connected",
      last_heartbeat_at: now,
    };

    const { data: integration, error } = await auth.supabase
      .from("integrations")
      .update({
        status: "connected",
        last_sync_at: now,
        extra_data: extraData,
        updated_at: now,
      })
      .eq("id", auth.integration.id)
      .eq("credentials_ref", auth.tokenHash)
      .eq("status", "connected")
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!integration) {
      return NextResponse.json({ error: "Extension disconnected" }, { status: 401 });
    }

    return NextResponse.json({ success: true, last_sync_at: now });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error, "Heartbeat failed") }, { status: 500 });
  }
}
