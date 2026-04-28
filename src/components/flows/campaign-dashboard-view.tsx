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
  Upload,
  Trash2,
  Trash,
  Globe,
  Building2,
  Users,
  Info,
  MapPin,
  ExternalLink,
  Link,
  Flame,
  MailSearch,
  ChevronRight,
  CircleSlash,
  HelpCircle,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SequenceBuilderModal } from "./sequence-builder";

// --- Types ---
type CampaignStatus = "active" | "paused" | "archived" | "draft";

interface Campaign {
  id: string;
  display_name: string;
  status: CampaignStatus;
  created_at: string;
  config?: any;
  sequence_id?: string | null;
}

interface Prospect {
  id: string;
  company_name: string;
  decision_maker: string;
  role: string;
  fit_score: number;
  status: string;
  priority: string;
  photo_url?: string | null;
  website?: string | null;
  location?: string | null;
  linkedin_url?: string | null;
  email?: string | null;
  extra_data?: any;
  company?: {
    industry?: string | null;
    size_range?: string | null;
    description?: string | null;
    linkedin_url?: string | null;
    location?: string | null;
  } | null;
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
  archived: "Archivé",
  draft: "Brouillon",
};

const StatusDot = ({ status }: { status: string }) => {
  if (status === "active") return <span className="flex size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>;
  if (status === "paused") return <span className="flex size-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></span>;
  return <span className="flex size-2 rounded-full bg-zinc-500"></span>;
};

