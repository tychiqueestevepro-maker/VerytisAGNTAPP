import { ListPage } from "@/components/layout/list-page";
import { TopLine } from "@/components/layout/top-line";
import { documents } from "@/lib/db/mock-data";
import { useTranslations } from "next-intl";

export default function DocumentsPage() {
  const t = useTranslations("Nav");
  return (
    <>
      <TopLine />
      <ListPage
        title={t("documents")}
        rows={documents.map((document) => ({
          id: document.id,
          title: document.title,
          detail: `${document.type} · ${document.createdAt}`,
          status: document.status,
        }))}
      />
    </>
  );
}
