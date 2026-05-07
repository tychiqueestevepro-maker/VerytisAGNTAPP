import { TopLine } from "@/components/layout/top-line";
import { ProspectsFullTable } from "@/components/flows/prospects-full-table";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Prospecting" });
  return {
    title: `Contacts — ${t("page_title")}`,
  };
}

export default async function ProspectingContactsPage() {
  return (
    <div className="h-full">
      <TopLine />
      <ProspectsFullTable />
    </div>
  );
}
