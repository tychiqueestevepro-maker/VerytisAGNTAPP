import Link from "next/link";
import { SectionHeading } from "@/components/layout/section-heading";
import { StatusDot, statusLabel } from "@/components/layout/status-dot";
import type { Status } from "@/types/models";

type Row = {
  id: string;
  title: string;
  detail: string;
  status?: string;
  link?: string;
};

export function ListPage({ 
  title, 
  rows, 
  emptyState = "Aucun élément trouvé." 
}: { 
  title: string; 
  rows: Row[];
  emptyState?: string;
}) {
  return (
    <div className="pt-2">
      <SectionHeading>{title}</SectionHeading>
      <div className="max-w-4xl divide-y divide-white/[0.075]">
        {rows.length > 0 ? (
          rows.map((row) => {
            const content = (
              <div className="flex items-center justify-between gap-8 py-6 transition-all hover:pl-2">
                <div>
                  <p className="text-2xl text-white">{row.title}</p>
                  <p className="mt-2 text-sm text-white/40">{row.detail}</p>
                </div>
                {row.status ? (
                  <span className="flex items-center gap-2 text-sm text-white/55">
                    <StatusDot status={row.status} pulse={row.status === "active" || row.status === "actif"} />
                    {statusLabel(row.status)}
                  </span>
                ) : null}
              </div>
            );

            return (
              <div key={row.id}>
                {row.link ? (
                  <Link href={row.link} className="block group">
                    {content}
                  </Link>
                ) : content}
              </div>
            );
          })
        ) : (
          <div className="py-12">
            <p className="text-white/40 italic">{emptyState}</p>
          </div>
        )}
      </div>
    </div>
  );
}
