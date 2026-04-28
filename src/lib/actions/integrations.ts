"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function connectExtensionIntegration(clientId: string) {
  const supabase = await createSupabaseServerClient();
  
  // Fetch existing integration to check if we need to insert or update
  const { data: existing } = await supabase
    .from("integrations")
    .select("id")
    .eq("client_id", clientId)
    .eq("integration_type", "chrome_extension")
    .single();

  let error;
  if (existing) {
    const res = await supabase
      .from("integrations")
      .update({ status: "connected", updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    error = res.error;
  } else {
    const res = await supabase
      .from("integrations")
      .insert({
        client_id: clientId,
        integration_type: "chrome_extension",
        name: "Extension LinkedIn",
        status: "connected"
      });
    error = res.error;
  }

  if (error) {
    console.error("Error connecting extension:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// Function to just get the first client id for this demo context
export async function getDefaultClientId() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("clients").select("id").limit(1).single();
  return data?.id || null;
}
