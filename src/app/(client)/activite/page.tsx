import { ListPage } from "@/components/layout/list-page";
import { TopLine } from "@/components/layout/top-line";
import { activities } from "@/lib/db/mock-data";

export default function ActivitePage() {
  return (
    <>
      <TopLine />
      <ListPage
        title="Activité"
        rows={activities.map((activity) => ({
          id: activity.id,
          title: activity.label,
          detail: activity.time,
          status: "termine",
        }))}
      />
    </>
  );
}
