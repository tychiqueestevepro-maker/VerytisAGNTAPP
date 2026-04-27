import { TopLine } from "@/components/layout/top-line";
import { getProspectingData } from "@/lib/flows/prospecting";
import { CampaignsListView } from "../../../../components/flows/campaigns-list-view";
import { createProspectingCampaign } from "@/lib/flows/actions";

export const metadata = {
  title: "Prospection IA",
};

export default async function ProspectingFlowPage() {
  const { campaigns, error } = await getProspectingData();

  if (error) {
    return (
      <>
        <TopLine />
        <div className="py-12 text-red-400 text-sm">
          Erreur lors du chargement : {error}
        </div>
      </>
    );
  }

  return (
    <>
      <TopLine />
      <CampaignsListView
        campaigns={campaigns ?? []}
        createAction={createProspectingCampaign}
      />
    </>
  );
}
