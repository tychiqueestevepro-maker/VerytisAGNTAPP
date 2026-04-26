import { SectionHeading } from "@/components/layout/section-heading";
import { StatusDot, statusLabel } from "@/components/layout/status-dot";
import type { Status } from "@/types/models";

type Row = {
  id: string;
  title: string;
  detail: string;
  status?: Status;
};

export function ListPage({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="pt-2">
      <SectionHeading>{title}</SectionHeading>
      <div className="max-w-4xl divide-y divide-white/[0.075]">
        {rows.map((row, index) => (
          <div key={row.id} className="flex items-center justify-between gap-8 py-6 transition hover:pl-2">
            <div>
              <p className="text-2xl text-white">{row.title}</p>
              <p className="mt-2 text-sm text-white/40">{row.detail}</p>
            </div>
            {row.status ? (
              <span className="flex items-center gap-2 text-sm text-white/55">
                <StatusDot status={row.status} pulse={row.status === "actif"} />
                {statusLabel(row.status)}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
