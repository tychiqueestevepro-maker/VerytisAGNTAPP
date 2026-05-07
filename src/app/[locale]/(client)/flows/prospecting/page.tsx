import { TopLine } from "@/components/layout/top-line";
import { getProspectingData } from "@/lib/flows/prospecting";
import { CampaignsListView } from "@/components/flows/campaigns-list-view";
import { createProspectingCampaign } from "@/lib/flows/actions";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Prospecting" });
  return {
    title: t("page_title"),
  };
}

export default async function ProspectingFlowPage() {
  const { campaigns, error } = await getProspectingData();
  const t = await getTranslations("Prospecting");

  if (error) {
    return (
      <>
        <TopLine />
        <div className="py-12 text-red-400 text-sm">
          {t("page_error")} {error}
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
