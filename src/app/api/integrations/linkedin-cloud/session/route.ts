import { NextResponse } from "next/server";
import { verifyExtensionRequest } from "@/lib/extension/auth";
import {
  encryptLinkedInStorageState,
  normalizeLinkedInStorageState,
} from "@/lib/linkedin-cloud/session";

export const runtime = "nodejs";

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
    const storageState = normalizeLinkedInStorageState(body.storageState);

    if (!storageState) {
      return NextResponse.json(
        { error: "Session LinkedIn introuvable. Ouvre LinkedIn et reconnecte-toi." },
        { status: 400 },
      );
    }

    const encrypted = encryptLinkedInStorageState(storageState);
    const now = new Date().toISOString();
    const linkedinAccountName =
      typeof body.linkedinAccountName === "string" ? body.linkedinAccountName : null;
    const linkedinAccountUrl =
      typeof body.linkedinAccountUrl === "string" ? body.linkedinAccountUrl : null;

    const { data: session, error: sessionError } = await auth.supabase
      .from("linkedin_cloud_sessions")
      .upsert(
        {
          client_id: auth.clientId,
          integration_id: auth.integration.id,
          status: "active",
          ...encrypted,
          linkedin_account_name: linkedinAccountName,
          linkedin_account_url: linkedinAccountUrl,
          last_verified_at: now,
          error_message: null,
          extra_data: {
            captured_via: "chrome_extension",
            captured_at: now,
            runner_type: "cloud",
            cookie_count: storageState.cookies.length,
          },
          updated_at: now,
        },
        { onConflict: "client_id" },
      )
      .select("id, status, last_verified_at")
      .single();

    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 500 });
    }

    const integrationExtraData =
      (auth.integration.extra_data as Record<string, unknown> | null) || {};

    await auth.supabase
      .from("integrations")
      .update({
        status: "connected",
        last_sync_at: now,
        extra_data: {
          ...integrationExtraData,
          runner_type: "cloud",
          runner_mode: "cloud",
          cloud_session_status: "active",
          cloud_session_captured_at: now,
          daily_action_limit: 30,
          action_delay_options_minutes: [5, 10, 15],
        },
        updated_at: now,
      })
      .eq("id", auth.integration.id);

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: errorMessage(error, "Impossible d'enregistrer la session LinkedIn cloud") },
      { status: 500 },
    );
  }
}
