import { ListPage } from "@/components/layout/list-page";
import { TopLine } from "@/components/layout/top-line";
import { getClientFlows } from "@/lib/flows/actions";
import { getTranslations } from "next-intl/server";

// Map flow_key → route dédiée dans l'app
const FLOW_ROUTES: Record<string, string> = {
  prospecting: "/flows/prospecting",
  support: "/flows/support",
  "audit-site": "/flows/audit-site",
  reporting: "/flows/reporting",
};

export default async function FlowsPage() {
  const { data: flows, error } = await getClientFlows();
  const t = await getTranslations("Flows");

  if (error) {
    return (
      <>
        <TopLine />
        <div className="py-12 text-red-400">
          <p>{t("error_loading")}{error}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <TopLine />
      <ListPage
        title={t("title")}

        emptyState={t("empty_state")}
        rows={(flows || []).map((flow) => ({
          id: flow.id,
          title: t.has(`names.${flow.flow_key}`) ? t(`names.${flow.flow_key}`) : flow.display_name,
          detail: t.has(`descriptions.${flow.flow_key}`) 
            ? t(`descriptions.${flow.flow_key}`) 
            : (flow.description || `${t("description_fallback")}${flow.display_name.toLowerCase()}.`),
          status: t.has(`status.${flow.status.toLowerCase()}`) 
            ? t(`status.${flow.status.toLowerCase()}`) 
            : flow.status,
          link: FLOW_ROUTES[flow.flow_key] ?? `/flows/${flow.flow_key}`,
        }))}


      />
    </>
  );
}
