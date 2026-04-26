import { ListPage } from "@/components/layout/list-page";
import { TopLine } from "@/components/layout/top-line";
import { documents } from "@/lib/db/mock-data";

export default function DocumentsPage() {
  return (
    <>
      <TopLine />
      <ListPage
        title="Documents"
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
