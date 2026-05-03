"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { getUserWithProfile } from "@/lib/auth";
import { createExtensionToken, hashExtensionToken } from "@/lib/extension/auth";

export async function connectExtensionIntegration(clientId: string) {
  const user = await getUserWithProfile();
  if (!user?.profile?.client_id || user.profile.client_id !== clientId) {
    return { success: false, error: "Non autorisé" };
  }

  const supabase = await createSupabaseServerClient();
  const extensionToken = createExtensionToken();
  const tokenHash = hashExtensionToken(extensionToken);
  const now = new Date().toISOString();
  
  // Fetch existing integration to check if we need to insert or update
  const { data: existing } = await supabase
    .from("integrations")
    .select("id, extra_data")
    .eq("client_id", clientId)
    .eq("integration_type", "chrome_extension")
    .maybeSingle();

  let error;
  if (existing) {
    const res = await supabase
      .from("integrations")
      .update({
        status: "connected",
        credentials_ref: tokenHash,
        last_sync_at: now,
        extra_data: {
          ...((existing.extra_data as Record<string, unknown> | null) || {}),
          token_issued_at: now,
          runner_mode: "cloud",
          runner_type: "cloud",
          daily_action_limit: 30,
          action_delay_options_minutes: [5, 10, 15],
        },
        updated_at: now,
      })
      .eq("id", existing.id);
    error = res.error;
  } else {
    const res = await supabase
      .from("integrations")
      .insert({
        client_id: clientId,
        integration_type: "chrome_extension",
        name: "Extension LinkedIn",
        status: "connected",
        credentials_ref: tokenHash,
        last_sync_at: now,
        extra_data: {
          token_issued_at: now,
          runner_mode: "cloud",
          runner_type: "cloud",
          daily_action_limit: 30,
          action_delay_options_minutes: [5, 10, 15],
        },
      });
    error = res.error;
  }

  if (error) {
    console.error("Error connecting extension:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/integrations");

  return { success: true, extensionToken };
}

export async function disconnectExtensionIntegration(clientId: string) {
  const user = await getUserWithProfile();

  if (process.env.NODE_ENV !== "production") {
    console.info("[integrations] disconnect request", {
      requestedClientId: clientId,
      userId: user?.id || null,
      profileClientId: user?.profile?.client_id || null,
    });
  }

  if (!user?.profile?.client_id || user.profile.client_id !== clientId) {
    return { success: false, error: "Non autorisé" };
  }

  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("integrations")
    .update({
      status: "disconnected",
      credentials_ref: null,
      updated_at: new Date().toISOString(),
    })
    .eq("client_id", clientId)
    .eq("integration_type", "chrome_extension")
    .select("id");

  if (error) {
    console.error("Error disconnecting extension:", error);
    return { success: false, error: error.message };
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[integrations] disconnect update", {
      requestedClientId: clientId,
      updatedRows: data?.length || 0,
    });
  }

  if (!data?.length) {
    return { success: false, error: "Intégration LinkedIn introuvable." };
  }

  await supabase
    .from("linkedin_cloud_sessions")
    .update({
      status: "revoked",
      updated_at: new Date().toISOString(),
    })
    .eq("client_id", clientId);

  revalidatePath("/integrations");

  return { success: true };
}

export async function getLinkedInConnectionStatus(clientId: string) {
  const user = await getUserWithProfile();
  if (!user?.profile?.client_id || user.profile.client_id !== clientId) {
    return { success: false, connected: false, error: "Non autorisé" };
  }

  const supabase = await createSupabaseServerClient();
  const [integrationRes, cloudSessionRes] = await Promise.all([
    supabase
      .from("integrations")
      .select("status")
      .eq("client_id", clientId)
      .eq("integration_type", "chrome_extension")
      .maybeSingle(),
    supabase
      .from("linkedin_cloud_sessions")
      .select("status")
      .eq("client_id", clientId)
      .maybeSingle(),
  ]);

  if (integrationRes.error || cloudSessionRes.error) {
    return {
      success: false,
      connected: false,
      error: integrationRes.error?.message || cloudSessionRes.error?.message,
    };
  }

  return {
    success: true,
    connected:
      integrationRes.data?.status === "connected" &&
      cloudSessionRes.data?.status === "active",
    integrationStatus: integrationRes.data?.status || null,
    cloudSessionStatus: cloudSessionRes.data?.status || null,
  };
}

export async function getDefaultClientId() {
  const user = await getUserWithProfile();
  return user?.profile?.client_id || null;
}
