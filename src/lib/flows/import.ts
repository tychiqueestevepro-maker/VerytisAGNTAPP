"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserWithProfile } from "@/lib/auth";
import { preScoreProspect } from "@/lib/prospecting/scoring";
import { logCampaignActivities } from "@/lib/flows/activity";

type CsvProspect = Record<string, unknown>;

function field(row: CsvProspect, key: string): string | null {
  const value = row[key];
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

export async function importProspectsCSV(
  campaignId: string,
  prospects: CsvProspect[]
) {
  const user = await getUserWithProfile();
  if (!user?.profile?.client_id) return { success: false, error: "Non authentifié" };

  const supabase = await createSupabaseServerClient();
  const clientId = user.profile.client_id;

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  // Transform data
  const validProspects = prospects.map((p) => {
    // Generate full name
    let decisionMaker = "";
    const firstName = field(p, "firstName");
    const lastName = field(p, "lastName");
    if (firstName && lastName) decisionMaker = `${firstName} ${lastName}`;
    else if (firstName) decisionMaker = firstName;
    else if (lastName) decisionMaker = lastName;
    else decisionMaker = field(p, "fullName") || "";
    
    // Collect extra standard variables
    const extraData: Record<string, unknown> = {};
    if (p.icebreaker) extraData.icebreaker = p.icebreaker;
    if (p.customVariables && typeof p.customVariables === "object" && !Array.isArray(p.customVariables)) {
      Object.assign(extraData, p.customVariables);
    }
    extraData.raw_data = p;

    const companyName = field(p, "companyName") || field(p, "company") || field(p, "companyDomain");
    const website = field(p, "website") || field(p, "companyWebsite") || field(p, "companyDomain");
    const role = field(p, "jobTitle") || field(p, "role") || field(p, "title");
    const location = field(p, "location") || field(p, "city") || field(p, "country");
    const companyDescription = field(p, "companyDescription") || field(p, "company_description") || field(p, "description");
    const linkedinUrl = field(p, "linkedInURL") || field(p, "linkedin_url") || field(p, "profile_url");

    const baseProspect = {
      client_id: clientId,
      campaign_id: campaignId,
      email: field(p, "email"),
      company_name: companyName,
      website,
      decision_maker: decisionMaker || null,
      role,
      linkedin_url: linkedinUrl,
      phone: field(p, "phone"),
      location,
      status: "discovered",
      priority: "medium",
      source: "csv_import",
      full_name: decisionMaker || null,
      role_title: role,
      company_description: companyDescription,
      profile_url: linkedinUrl,
      website_url: website,
      raw_data: p,
      extra_data: extraData
    };

    const preScore = campaign ? preScoreProspect(baseProspect, campaign) : null;

    return {
      ...baseProspect,
      fit_score: preScore?.score ?? null,
      pre_score: preScore?.score ?? null,
      pre_score_level: preScore?.level ?? null,
      qualification_status: preScore ? "pre_scored" : "collected",
    };
  });

  if (validProspects.length === 0) {
    return { success: false, error: "Aucun prospect valide à importer" };
  }

  // Insert prospects. Note: Supabase JS doesn't easily do upsert by multiple columns without a unique constraint.
  // For safety, we just insert. If there are duplicates, they will be inserted again unless DB has constraint.
  const { data: insertedProspects, error } = await supabase
    .from("prospects")
    .insert(validProspects)
    .select("id, decision_maker, company_name");

  if (error) {
    console.error("CSV Import Error:", error);
    return { success: false, error: "Erreur lors de l'insertion en base" };
  }

  await logCampaignActivities((insertedProspects ?? []).map((prospect) => ({
    clientId,
    campaignId,
    action: "prospect.imported.document",
    entityType: "prospect",
    entityId: prospect.id,
    actorType: "user",
    metadata: {
      prospect_name: prospect.decision_maker || "Profil importé",
      company_name: prospect.company_name || null,
      source: "csv_import",
    },
  })));

  return { success: true, count: validProspects.length };
}
