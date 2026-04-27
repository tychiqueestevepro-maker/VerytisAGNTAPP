import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getClientFlows } from "@/lib/flows/actions";

export default async function DashboardPage() {
  const { data: flows } = await getClientFlows();
  
  return <DashboardView initialAgents={flows || []} />;
}
