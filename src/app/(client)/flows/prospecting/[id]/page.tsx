import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserWithProfile } from "@/lib/auth";
import { getCampaignDetail } from "@/lib/flows/actions";
import { TopLine } from "@/components/layout/top-line";
import { CampaignDashboardView } from "@/components/flows/campaign-dashboard-view";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const user = await getUserWithProfile();
  if (!user?.profile?.client_id) return { title: "Campagne" };

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("campaigns")
    .select("display_name")
    .eq("id", id)
    .single();

  return { title: `${data?.display_name ?? "Campagne"} — Prospection Flow` };
}

export default async function CampaignDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getUserWithProfile();

  if (!user?.profile?.client_id) notFound();

  const supabase = await createSupabaseServerClient();

  // Load the specific campaign and its steps
  const { campaign, steps: sequenceSteps, error: campaignError } = await getCampaignDetail(id);

  if (campaignError || !campaign) notFound();

  // Load prospects for this campaign
  const { data: prospects } = await supabase
    .from("prospects")
    .select(`
      id, 
      company_name, 
      decision_maker, 
      role, 
      fit_score, 
      status, 
      priority, 
      photo_url,
      website,
      location,
      linkedin_url,
      extra_data,
      company:companies (
        industry,
        size_range,
        description,
        linkedin_url,
        location
      )
    `)
    .eq("client_id", user.profile.client_id)
    .eq("campaign_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  // Load recent activity
  const { data: activities } = await supabase
    .from("agent_runs")
    .select(`
      id, 
      action:run_type, 
      entity_type:status, 
      created_at,
      agent:agents(name),
      prospect:prospects(decision_maker)
    `)
    .eq("client_id", user.profile.client_id)
    .order("created_at", { ascending: false })
    .limit(10);

  const activityMap: Record<string, string> = {
    'hunter': 'Import de nouveaux prospects',
    'hunt': 'Analyse des profils terminée',
    'qualifier': 'Qualification ICP effectuée',
    'copywriter': 'Message prêt pour envoi',
    'message_generation': 'Message prêt pour envoi',
    'outreach': 'Étape du flow validée',
    'send_message': 'Passage à l\'étape : Message',
    'invitation': 'Passage à l\'étape : Invitation',
    'acceptance': 'Invitation LinkedIn acceptée',
    'response': 'Réponse reçue (Flow mis en pause)',
    'qa': 'Flow débuté pour le prospect',
    'validation': 'Flow terminé pour le prospect',
    'enrichment': 'Données prospect complétées'
  };

  const excludedTypes = ['enrichment', 'qualifier', 'hunt', 'message_generation', 'copywriter'];

  const mappedActivities = (activities ?? [])
    .filter(act => !excludedTypes.includes(act.action))
    .map(act => {
      const prospectName = (act as any).prospect?.decision_maker?.split(/[,|•-]/)[0].trim() || 'un prospect';
      let actionLabel = activityMap[act.action] || act.action;

      if (act.action === 'send_message') actionLabel = `Passage à l'étape Message pour ${prospectName}`;
      else if (act.action === 'invitation') actionLabel = `Invitation envoyée à ${prospectName}`;
      else if (act.action === 'acceptance') actionLabel = `Invitation acceptée par ${prospectName}`;
      else if (act.action === 'response') actionLabel = `Réponse reçue de ${prospectName}`;
      else if (act.action === 'outreach') actionLabel = `Étape du flow validée pour ${prospectName}`;
      else if (act.action === 'qa') actionLabel = `Flow débuté pour ${prospectName}`;
      else if (act.action === 'validation') actionLabel = `Flow terminé pour ${prospectName}`;

      return {
        ...act,
        type: act.action,
        action: actionLabel
      };
    });

  const mappedProspects = (prospects ?? []).map(p => ({
    ...p,
    company: p.company?.[0] || null
  }));

  return (
    <>
      <CampaignDashboardView
        campaign={campaign}
        prospects={mappedProspects as any}
        activities={mappedActivities as any}
        sequenceSteps={sequenceSteps ?? []}
      />
    </>
  );
}
