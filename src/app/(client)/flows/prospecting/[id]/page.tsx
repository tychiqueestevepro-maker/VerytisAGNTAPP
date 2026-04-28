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
      agent:agents(name)
    `)
    .eq("client_id", user.profile.client_id)
    .order("created_at", { ascending: false })
    .limit(10);

  const activityMap: Record<string, string> = {
    'hunter': 'Prospects identifiés',
    'hunt': 'Prospects identifiés',
    'qualifier': 'Qualification effectuée',
    'copywriter': 'Message personnalisé généré',
    'message_generation': 'Message personnalisé généré',
    'outreach': 'Message envoyé',
    'send_message': 'Message envoyé',
    'qa': 'Contrôle qualité terminé',
    'validation': 'Validation demandée',
    'enrichment': 'Données enrichies'
  };

  const mappedActivities = (activities ?? []).map(act => ({
    ...act,
    type: act.action,
    action: activityMap[act.action] || act.action.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
  }));

  return (
    <>
      <TopLine />
      <CampaignDashboardView
        campaign={campaign}
        prospects={prospects ?? []}
        activities={mappedActivities as any}
        sequenceSteps={sequenceSteps ?? []}
      />
    </>
  );
}