const ProspectAvatar = ({ name, photoUrl, colorIndex }: { name: string; photoUrl?: string | null; colorIndex: number }) => {
  if (photoUrl) {
    return (
      <div className="size-10 rounded-full border border-white/10 overflow-hidden shrink-0">
        <img src={photoUrl} alt={name} className="size-full object-cover" onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }} />
      </div>
    );
  }

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  
  const colors = [
    "bg-blue-500/20 text-blue-400 border-blue-500/30",
    "bg-purple-500/20 text-purple-400 border-purple-500/30",
    "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    "bg-amber-500/20 text-amber-400 border-amber-500/30",
    "bg-rose-500/20 text-rose-400 border-rose-500/30",
  ];
  
  const colorClass = colors[colorIndex % colors.length];

  return (
    <div className={`size-10 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 ${colorClass}`}>
      {initials || <User className="size-4" />}
    </div>
  );
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
    const result = await setCampaignStatus(campaign.id, "archived");
    
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
  const [isProspectsModalOpen, setIsProspectsModalOpen] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
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

  const handleDelete = async (ids: string[]) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${ids.length} contact(s) ?`)) return;
    setIsDeleting(true);
    const { deleteProspects } = await import("@/lib/flows/actions");
    const res = await deleteProspects(ids);
    if (res.success) {
      setSelectedIds([]);
      router.refresh();
    } else {
      alert(res.error);
    }
    setIsDeleting(false);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === prospects.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(prospects.map(p => p.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
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
              <div className="flex items-center justify-between w-full 2xl:w-auto">
                <h2 className="text-xl font-semibold flex items-center gap-2 shrink-0">
                  <User className="size-5 text-white/40" /> Contacts de la campagne
                </h2>
                <button 
                  onClick={() => setIsProspectsModalOpen(true)}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors group/zoom 2xl:ml-2"
                  title="Agrandir la liste"
                >
                  <Maximize2 className="size-4 text-white/20 group-hover/zoom:text-white transition-colors" />
                </button>
              </div>
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

            <div className="bg-[#050505] border border-[#1F1F1F] rounded-2xl overflow-hidden shadow-2xl">
              <table className="w-full text-left text-sm relative">
                <thead className={`bg-[#080808] border-b border-[#1F1F1F] text-white/20 text-[10px] uppercase tracking-[0.2em] font-bold sticky top-0 ${isProspectsModalOpen ? 'z-10' : 'z-30'}`}>
                  <tr>
                    <th className="pl-6 py-4 w-10">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.length > 0 && selectedIds.length === prospects.length}
                        onChange={toggleSelectAll}
                        className="size-4 rounded border-white/10 bg-white/5 checked:bg-blue-500 transition-colors cursor-pointer"
                      />
                    </th>
                    <th className="px-6 py-4 font-bold">Prospect</th>
                    <th className="px-6 py-4 font-bold text-center">Score ICP</th>
                    <th className="px-6 py-4 font-bold text-center">Statut</th>
                        <th className="px-6 py-4 font-bold text-right relative">
                          <button 
                            onClick={() => setIsFilterOpen(!isFilterOpen)} 
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all border ${isFilterOpen ? "bg-white/10 border-white/20 text-white" : "border-transparent text-white/40 hover:bg-white/[0.03] hover:text-white/60"}`}
                          >
                            <Filter className="size-3" />
                            <span className="text-[10px] uppercase tracking-widest">Filtrer</span>
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
                    prospects.filter(p => (filterStatus === "all" || p.status === filterStatus) && (p.fit_score || 0) >= filterScore).map((p, i) => {
                      const isSelected = selectedIds.includes(p.id);
                      return (
                        <tr key={p.id} className={`hover:bg-white/[0.02] transition-colors group cursor-pointer border-b border-white/5 last:border-0 ${isSelected ? "bg-blue-500/5" : ""}`}>
                          <td className="pl-6 py-4" onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => toggleSelectOne(p.id)}
                              className="size-4 rounded border-white/10 bg-white/5 checked:bg-blue-500 transition-colors cursor-pointer"
                            />
                          </td>
                          <td className="px-6 py-4" onClick={() => toggleSelectOne(p.id)}>
                            <div className="flex items-center gap-4">
                            <ProspectAvatar name={p.decision_maker || p.company_name} photoUrl={p.photo_url} colorIndex={i} />
                            <div>
                              <p className="font-bold text-[15px] text-white group-hover:text-blue-400 transition-colors">
                                {p.decision_maker ? (p.decision_maker.split(/[,|•-]/)[0].trim()) : "Inconnu"}
                              </p>
                              <p className="text-xs text-white/40 mt-0.5">
                                <span className="text-white/60 font-medium">
                                  {p.role || (p.decision_maker?.includes(' at ') ? p.decision_maker.split(' at ')[1] : "Décideur")}
                                </span>
                                {p.company_name && (
                                  <>
                                    <span className="mx-1.5 opacity-30">@</span>
                                    <span className="text-white/80">{p.company_name}</span>
                                  </>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${
                            (p.fit_score || 0) > 80 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                            (p.fit_score || 0) > 50 ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                            "bg-white/5 text-white/40 border-white/10"
                          }`}>
                            {p.fit_score || 0}/100
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                            <div className={`size-1.5 rounded-full ${
                              p.status === 'replied' ? 'bg-emerald-500' :
                              p.status === 'contacted' ? 'bg-blue-500' :
                              'bg-white/20'
                            }`} />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                              {{
                                discovered: "Découvert",
                                qualified: "Qualifié",
                                disqualified: "Non qualifié",
                                contacted: "Contacté",
                                replied: "Répondu",
                                meeting_booked: "Rendez-vous"
                              }[p.status] || p.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={(e) => { e.stopPropagation(); handleDelete([p.id]); }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-white/20 hover:text-red-400 size-8 p-0"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="border-white/10 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => { e.stopPropagation(); setSelectedProspect(p); setIsProspectsModalOpen(true); }}
                            >
                              Détails
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
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
        {isProspectsModalOpen && (
          <div className="fixed inset-0 z-[25] flex flex-col bg-[#050505]">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative w-full h-full bg-[#050505] flex flex-col overflow-hidden"
              style={{ paddingLeft: 'var(--sidebar-width, 0px)' }}
            >
              {/* TOP HEADER */}
              <div className="px-8 py-4 border-b border-[#1F1F1F] flex items-center justify-between shrink-0 bg-[#080808]/50 backdrop-blur-xl">
                <div className="flex items-center gap-8">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <User className="size-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white tracking-tight">Contacts</h2>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">{prospects.length} prospects</p>
                    </div>
                  </div>
                  
                  {/* SUB TABS */}
                  <div className="flex items-center bg-black/40 p-1 rounded-xl border border-[#1F1F1F]">
                    <button className="px-5 py-1.5 rounded-lg bg-white/[0.06] text-white text-[11px] font-bold uppercase tracking-wider transition-all">Tous</button>
                    <button className="px-5 py-1.5 rounded-lg text-white/40 text-[11px] font-bold uppercase tracking-wider hover:text-white transition-all">Segments</button>
                    <button className="px-5 py-1.5 rounded-lg text-white/40 text-[11px] font-bold uppercase tracking-wider hover:text-white transition-all">Listes</button>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/20 group-focus-within:text-blue-400 transition-colors" />
                    <input 
                      type="text" 
                      placeholder="Rechercher un prospect..." 
                      className="bg-black/40 border border-[#1F1F1F] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 w-[280px] transition-all"
                    />
                  </div>
                  <Button variant="outline" className="border-[#1F1F1F] bg-black/40 text-white/60 hover:text-white gap-2 h-10 rounded-xl px-4 text-xs font-bold uppercase tracking-wider">
                    <Filter className="size-3.5" /> Filtres
                  </Button>
                  <div className="w-[1px] h-6 bg-[#1F1F1F] mx-1" />
                  <Button className="bg-blue-600 hover:bg-blue-500 text-white gap-2 h-10 rounded-xl px-4 text-xs font-bold uppercase tracking-wider shadow-lg shadow-blue-600/10 border-t border-blue-400/20">
                    <Zap className="size-3.5" /> Ajouter des leads
                  </Button>
                  <button 
                    onClick={() => { setIsProspectsModalOpen(false); setSelectedProspect(null); }}
                    className="p-2 hover:bg-white/5 rounded-xl transition-all text-white/20 hover:text-white ml-2"
                  >
                    <X className="size-6" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden flex">
                <div className={`flex-1 overflow-auto p-8 ${selectedProspect ? 'hidden lg:block lg:border-r lg:border-[#1F1F1F]' : ''}`}>
                  <div className="border border-[#1F1F1F] rounded-2xl overflow-hidden bg-[#050505] shadow-2xl">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#080808]/80 border-b border-[#1F1F1F] text-white/20 text-[10px] uppercase tracking-[0.2em] font-bold sticky top-0 z-30 backdrop-blur-md">
                      <tr>
                        <th className="pl-6 py-5 w-12 text-center">
                          <input 
                            type="checkbox" 
                            checked={selectedIds.length > 0 && selectedIds.length === prospects.length}
                            onChange={toggleSelectAll}
                            className="size-4 rounded border-[#1F1F1F] bg-black/40 text-blue-500 focus:ring-blue-500/20 cursor-pointer"
                          />
                        </th>
                        <th className="px-6 py-5 font-bold">Contact</th>
                        <th className="px-6 py-5 font-bold">Signal</th>
                        <th className="px-6 py-5 font-bold">Pertinence</th>
                        <th className="px-6 py-5 font-bold">Email</th>
                        <th className="px-6 py-5 font-bold text-right">Détails</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1F1F1F]/50">
                      {prospects.map((p, i) => {
                        const isSelected = selectedIds.includes(p.id);
                        return (
                          <tr 
                            key={`modal-${p.id}`} 
                            onClick={() => setSelectedProspect(p)}
                            className={`group cursor-pointer transition-all hover:bg-white/[0.015] ${selectedProspect?.id === p.id ? 'bg-blue-500/[0.03]' : ''} ${isSelected ? "bg-blue-500/[0.02]" : ""}`}
                          >
                            <td className="pl-6 py-5 w-12 text-center" onClick={(e) => e.stopPropagation()}>
                              <input 
                                type="checkbox" 
                                checked={isSelected}
                                onChange={() => toggleSelectOne(p.id)}
                                className="size-4 rounded border-[#1F1F1F] bg-black/40 text-blue-500 focus:ring-blue-500/20 cursor-pointer"
                              />
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-4">
                                <div className="group-hover:scale-105 transition-transform duration-300">
                                  <ProspectAvatar name={p.decision_maker || p.company_name} photoUrl={p.photo_url} colorIndex={i} />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <p className="font-bold text-[15px] text-white/90 truncate group-hover:text-white transition-colors">
                                      {p.decision_maker ? (p.decision_maker.split(/[,|•-]/)[0].trim()) : "Inconnu"}
                                    </p>
                                    <div className="text-blue-400/30 group-hover:text-blue-400 transition-colors">
                                      <Link className="size-3" />
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[11px] text-white/30 uppercase tracking-wider font-bold">
                                    <span className="truncate max-w-[120px]">{p.role || "Décideur"}</span>
                                    <span className="text-white/10">•</span>
                                    <span className="truncate text-white/50">{p.company_name}</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex flex-col gap-1 max-w-[260px]">
                                <p className="text-[13px] text-white/70 line-clamp-1 font-medium group-hover:text-white transition-colors">
                                  {p.status === 'replied' ? 'Intérêt confirmé via Email' : 
                                   p.status === 'contacted' ? 'Séquence active : Step 2' :
                                   `Vient d'engager avec un post LinkedIn`}
                                </p>
                                <p className="text-[11px] text-white/20 truncate uppercase tracking-widest font-bold">
                                  {p.company?.industry || 'Technologie'} • Il y a 2h
                                </p>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <Flame className={`size-3.5 ${p.fit_score >= 80 ? 'text-orange-500 animate-pulse' : p.fit_score >= 50 ? 'text-blue-400' : 'text-white/20'}`} />
                                  <span className={`text-[12px] font-bold uppercase tracking-wider ${p.fit_score >= 80 ? 'text-white' : 'text-white/40'}`}>
                                    Potentiel : {p.fit_score >= 80 ? 'Fort' : p.fit_score >= 50 ? 'Moyen' : 'Faible'}
                                  </span>
                                </div>
                                <div className="w-20 h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-1000 ${p.fit_score >= 80 ? 'bg-gradient-to-r from-orange-600 to-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.4)]' : p.fit_score >= 50 ? 'bg-blue-500' : 'bg-white/20'}`} 
                                    style={{ width: `${p.fit_score || 0}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-white/[0.03] border border-[#1F1F1F] text-white/30 group-hover:text-blue-400 group-hover:border-blue-500/30 transition-all">
                                  <MailSearch className="size-4" />
                                </div>
                                <span className="text-[12px] text-white/50 font-medium lowercase truncate max-w-[150px]">
                                  {p.email || (p.decision_maker ? `${p.decision_maker.toLowerCase().replace(/\s+/g, '.')}@${p.company_name?.toLowerCase().replace(/\s+/g, '') || 'company'}.com` : 'enrichir...')}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-5 text-right">
                              <div className="flex items-center justify-end gap-4" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center bg-black/60 rounded-xl border border-[#1F1F1F] p-1 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                  <button className="p-2 hover:bg-emerald-500/10 text-white/20 hover:text-emerald-500 rounded-lg transition-all" title="Approuver">
                                    <CheckCircle2 className="size-4" />
                                  </button>
                                  <button className="p-2 hover:bg-white/10 text-white/20 hover:text-white rounded-lg transition-all" title="En attente">
                                    <HelpCircle className="size-4" />
                                  </button>
                                  <button className="p-2 hover:bg-red-500/10 text-white/20 hover:text-red-500 rounded-lg transition-all" title="Rejeter">
                                    <CircleSlash className="size-4" />
                                  </button>
                                </div>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setSelectedProspect(p); }}
                                  className="p-2.5 hover:bg-white/5 rounded-xl text-white/20 hover:text-white transition-all group/btn"
                                >
                                  <Plus className="size-5 group-hover/btn:rotate-90 transition-transform duration-300" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                </div>

                {selectedProspect && (
                  <div className="w-full lg:w-[450px] xl:w-[500px] bg-[#080808] border-l border-[#1F1F1F] overflow-y-auto flex flex-col shrink-0">
                    <div className="p-6 border-b border-[#1F1F1F] flex items-center justify-between sticky top-0 bg-[#080808]/90 backdrop-blur z-10">
                      <h3 className="text-xl font-bold">Détails Prospect</h3>
                      <button onClick={() => setSelectedProspect(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                        <X className="size-5 text-white/40" />
                      </button>
                    </div>
                    <div className="p-8 space-y-8">
                      <div className="flex flex-col items-center text-center gap-4">
                        <div className="size-24 rounded-2xl bg-white/[0.03] flex items-center justify-center overflow-hidden border border-[#1F1F1F] shrink-0 shadow-2xl">
                          {selectedProspect.photo_url ? (
                            <img src={selectedProspect.photo_url} alt={selectedProspect.decision_maker} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-3xl font-bold text-white/20">{selectedProspect.decision_maker?.charAt(0) || "U"}</span>
                          )}
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold text-white tracking-tight">{selectedProspect.decision_maker || "Inconnu"}</h2>
                          <p className="text-white/60 font-medium text-lg mt-1">{selectedProspect.role || "Décideur"}</p>
                          <p className="text-white/30 mt-1">{selectedProspect.company_name}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-5 rounded-xl bg-white/[0.03] border border-[#1F1F1F] flex flex-col items-center justify-center text-center">
                          <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold mb-1.5">Score ICP</p>
                          <p className="text-2xl font-bold text-emerald-400">{selectedProspect.fit_score || 0}%</p>
                        </div>
                        <div className="p-5 rounded-xl bg-white/[0.03] border border-[#1F1F1F] flex flex-col items-center justify-center text-center">
                          <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold mb-1.5">Statut</p>
                          <p className="text-xs font-bold text-white uppercase tracking-wider mt-1 px-2 py-1 rounded bg-white/5">
                            {{
                              discovered: "Découvert",
                              qualified: "Qualifié",
                              disqualified: "Non qualifié",
                              contacted: "Contacté",
                              replied: "Répondu",
                              meeting_booked: "Rdv"
                            }[selectedProspect.status] || selectedProspect.status}
                          </p>
                        </div>
                      </div>

                      {/* Campaign Sequence Section */}
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                          <Zap className="size-3" /> Campaign Sequence
                        </h4>
                        <div className="p-5 rounded-xl bg-blue-500/5 border border-blue-500/10 space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-white/40 uppercase tracking-wider font-medium">Status</span>
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase border border-emerald-500/20">Actif</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-white/40 uppercase tracking-wider font-medium">Étape</span>
                            <span className="text-sm font-bold text-white">Étape 1 : Identification</span>
                          </div>
                        </div>
                      </div>

                      {/* Basic Information Section */}
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                          <Info className="size-3" /> Basic Information
                        </h4>
                        <div className="p-6 rounded-xl bg-white/[0.03] border border-[#1F1F1F] space-y-6">
                          <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                            <div className="space-y-1.5">
                              <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Industry</p>
                              <div className="flex items-center gap-2 text-[13px] text-white/70">
                                <Building2 className="size-3.5 text-white/20 shrink-0" />
                                <span className="truncate">{selectedProspect.company?.industry || "N/A"}</span>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Size</p>
                              <div className="flex items-center gap-2 text-[13px] text-white/70">
                                <Users className="size-3.5 text-white/20 shrink-0" />
                                <span className="truncate">{selectedProspect.company?.size_range || "N/A"}</span>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Location</p>
                              <div className="flex items-center gap-2 text-[13px] text-white/70">
                                <MapPin className="size-3.5 text-white/20 shrink-0" />
                                <span className="truncate">{selectedProspect.location || selectedProspect.company?.location || "N/A"}</span>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Website</p>
                              <div className="flex items-center gap-2 text-[13px] text-white/70 overflow-hidden">
                                <Globe className="size-3.5 text-white/20 shrink-0" />
                                {selectedProspect.website ? (
                                  <a href={selectedProspect.website.startsWith('http') ? selectedProspect.website : `https://${selectedProspect.website}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors truncate">{selectedProspect.website.replace(/^https?:\/\//, '')}</a>
                                ) : "N/A"}
                              </div>
                            </div>
                          </div>
                          
                          <div className="pt-5 border-t border-white/5 space-y-2 overflow-hidden">
                            <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Company LinkedIn</p>
                            <div className="flex items-center gap-2 text-[13px] text-white/70">
                              <Link className="size-3.5 text-white/20 shrink-0" />
                              {selectedProspect.company?.linkedin_url || selectedProspect.linkedin_url ? (
                                <a href={selectedProspect.company?.linkedin_url || selectedProspect.linkedin_url || '#'} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors truncate flex items-center gap-1.5">
                                  Lien profil <ExternalLink className="size-3" />
                                </a>
                              ) : "N/A"}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Company Description Section */}
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] px-1">Description</h4>
                        <div className="p-6 rounded-xl bg-white/[0.03] border border-[#1F1F1F]">
                          <p className="text-[13px] text-white/50 leading-relaxed italic">
                            {selectedProspect.company?.description ? `"${selectedProspect.company.description}"` : "Aucune description disponible."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

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

      {/* FLOATING ACTION BAR */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] bg-[#0A0A0A] border border-white/10 rounded-2xl p-4 shadow-[0_30px_100px_rgba(0,0,0,0.8)] flex items-center gap-6 min-w-[400px]"
          >
            <div className="flex items-center gap-3 pr-6 border-r border-white/10">
              <div className="size-8 rounded-lg bg-blue-500 flex items-center justify-center font-bold text-sm">
                {selectedIds.length}
              </div>
              <span className="text-sm font-medium text-white/60">contacts sélectionnés</span>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={() => handleDelete(selectedIds)} 
                disabled={isDeleting}
                variant="destructive" 
                className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 gap-2 h-10 px-4"
              >
                {isDeleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Supprimer la sélection
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setSelectedIds([])}
                className="text-white/40 hover:text-white h-10 px-4"
              >
                Annuler
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
