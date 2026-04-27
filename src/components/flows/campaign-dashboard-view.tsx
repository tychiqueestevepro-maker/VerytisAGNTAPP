"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  ChevronDown,
  Search,
  MessageSquare,
  Clock,
  Filter,
  ZoomIn,
  ZoomOut,
  Activity,
  User,
  Zap,
  CheckCircle2,
  AlertCircle,
  MoreHorizontal,
  ArrowLeft,
  Maximize2,
  X,
  Edit2,
  Settings,
  Loader2,
  Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SequenceBuilderModal } from "./sequence-builder";

// --- Types ---
type FlowStatus = "active" | "paused" | "setup_required" | "disabled";

interface Campaign {
  id: string;
  display_name: string;
  status: FlowStatus;
  created_at: string;
  config?: any;
}

interface Prospect {
  id: string;
  company_name: string;
  decision_maker: string;
  role: string;
  fit_score: number;
  status: string;
  priority: string;
}

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string;
  created_at: string;
  type?: string;
}

// --- Helpers ---
const STATUS_LABEL: Record<string, string> = {
  active: "Actif",
  paused: "En pause",
  setup_required: "Configuration requise",
  disabled: "Désactivé",
};

const StatusDot = ({ status }: { status: string }) => {
  if (status === "active") return <span className="flex size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>;
  if (status === "paused") return <span className="flex size-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></span>;
  return <span className="flex size-2 rounded-full bg-zinc-500"></span>;
};

// ============================================================================
// CANVAS FLOW COMPONENTS (Now in a Modal)
// ============================================================================

