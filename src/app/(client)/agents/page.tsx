import { ListPage } from "@/components/layout/list-page";
import { TopLine } from "@/components/layout/top-line";
import { agents } from "@/lib/db/mock-data";

export default function AgentsPage() {
  return (
    <>
      <TopLine />
      <ListPage
        title="Agents"
        rows={agents.map((agent) => ({
          id: agent.id,
          title: agent.name,
          detail: `dernière exécution : ${agent.lastRun}`,
          status: agent.status,
        }))}
      />
    </>
  );
}
