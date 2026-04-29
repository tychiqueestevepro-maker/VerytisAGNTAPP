"use client";

import type { User } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ActivityIcon,
  AgentIcon,
  DashboardIcon,
  DocumentIcon,
  HelpIcon,
  IntegrationIcon,
  MarkIcon,
  SettingsIcon,
} from "@/components/layout/custom-icons";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { logout } from "@/lib/auth";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/activite", label: "Activité", icon: ActivityIcon },
  { href: "/flows", label: "Flows", icon: AgentIcon },
  { href: "/documents", label: "Documents", icon: DocumentIcon },
  { href: "/integrations", label: "Intégrations", icon: IntegrationIcon },
  { href: "/parametres", label: "Paramètres", icon: SettingsIcon },
];

export function AppShell({ children, user }: { children: React.ReactNode; user: any }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div 
      className="min-h-screen bg-black text-white"
      style={{ '--sidebar-width': collapsed ? '64px' : '220px' } as any}
    >
      <motion.aside
        animate={{ width: collapsed ? 64 : 220 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        className="fixed inset-y-0 left-0 z-30 flex border-r border-[#1F1F1F] bg-[#050505]/95"
      >
        <div className="flex min-w-0 flex-1 flex-col px-3 py-4">
          <div className={cn("mb-6 flex items-center px-1", collapsed ? "flex-col gap-6" : "justify-between")}>
            <img 
              src="/logo.png" 
              alt="Verytis" 
              className={cn(
                "h-14 w-auto object-contain invert grayscale contrast-125 opacity-70 transition-all duration-300 hover:opacity-100", 
                collapsed ? "h-9" : "h-14"
              )} 
            />
            {!collapsed ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-white/45 hover:bg-white/[0.06] hover:text-white"
                onClick={() => setCollapsed(true)}
                aria-label="Réduire"
              >
                <ChevronLeft className="size-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-white/45 hover:bg-white/[0.06] hover:text-white"
                onClick={() => setCollapsed(false)}
                aria-label="Ouvrir"
              >
                <ChevronRight className="size-4" />
              </Button>
            )}
          </div>

          {!collapsed && (
            <p className="mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-white/24">
              Menu
            </p>
          )}
          <nav className="space-y-1">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              const link = (
                <Link
                  href={item.href}
                  className={cn(
                    "group flex h-9 items-center gap-2.5 rounded-[6px] px-2.5 text-[13px] text-white/50 transition duration-200 hover:bg-white/[0.04] hover:text-white",
                    active && "bg-white/[0.08] text-white font-medium"
                  )}
                >
                  <Icon className="size-[18px] shrink-0" />
                  {!collapsed ? <span>{item.label}</span> : null}
                </Link>
              );

              return collapsed ? (
                <Tooltip key={item.href}>
                  <TooltipTrigger render={link} />
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                <div key={item.href}>{link}</div>
              );
            })}
          </nav>

          <div className="mt-auto space-y-4">
            <Link
              href="#"
              className="flex h-9 items-center gap-2.5 rounded-[6px] px-2.5 text-[13px] text-white/45 transition hover:bg-white/[0.045] hover:text-white"
            >
              <HelpIcon className="size-[18px] shrink-0" />
              {!collapsed ? <span>Centre d’aide</span> : null}
            </Link>
            <div className="border-t border-[#1F1F1F] pt-4">
              <div className="flex items-center gap-3 px-1">
                <Avatar className="size-8 rounded-[8px] border border-white/10">
                  <AvatarFallback className="rounded-[8px] bg-[#151515] text-xs text-white">
                    {user.email?.[0]?.toUpperCase() ?? "U"}
                  </AvatarFallback>
                </Avatar>
                {!collapsed ? (
                  <div className="flex min-w-0 flex-1 items-center justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-xs text-white/42">{user.email}</p>
                    </div>
                    <form action={logout}>
                      <button
                        type="submit"
                        aria-label="Se déconnecter"
                        className="text-white/35 transition hover:text-white"
                      >
                        <LogOut className="size-4" />
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </motion.aside>

      <motion.main
        animate={{ paddingLeft: collapsed ? 64 : 220 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        className="min-h-screen"
      >
        <div className="w-full px-4 md:px-8 py-6">
          {children}
        </div>
      </motion.main>
    </div>
  );
}
