"use client";

import type { User } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { Link, usePathname } from "@/i18n/routing";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  AgentIcon,
  DashboardIcon,
  DocumentIcon,
  HelpIcon,
  IntegrationIcon,
  MarkIcon,
  SettingsIcon,
  ReportIcon,
} from "@/components/layout/custom-icons";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { logout } from "@/lib/auth";
import { cn } from "@/lib/utils";

const FLOW_ROUTES: Record<string, string> = {
  prospecting: "/flows/prospecting",
  support: "/flows/support",
  "audit-site": "/flows/audit-site",
  reporting: "/flows/reporting",
};

export function AppShell({ children, user, initialFlows = [] }: { children: React.ReactNode; user: any; initialFlows?: any[] }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [flowsExpanded, setFlowsExpanded] = useState(true);
  const tNav = useTranslations("Nav");
  const tRoles = useTranslations("Settings.roles");
  const tFlows = useTranslations("Flows");

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden selection:bg-indigo-500/30">
      {/* Sidebar - Optimized for speed */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 64 : 220 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="relative z-30 flex flex-col border-r border-white/5 bg-[#050505] shrink-0"
      >
        <div className="flex flex-col h-full px-3 py-4 overflow-hidden">
          <div className={cn("mb-6 flex items-center px-1", collapsed ? "flex-col gap-6" : "justify-between")}>
            <img 
              src="/logo.png" 
              alt="Verytis" 
              className={cn(
                "h-14 w-auto object-contain invert grayscale contrast-125 opacity-70 transition-all duration-300 hover:opacity-100", 
                collapsed ? "h-9" : "h-14"
              )} 
            />
            {collapsed ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-white/45 hover:bg-white/[0.06] hover:text-white"
                onClick={() => setCollapsed(false)}
              >
                <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-white/45 hover:bg-white/[0.06] hover:text-white"
                onClick={() => setCollapsed(true)}
              >
                <ChevronLeft className="size-4" />
              </Button>
            )}
          </div>

          {!collapsed && (
            <p className="mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-white/24">
              {tNav("menu")}
            </p>
          )}
          <nav className="space-y-1">
            {/* Home */}
            <Link
              href="/"
              className={cn(
                "group flex h-9 items-center gap-2.5 rounded-[6px] px-2.5 text-[13px] text-white/50 transition duration-200 hover:bg-white/[0.04] hover:text-white",
                pathname === "/" && "bg-white/[0.08] text-white font-medium"
              )}
            >
              <DashboardIcon className="size-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{tNav("home")}</span>}
            </Link>

            {/* Flows with Submenu */}
            <div className="space-y-1">
              <div
                className={cn(
                  "group flex h-9 items-center justify-between rounded-[6px] px-2.5 text-[13px] text-white/50 transition duration-200 hover:bg-white/[0.04] hover:text-white",
                  pathname.startsWith("/flows") && "bg-white/[0.08] text-white font-medium"
                )}
              >
                <Link href="/flows" className="flex items-center gap-2.5 flex-1 h-full">
                  <AgentIcon className="size-[18px] shrink-0" />
                  {!collapsed && <span className="truncate">{tNav("flows")}</span>}
                </Link>
                {!collapsed && initialFlows.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setFlowsExpanded(!flowsExpanded);
                    }}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                  >
                    <ChevronDown className={cn("size-3.5 transition-transform duration-200", flowsExpanded ? "rotate-180" : "")} />
                  </button>
                )}
              </div>

              {!collapsed && initialFlows.length > 0 && (
                <motion.div
                  initial={false}
                  animate={{ height: flowsExpanded ? "auto" : 0, opacity: flowsExpanded ? 1 : 0 }}
                  className="overflow-hidden space-y-1 ml-4 border-l border-white/5 pl-2"
                >
                  {initialFlows.map((flow) => {
                    const flowHref = FLOW_ROUTES[flow.flow_key] ?? `/flows/${flow.flow_key}`;
                    const isActiveFlow = pathname.startsWith(flowHref);
                    
                    return (
                      <div key={flow.id} className="space-y-1">
                        <Link
                          href={flowHref as any}
                          className={cn(
                            "flex h-8 items-center gap-2 px-2.5 text-[12px] text-white/30 transition hover:text-white",
                            isActiveFlow && "text-white font-medium bg-white/5 rounded"
                          )}
                        >
                          <div className={cn(
                            "size-1.5 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]",
                            flow.flow_key === "prospecting" ? "bg-blue-500" : "bg-emerald-500"
                          )} />
                          <span className="truncate">{tFlows(`names.${flow.flow_key}`) || flow.display_name}</span>
                        </Link>

                        {/* Sub-pages for active flow */}
                        {isActiveFlow && flow.flow_key === "prospecting" && (
                          <div className="ml-4 space-y-1">
                            <Link
                              href={flowHref as any}
                              className={cn(
                                "flex h-7 items-center gap-2 px-2.5 text-[11px] text-white/20 transition hover:text-white",
                                pathname === flowHref && "text-white font-medium bg-white/5 rounded"
                              )}
                            >
                              <div className="size-1 rounded-full bg-blue-500/40" />
                              <span className="truncate">{tNav("campaigns")}</span>
                            </Link>
                            <Link
                              href={`${flowHref}/contacts` as any}
                              className={cn(
                                "flex h-7 items-center gap-2 px-2.5 text-[11px] text-white/20 transition hover:text-white",
                                pathname.includes("/contacts") && "text-white font-medium bg-white/5 rounded"
                              )}
                            >
                              <div className="size-1 rounded-full bg-blue-500/40" />
                              <span className="truncate">{tNav("contacts")}</span>
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </div>

            {/* Other Items */}
            {[
              { href: "/documents", labelKey: "reports", icon: ReportIcon },
              { href: "/integrations", labelKey: "integrations", icon: IntegrationIcon },
              { href: "/parametres", labelKey: "settings", icon: SettingsIcon },
            ].map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href as any}
                  className={cn(
                    "group flex h-9 items-center gap-2.5 rounded-[6px] px-2.5 text-[13px] text-white/50 transition duration-200 hover:bg-white/[0.04] hover:text-white",
                    active && "bg-white/[0.08] text-white font-medium"
                  )}
                >
                  <Icon className="size-[18px] shrink-0" />
                  {!collapsed ? <span className="truncate">{tNav(item.labelKey)}</span> : null}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-4">
            <Link
              href="#"
              className="flex h-9 items-center gap-2.5 rounded-[6px] px-2.5 text-[13px] text-white/45 transition hover:bg-white/[0.045] hover:text-white"
            >
              <HelpIcon className="size-[18px] shrink-0" />
              {!collapsed ? <span>{tNav("help")}</span> : null}
            </Link>
            <div className="border-t border-[#1F1F1F] pt-4">
              <div className="flex items-center gap-3 px-2">
                {!collapsed ? (
                  <div className="flex min-w-0 flex-1 items-center justify-between">
                    <div className="min-w-0 flex flex-col">

                      <p className="truncate text-[13px] font-medium text-white/90 leading-none mb-1">
                        {user.profile?.first_name} {user.profile?.last_name}
                      </p>
                      <p className="truncate text-[10px] uppercase tracking-wider text-white/30 font-semibold leading-none">
                        {user.profile?.role === 'owner' ? tRoles('owner') : user.profile?.role === 'admin' ? tRoles('admin') : tRoles('member')}
                      </p>
                    </div>
                    <form action={logout}>
                      <button
                        type="submit"
                        className="text-white/30 transition hover:text-white ml-2"
                        title={tNav("logout")}
                      >
                        <LogOut className="size-3.5" />
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>

            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Content - Flex-1 automatically fills space without animating padding */}
      <main className="flex-1 h-screen relative overflow-y-auto">
        <div className={cn(
          "w-full h-full",
          pathname !== "/" && !pathname.startsWith("/flows/prospecting") && "px-4 md:px-8 py-6"
        )}>
          {children}
        </div>
      </main>
    </div>
  );
}