function CsvImportModal({ onClose, campaignId }: { onClose: () => void; campaignId: string }) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const Papa = (await import("papaparse")).default;
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const { createSupabaseBrowserClient } = await import("@/lib/supabase/client");
            const supabase = createSupabaseBrowserClient();
            
            // Upload to storage for archiving
            const timestamp = new Date().getTime();
            const fileName = `${campaignId}_${timestamp}.csv`;
            
            await supabase.storage
              .from('csv_imports')
              .upload(fileName, file);
          } catch (storageErr) {
            console.error("Failed to archive CSV:", storageErr);
          }

          const { importProspectsCSV } = await import("@/lib/flows/import");
          const res = await importProspectsCSV(campaignId, results.data);
          if (res.success) {
            router.refresh();
            onClose();
          } else {
            setError(res.error || "Erreur lors de l'import");
            setIsUploading(false);
          }
        },
        error: (err) => {
          setError("Erreur de lecture du CSV");
          setIsUploading(false);
        }
      });
    } catch (err) {
      setError("Erreur lors de l'import");
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden flex flex-col relative shadow-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-lg text-white flex items-center gap-2">
            <Upload className="size-5 text-white/70" /> Importer des contacts
          </h2>
          <button onClick={onClose} className="p-1.5 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors">
            <X className="size-4" />
          </button>
        </div>
        
        <div className="space-y-4">
          <p className="text-sm text-white/60">Importez un fichier CSV UTF-8. Champs recommandés : <code className="text-xs bg-white/5 px-1 py-0.5 rounded">Email</code>, <code className="text-xs bg-white/5 px-1 py-0.5 rounded">FirstName</code>, <code className="text-xs bg-white/5 px-1 py-0.5 rounded">LastName</code>, <code className="text-xs bg-white/5 px-1 py-0.5 rounded">CompanyName</code>, <code className="text-xs bg-white/5 px-1 py-0.5 rounded">LinkedInURL</code>.</p>
          
          <div className="relative border-2 border-dashed border-white/20 rounded-xl p-8 hover:border-white/40 transition-colors bg-white/[0.02] text-center cursor-pointer">
            <input type="file" accept=".csv" onChange={handleFileUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <div className="flex flex-col items-center justify-center pointer-events-none">
              {isUploading ? <Loader2 className="size-8 text-emerald-500 animate-spin mb-3" /> : <Upload className="size-8 text-white/40 mb-3" />}
              <p className="text-sm font-medium text-white">{isUploading ? "Import en cours..." : "Cliquez ou glissez un fichier CSV"}</p>
            </div>
          </div>
          {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
        </div>
      </motion.div>
    </div>
  );
}

const FLOW_STEPS = [
  { id: "s1", type: "trigger", title: "Leads Finder Agent", subtitle: "Agent de recherche • Actif", icon: Search, color: "text-blue-400", statsText: "35 contact(s) trouvés", statsColor: "text-emerald-400", statsBg: "bg-emerald-500/10" },
  { id: "s2", type: "action", title: "Envoyer Invitation", subtitle: "Invitation LinkedIn sans note", icon: User, color: "text-purple-400", statsText: "0 accepté", statsColor: "text-emerald-400", statsBg: "bg-emerald-500/10" },
  { id: "w1", type: "wait", title: "1 jour(s) après", icon: Clock },
  { id: "s3", type: "action", title: "Envoyer Message", subtitle: "AI Icebreaker • Personnalisé pour chaque contact", icon: MessageSquare, color: "text-emerald-400", statsText: "0 répondu", statsColor: "text-white/40", statsBg: "bg-white/5" },
  { id: "w2", type: "wait", title: "2 jour(s) après", icon: Clock },
  { id: "s4", type: "action", title: "Envoyer Message", subtitle: "Relance automatique (Step 3)", icon: MessageSquare, color: "text-amber-400", statsText: "0 répondu", statsColor: "text-white/40", statsBg: "bg-white/5" }
];

function FlowCanvasModal({ onClose, sequenceSteps }: { onClose: () => void; sequenceSteps?: any[] }) {
  const stepsData = sequenceSteps && sequenceSteps.length > 0
    ? sequenceSteps.map(s => ({
        id: s.id,
        type: s.action_type,
        title: s.name,
        subtitle: s.description || "",
        icon: s.action_type === 'trigger' ? Search : s.action_type === 'wait' ? Clock : MessageSquare,
        color: s.action_type === 'trigger' ? "text-blue-400" : s.action_type === 'wait' ? "text-amber-400" : "text-emerald-400",
        statsText: "0",
        statsColor: "text-white/40",
        statsBg: "bg-white/5"
      }))
    : FLOW_STEPS;

  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [editingStep, setEditingStep] = useState<typeof stepsData[0] | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setStartY(e.pageY - containerRef.current.offsetTop);
    setScrollLeft(containerRef.current.scrollLeft);
    setScrollTop(containerRef.current.scrollTop);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const y = e.pageY - containerRef.current.offsetTop;
    const walkX = (x - startX) * 1.5;
    const walkY = (y - startY) * 1.5;
    containerRef.current.scrollLeft = scrollLeft - walkX;
    containerRef.current.scrollTop = scrollTop - walkY;
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingStep) setEditingStep(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, editingStep]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-8">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full h-full bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden flex flex-col relative shadow-2xl"
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#050505] z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded bg-white/5">
              <Zap className="size-4 text-emerald-400" />
            </div>
            <h2 className="font-semibold text-white">Visualisation du Flow</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-md text-xs text-white/60">
              <span className="size-2 rounded-full bg-emerald-500" />
              Campagne active
            </div>
            <button onClick={onClose} className="p-2 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden" ref={containerRef}>
          <div 
            className="absolute inset-0 opacity-[0.03] pointer-events-none" 
            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}
          />
          
          <div className="absolute bottom-6 left-6 flex items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-lg backdrop-blur-md z-10">
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-2 hover:bg-white/10 rounded-md text-white/60 hover:text-white transition-colors">
              <ZoomOut className="size-4" />
            </button>
            <span className="text-xs font-mono w-12 text-center text-white/60">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(1.5, z + 0.1))} className="p-2 hover:bg-white/10 rounded-md text-white/60 hover:text-white transition-colors">
              <ZoomIn className="size-4" />
            </button>
          </div>

          <AnimatePresence>
            {editingStep && (
              <motion.div
                initial={{ opacity: 0, x: 50, filter: "blur(10px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, x: 50, filter: "blur(10px)" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="absolute top-6 right-6 bottom-6 w-[400px] bg-[#0c0c0c]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] p-6 z-50 flex flex-col"
              >
                <div className="flex items-center justify-between mb-8">
                  <h3 className="font-semibold text-white flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-[#111] border border-white/5 ${editingStep.color}`}>
                      {editingStep.icon && <editingStep.icon className="size-4" />}
                    </div>
                    Éditer l'étape
                  </h3>
                  <button onClick={() => setEditingStep(null)} className="p-1.5 hover:bg-white/10 rounded-md text-white/40 hover:text-white transition-colors">
                    <X className="size-4" />
                  </button>
                </div>
                
                <div className="flex-1 space-y-6 overflow-y-auto pr-2">
                  <div>
                    <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block font-medium">Titre de l'action</label>
                    <input className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 transition-colors" defaultValue={editingStep.title} />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block font-medium">Description interne</label>
                    <input className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 transition-colors" defaultValue={editingStep.subtitle} />
                  </div>
                  <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
                    <p className="text-sm text-blue-400 font-medium mb-1">Configuration de l'agent IA</p>
                    <p className="text-xs text-white/60">Cette étape est gérée dynamiquement par le moteur. Modifiez les prompts dans la section Configuration Agent.</p>
                  </div>
                </div>
                
                <div className="pt-6 border-t border-white/10 mt-auto flex gap-3">
                  <Button variant="outline" onClick={() => setEditingStep(null)} className="flex-1 bg-transparent border-white/10 text-white hover:bg-white/5">Annuler</Button>
                  <Button onClick={() => setEditingStep(null)} className="flex-1 bg-white text-black hover:bg-white/90">Sauvegarder</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div 
            className="absolute inset-0 overflow-auto flex flex-col items-center py-20 select-none" 
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
          >
            <motion.div 
              className="flex flex-col items-center min-w-max"
              animate={{ scale: zoom }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              style={{ transformOrigin: "top center" }}
            >
              <div className="mb-6 px-4 py-1.5 rounded-full text-xs font-medium text-white/40 bg-white/5 border border-white/10">
                Début de séquence
              </div>

              {stepsData.map((step, i) => {
                const isLast = i === stepsData.length - 1;
                return (
                  <div key={step.id} className="flex flex-col items-center">
                    {step.type === 'wait' || step.type === 'condition' ? (
                      <div className={`z-10 px-4 py-1.5 rounded-full text-xs font-medium border flex items-center gap-2 bg-[#0A0A0A] ${step.type === 'wait' ? 'text-amber-400 border-amber-500/30' : 'text-purple-400 border-purple-500/30'}`}>
                        {step.icon && <step.icon className="size-3" />} {step.title}
                      </div>
                    ) : (
                      <div className="z-10 w-[500px] bg-[#0c0c0c] border border-white/10 rounded-2xl p-5 shadow-xl hover:border-white/20 transition-colors">
                        <div className="flex justify-between items-start mb-5">
                          <div className="flex items-center gap-3.5">
                            <div className={`p-2.5 rounded-xl bg-[#111] border border-white/5 ${step.color}`}>
                              {step.icon && <step.icon className="size-5" />}
                            </div>
                            <div>
                              <h3 className="text-white text-sm font-medium">{step.title}</h3>
                              <p className="text-xs text-white/40 mt-0.5">{step.subtitle}</p>
                            </div>
                          </div>
                          <button onClick={() => setEditingStep(step)} className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors px-2 py-1 rounded-md hover:bg-blue-500/10">
                            Éditer <Edit2 className="size-3" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                          <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md ${step.statsBg} ${step.statsColor}`}>
                            <CheckCircle2 className="size-3.5" /> {step.statsText}
                          </div>
                          <div className="text-xs text-white/40 flex items-center gap-1.5">
                            <User className="size-3.5" /> 0 contact(s)
                          </div>
                        </div>
                      </div>
                    )}
                    {!isLast && (
                      <div className="w-px h-10 bg-gradient-to-b from-white/20 to-white/20 relative">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-1.5 rounded-full bg-white/10" />
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="mt-6 size-3 rounded-full border-2 border-white/20 bg-[#0A0A0A]" />
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function SettingsModal({ onClose, campaignName, campaign }: { onClose: () => void; campaignName: string; campaign: Campaign }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'config' | 'prospection' | 'injection'>('prospection');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [localProspectsPerDay, setLocalProspectsPerDay] = useState(campaign.config?.prospection?.prospects_per_day || 20);
  const [localSearchTime, setLocalSearchTime] = useState(campaign.config?.prospection?.search_time || "09:00");

  const handleSave = async () => {
    setIsSaving(true);
    const { updateCampaignConfig } = await import("@/lib/flows/actions");
    const result = await updateCampaignConfig(campaign.id, {
      prospection: {
        prospects_per_day: localProspectsPerDay,
        search_time: localSearchTime
      }
    });

    if (result.success) {
      router.refresh();
      onClose();
    } else {
      alert(result.error || "Erreur lors de la sauvegarde");
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette campagne ? Cette action est irréversible.")) return;
    
    setIsDeleting(true);
    const { setCampaignStatus } = await import("@/lib/flows/actions");
    const result = await setCampaignStatus(campaign.id, "disabled");
    
    if (result.success) {
      router.push("/flows/prospecting");
    } else {
      alert(result.error || "Erreur lors de la suppression");
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-8">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full h-full max-w-5xl max-h-[850px] bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden flex flex-col relative shadow-2xl"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-[#050505] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/5">
              <Settings className="size-5 text-white/70" />
            </div>
            <div>
              <h2 className="font-semibold text-xl text-white">Paramètres de la campagne</h2>
              <p className="text-sm text-white/40">{campaignName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-64 border-r border-white/10 bg-[#070707] p-4 flex flex-col gap-2 shrink-0">
            {[
              { id: 'config', label: 'Configuration', icon: Edit2 },
              { id: 'prospection', label: 'Prospection', icon: Search },
              { id: 'injection', label: 'Injection', icon: Zap },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id 
                    ? "bg-white/10 text-white border border-white/10 shadow-lg" 
                    : "text-white/40 hover:bg-white/5 hover:text-white border border-transparent"
                }`}
              >
                <tab.icon className="size-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-8 bg-[#0A0A0A]">
            <AnimatePresence mode="wait">
              {activeTab === 'config' && (
                <motion.div key="config" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                  <section className="space-y-6">
                    <h3 className="text-xs font-bold text-white/40 uppercase tracking-[0.2em] flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-blue-400" /> Identité & Objectif
                    </h3>
                    <div className="grid gap-6 p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                      <div className="space-y-2">
                        <label className="text-xs text-white/30 uppercase tracking-wider font-medium">Nom de la campagne</label>
                        <p className="text-sm text-white font-medium">{campaignName}</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-white/30 uppercase tracking-wider font-medium">Objectif principal</label>
                        <p className="text-sm text-white/70 leading-relaxed">Génération de rendez-vous qualifiés pour l'offre d'Agents IA autonomes.</p>
                      </div>
                    </div>
                  </section>
                </motion.div>
              )}

              {activeTab === 'prospection' && (
                <motion.div key="prospection" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-12">
                  <section className="space-y-8">
                    <h3 className="text-xs font-bold text-white/40 uppercase tracking-[0.2em] flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-blue-400" /> 🎯 Prospection & Cible
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                        <label className="text-xs text-white/30 uppercase tracking-wider font-medium">Secteurs & Taille</label>
                        <div className="flex flex-wrap gap-2">
                          {(campaign.config?.target_icp?.sectors || ['Non défini']).map((s: string) => (
                            <span key={s} className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-medium">{s}</span>
                          ))}
                        </div>
                      </div>
                      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                        <label className="text-xs text-white/30 uppercase tracking-wider font-medium">Géographie</label>
                        <div className="flex flex-wrap gap-2">
                          {(campaign.config?.target_icp?.locations || ['Non défini']).map((t: string) => (
                            <span key={t} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70">{t}</span>
                          ))}
                        </div>
                      </div>
                      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                        <label className="text-xs text-white/30 uppercase tracking-wider font-medium">Décideurs ciblés</label>
                        <div className="flex flex-wrap gap-2">
                          {(campaign.config?.personas || ['Non défini']).map((p: string) => (
                            <span key={p} className="px-2.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-400 font-medium">{p}</span>
                          ))}
                        </div>
                      </div>
                      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                        <label className="text-xs text-white/30 uppercase tracking-wider font-medium">IA & Ton</label>
                        <p className="text-sm text-white/70 font-medium">{campaign.config?.tone || "Professionnel"}</p>
                      </div>
                    </div>

                    <div className="pt-8 border-t border-white/5 space-y-8">
                      <div className="flex items-center justify-between p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-white">Mode Automatique</p>
                          <p className="text-xs text-white/40">L'agent prospecte quotidiennement selon l'heure définie.</p>
                        </div>
                        <div className={`w-12 h-6 rounded-full border relative cursor-pointer transition-colors ${campaign.config?.prospection?.mode === 'auto' ? 'bg-blue-500/20 border-blue-500/40' : 'bg-white/5 border-white/10'}`}>
                          <div className={`absolute top-1 size-4 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)] transition-all ${campaign.config?.prospection?.mode === 'auto' ? 'right-1 bg-blue-500' : 'left-1 bg-white/20'}`} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <p className="text-xs text-white/30 uppercase tracking-wider font-medium">Prospects par jour :</p>
                          <input type="number" value={localProspectsPerDay} onChange={(e) => setLocalProspectsPerDay(parseInt(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50" />
                        </div>
                        <div className="space-y-4">
                          <p className="text-xs text-white/30 uppercase tracking-wider font-medium">Heure de recherche :</p>
                          <input type="time" value={localSearchTime} onChange={(e) => setLocalSearchTime(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50" />
                        </div>
                      </div>
                    </div>
                  </section>
                </motion.div>
              )}

              {activeTab === 'injection' && (
                <motion.div key="injection" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-12">
                  <section>
                    <h3 className="text-xs font-bold text-white/40 uppercase tracking-[0.2em] mb-8">📥 Injection</h3>
                    <div className="space-y-10">
                      <div>
                        <p className="text-sm font-medium text-white mb-4">Que faire des prospects trouvés ?</p>
                        <div className="space-y-3">
                          <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer group transition-all ${campaign.config?.injection?.auto_add ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
                            <input type="radio" name="injection" checked={campaign.config?.injection?.auto_add} readOnly className="size-4 accent-emerald-500" />
                            <div>
                              <p className="text-sm text-white font-medium">Ajouter automatiquement à la campagne</p>
                              <p className="text-xs text-white/40 mt-0.5">L'IA lance la séquence immédiatement après la découverte.</p>
                            </div>
                          </label>
                          <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer group transition-all ${!campaign.config?.injection?.auto_add ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
                            <input type="radio" name="injection" checked={!campaign.config?.injection?.auto_add} readOnly className="size-4 accent-emerald-500" />
                            <div>
                              <p className="text-sm text-white/70 font-medium group-hover:text-white transition-colors">Valider avant ajout</p>
                              <p className="text-xs text-white/40 mt-0.5">Les prospects restent en attente dans l'onglet de validation.</p>
                            </div>
                          </label>
                        </div>
                      </div>
                      <div className="space-y-4 pt-6 border-t border-white/5">
                        <p className="text-sm font-medium text-white">Options :</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <label className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5 opacity-50 cursor-not-allowed">
                            <div className="flex items-center justify-center size-5 rounded border border-white/20 bg-white/5">
                              <input type="checkbox" checked={campaign.config?.injection?.ignore_duplicates} readOnly className="size-4 accent-blue-500" />
                            </div>
                            <span className="text-sm text-white/70">Ignorer les doublons</span>
                          </label>
                          <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer hover:bg-white/5 transition-colors ${campaign.config?.injection?.prioritize_linkedin ? 'bg-blue-500/5 border-blue-500/20' : 'bg-white/[0.02] border-white/5'}`}>
                            <div className="flex items-center justify-center size-5 rounded border border-white/20 bg-white/5">
                              <input type="checkbox" checked={campaign.config?.injection?.prioritize_linkedin} readOnly className="size-4 accent-blue-500" />
                            </div>
                            <span className="text-sm text-white/70">Prioriser les prospects avec LinkedIn</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </section>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        
        <div className="p-6 border-t border-white/10 bg-[#050505] flex justify-between items-center shrink-0">
          <Button variant="ghost" onClick={handleDelete} disabled={isDeleting} className="text-red-500 hover:text-red-400 hover:bg-red-500/10 px-4 gap-2">
            {isDeleting ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
            Supprimer la campagne
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="bg-transparent border-white/10 text-white hover:bg-white/5 px-8">Annuler</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-white text-black hover:bg-white/90 px-8 font-bold min-w-[140px]">
              {isSaving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Enregistrer
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================
export function CampaignDashboardView({ 
  campaign, 
  prospects, 
  activities,
  sequenceSteps
}: { 
  campaign: Campaign; 
  prospects: Prospect[]; 
  activities: ActivityLog[]; 
  sequenceSteps?: any[];
}) {
  const router = useRouter();
  const [isFlowModalOpen, setIsFlowModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [campaignName, setCampaignName] = useState(campaign.display_name || "Campagne Sans Nom");
  const [isEditingName, setIsEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterScore, setFilterScore] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isEditingName]);

  const [isStatusLoading, setIsStatusLoading] = useState(false);

  const toggleStatus = async () => {
    setIsStatusLoading(true);
    const newStatus = campaign.status === "active" ? "paused" : "active";
    const { setCampaignStatus } = await import("@/lib/flows/actions");
    const result = await setCampaignStatus(campaign.id, newStatus);
    
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error || "Erreur lors du changement de statut");
    }
    setIsStatusLoading(false);
  };

  const isPaused = campaign.status === "paused";

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)] w-full bg-black text-white font-sans overflow-y-auto">
      
      {/* HEADER */}
      <header className="shrink-0 border-b border-white/10 px-8 py-5 flex items-center justify-between bg-[#050505] sticky top-0 z-30">
        <div className="flex items-center gap-6">
          <Button variant="ghost" size="sm" className="text-white/40 hover:text-white px-0 hover:bg-transparent" onClick={() => router.push("/flows/prospecting")}>
            <ArrowLeft className="size-4 mr-2" /> Retour aux campagnes
          </Button>
          <div className="h-6 w-px bg-white/10" />
          <div className="flex items-center gap-3 group">
            {isEditingName ? (
              <input ref={nameInputRef} value={campaignName} onChange={(e) => setCampaignName(e.target.value)} onBlur={() => setIsEditingName(false)} onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)} className="bg-white/5 border border-white/20 rounded-md px-3 py-1 text-lg font-semibold text-white focus:outline-none focus:border-white/40 w-64" />
            ) : (
              <h1 className="text-2xl font-bold flex items-center gap-2 cursor-pointer group-hover:text-white/90 transition-colors" onClick={() => setIsEditingName(true)}>
                {campaignName}
                <Edit2 className="size-4 text-white/0 group-hover:text-white/40 transition-colors" />
              </h1>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 ml-2">
              <StatusDot status={campaign.status} />
              <span className="text-xs text-white/60 capitalize">{STATUS_LABEL[campaign.status] || campaign.status}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button onClick={toggleStatus} disabled={isStatusLoading} className={`gap-2 font-medium border min-w-[140px] ${isPaused ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"}`}>
            {isStatusLoading ? <Loader2 className="size-4 animate-spin" /> : isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
            {isPaused ? "Activer" : "Mettre en pause"}
          </Button>
          <div className="h-6 w-px bg-white/10" />
          <Button onClick={() => setIsSettingsOpen(true)} className="bg-white/10 hover:bg-white/20 text-white gap-2 border border-white/10 font-medium">
            <Settings className="size-4" /> Paramètres
          </Button>
        </div>
      </header>

      {/* DASHBOARD CONTENT */}
      <div className="p-8 w-full space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 p-5 rounded-2xl border border-white/10 bg-white/[0.01] flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold text-base text-white">Performances</h3>
                <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">Live Analytics</p>
              </div>
              <div className="px-2 py-0.5 rounded-full bg-emerald-500/5 border border-emerald-500/10 text-[9px] text-emerald-400 font-bold uppercase tracking-widest">
                En direct
              </div>
            </div>

            {/* KPI Cards Row */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-center">
                <p className="text-[9px] text-white/30 uppercase tracking-widest mb-1 font-bold">Prospects</p>
                <p className="text-xl font-bold text-white">{prospects.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-center">
                <p className="text-[9px] text-white/30 uppercase tracking-widest mb-1 font-bold">Contactés</p>
                <p className="text-xl font-bold text-amber-400">
                  {prospects.filter(p => ['contacted', 'replied', 'converted'].includes(p.status)).length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-center">
                <p className="text-[9px] text-white/30 uppercase tracking-widest mb-1 font-bold">Réponses</p>
                <p className="text-xl font-bold text-emerald-400">
                  {prospects.filter(p => ['replied', 'converted'].includes(p.status)).length}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-medium text-white/60">Identification</span>
                  <span className="text-xs font-bold text-white">{prospects.length}</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: prospects.length > 0 ? "100%" : "0%" }} className="h-full bg-blue-500/50 rounded-full" />
                </div>
              </div>

              <div className="space-y-2">
                {(() => {
                  const contacted = prospects.filter(p => ['contacted', 'replied', 'converted'].includes(p.status)).length;
                  const percent = prospects.length > 0 ? (contacted / prospects.length) * 100 : 0;
                  return (
                    <>
                      <div className="flex justify-between items-end">
                        <span className="text-xs font-medium text-white/60">Messages envoyés</span>
                        <span className="text-xs font-bold text-amber-400">{Math.round(percent)}%</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${percent}%` }} className="h-full bg-amber-500/50 rounded-full" />
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="space-y-2">
                {(() => {
                  const replied = prospects.filter(p => ['replied', 'converted'].includes(p.status)).length;
                  const percent = prospects.length > 0 ? (replied / prospects.length) * 100 : 0;
                  return (
                    <>
                      <div className="flex justify-between items-end">
                        <span className="text-xs font-medium text-white/60">Taux de réponse</span>
                        <span className="text-xs font-bold text-emerald-400">{Math.round(percent)}%</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${percent}%` }} className="h-full bg-emerald-500/50 rounded-full" />
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          <div onClick={() => setIsFlowModalOpen(true)} className="p-5 rounded-2xl border border-white/10 bg-[#0c0c0c] hover:bg-[#111] transition-all flex flex-col relative overflow-hidden group cursor-pointer">
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Zap className="size-5" />
                  </div>
                  <h3 className="font-bold text-lg">Structure du Flow</h3>
                </div>
                <Maximize2 className="size-5 text-white/40 group-hover:text-white transition-colors" />
              </div>
              <p className="text-sm text-white/40 mb-4">{sequenceSteps?.length || FLOW_STEPS.length} étapes configurées.</p>
              <div className="flex-1 bg-black/40 border border-white/5 rounded-xl flex flex-col items-center p-3 gap-2 relative group-hover:border-white/10 transition-colors overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '12px 12px' }} />
                <div className="flex flex-col items-center gap-1 scale-[0.8] origin-top relative z-10">
                  {(sequenceSteps && sequenceSteps.length > 0 ? sequenceSteps : FLOW_STEPS).slice(0, 3).map((step, i) => (
                    <div key={`glimpse-${i}`} className="flex flex-col items-center">
                      <div className={`px-3 py-1 rounded-md border border-white/10 text-[9px] font-medium flex items-center gap-2 min-w-[120px] ${step.type === 'action' || step.action_type === 'action' || step.type === 'trigger' || step.action_type === 'trigger' ? 'bg-[#1a1a1a] text-white' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                        {(step.icon || step.action_type === 'trigger' ? Search : step.action_type === 'wait' ? Clock : MessageSquare) && <Search className="size-3" />}
                        <span className="truncate">{step.title || step.name}</span>
                      </div>
                      {i < 2 && <div className="w-px h-2 bg-white/10" />}
                    </div>
                  ))}
                  <div className="w-px h-2 bg-white/10" />
                  <div className="size-1.5 rounded-full bg-white/20" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2">
            <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between mb-6 gap-4">
              <h2 className="text-xl font-semibold flex items-center gap-2 shrink-0">
                <User className="size-5 text-white/40" /> Contacts de la campagne
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="size-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input placeholder="Rechercher..." className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30 text-white w-64 transition-colors" />
                </div>
                <Button onClick={() => setIsCsvModalOpen(true)} variant="outline" className="border-white/10 bg-transparent hover:bg-white/5 text-white h-10 px-4 transition-colors">
                  <Upload className="size-4 mr-2" /> Importer CSV
                </Button>
                <Button className="bg-white text-black hover:bg-white/90 gap-2 h-10 px-6 font-bold text-sm shadow-xl shadow-white/5 whitespace-nowrap">
                  <Search className="size-4" /> Rechercher des prospects
                </Button>
                <div className="relative">
                  {/* Filter button removed from here */}
                </div>
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/10 rounded-2xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 border-b border-white/10 text-white/40 text-[10px] uppercase tracking-widest sticky top-0 z-30">
                  <tr>
                    <th className="px-6 py-4 font-bold">Contact</th>
                    <th className="px-6 py-4 font-bold">Rôle</th>
                    <th className="px-6 py-4 font-bold">Score ICP</th>
                    <th className="px-6 py-4 font-bold">Statut</th>
                    <th className="px-6 py-4 font-bold text-right relative">
                      <button 
                        onClick={() => setIsFilterOpen(!isFilterOpen)} 
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-md transition-all ${isFilterOpen ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white/60"}`}
                      >
                        <Filter className="size-3" />
                        <span>Filtrer</span>
                        <ChevronDown className={`size-3 transition-transform ${isFilterOpen ? "rotate-180" : ""}`} />
                      </button>

                      <AnimatePresence>
                        {isFilterOpen && (
                          <motion.div 
                            initial={{ opacity: 0, y: 8, scale: 0.95 }} 
                            animate={{ opacity: 1, y: 0, scale: 1 }} 
                            exit={{ opacity: 0, y: 8, scale: 0.95 }} 
                            className="absolute right-0 top-full mt-2 w-64 bg-[#0A0A0A]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-5 z-50 text-left normal-case tracking-normal"
                          >
                            <div className="space-y-5">
                              <div>
                                <label className="text-[10px] text-white/30 uppercase tracking-widest mb-2.5 block font-bold">Statut des prospects</label>
                                <select 
                                  value={filterStatus} 
                                  onChange={(e) => setFilterStatus(e.target.value)} 
                                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                                >
                                  <option value="all" className="bg-[#0A0A0A]">Tous les statuts</option>
                                  <option value="discovered" className="bg-[#0A0A0A]">Découvert</option>
                                  <option value="qualified" className="bg-[#0A0A0A]">Qualifié</option>
                                  <option value="contacted" className="bg-[#0A0A0A]">Contacté</option>
                                  <option value="replied" className="bg-[#0A0A0A]">Répondu</option>
                                </select>
                              </div>
                              <div>
                                <div className="flex items-center justify-between mb-2.5">
                                  <label className="text-[10px] text-white/30 uppercase tracking-widest block font-bold">Score ICP Minimum</label>
                                  <span className="text-xs text-emerald-400 font-bold">{filterScore}%</span>
                                </div>
                                <input 
                                  type="range" 
                                  min="0" 
                                  max="100" 
                                  value={filterScore} 
                                  onChange={(e) => setFilterScore(Number(e.target.value))} 
                                  className="w-full accent-emerald-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer" 
                                />
                              </div>
                              <div className="pt-4 border-t border-white/5 flex justify-end gap-2">
                                <Button size="sm" variant="ghost" onClick={() => { setFilterStatus('all'); setFilterScore(0); }} className="text-[10px] text-white/40 hover:text-white uppercase tracking-widest font-bold">Réinitialiser</Button>
                                <Button size="sm" onClick={() => setIsFilterOpen(false)} className="bg-white text-black hover:bg-white/90 text-[10px] uppercase tracking-widest font-bold px-4">Appliquer</Button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {prospects.filter(p => (filterStatus === "all" || p.status === filterStatus) && (p.fit_score || 0) >= filterScore).length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-white/40">Aucun contact trouvé.</td></tr>
                  ) : (
                    prospects.filter(p => (filterStatus === "all" || p.status === filterStatus) && (p.fit_score || 0) >= filterScore).map(p => (
                      <tr key={p.id} className="hover:bg-white/[0.02] transition-colors group cursor-pointer">
                        <td className="px-6 py-4">
                          <p className="font-medium text-white">{p.decision_maker || "Inconnu"}</p>
                          <p className="text-xs text-white/40 mt-0.5">{p.company_name}</p>
                        </td>
                        <td className="px-6 py-4 text-white/70">{p.role || "Non défini"}</td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{p.fit_score || 0}/100</span>
                        </td>
                        <td className="px-6 py-4 text-white/60 capitalize">{p.status}</td>
                        <td className="px-6 py-4 text-right">
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity text-white/40 hover:text-white">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="xl:col-span-1">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Activity className="size-5 text-white/40" /> Activité Récente
              </h2>
              <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Logs</span>
            </div>
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 min-h-[400px] max-h-[600px] overflow-y-auto">
              {activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <div className="size-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <Clock className="size-6 text-white/20" />
                  </div>
                  <p className="text-sm text-white/40">Aucune activité enregistrée.</p>
                  <p className="text-xs text-white/20 mt-1">Les actions apparaîtront ici.</p>
                </div>
              ) : (
                <div className="space-y-8 relative before:absolute before:inset-0 before:ml-[19px] before:-translate-x-px before:h-full before:w-0.5 before:bg-white/5">
                  {activities.map((act) => (
                    <div key={act.id} className="relative flex items-start gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-[#0c0c0c] shrink-0 relative z-10 text-white/40 shadow-xl">
                        {act.type?.includes('hunt') ? <Search className="size-4" /> : 
                         act.type?.includes('message') || act.type?.includes('outreach') ? <MessageSquare className="size-4" /> : 
                         act.type?.includes('qa') ? <CheckCircle2 className="size-4" /> :
                         <Zap className="size-4" />}
                      </div>
                      <div className="flex-1 pt-1.5">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-medium text-white/90 leading-snug">
                            {act.action}
                          </p>
                          <span className="text-[10px] text-white/20 font-mono whitespace-nowrap">
                            {new Date(act.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        <p className="text-xs text-white/40 leading-relaxed">
                          L'opération s'est déroulée avec succès.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isFlowModalOpen && (
          <SequenceBuilderModal 
            onClose={() => setIsFlowModalOpen(false)} 
            initialSteps={sequenceSteps || []} 
            onSave={async (steps) => {
              const { saveSequenceSteps } = await import("@/lib/flows/actions");
              await saveSequenceSteps(campaign.id, steps);
              router.refresh();
            }}
          />
        )}
        {isSettingsOpen && (
          <SettingsModal 
            onClose={() => setIsSettingsOpen(false)} 
            campaignName={campaignName} 
            campaign={campaign}
          />
        )}
        {isCsvModalOpen && <CsvImportModal onClose={() => setIsCsvModalOpen(false)} campaignId={campaign.id} />}
      </AnimatePresence>
    </div>
  );
}
