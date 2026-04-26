"use client";

import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { IntegrationLogo } from "@/components/integrations/integration-logo";
import { SectionHeading } from "@/components/layout/section-heading";
import { StatusDot, statusLabel } from "@/components/layout/status-dot";
import { TopLine } from "@/components/layout/top-line";
import { activities, agents, dashboardMetrics, integrations } from "@/lib/db/mock-data";

const fade = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

export function DashboardView() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => ({
      agents,
      activities,
      integrations,
      metrics: dashboardMetrics,
    }),
    initialData: {
      agents,
      activities,
      integrations,
      metrics: dashboardMetrics,
    },
  });

  const metrics = [
    ["Statut agent", data.metrics.agentStatus],
    ["Outils connectés", data.metrics.connectedTools],
    ["Actions aujourd’hui", data.metrics.actionsToday],
    ["Documents générés", data.metrics.documentsGenerated],
  ];

  return (
    <>
      <TopLine />
      <div className="space-y-20">
        <motion.section {...fade} className="ml-0 max-w-6xl">
          <div className="flex flex-wrap items-end gap-x-12 gap-y-9 md:gap-x-16">
            {metrics.map(([label, value], index) => (
              <div key={label}>
                <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/34">{label}</p>
                <p className="text-5xl font-semibold leading-none tracking-normal text-white md:text-7xl">{value}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <div className="flex flex-col gap-16 lg:flex-row lg:items-start lg:gap-20">
          <motion.section {...fade} transition={{ delay: 0.06 }} className="w-full pt-3 lg:w-[58%]">
            <SectionHeading>Agents</SectionHeading>
            <div className="divide-y divide-[#1F1F1F]">
              {data.agents.map((agent, index) => (
                <div key={agent.id} className="group flex items-center justify-between gap-8 py-5 transition duration-200 hover:pl-2 hover:bg-white/[0.018]">
                  <div>
                    <p className="text-lg text-white">{agent.name}</p>
                    <p className="mt-1 text-sm text-white/40">dernière exécution : {agent.lastRun}</p>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-white/56">
                    <StatusDot status={agent.status} pulse={agent.status === "actif"} />
                    {statusLabel(agent.status)}
                  </div>
                </div>
              ))}
            </div>
          </motion.section>

          <div className="w-full space-y-16 lg:w-[34%]">
            <motion.section {...fade} transition={{ delay: 0.1 }}>
              <SectionHeading>Activité</SectionHeading>
              <div className="space-y-4">
                {data.metrics.activity.map((item, index) => (
                  <p key={item} className="text-xl text-white/85 transition hover:text-white">
                    {item}
                  </p>
                ))}
              </div>
            </motion.section>

            <motion.section {...fade} transition={{ delay: 0.14 }}>
              <SectionHeading>Intégrations</SectionHeading>
              <div className="space-y-3">
                {data.integrations.map((integration, index) => (
                  <div key={integration.id} className="flex items-center justify-between gap-5 py-2 transition duration-200 hover:translate-x-1">
                    <div className="flex items-center gap-3">
                      <IntegrationLogo name={integration.name} />
                      <span className="text-sm text-white/82">{integration.name}</span>
                    </div>
                    <span className="flex items-center gap-2 text-xs text-white/45">
                      <StatusDot status={integration.status} />
                      {statusLabel(integration.status)}
                    </span>
                  </div>
                ))}
              </div>
            </motion.section>
          </div>
        </div>

        <motion.section {...fade} transition={{ delay: 0.18 }} className="max-w-5xl pb-10">
          <SectionHeading>Journal</SectionHeading>
          <div className="relative ml-2 space-y-7 before:absolute before:left-[4px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-[#1F1F1F]">
            {data.activities.map((activity) => (
              <div key={activity.id} className="relative flex gap-7 pl-8 transition duration-200 hover:translate-x-1">
                <span className="absolute left-0 top-2 size-2.5 rounded-full bg-white/70 ring-4 ring-black" />
                <span className="w-14 text-sm text-white/40">{activity.time}</span>
                <span className="text-sm text-white/78">{activity.label}</span>
              </div>
            ))}
          </div>
        </motion.section>
      </div>
    </>
  );
}
