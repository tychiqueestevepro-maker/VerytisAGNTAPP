"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserWithProfile } from "@/lib/auth";

export async function importProspectsCSV(
  campaignId: string,
  prospects: any[]
) {
  const user = await getUserWithProfile();
  if (!user?.profile?.client_id) return { success: false, error: "Non authentifié" };

  const supabase = await createSupabaseServerClient();
  const clientId = user.profile.client_id;

  // Transform data
  const validProspects = prospects.map((p: any) => {
    // Generate full name
    let decisionMaker = "";
    if (p.firstName && p.lastName) decisionMaker = `${p.firstName} ${p.lastName}`;
    else if (p.firstName) decisionMaker = p.firstName;
    else if (p.lastName) decisionMaker = p.lastName;
    else if (p.fullName) decisionMaker = p.fullName;
    
    // Collect extra standard variables
    const extraData: any = {};
    if (p.icebreaker) extraData.icebreaker = p.icebreaker;
    if (p.customVariables) Object.assign(extraData, p.customVariables);

    return {
      client_id: clientId,
      campaign_id: campaignId,
      email: p.email || null,
      company_name: p.companyName || p.companyDomain || null,
      website: p.companyDomain || null,
      decision_maker: decisionMaker || null,
      role: p.jobTitle || null,
      linkedin_url: p.linkedInURL || null,
      phone: p.phone || null,
      status: "discovered",
      priority: "medium",
      source: "csv_import",
      extra_data: extraData
    };
  });

  if (validProspects.length === 0) {
    return { success: false, error: "Aucun prospect valide à importer" };
  }

  // Insert prospects. Note: Supabase JS doesn't easily do upsert by multiple columns without a unique constraint.
  // For safety, we just insert. If there are duplicates, they will be inserted again unless DB has constraint.
  const { error } = await supabase
    .from("prospects")
    .insert(validProspects);

  if (error) {
    console.error("CSV Import Error:", error);
    return { success: false, error: "Erreur lors de l'insertion en base" };
  }

  return { success: true, count: validProspects.length };
}
