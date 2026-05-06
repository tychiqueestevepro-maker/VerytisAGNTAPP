"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserWithProfile } from "@/lib/auth";
import { SettingsForm } from "@/lib/schemas/settings";
import { revalidatePath } from "next/cache";

export async function getSettings(): Promise<{ data: SettingsForm | null; error: string | null }> {
  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id) {
    return { data: null, error: "Non authentifié" };
  }

  const supabase = await createSupabaseServerClient();
  const clientId = user.profile.client_id;

  // 1. Fetch Client info
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("company_name, industry, website")
    .eq("id", clientId)
    .single();

  if (clientError) return { data: null, error: "Erreur lors du chargement du client" };

  // 2. Fetch Client Config
  const { data: config, error: configError } = await supabase
    .from("client_configs")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();

  if (configError) return { data: null, error: "Erreur lors du chargement de la configuration" };

  const settings: SettingsForm = {
    first_name: user.profile.first_name || "",
    last_name: user.profile.last_name || "",
    email: user.email || "",
    avatar_url: user.profile.avatar_url || "",
    company_name: client.company_name || "",
    industry: client.industry || "",
    website: client.website || "",
    openai_api_key: config?.extra_config?.openai_api_key || "",
    min_fit_score: config?.min_fit_score || 70,
    tone: config?.tone || "",
    offer_type: config?.offer_type || "",
    message_style: config?.message_style || "",
    excluded_sectors: config?.excluded_sectors || [],
    required_fields: config?.required_fields || [],
    daily_cost_limit: 0,
    daily_prospect_limit: 0,
    daily_message_limit: 0,
    active_flows: [],
    user_role: user.profile.role,
  };

  // 3. Fetch Limits
  const { data: limits } = await supabase
    .from("daily_limits")
    .select("limit_type, limit_value")
    .eq("client_id", clientId);

  if (limits) {
    settings.daily_cost_limit = limits.find(l => l.limit_type === 'cost')?.limit_value || 0;
    settings.daily_prospect_limit = limits.find(l => l.limit_type === 'prospects')?.limit_value || 0;
    settings.daily_message_limit = limits.find(l => l.limit_type === 'messages')?.limit_value || 0;
  }

  // 4. Fetch Flows
  const { data: flows } = await supabase
    .from("client_flows")
    .select("flow_key, display_name, status")
    .eq("client_id", clientId);

  if (flows) {
    settings.active_flows = flows.map(f => ({
      key: f.flow_key,
      label: f.display_name || f.flow_key,
      status: f.status,
    }));
  }

  return { data: settings, error: null };
}

export async function getOrganizationMembers() {
  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id) return { data: null, error: "Non authentifié" };

  const supabase = await createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url, role, created_at")
    .eq("client_id", user.profile.client_id)
    .order("created_at", { ascending: true });

  return { data, error };
}

export async function updateSettings(data: SettingsForm) {
  const user = await getUserWithProfile();
  if (!user || !user.profile?.client_id) {
    return { error: "Non authentifié" };
  }

  const supabase = await createSupabaseServerClient();
  const clientId = user.profile.client_id;

  // 1. Update Profile
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      first_name: data.first_name,
      last_name: data.last_name,
      avatar_url: data.avatar_url,
    })
    .eq("id", user.id);

  if (profileError) return { error: "Erreur lors de la mise à jour du profil" };

  // 2. Update Client
  const { error: clientError } = await supabase
    .from("clients")
    .update({
      company_name: data.company_name,
      industry: data.industry,
      website: data.website,
    })
    .eq("id", clientId);

  if (clientError) return { error: "Erreur lors de la mise à jour de l'entreprise" };

  // 3. Update Client Config
  const { data: currentConfig } = await supabase
    .from("client_configs")
    .select("extra_config")
    .eq("client_id", clientId)
    .single();

  const newExtraConfig = {
    ...(currentConfig?.extra_config || {}),
    openai_api_key: data.openai_api_key,
  };

  const { error: configError } = await supabase
    .from("client_configs")
    .upsert({
      client_id: clientId,
      min_fit_score: data.min_fit_score,
      tone: data.tone,
      offer_type: data.offer_type,
      message_style: data.message_style,
      excluded_sectors: data.excluded_sectors,
      required_fields: data.required_fields,
      extra_config: newExtraConfig,
    }, { onConflict: 'client_id' });

  if (configError) return { error: "Erreur lors de la mise à jour de la configuration" };

  // 4. Update Limits
  const limitPayloads = [
    { client_id: clientId, limit_type: 'cost', limit_value: data.daily_cost_limit, reset_at: new Date() },
    { client_id: clientId, limit_type: 'prospects', limit_value: data.daily_prospect_limit, reset_at: new Date() },
    { client_id: clientId, limit_type: 'messages', limit_value: data.daily_message_limit, reset_at: new Date() },
  ];

  for (const payload of limitPayloads) {
    await supabase
      .from("daily_limits")
      .upsert(payload, { onConflict: 'client_id,agent_id,limit_type' });
  }

  // 5. Update Flow Statuses
  for (const flow of data.active_flows) {
    await supabase
      .from("client_flows")
      .update({ status: flow.status })
      .eq("client_id", clientId)
      .eq("flow_key", flow.key);
  }

  revalidatePath("/parametres");
  return { success: true };
}
