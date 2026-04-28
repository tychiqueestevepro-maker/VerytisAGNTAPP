import { ListPage } from "@/components/layout/list-page";
import { TopLine } from "@/components/layout/top-line";
import { getClientFlows } from "@/lib/flows/actions";

// Map flow_key → route dédiée dans l'app
const FLOW_ROUTES: Record<string, string> = {
  prospecting: "/flows/prospecting",
  support: "/flows/support",
  "audit-site": "/flows/audit-site",
  reporting: "/flows/reporting",
};

export default async function FlowsPage() {
  const { data: flows, error } = await getClientFlows();

  if (error) {
    return (
      <>
        <TopLine />
        <div className="py-12 text-red-400">
          <p>Erreur lors du chargement des flows : {error}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <TopLine />
      <ListPage
        title="Flux Opérationnels"
        emptyState="Aucun flux activé pour cette organisation. Les flux sont activés selon votre offre."
        rows={(flows || []).map((flow) => ({
          id: flow.id,
          title: flow.display_name,
          detail: flow.description || `Gestion des campagnes de ${flow.display_name.toLowerCase()}.`,
          status: flow.status,
          link: FLOW_ROUTES[flow.flow_key] ?? `/flows/${flow.flow_key}`,
        }))}
      />
    </>
  );
}
