import { StatusDot } from "@/components/layout/status-dot";

export function TopLine() {
  return (
    <div className="mb-12 flex items-center gap-3 text-xs text-white/45">
      <StatusDot status="actif" pulse />
      <span>Système actif — dernière mise à jour il y a 2h</span>
    </div>
  );
}
