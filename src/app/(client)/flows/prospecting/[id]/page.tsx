import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserWithProfile } from "@/lib/auth";
import { getProspectingData } from "@/lib/flows/prospecting";
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
    .from("client_flows")
    .select("display_name")
    .eq("id", id)
    .eq("client_id", user.profile.client_id)
    .single();

  return { title: `${data?.display_name ?? "Campagne"} — Prospection Flow` };
}

export default async function CampaignDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getUserWithProfile();

  if (!user?.profile?.client_id) notFound();

  const supabase = await createSupabaseServerClient();

  // Load the specific campaign
  const { data: campaign, error: campaignError } = await supabase
    .from("client_flows")
    .select("*")
    .eq("id", id)
    .eq("client_id", user.profile.client_id)
    .eq("flow_key", "prospecting")
    .single();

  if (campaignError || !campaign) notFound();

  // Load prospects for this campaign (scoped to this flow_id)
  const { data: prospects } = await supabase
    .from("prospects")
    .select("id, company_name, decision_maker, role, fit_score, status, priority")
    .eq("client_id", user.profile.client_id)
    .eq("flow_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  // Load recent activity from agent_runs with agent details
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

  // Map activities to user-friendly labels
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

  // Load sequence steps
  let sequenceSteps: any[] = [];
  if (campaign.sequence_id) {
    const { data: steps } = await supabase
      .from("sequence_steps")
      .select("*")
      .eq("sequence_id", campaign.sequence_id)
      .order("step_order", { ascending: true });
    if (steps) sequenceSteps = steps;
  }

  return (
    <>
      <TopLine />
      <CampaignDashboardView
        campaign={campaign}
        prospects={prospects ?? []}
        activities={mappedActivities as any}
        sequenceSteps={sequenceSteps}
      />
    </>
  );
}
