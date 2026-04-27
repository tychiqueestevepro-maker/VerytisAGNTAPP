import { cn } from "@/lib/utils";
import type { Status } from "@/types/models";

const tone: Record<string, string> = {
  actif: "bg-emerald-400",
  active: "bg-emerald-400",
  connecte: "bg-emerald-400",
  termine: "bg-emerald-400",
  planifie: "bg-orange-400",
  setup_required: "bg-orange-400",
  en_attente: "bg-orange-400",
  paused: "bg-white/20",
  erreur: "bg-red-400",
};

export function StatusDot({ status, pulse = false }: { status: string; pulse?: boolean }) {
  const colorClass = tone[status] || "bg-white/20";
  return (
    <span className="relative inline-flex size-2.5">
      {pulse ? <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-35", colorClass)} /> : null}
      <span className={cn("relative inline-flex size-2.5 rounded-full", colorClass)} />
    </span>
  );
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    actif: "Actif",
    active: "Actif",
    connecte: "Connecté",
    termine: "Terminé",
    planifie: "Planifié",
    setup_required: "Configuration requise",
    en_attente: "En attente",
    paused: "En pause",
    erreur: "Erreur",
  };

  return labels[status] || status;
}
