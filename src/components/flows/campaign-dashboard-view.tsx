"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Mail,
  ChevronRight,
  CircleSlash,
  HelpCircle,
  Plus,
  FolderOpen,
  ArrowRight,
  Download,
  UserPlus,
  Send
} from "lucide-react";
import { 
  getOrganizationProspects,
  getContactLists,
  getProspectsByList,
} from "@/lib/flows/actions";
import { Button } from "@/components/ui/button";
import { SequenceBuilderModal } from "./sequence-builder";
import { cn } from "@/lib/utils";

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
  created_at?: string;
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

// --- Icons ---
const LinkedinIcon = (props: any) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

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
  prospects: initialProspects, 
  activities,
  sequenceSteps
}: { 
  campaign: Campaign; 
  prospects: Prospect[]; 
  activities: ActivityLog[]; 
  sequenceSteps?: any[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentView = searchParams.get('view');

  const isFlowModalOpen = currentView === 'flow';
  const isProspectsModalOpen = currentView === 'contacts';
  const isSettingsOpen = currentView === 'settings';

  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [activeProspectTab, setActiveProspectTab] = useState<"campaign" | "lists" | "all">("campaign");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStep, setFilterStep] = useState<string>("all");
  const [filterPertinence, setFilterPertinence] = useState<string>("all");
  const [filterEmail, setFilterEmail] = useState<string>("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [contactLists, setContactLists] = useState<any[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [displayProspects, setDisplayProspects] = useState<any[]>(initialProspects);
  const [isLoadingProspects, setIsLoadingProspects] = useState(false);

  // Re-sync displayProspects when initialProspects changes
  useEffect(() => {
    const filtered = initialProspects.filter(p => {
      const matchesSearch = !searchQuery || 
        p.decision_maker?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.email?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStep = filterStep === "all" || getStepLabel(p.status) === filterStep;
      
      const pPertinence = (p.fit_score || 0) >= 80 ? '3/3' : (p.fit_score || 0) >= 50 ? '2/3' : '1/3';
      const matchesPertinence = filterPertinence === "all" || pPertinence === filterPertinence;
      
      const matchesEmail = filterEmail === "all" || (filterEmail === "has" ? !!p.email : !p.email);

      return matchesSearch && matchesStep && matchesPertinence && matchesEmail;
    });

    const sorted = [...filtered].sort((a, b) => {
      let valA: any = a[sortBy as keyof Prospect];
      let valB: any = b[sortBy as keyof Prospect];

      if (sortBy === 'step') {
        const stepOrder: Record<string, number> = { 'Step 1': 1, 'Step 2': 2, 'Step 3': 3, 'End': 4 };
        valA = stepOrder[getStepLabel(a.status)] || 0;
        valB = stepOrder[getStepLabel(b.status)] || 0;
      } else if (sortBy === 'fit_score') {
        valA = a.fit_score || 0;
        valB = b.fit_score || 0;
      } else if (sortBy === 'created_at') {
        valA = new Date(a.created_at || 0).getTime();
        valB = new Date(b.created_at || 0).getTime();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    setDisplayProspects(sorted);
  }, [initialProspects, activeProspectTab, searchQuery, filterStep, filterPertinence, filterEmail, sortBy, sortOrder]);

  // Fetch data based on active tab
  useEffect(() => {
    if (!isProspectsModalOpen) return;

    const fetchData = async () => {
      setIsLoadingProspects(true);
      try {
        if (activeProspectTab === "all") {
          const { data, error } = await getOrganizationProspects();
          if (!error && data) setDisplayProspects(data);
        } else if (activeProspectTab === "lists") {
          const { data, error } = await getContactLists();
          if (!error && data) {
            setContactLists(data);
            if (data.length > 0 && !selectedListId) {
              setSelectedListId(data[0].id);
            }
          }
          if (selectedListId) {
            const { data: listProspects, error: listError } = await getProspectsByList(selectedListId);
            if (!listError && listProspects) setDisplayProspects(listProspects);
          } else {
            setDisplayProspects([]);
          }
        } else {
          setDisplayProspects(initialProspects);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setIsLoadingProspects(false);
      }
    };

    fetchData();
  }, [activeProspectTab, isProspectsModalOpen, selectedListId, initialProspects]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [campaignName, setCampaignName] = useState(campaign.display_name || "Campagne Sans Nom");
  const [isEditingName, setIsEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  const [filterScore, setFilterScore] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isEditingName]);

  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [isAddLeadsOpen, setIsAddLeadsOpen] = useState(false);
  const [isLinkedInModalOpen, setIsLinkedInModalOpen] = useState(false);

  // URL View Synchronization
  const updateUrlView = (view: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (view) {
      params.set('view', view);
    } else {
      params.delete('view');
    }
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const toggleFlowModal = (open: boolean) => {
    updateUrlView(open ? 'flow' : null);
  };

  const toggleProspectsModal = (open: boolean) => {
    updateUrlView(open ? 'contacts' : null);
  };

  const toggleSettingsModal = (open: boolean) => {
    updateUrlView(open ? 'settings' : null);
  };

  const getStepLabel = (status: string) => {
    switch (status) {
      case 'discovered':
      case 'qualified': return 'Step 1';
      case 'contacted': return 'Step 2';
      case 'replied': return 'Step 3';
      case 'converted': return 'End';
      default: return 'Step 1';
    }
  };

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
    const currentList = isProspectsModalOpen ? displayProspects : initialProspects;
    if (selectedIds.length === currentList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentList.map((p: Prospect) => p.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const isPaused = campaign.status === "paused";

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)] w-full bg-black text-white font-sans overflow-y-auto">
      
      {/* HEADER */}
      {!isProspectsModalOpen && (
        <header className="shrink-0 border-b border-white/10 px-8 py-5 flex items-center justify-between bg-[#050505] sticky top-0 z-20">
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
            <Button onClick={() => toggleSettingsModal(true)} className="bg-white/10 hover:bg-white/20 text-white gap-2 border border-white/10 font-medium">
              <Settings className="size-4" /> Paramètres
            </Button>
          </div>
        </header>
      )}

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
                <p className="text-xl font-bold text-white">{initialProspects.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-center">
                <p className="text-[9px] text-white/30 uppercase tracking-widest mb-1 font-bold">Contactés</p>
                <p className="text-xl font-bold text-amber-400">
                  {initialProspects.filter((p: Prospect) => ['contacted', 'replied', 'converted'].includes(p.status)).length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-center">
                <p className="text-[9px] text-white/30 uppercase tracking-widest mb-1 font-bold">Réponses</p>
                <p className="text-xl font-bold text-emerald-400">
                  {initialProspects.filter((p: Prospect) => ['replied', 'converted'].includes(p.status)).length}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-medium text-white/60">Identification</span>
                  <span className="text-xs font-bold text-white">{initialProspects.length}</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: initialProspects.length > 0 ? "100%" : "0%" }} className="h-full bg-blue-500/50 rounded-full" />
                </div>
              </div>

              <div className="space-y-2">
                {(() => {
                  const contacted = initialProspects.filter((p: Prospect) => ['contacted', 'replied', 'converted'].includes(p.status)).length;
                  const percent = initialProspects.length > 0 ? (contacted / initialProspects.length) * 100 : 0;
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
                  const replied = initialProspects.filter((p: Prospect) => ['replied', 'converted'].includes(p.status)).length;
                  const percent = initialProspects.length > 0 ? (replied / initialProspects.length) * 100 : 0;
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

          <div onClick={() => toggleFlowModal(true)} className="p-5 rounded-2xl border border-white/10 bg-[#0c0c0c] hover:bg-[#111] transition-all flex flex-col relative overflow-hidden group cursor-pointer">
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
                  onClick={() => toggleProspectsModal(true)}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors group/zoom 2xl:ml-2"
                  title="Agrandir la liste"
                >
                  <Maximize2 className="size-4 text-white/20 group-hover/zoom:text-white transition-colors" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
              </div>
            </div>

            <div className="bg-[#050505] border border-[#1F1F1F] rounded-2xl overflow-hidden shadow-2xl">
              <table className="w-full text-left text-sm relative">
                <thead className={`bg-[#080808] border-b border-[#1F1F1F] text-white/20 text-[10px] uppercase tracking-[0.2em] font-bold sticky top-0 ${isProspectsModalOpen ? 'z-10' : 'z-30'}`}>
                  <tr>
                    <th className="pl-6 py-4 font-bold">Prospect</th>
                    <th className="px-6 py-4 font-bold text-center w-32">Pertinence</th>
                    <th className="px-6 py-4 font-bold text-center w-32">Step</th>
                    <th className="px-6 py-4 font-bold text-right w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {displayProspects.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-white/40">Aucun contact trouvé.</td></tr>
                  ) : (
                    displayProspects.slice(0, 6).map((p: Prospect, i: number) => {
                      const isSelected = selectedIds.includes(p.id);
                      return (
                        <tr key={p.id} className={`hover:bg-white/[0.02] transition-colors group cursor-pointer border-b border-white/5 last:border-0 ${isSelected ? "bg-blue-500/5" : ""}`}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                            <ProspectAvatar name={p.decision_maker || p.company_name} photoUrl={p.photo_url} colorIndex={i} />
                            <div>
                              <p className="font-bold text-[15px] text-white group-hover:text-blue-400 transition-colors flex items-center gap-2">
                                {p.decision_maker ? (p.decision_maker.split(/[,|•-]/)[0].trim()) : "Inconnu"}
                                {p.linkedin_url && (
                                  <a 
                                    href={p.linkedin_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-white/20 hover:text-[#0077b5] transition-all hover:scale-110 active:scale-95"
                                  >
                                    <LinkedinIcon className="size-3.5" />
                                  </a>
                                )}
                              </p>
                              <p className="text-[11px] text-white/40 font-medium">
                                {p.role || "Décideur"} {p.company_name && `@ ${p.company_name}`}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center w-32">
                          <span className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-bold border inline-block w-12",
                            (p.fit_score || 0) >= 80 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                            (p.fit_score || 0) >= 50 ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                            "bg-red-500/10 text-red-400 border-red-500/20"
                          )}>
                            {(p.fit_score || 0) >= 80 ? '3/3' : (p.fit_score || 0) >= 50 ? '2/3' : '1/3'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center w-32">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border inline-block w-20",
                            p.status === 'converted' 
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          )}>
                            {getStepLabel(p.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedProspect(p); toggleProspectsModal(true); }}
                            className="p-2.5 hover:bg-white/5 rounded-xl text-white/20 hover:text-white transition-all group/btn"
                          >
                            <Plus className="size-5 group-hover/btn:rotate-90 transition-transform duration-300" />
                          </button>
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
                        {act.type?.includes('hunt') || act.type?.includes('hunter') ? <UserPlus className="size-4" /> : 
                         act.type?.includes('message') || act.type?.includes('outreach') ? <Send className="size-4" /> : 
                         act.type?.includes('response') ? <MessageSquare className="size-4" /> :
                         act.type?.includes('qa') || act.type?.includes('validation') ? <CheckCircle2 className="size-4" /> :
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
                          {act.type?.includes('hunt') ? 'Nouveaux profils ajoutés à votre liste de prospection.' :
                           act.type?.includes('message') || act.type?.includes('outreach') ? 'Le message a été transmis avec succès via LinkedIn.' :
                           act.type?.includes('qa') ? 'Les critères de qualité ont été vérifiés par l\'IA.' :
                           'Action de campagne effectuée avec succès.'}
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
              <div className="px-8 py-4 border-b border-[#1F1F1F] flex items-center justify-between shrink-0 bg-[#080808]/50 backdrop-blur-xl relative z-[100]">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <User className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-white tracking-tight">Contacts</h2>
                        <span className="text-white/20 font-light">—</span>
                        <h3 className="text-sm font-medium text-white/70">{campaignName}</h3>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 ml-1">
                          <StatusDot status={campaign.status} />
                          <span className="text-[9px] text-white/40 uppercase font-bold tracking-wider">{STATUS_LABEL[campaign.status]}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">{displayProspects.length} prospects</p>
                    </div>
                  </div>
                  
                  <div className="h-8 w-px bg-[#1F1F1F]" />

                  {/* SUB TABS */}
                  <div className="flex items-center bg-black/40 p-1 rounded-xl border border-[#1F1F1F]">
                    <button 
                      onClick={() => setActiveProspectTab("campaign")}
                      className={cn(
                        "px-5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all",
                        activeProspectTab === "campaign" ? "bg-white/[0.06] text-white" : "text-white/40 hover:text-white"
                      )}
                    >
                      Campagne
                    </button>
                    <button 
                      onClick={() => setActiveProspectTab("lists")}
                      className={cn(
                        "px-5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all",
                        activeProspectTab === "lists" ? "bg-white/[0.06] text-white" : "text-white/40 hover:text-white"
                      )}
                    >
                      Listes
                    </button>
                    <button 
                      onClick={() => setActiveProspectTab("all")}
                      className={cn(
                        "px-5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all",
                        activeProspectTab === "all" ? "bg-white/[0.06] text-white" : "text-white/40 hover:text-white"
                      )}
                    >
                      Tous
                    </button>
                  </div>

                  {activeProspectTab === "lists" && contactLists.length > 0 && (
                    <>
                      <div className="h-8 w-px bg-[#1F1F1F]" />
                      <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-[#1F1F1F]">
                        <FolderOpen className="size-3.5 text-white/30" />
                        <select 
                          value={selectedListId || ""} 
                          onChange={(e) => setSelectedListId(e.target.value)}
                          className="bg-transparent text-[11px] font-bold text-white/70 uppercase tracking-wider focus:outline-none cursor-pointer"
                        >
                          {contactLists.map(list => (
                            <option key={list.id} value={list.id} className="bg-[#050505]">
                              {list.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  <div className="h-8 w-px bg-[#1F1F1F]" />

                </div>

                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/20 group-focus-within:text-blue-400 transition-colors" />
                    <input 
                      type="text" 
                      placeholder="Rechercher un prospect..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-black/40 border border-[#1F1F1F] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 w-[240px] transition-all"
                    />
                  </div>
                  <div className="relative">
                    <Button 
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                      variant="outline" 
                      className={cn(
                        "border-[#1F1F1F] bg-black/40 text-white/60 hover:text-white gap-2 h-10 rounded-xl px-4 text-xs font-bold uppercase tracking-wider",
                        (filterStep !== "all" || filterPertinence !== "all" || filterEmail !== "all") && "text-blue-400 border-blue-500/30 bg-blue-500/5"
                      )}
                    >
                      <Filter className="size-3.5" /> Filtres
                    </Button>

                    <AnimatePresence>
                      {isFilterOpen && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 top-full mt-2 w-72 bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[999] p-6 space-y-6"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Filtres Avancés</h4>
                            <button 
                              onClick={() => {
                                setFilterStep("all");
                                setFilterPertinence("all");
                                setFilterEmail("all");
                                setSortBy("created_at");
                                setSortOrder("desc");
                              }}
                              className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-wider"
                            >
                              Réinitialiser
                            </button>
                          </div>

                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Trier par</label>
                                <select 
                                  value={sortBy}
                                  onChange={(e) => setSortBy(e.target.value)}
                                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white focus:outline-none focus:border-blue-500/50"
                                >
                                  <option value="created_at">Date d'import</option>
                                  <option value="fit_score">Pertinence</option>
                                  <option value="step">Step</option>
                                </select>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Ordre</label>
                                <select 
                                  value={sortOrder}
                                  onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white focus:outline-none focus:border-blue-500/50"
                                >
                                  <option value="desc">Décroissant</option>
                                  <option value="asc">Croissant</option>
                                </select>
                              </div>
                            </div>

                            <div className="h-px bg-white/5 my-2" />

                            <div className="space-y-2">
                              <label className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Step</label>
                              <select 
                                value={filterStep}
                                onChange={(e) => setFilterStep(e.target.value)}
                                className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                              >
                                <option value="all">Tous les steps</option>
                                <option value="Step 1">Step 1</option>
                                <option value="Step 2">Step 2</option>
                                <option value="Step 3">Step 3</option>
                                <option value="End">End</option>
                              </select>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Pertinence</label>
                              <select 
                                value={filterPertinence}
                                onChange={(e) => setFilterPertinence(e.target.value)}
                                className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                              >
                                <option value="all">Toutes les pertinence</option>
                                <option value="3/3">Élevée (3/3)</option>
                                <option value="2/3">Moyenne (2/3)</option>
                                <option value="1/3">Faible (1/3)</option>
                              </select>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Email</label>
                              <select 
                                value={filterEmail}
                                onChange={(e) => setFilterEmail(e.target.value)}
                                className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                              >
                                <option value="all">Tous</option>
                                <option value="has">Avec Email</option>
                                <option value="no">Sans Email</option>
                              </select>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <Button 
                    variant="outline" 
                    className="border-[#1F1F1F] bg-black/40 text-white/60 hover:text-white gap-2 h-10 rounded-xl px-4 text-xs font-bold uppercase tracking-wider"
                    onClick={() => {
                      // Logic depends on activeProspectTab
                      console.log("Exporting", activeProspectTab);
                    }}
                  >
                    <Download className="size-3.5" /> Exporter
                  </Button>
                  <div className="w-[1px] h-6 bg-[#1F1F1F] mx-1" />
                  <div className="relative">
                    <Button 
                      onClick={() => setIsAddLeadsOpen(!isAddLeadsOpen)}
                      className="bg-blue-600 hover:bg-blue-500 text-white gap-2 h-10 rounded-xl px-4 text-xs font-bold uppercase tracking-wider shadow-lg shadow-blue-600/10 border-t border-blue-400/20"
                    >
                      <Zap className="size-3.5" /> Ajouter des leads
                      <ChevronDown className={cn("size-3.5 transition-transform", isAddLeadsOpen ? "rotate-180" : "")} />
                    </Button>

                    <AnimatePresence>
                      {isAddLeadsOpen && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 top-full mt-2 w-64 bg-[#0A0A0A] border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[999] overflow-hidden"
                        >
                          <div className="p-2">
                            <div className="px-3 py-2 mb-1 border-b border-white/5">
                              <span className="text-[9px] font-bold text-white/40 uppercase tracking-[0.2em]">Source de données</span>
                            </div>
                            <button 
                              onClick={() => {
                                setIsAddLeadsOpen(false);
                                setIsCsvModalOpen(true);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/5 text-[11px] font-bold uppercase tracking-wider text-white/70 hover:text-white transition-all text-left group"
                            >
                              <div className="p-2 rounded-md bg-white/5 group-hover:bg-blue-500/10 group-hover:text-blue-400 transition-colors">
                                <Upload className="size-4" />
                              </div>
                              Ajouter via Import CSV
                            </button>
                            <button 
                              onClick={() => {
                                setIsAddLeadsOpen(false);
                                setIsLinkedInModalOpen(true);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/5 text-[11px] font-bold uppercase tracking-wider text-white/70 hover:text-white transition-all text-left group"
                            >
                              <div className="p-2 rounded-md bg-white/5 group-hover:bg-[#0077b5]/10 group-hover:text-[#0077b5] transition-colors">
                                <LinkedinIcon className="size-4" />
                              </div>
                              Ajouter via LinkedIn
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button 
                    onClick={() => { toggleProspectsModal(false); setSelectedProspect(null); }}
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
                            checked={selectedIds.length > 0 && selectedIds.length === displayProspects.length}
                            onChange={toggleSelectAll}
                            className="size-4 rounded border-[#1F1F1F] bg-black/40 text-blue-500 focus:ring-blue-500/20 cursor-pointer"
                          />
                        </th>
                        <th className="px-6 py-5 font-bold">Contact</th>
                        <th className="px-6 py-5 font-bold text-center w-32">Pertinence</th>
                        <th className="px-6 py-5 font-bold text-center w-32">Step</th>
                        <th className="px-6 py-5 font-bold text-center">Date d'import</th>
                        <th className="px-6 py-5 font-bold">Email</th>
                        <th className="px-6 py-5 font-bold text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1F1F1F]/50">
                      {isLoadingProspects ? (
                        <tr>
                          <td colSpan={8} className="py-20 text-center">
                            <div className="flex flex-col items-center gap-4">
                              <Loader2 className="size-8 animate-spin text-blue-500" />
                              <p className="text-white/30 text-xs font-bold uppercase tracking-[0.2em]">Chargement des prospects...</p>
                            </div>
                          </td>
                        </tr>
                      ) : displayProspects.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-20 text-center">
                            <div className="flex flex-col items-center gap-4">
                              <User className="size-8 text-white/10" />
                              <p className="text-white/30 text-xs font-bold uppercase tracking-[0.2em]">Aucun prospect trouvé</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        displayProspects.map((p, i) => {
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
                                    {p.linkedin_url && (
                                      <a 
                                        href={p.linkedin_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-white/20 hover:text-[#0077b5] transition-all hover:scale-110 active:scale-95"
                                      >
                                        <LinkedinIcon className="size-3.5" />
                                      </a>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-white/40 font-medium">
                                    {p.role || "Décideur"} {p.company_name && `@ ${p.company_name}`}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5 text-center w-32">
                              <span className={cn(
                                "px-2.5 py-1 rounded-md text-[10px] font-bold border inline-block w-12",
                                (p.fit_score || 0) >= 80 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                (p.fit_score || 0) >= 50 ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                                "bg-red-500/10 text-red-400 border-red-500/20"
                              )}>
                                {(p.fit_score || 0) >= 80 ? '3/3' : (p.fit_score || 0) >= 50 ? '2/3' : '1/3'}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-center w-32">
                              <span className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border inline-block w-20",
                                p.status === 'converted' 
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              )}>
                                {getStepLabel(p.status)}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-center text-[11px] text-white/70 font-bold uppercase tracking-wider">
                              {p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "—"}
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                {p.email ? (
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                                      <Mail className="size-3.5" />
                                    </div>
                                    <span className="text-[12px] text-white/50 font-medium lowercase truncate max-w-[150px]">
                                      {p.email}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-white/20 font-bold uppercase tracking-widest">Not Found</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-5 text-right">
                              <button 
                                onClick={(e) => { e.stopPropagation(); setSelectedProspect(p); }}
                                className="p-2.5 hover:bg-white/5 rounded-xl text-white/20 hover:text-white transition-all group/btn"
                              >
                                <Plus className="size-5 group-hover/btn:rotate-90 transition-transform duration-300" />
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
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
                          <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold mb-1.5">Step</p>
                          <p className="text-xs font-bold text-white uppercase tracking-wider mt-1 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                            {getStepLabel(selectedProspect.status)}
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
            onClose={() => toggleFlowModal(false)} 
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
            onClose={() => toggleSettingsModal(false)} 
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

      <LinkedInExtensionModal 
        isOpen={isLinkedInModalOpen} 
        onClose={() => setIsLinkedInModalOpen(false)} 
      />
    </div>
  );
}

function LinkedInExtensionModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className="p-8">
              <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-[#0077b5]/10 text-[#0077b5] border border-[#0077b5]/20">
                    <LinkedinIcon className="size-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">Extension LinkedIn Verytis</h2>
                    <p className="text-sm text-white/40 mt-1">Prospectez directement depuis le réseau n°1</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors text-white/20 hover:text-white">
                  <X className="size-5" />
                </button>
              </div>

              <div className="space-y-6 mb-10">
                <div className="flex gap-4">
                  <div className="size-6 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center shrink-0 border border-blue-500/20">1</div>
                  <div>
                    <h4 className="text-[13px] font-bold text-white mb-1">Installez l'extension</h4>
                    <p className="text-[12px] text-white/40 leading-relaxed">Téléchargez l'extension Verytis Pro sur le Chrome Web Store pour commencer le scraping.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="size-6 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center shrink-0 border border-blue-500/20">2</div>
                  <div>
                    <h4 className="text-[13px] font-bold text-white mb-1">Activez "Verytis Pro"</h4>
                    <p className="text-[12px] text-white/40 leading-relaxed">Une bulle flottante apparaîtra sur LinkedIn. Connectez-vous avec votre identifiant client.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="size-6 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center shrink-0 border border-blue-500/20">3</div>
                  <div>
                    <h4 className="text-[13px] font-bold text-white mb-1">Scrapez en un clic</h4>
                    <p className="text-[12px] text-white/40 leading-relaxed">Allez sur n'importe quel profil, recherche ou post et cliquez sur "Ajouter à la campagne".</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button 
                  onClick={() => router.push('/integrations')}
                  variant="outline" 
                  className="h-12 rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10 font-bold gap-2"
                >
                  <Settings className="size-4" /> Voir l'Intégration
                </Button>
                <Button 
                  onClick={() => window.open('https://linkedin.com', '_blank')}
                  className="h-12 rounded-2xl bg-[#0077b5] hover:bg-[#0077b5]/90 text-white font-bold gap-2"
                >
                  <ExternalLink className="size-4" /> Ouvrir LinkedIn
                </Button>
              </div>
            </div>

            <div className="bg-[#0077b5]/5 border-t border-white/5 p-4 text-center">
              <p className="text-[10px] text-[#0077b5] font-bold uppercase tracking-widest">L'IA s'occupe de l'enrichissement automatiquement</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
