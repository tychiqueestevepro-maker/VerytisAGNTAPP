import { cn } from "@/lib/utils";
import type { Status } from "@/types/models";

const tone: Record<Status, string> = {
  actif: "bg-emerald-400",
  connecte: "bg-emerald-400",
  termine: "bg-emerald-400",
  planifie: "bg-orange-400",
  en_attente: "bg-orange-400",
  erreur: "bg-red-400",
};

export function StatusDot({ status, pulse = false }: { status: Status; pulse?: boolean }) {
  return (
    <span className="relative inline-flex size-2.5">
      {pulse ? <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-35", tone[status])} /> : null}
      <span className={cn("relative inline-flex size-2.5 rounded-full", tone[status])} />
    </span>
  );
}

export function statusLabel(status: Status) {
  const labels: Record<Status, string> = {
    actif: "Actif",
    connecte: "Connecté",
    termine: "Terminé",
    planifie: "Planifié",
    en_attente: "En attente",
    erreur: "Erreur",
  };

  return labels[status];
}
