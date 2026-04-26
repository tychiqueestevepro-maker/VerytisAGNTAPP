import { IntegrationLogo } from "@/components/integrations/integration-logo";
import { SectionHeading } from "@/components/layout/section-heading";
import { StatusDot, statusLabel } from "@/components/layout/status-dot";
import { TopLine } from "@/components/layout/top-line";
import { integrations } from "@/lib/db/mock-data";

export default function IntegrationsPage() {
  return (
    <>
      <TopLine />
      <SectionHeading>Intégrations</SectionHeading>
      <div className="max-w-3xl space-y-2">
        {integrations.map((integration, index) => (
          <div key={integration.id} className="flex items-center justify-between py-5 transition hover:pl-2">
            <div className="flex items-center gap-4">
              <IntegrationLogo name={integration.name} />
              <span className="text-xl text-white">{integration.name}</span>
            </div>
            <span className="flex items-center gap-2 text-sm text-white/55">
              <StatusDot status={integration.status} />
              {statusLabel(integration.status)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
