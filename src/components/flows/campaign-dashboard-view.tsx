"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  ChevronDown,
  Briefcase,
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
  Send,
  Phone,
  Save,
  ArrowRightLeft,
  CopyPlus,
  XCircle,
  Sparkles,
} from "lucide-react";
import {
  getOrganizationProspects,
  getContactLists,
  getProspectsByList,
  qualifyProspects,
  setProspectSequenceDecision,
  updateProspectPersonalization,
  moveProspectsToCampaign,
  addProspectsToList,
  getOrganizationCampaigns,
  getProspectsMembership,
} from "@/lib/flows/actions";
import { Button } from "@/components/ui/button";
import { SequenceBuilderModal } from "./sequence-builder";
import { TopLine } from "@/components/layout/top-line";
import { SectionHeading } from "@/components/layout/section-heading";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { CsvImportModal } from "./csv-import-modal";

const fade = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

const getActionLabel = (name: string, t: any) => {
  if (!name) return "";
  
  const mapping: Record<string, string> = {
    "voir profil": t("nodes.view_profile"),
    "ajouter sans message": t("nodes.add_no_msg"),
    "ajouter avec message": t("nodes.add_with_msg"),
    "envoyer message": t("nodes.send_msg"),
    "relance message": t("nodes.follow_up_msg"),
    "créer action extension": t("nodes.create_ext_action"),
    "attendre x jours": t("nodes.wait_x_days"),
    "attendre une réponse": t("nodes.wait_reply"),
    "stopper la séquence": t("nodes.stop_sequence"),
    "passer en suivi manuel": t("nodes.manual_followup"),
    "marquer comme chaud": t("nodes.mark_hot"),
    "réessayer": t("nodes.retry"),
    "signaler erreur": t("nodes.report_error"),
    "si invitation acceptée (linkedin)": t("nodes.if_profile_found"), // Fallback for condition preview
  };

  const normalized = name.toLowerCase().trim();
  
  // Handle dynamic "Attendre 1 jours" or "Wait 1 day(s)"
  if (normalized.includes("attendre") || normalized.includes("wait")) {
    const days = name.match(/\d+/)?.[0];
    if (days) {
      return t("nodes.wait_x_days").replace("X", days);
    }
  }

  return mapping[normalized] || name;
};

// --- Types ---
type CampaignStatus = "active" | "paused" | "archived" | "draft";

interface Campaign {
  id: string;
  display_name: string;
  status: CampaignStatus;
  created_at: string;
  config?: any;
  source?: string | null;
  sequence_id?: string | null;
}

interface Prospect {
  id: string;
  campaign_id?: string | null;
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
  source?: string | null;
  email?: string | null;
  phone?: string | null;
  created_at?: string;
  extra_data?: any;
  full_name?: string | null;
  role_title?: string | null;
  company_description?: string | null;
  profile_url?: string | null;
  website_url?: string | null;
  raw_data?: any;
  pre_score?: number | null;
  pre_score_level?: "high" | "medium" | "low" | null;
  qualification_status?:
    | "collected"
    | "pre_scored"
    | "to_qualify"
    | "qualified"
    | "rejected"
    | null;
  qualification_level?: "high" | "medium" | "low" | null;
  qualification_reason?: string | null;
  company?: {
    industry?: string | null;
    size_range?: string | null;
    description?: string | null;
    linkedin_url?: string | null;
    location?: string | null;
    website?: string | null;
  } | null;
}

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string;
  created_at: string;
  type?: string;
  detail?: string;
  photos?: string[];
  count?: number;
  metadata?: any;
}

interface ExtensionOverview {
  status: string;
  last_sync_at: string | null;
  is_online: boolean;
  runner_type?: "cloud" | "extension";
  cloud_session_status?: string | null;
  action_stats: Record<string, number>;
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
// Helpers moved to component for translation support

const StatusDot = ({ status }: { status: string }) => {
  if (status === "active")
    return (
      <span className="flex size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
    );
  if (status === "paused")
    return (
      <span className="flex size-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></span>
    );
  return <span className="flex size-2 rounded-full bg-zinc-500"></span>;
};

const ProspectAvatar = ({
  name,
  photoUrl,
  colorIndex,
  size = "size-10",
}: {
  name: string;
  photoUrl?: string | null;
  colorIndex: number;
  size?: string;
}) => {
  if (photoUrl) {
    return (
      <div
        className={`${size} rounded-full border border-white/10 overflow-hidden shrink-0 shadow-xl`}
      >
        <img
          src={photoUrl}
          alt={name}
          className="size-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
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
    <div
      className={`${size} rounded-full border flex items-center justify-center font-bold text-xs shrink-0 shadow-xl ${colorClass}`}
    >
      {initials || <User className="size-4" />}
    </div>
  );
};

const StackedAvatars = ({
  photos,
  count,
}: {
  photos: string[];
  count: number;
}) => {
  const displayPhotos = photos.slice(0, 2);
  return (
    <div className="flex -space-x-4 items-center shrink-0">
      {displayPhotos.map((url, i) => (
        <div
          key={i}
          className="size-10 rounded-full border-2 border-black overflow-hidden bg-[#0c0c0c] shadow-2xl relative z-10"
        >
          <img
            src={url}
            alt={`Avatar ${i}`}
            className="size-full object-cover"
          />
        </div>
      ))}
      {count > displayPhotos.length && (
        <div className="size-9 rounded-full border-2 border-black bg-zinc-900 flex items-center justify-center text-[9px] font-black text-white/90 shadow-2xl relative z-0 -ml-3 pl-2 pr-1">
          +{count - displayPhotos.length}
        </div>
      )}
    </div>
  );
};

type IcpLevel = "high" | "medium" | "low";

const getIcpLevel = (prospect: Prospect): IcpLevel | null => {
  return prospect.qualification_level ?? null;
};



type SequenceDecision = "confirmed" | "paused" | "removed";

const isProspectQualificationDone = (prospect: Prospect) =>
  prospect.qualification_status === "qualified" ||
  prospect.qualification_status === "rejected" ||
  Boolean(prospect.qualification_level);

const getSequenceDecision = (
  prospect: Prospect,
): SequenceDecision | "pending" | "unqualified" => {
  const status = prospect.extra_data?.sequence_decision?.status;
  if (status === "confirmed" || status === "paused" || status === "removed") {
    return status;
  }
  return isProspectQualificationDone(prospect) ? "pending" : "unqualified";
};

function SequenceDecisionControls({
  prospect,
  isLoading,
  onDecision,
  compact = false,
  className,
}: {
  prospect: Prospect;
  isLoading: boolean;
  onDecision: (prospectId: string, decision: SequenceDecision) => void;
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("Cockpit");
  const decision = getSequenceDecision(prospect);
  const isQualified = isProspectQualificationDone(prospect);
  const isDisabled = !isQualified || isLoading;

  const actions: Array<{
    decision: SequenceDecision;
    label: string;
    icon: typeof CheckCircle2;
    activeClass: string;
    hoverClass: string;
  }> = [
    {
      decision: "confirmed",
      label: t("confirm_sequence"),
      icon: CheckCircle2,
      activeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      hoverClass: "hover:bg-emerald-500/10 hover:text-emerald-300",
    },
    {
      decision: "paused",
      label: t("pause_sequence"),
      icon: Pause,
      activeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      hoverClass: "hover:bg-amber-500/10 hover:text-amber-300",
    },
    {
      decision: "removed",
      label: t("remove_from_campaign_action"),
      icon: XCircle,
      activeClass: "bg-red-500/15 text-red-300 border-red-500/30",
      hoverClass: "hover:bg-red-500/10 hover:text-red-300",
    },
  ];

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-1.5",
        !isQualified && "opacity-35",
        className,
      )}
      onClick={(event) => event.stopPropagation()}
    >
      {actions.map((action) => {
        const Icon = action.icon;
        const isActive = decision === action.decision;

        return (
          <button
            key={action.decision}
            type="button"
            title={
              isQualified
                ? action.label
                : "Qualifiez le prospect avant de décider la suite"
            }
            aria-label={action.label}
            disabled={isDisabled}
            onClick={() => onDecision(prospect.id, action.decision)}
            className={cn(
              "rounded-full border border-white/10 bg-white/[0.03] text-white/35 transition-all active:scale-95 disabled:cursor-not-allowed",
              compact ? "size-8" : "h-9 px-3",
              isActive ? action.activeClass : action.hoverClass,
            )}
          >
            {isLoading ? (
              <Loader2 className="size-3.5 animate-spin mx-auto" />
            ) : compact ? (
              <Icon className="size-3.5 mx-auto" />
            ) : (
              <span className="flex items-center gap-2 text-[11px] font-bold">
                <Icon className="size-3.5" />
                {action.decision === "confirmed"
                  ? t("confirm_sequence")
                  : action.decision === "paused"
                    ? t("pause_sequence")
                    : t("remove_from_campaign_action")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const normalizeProspectList = (prospects: any[]): Prospect[] =>
  prospects.map((prospect) => ({
    ...prospect,
    company: Array.isArray(prospect.company)
      ? prospect.company[0] || null
      : prospect.company || null,
  }));

const firstText = (...values: any[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
};

const getOrganizationData = (prospect: Prospect) => {
  const extraOrg = prospect.extra_data?.organization;
  const rawOrg = prospect.raw_data?.organization;
  return {
    ...(rawOrg && typeof rawOrg === "object" ? rawOrg : {}),
    ...(extraOrg && typeof extraOrg === "object" ? extraOrg : {}),
  };
};

const getProspectIndustry = (prospect: Prospect) => {
  const organization = getOrganizationData(prospect);
  return firstText(
    prospect.company?.industry,
    prospect.extra_data?.industry,
    prospect.raw_data?.industry,
    organization.industry,
  );
};

const getProspectCompanySize = (prospect: Prospect) => {
  const organization = getOrganizationData(prospect);
  return firstText(
    prospect.company?.size_range,
    prospect.extra_data?.company_size,
    prospect.raw_data?.companySize,
    prospect.raw_data?.company_size,
    organization.companySize,
    organization.company_size,
    organization.size_range,
  );
};

const getProspectLocation = (prospect: Prospect) => {
  const organization = getOrganizationData(prospect);
  return firstText(
    prospect.location,
    prospect.company?.location,
    prospect.extra_data?.location,
    prospect.raw_data?.profileLocation,
    prospect.raw_data?.location,
    organization.location,
  );
};

const getProspectWebsite = (prospect: Prospect) => {
  const organization = getOrganizationData(prospect);
  return firstText(
    prospect.website,
    prospect.website_url,
    prospect.company?.website,
    prospect.extra_data?.website_url,
    prospect.raw_data?.companyWebsite,
    prospect.raw_data?.website_url,
    organization.website,
    organization.website_url,
  );
};

const getProspectCompanyLinkedin = (prospect: Prospect) => {
  const organization = getOrganizationData(prospect);
  return firstText(
    prospect.company?.linkedin_url,
    prospect.extra_data?.company_linkedin_url,
    prospect.raw_data?.companyLinkedinUrl,
    prospect.raw_data?.organizationLinkedinUrl,
    organization.linkedin_url,
    organization.linkedinUrl,
  );
};

const getProspectCompanyDescription = (prospect: Prospect) => {
  const organization = getOrganizationData(prospect);
  return firstText(
    prospect.company_description,
    prospect.company?.description,
    prospect.extra_data?.company_description,
    prospect.raw_data?.companyDescription,
    prospect.raw_data?.organizationDescription,
    organization.description,
    organization.mission,
  );
};

const getProspectExperience = (prospect: Prospect) => {
  const rawExp = prospect.raw_data?.experience || prospect.extra_data?.experience;
  if (Array.isArray(rawExp) && rawExp.length > 0) {
    // Format the first 2 experiences
    return rawExp.slice(0, 2).map((exp: any) => {
      const title = exp.title || exp.role;
      const comp = exp.company || exp.companyName;
      if (title && comp) return `${title} @ ${comp}`;
      return title || comp;
    }).join(" / ");
  }
  return firstText(
    prospect.extra_data?.last_experience,
    prospect.raw_data?.headline,
    prospect.raw_data?.summary
  );
};

const getTitleAndCompany = (role: string, companyName?: string | null) => {
  if (!role || role === "Décideur") {
    return { title: "Décideur", company: companyName || "" };
  }

  // Detect company separators without cutting hyphenated titles like "Co-founder".
  const parts = role.split(/\s+(?:at|chez)\s+|[@|•]|\s[-–—]\s/i);
  let title = parts[0].trim();
  let company = (companyName || "").trim();

  // If company name is missing, try to extract it from the second part of the headline
  if (!company && parts.length > 1) {
    company = parts[1].trim();
  }

  // If the title ends with the company name (without separator), strip it from title
  if (company && title.toLowerCase().endsWith(company.toLowerCase())) {
    const stripped = title.substring(0, title.length - company.length).trim();
    const cleaned = stripped.replace(/[@|•\-–·\s,:]+$/, "").trim();
    if (cleaned.length >= 2) {
      title = cleaned;
    }
  }

  // If the title now exactly matches the company, return it as title only
  if (title.toLowerCase() === company.toLowerCase()) {
    return { title, company: "" };
  }

  return { title, company };
};

// ============================================================================
// CANVAS FLOW COMPONENTS (Now in a Modal)
// ============================================================================



function FlowCanvasModal({
  onClose,
  sequenceSteps,
  stepCounts = {},
  completedCount = 0,
}: {
  onClose: () => void;
  sequenceSteps?: any[];
  stepCounts?: Record<string, number>;
  completedCount?: number;
}) {
  const stepsData =
    sequenceSteps && sequenceSteps.length > 0
      ? sequenceSteps.map((s) => ({
          id: s.id,
          type: s.action_type,
          title: s.name,
          subtitle: s.description || "",
          icon:
            s.action_type === "trigger"
              ? Search
              : s.action_type === "wait"
                ? Clock
                : LinkedinIcon,
          color:
            s.action_type === "trigger"
              ? "text-blue-400"
              : s.action_type === "wait"
                ? "text-amber-400"
                : "text-blue-400",
          statsText: String(stepCounts[s.id] || 0),
          statsColor: (stepCounts[s.id] || 0) > 0 ? "text-emerald-400" : "text-white/40",
          statsBg: (stepCounts[s.id] || 0) > 0 ? "bg-emerald-500/10" : "bg-white/5",
        }))
      : [];

  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [editingStep, setEditingStep] = useState<(typeof stepsData)[0] | null>(
    null,
  );
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
      if (e.key === "Escape") {
        if (editingStep) setEditingStep(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
            <button
              onClick={onClose}
              className="p-2 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden" ref={containerRef}>
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "40px 40px",
            }}
          />

          <div className="absolute bottom-6 left-6 flex items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-lg backdrop-blur-md z-10">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
              className="p-2 hover:bg-white/10 rounded-md text-white/60 hover:text-white transition-colors"
            >
              <ZoomOut className="size-4" />
            </button>
            <span className="text-xs font-mono w-12 text-center text-white/60">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
              className="p-2 hover:bg-white/10 rounded-md text-white/60 hover:text-white transition-colors"
            >
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
                    <div
                      className={`p-2 rounded-lg bg-[#111] border border-white/5 ${editingStep.color}`}
                    >
                      {editingStep.icon && (
                        <editingStep.icon className="size-4" />
                      )}
                    </div>
                    Éditer l'étape
                  </h3>
                  <button
                    onClick={() => setEditingStep(null)}
                    className="p-1.5 hover:bg-white/10 rounded-md text-white/40 hover:text-white transition-colors"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="flex-1 space-y-6 overflow-y-auto pr-2">
                  <div>
                    <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block font-medium">
                      Titre de l'action
                    </label>
                    <input
                      className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
                      defaultValue={editingStep.title}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block font-medium">
                      Description interne
                    </label>
                    <input
                      className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
                      defaultValue={editingStep.subtitle}
                    />
                  </div>
                  <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
                    <p className="text-sm text-blue-400 font-medium mb-1">
                      Configuration de l'agent IA
                    </p>
                    <p className="text-xs text-white/60">
                      Cette étape est gérée dynamiquement par le moteur.
                      Modifiez les prompts dans la section Configuration Agent.
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/10 mt-auto flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setEditingStep(null)}
                    className="flex-1 bg-transparent border-white/10 text-white hover:bg-white/5"
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={() => setEditingStep(null)}
                    className="flex-1 bg-white text-black hover:bg-white/90"
                  >
                    Sauvegarder
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div
            className="absolute inset-0 overflow-auto flex flex-col items-center py-20 select-none"
            style={{ cursor: isDragging ? "grabbing" : "grab" }}
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

              {stepsData.length > 0 ? (
                stepsData.map((step, i) => {
                  const isLast = i === stepsData.length - 1;
                  return (
                    <div key={step.id} className="flex flex-col items-center">
                      {step.type === "wait" || step.type === "condition" ? (
                        <div
                          className={`z-10 px-4 py-1.5 rounded-full text-xs font-medium border flex items-center gap-2 bg-[#0A0A0A] ${step.type === "wait" ? "text-amber-400 border-amber-500/30" : "text-purple-400 border-purple-500/30"}`}
                        >
                          {step.icon && <step.icon className="size-3" />}{" "}
                          {step.title}
                        </div>
                      ) : (
                        <div className="z-10 w-[500px] bg-[#0c0c0c] border border-white/10 rounded-2xl p-5 shadow-xl hover:border-white/20 transition-colors">
                          <div className="flex justify-between items-start mb-5">
                            <div className="flex items-center gap-3.5">
                              <div
                                className={`p-2.5 rounded-xl bg-[#111] border border-white/5 ${step.color}`}
                              >
                                {step.icon && <step.icon className="size-5" />}
                              </div>
                              <div>
                                <h3 className="text-white text-sm font-medium">
                                  {step.title}
                                </h3>
                                <p className="text-xs text-white/40 mt-0.5">
                                  {step.subtitle}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => setEditingStep(step)}
                              className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors px-2 py-1 rounded-md hover:bg-blue-500/10"
                            >
                              Éditer <Edit2 className="size-3" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between pt-4 border-t border-white/5">
                            <div
                              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md ${step.statsBg} ${step.statsColor}`}
                            >
                              <CheckCircle2 className="size-3.5" />{" "}
                              {step.statsText}
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
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-white/20">
                  <Zap className="size-16 mb-6 opacity-20" />
                  <h3 className="text-xl font-bold text-white/40 uppercase tracking-[0.2em]">
                    Séquence Vide
                  </h3>
                  <p className="text-sm text-white/20 mt-2">
                    Utilisez le Sequence Builder pour générer votre flow.
                  </p>
                </div>
              )}
              {stepsData.length > 0 && (
                <div className="mt-8 flex flex-col items-center">
                  <div className="w-px h-8 bg-gradient-to-b from-white/20 to-transparent" />
                  <div className="px-6 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center gap-1 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                    <CheckCircle2 className="size-5 text-emerald-400 mb-1" />
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">
                      Terminés
                    </span>
                    <span className="text-2xl font-bold text-white">
                      {completedCount}
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function SettingsModal({
  onClose,
  campaignName,
  campaign,
}: {
  onClose: () => void;
  campaignName: string;
  campaign: Campaign;
}) {
  const t = useTranslations("Cockpit");
  const tCS = useTranslations("CampaignSettings");
  const tAct = useTranslations("Activities");
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"config" | "contact">("contact");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [localMessagesPerDay, setLocalMessagesPerDay] = useState(
    campaign.config?.prospection?.messages_per_day || 20,
  );
  const [localInvitationsPerDay, setLocalInvitationsPerDay] = useState(
    campaign.config?.prospection?.invitations_per_day || 40,
  );
  const [localProspectsPerDay, setLocalProspectsPerDay] = useState(
    campaign.config?.prospection?.prospects_per_day || 20,
  );
  const [localSearchTime, setLocalSearchTime] = useState(
    campaign.config?.prospection?.search_time || "09:00",
  );
  const [localEndTime, setLocalEndTime] = useState(
    campaign.config?.prospection?.end_time || "18:00",
  );
  const [localTimezone, setLocalTimezone] = useState(
    campaign.config?.prospection?.timezone || "Europe/Paris",
  );
  const [localSelectedDays, setLocalSelectedDays] = useState<number[]>(
    campaign.config?.prospection?.selected_days || [1, 2, 3, 4, 5],
  );
  const [localLanguage, setLocalLanguage] = useState(
    campaign.config?.language || "français",
  );

  const handleSave = async () => {
    setIsSaving(true);
    const { updateCampaignConfig } = await import("@/lib/flows/actions");
    const result = await updateCampaignConfig(campaign.id, {
      prospection: {
        prospects_per_day: localProspectsPerDay,
        messages_per_day: localMessagesPerDay,
        invitations_per_day: localInvitationsPerDay,
        search_time: localSearchTime,
        end_time: localEndTime,
        timezone: localTimezone,
        selected_days: localSelectedDays,
      },
      language: localLanguage,
    });

    if (result.success) {
      router.refresh();
      onClose();
    } else {
      alert(result.error || tCS("save_error"));
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (
      !confirm(
        tCS("delete_confirm"),
      )
    )
      return;

    setIsDeleting(true);
    const { deleteCampaign } = await import("@/lib/flows/actions");
    const result = await deleteCampaign(campaign.id);

    if (result.success) {
      router.push("/flows/prospecting");
    } else {
      alert(result.error || tCS("delete_error"));
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
              <h2 className="font-semibold text-xl text-white">
                {tCS("title")}
              </h2>
              <p className="text-sm text-white/40">{campaignName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-64 border-r border-white/10 bg-[#070707] p-4 flex flex-col gap-2 shrink-0">
            {[
              { id: "config", label: tCS("tab_config"), icon: Edit2 },
              { id: "contact", label: tCS("tab_contact"), icon: Zap },
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
              {activeTab === "config" && (
                <motion.div
                  key="config"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  <section className="space-y-6">
                    <h3 className="text-xs font-bold text-white/40 uppercase tracking-[0.2em] flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-blue-400" />{" "}
                      {tCS("tab_config")}
                    </h3>
                    <div className="grid gap-6 p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                      <div className="space-y-2">
                        <label className="text-xs text-white/30 uppercase tracking-wider font-medium">
                          {tCS("mission_goal")}
                        </label>
                        <p className="text-sm text-white/70 leading-relaxed italic">
                          {campaign.config?.company_purpose ||
                            tCS("mission_default")}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs text-white/30 uppercase tracking-wider font-medium">
                            {tCS("sectors_size")}
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {(() => {
                              const icp = campaign.config?.target_icp;
                              const combined = [
                                ...(icp?.sectors || []),
                                ...(icp?.industries || []),
                                ...(icp?.company_size || []),
                                ...(icp?.company_sizes || []),
                              ].filter((s) => s && s !== "N/A");

                              if (combined.length === 0)
                                return (
                                  <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/5 text-[10px] text-white/20 font-medium">
                                    N/A
                                  </span>
                                );

                              return combined.map((s: string) => (
                                <span
                                  key={s}
                                  className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-medium"
                                >
                                  {s}
                                </span>
                              ));
                            })()}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs text-white/30 uppercase tracking-wider font-medium">
                            {tCS("geo_zone")}
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {(
                              campaign.config?.target_icp?.locations || ["N/A"]
                            ).map((l: string) => (
                              <span
                                key={l}
                                className="px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-400 font-medium"
                              >
                                {l}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs text-white/30 uppercase tracking-wider font-medium">
                          {tCS("targeted_decision_makers")}
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {(campaign.config?.personas || ["N/A"]).map(
                            (p: string) => (
                              <span
                                key={p}
                                className="px-2.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-400 font-medium"
                              >
                                {p}
                              </span>
                            ),
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs text-white/30 uppercase tracking-wider font-medium">
                          {tCS("ai_tone")}
                        </label>
                        <p className="text-sm text-white/70 font-medium">
                          {campaign.config?.tone || "Professionnel"}
                        </p>
                      </div>
                    </div>
                  </section>
                </motion.div>
              )}

              {activeTab === "contact" && (
                <motion.div
                  key="contact"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-12"
                >
                  <section className="space-y-8">
                    <h3 className="text-xs font-bold text-white/40 uppercase tracking-[0.2em] flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-blue-400" /> ⚡️
                      {tCS("tab_contact")}
                    </h3>

                    <div className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-white/30 uppercase tracking-wider font-medium">
                              {tCS("contact_per_day")}
                            </label>
                            <span className="text-[10px] bg-white/5 text-white/40 px-2 py-0.5 rounded font-bold border border-white/10">
                              {tCS("advice_n", { n: 20 })}
                            </span>
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              min={1}
                              value={localProspectsPerDay}
                              onChange={(e) => {
                                setLocalProspectsPerDay(
                                  parseInt(e.target.value) || 0,
                                );
                              }}
                              className={cn(
                                "w-full bg-white/5 border rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all",
                                localProspectsPerDay > 30
                                  ? "border-red-500/50 bg-red-500/5"
                                  : localProspectsPerDay > 20
                                    ? "border-amber-500/50 bg-amber-500/5 focus:border-amber-500"
                                    : "border-white/10 focus:border-blue-500/50",
                              )}
                            />
                            {localProspectsPerDay > 30 ? (
                              <div className="flex items-center gap-2 mt-2 text-red-400">
                                <AlertCircle className="size-3" />
                                <p className="text-[10px] font-bold uppercase tracking-wider">
                                  {tCS("critical_limit", { n: 30 })}
                                </p>
                              </div>
                            ) : localProspectsPerDay > 20 ? (
                              <div className="flex items-center gap-2 mt-2 text-amber-400">
                                <Info className="size-3" />
                                <p className="text-[10px] font-bold uppercase tracking-wider">
                                  {tCS("exceeding_advice", { n: 20 })}
                                </p>
                              </div>
                            ) : (
                              <p className="text-[10px] text-white/20 italic mt-2">
                                {tCS("security_advice", { n: 20 })}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <label className="text-xs text-white/30 uppercase tracking-wider font-medium">
                              {tCS("messages_per_day")}
                            </label>
                            <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
                              <button onClick={() => setLocalMessagesPerDay(Math.max(1, localMessagesPerDay - 1))} className="text-white/40 hover:text-white">-</button>
                              <input
                                type="number"
                                value={localMessagesPerDay}
                                onChange={(e) => setLocalMessagesPerDay(parseInt(e.target.value))}
                                className="w-full bg-transparent text-center font-bold text-white border-none focus:ring-0"
                              />
                              <button onClick={() => setLocalMessagesPerDay(localMessagesPerDay + 1)} className="text-white/40 hover:text-white">+</button>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <label className="text-xs text-white/30 uppercase tracking-wider font-medium">
                              {tCS("invitations_per_day")}
                            </label>
                            <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
                              <button onClick={() => setLocalInvitationsPerDay(Math.max(1, localInvitationsPerDay - 1))} className="text-white/40 hover:text-white">-</button>
                              <input
                                type="number"
                                value={localInvitationsPerDay}
                                onChange={(e) => setLocalInvitationsPerDay(parseInt(e.target.value))}
                                className="w-full bg-transparent text-center font-bold text-white border-none focus:ring-0"
                              />
                              <button onClick={() => setLocalInvitationsPerDay(localInvitationsPerDay + 1)} className="text-white/40 hover:text-white">+</button>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <label className="text-xs text-white/30 uppercase tracking-wider font-medium">
                            {tCS("contact_hours")}
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="time"
                              value={localSearchTime}
                              onChange={(e) =>
                                setLocalSearchTime(e.target.value)
                              }
                              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50"
                            />
                            <span className="text-white/20">à</span>
                            <input
                              type="time"
                              value={localEndTime}
                              onChange={(e) => setLocalEndTime(e.target.value)}
                              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50"
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <label className="text-xs text-white/30 uppercase tracking-wider font-medium">
                            {tCS("timezone")}
                          </label>
                          <select
                            value={localTimezone}
                            onChange={(e) => setLocalTimezone(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50"
                          >
                            <option value="Europe/Paris">
                              Paris (UTC+01:00)
                            </option>
                            <option value="Europe/London">
                              Londres (UTC+00:00)
                            </option>
                            <option value="America/New_York">
                              New York (UTC-05:00)
                            </option>
                            <option value="Asia/Tokyo">
                              Tokyo (UTC+09:00)
                            </option>
                            <option value="Australia/Sydney">
                              Sydney (UTC+11:00)
                            </option>
                          </select>
                        </div>

                        <div className="space-y-4">
                          <label className="text-xs text-white/30 uppercase tracking-wider font-medium">
                            {tCS("discussion_language")}
                          </label>
                          <select
                            value={localLanguage}
                            onChange={(e) => setLocalLanguage(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50"
                          >
                            <option value="français">Français</option>
                            <option value="english">English</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="text-xs text-white/30 uppercase tracking-wider font-medium">
                          Jours d'actions
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { id: 1, label: "Lun" },
                            { id: 2, label: "Mar" },
                            { id: 3, label: "Mer" },
                            { id: 4, label: "Jeu" },
                            { id: 5, label: "Ven" },
                            { id: 6, label: "Sam" },
                            { id: 0, label: "Dim" },
                          ].map((day) => {
                            const isSelected = localSelectedDays.includes(
                              day.id,
                            );
                            return (
                              <button
                                key={day.id}
                                onClick={() => {
                                  if (isSelected) {
                                    setLocalSelectedDays(
                                      localSelectedDays.filter(
                                        (d) => d !== day.id,
                                      ),
                                    );
                                  } else {
                                    setLocalSelectedDays([
                                      ...localSelectedDays,
                                      day.id,
                                    ]);
                                  }
                                }}
                                className={cn(
                                  "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                                  isSelected
                                    ? "bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                                    : "bg-white/5 border-white/10 text-white/40 hover:text-white/60 hover:border-white/20",
                                )}
                              >
                                {day.label}
                              </button>
                            );
                          })}
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
          <Button
            variant="ghost"
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-red-500 hover:text-red-400 hover:bg-red-500/10 px-4 gap-2"
          >
            {isDeleting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <X className="size-4" />
            )}
            Supprimer la campagne
          </Button>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="bg-transparent border-white/10 text-white hover:bg-white/5 px-8"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || localProspectsPerDay > 30}
              className="bg-white text-black hover:bg-white/90 px-8 font-bold min-w-[140px]"
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : null}
              Enregistrer
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}



export function CampaignDashboardView({
  campaign,
  prospects: initialProspects,
  activities,
  sequenceSteps,
  extensionOverview,
  stepCounts = {},
  completedCount = 0,
}: {
campaign: Campaign;
  prospects: Prospect[];
  activities: ActivityLog[];
  sequenceSteps?: any[];
  extensionOverview?: ExtensionOverview;
  stepCounts?: Record<string, number>;
  completedCount?: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("Cockpit");
  const tProspecting = useTranslations("Prospecting");
  const tAct = useTranslations("Activities");
  const currentView = searchParams.get("view");

  const isFlowModalOpen = currentView === "flow";
  const isProspectsModalOpen = currentView === "contacts";
  const isSettingsOpen = currentView === "settings";

  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(
    null,
  );
  const [editingSequence, setEditingSequence] = useState<any>(null);

  useEffect(() => {
    if (selectedProspect?.extra_data?.personalized_sequence) {
      setEditingSequence(selectedProspect.extra_data.personalized_sequence);
    } else {
      setEditingSequence(null);
    }
  }, [selectedProspect]);

  const ICP_META = {
    high: {
      label: t("icp_score_high"),
      shortLabel: t("short_high"),
      className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    },
    medium: {
      label: t("icp_score_medium"),
      shortLabel: t("short_medium"),
      className: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    },
    low: {
      label: t("icp_score_low"),
      shortLabel: t("short_low"),
      className: "bg-red-500/10 text-red-400 border-red-500/20",
    },
  };

  const EMPTY_ICP_META = {
    label: "—",
    shortLabel: "—",
    className: "bg-white/[0.03] text-white/25 border-white/10",
  };

  const getIcpMeta = (prospect: Prospect) => {
    const level = getIcpLevel(prospect);
    return level ? (ICP_META as any)[level] : EMPTY_ICP_META;
  };

  const QUALIFICATION_META = {
    high: {
      label: t("icp_qualif_high"),
      className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    },
    medium: {
      label: t("icp_qualif_medium"),
      className: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    },
    low: {
      label: t("icp_qualif_low"),
      className: "bg-red-500/10 text-red-400 border-red-500/20",
    },
  };

  const getQualificationMeta = (prospect: Prospect) => {
    if (!prospect.qualification_level) {
      return {
        label:
          prospect.qualification_status === "to_qualify"
            ? t("in_qualification")
            : t("not_qualified"),
        className: "bg-white/[0.03] text-white/40 border-white/10",
      };
    }
    return (QUALIFICATION_META as any)[prospect.qualification_level];
  };

  const formatActivity = (act: ActivityLog) => {
    const metadata = (act.metadata as any) || {};
    const prospectName = metadata.prospect_name || "Prospect";
    const companyName = metadata.company_name;
    const companySuffix = companyName ? ` (${companyName})` : "";

    // 1. If it's a known dot-key action
    if (act.action.includes(".")) {
      const key = act.action.replace(/\./g, "_");
      
      // Basic keys without params
      if (["prospect_qualified", "prospect_sequence_removed", "prospect_sequence_confirmed", "prospect_sequence_paused", "prospect_deleted"].includes(key)) {
        return tAct(key);
      }

      // Keys with params
      if (act.action === "prospect.imported.extension") {
        return tAct("imported_via_extension", { name: `${prospectName}${companySuffix}` });
      }
      if (act.action === "prospect.imported.document") {
        return tAct("imported_via_document", { name: `${prospectName}${companySuffix}` });
      }
      if (act.action === "prospect.qualified") {
        return tAct("qualification_done_for", { name: `${prospectName}${companySuffix}` });
      }
      if (act.action === "prospect.sequence.confirmed") {
        return tAct("sequence_confirmed_for", { name: `${prospectName}${companySuffix}` });
      }
      if (act.action === "prospect.sequence.paused") {
        return tAct("sequence_paused_for", { name: `${prospectName}${companySuffix}` });
      }
      if (act.action === "prospect.sequence.removed") {
        return tAct("prospect_removed_name", { name: prospectName });
      }
      if (act.action === "prospect.deleted") {
        return tAct("contact_deleted_name", { name: prospectName });
      }

      // 3. Agent Task Actions Mapping
      if (act.action.startsWith("task.")) {
        const agentName = metadata.agent_slug
          ? metadata.agent_slug.charAt(0).toUpperCase() + metadata.agent_slug.slice(1)
          : "Agent";
        const runType = metadata.run_type || "action";

        if (act.action.endsWith(".completed")) {
          if (runType === "enrichment") {
            return tAct("agent_enriched", { agent: agentName, name: `${prospectName}${companySuffix}` });
          } else if (runType === "qualifier") {
            return tAct("agent_qualified", { agent: agentName, name: `${prospectName}${companySuffix}` });
          } else {
            return tAct("agent_finished_step", { agent: agentName, step: runType });
          }
        } else if (act.action.endsWith(".failed")) {
          return tAct("step_failed_for", { step: runType, name: prospectName });
        }
      }
    }
    
    // 4. Step completed with duration
    if (act.action === "prospect.step.completed") {
      return tAct("step_completed_duration", { duration: metadata.duration || 0 });
    }

    // 2. Fallback to raw action if no key matches
    return act.action;
  };

  const handleUpdateSequenceStep = (index: number, newMessage: string) => {
    if (!editingSequence) return;
    const newSteps = [...editingSequence.steps];
    newSteps[index] = { ...newSteps[index], personalized_message: newMessage };
    setEditingSequence({ ...editingSequence, steps: newSteps });
  };

  const handleSavePersonalization = async () => {
    if (!selectedProspect || !editingSequence) return;
    const res = await updateProspectPersonalization(
      selectedProspect.id,
      editingSequence,
    );
    if (res.success) {
      // Update local prospect data
      setSelectedProspect({
        ...selectedProspect,
        extra_data: {
          ...selectedProspect.extra_data,
          personalized_sequence: editingSequence,
        },
      });
    } else {
      alert(res.error || "Erreur lors de la sauvegarde");
    }
  };
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [activeProspectTab, setActiveProspectTab] = useState<
    "campaign" | "lists" | "all"
  >("campaign");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStep, setFilterStep] = useState<string>("all");
  const [filterIcp, setFilterIcp] = useState<string>("all");
  const [filterEmail, setFilterEmail] = useState<string>("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [contactLists, setContactLists] = useState<any[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [displayProspects, setDisplayProspects] =
    useState<any[]>(initialProspects);
  const [isLoadingProspects, setIsLoadingProspects] = useState(false);

  // Re-sync displayProspects when initialProspects changes
  useEffect(() => {
    const filtered = initialProspects.filter((p) => {
      const matchesSearch =
        !searchQuery ||
        p.decision_maker?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.email?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStep =
        filterStep === "all" || getStepLabel(p.status) === filterStep;

      const pIcp = getIcpLevel(p);
      const matchesIcp = filterIcp === "all" || pIcp === filterIcp;

      const matchesEmail =
        filterEmail === "all" || (filterEmail === "has" ? !!p.email : !p.email);

      return matchesSearch && matchesStep && matchesIcp && matchesEmail;
    });

    const sorted = [...filtered].sort((a, b) => {
      let valA: any = a[sortBy as keyof Prospect];
      let valB: any = b[sortBy as keyof Prospect];

      if (sortBy === "step") {
        const stepOrder: Record<string, number> = {
          "Step 1": 1,
          "Step 2": 2,
          "Step 3": 3,
          End: 4,
        };
        valA = stepOrder[getStepLabel(a.status)] || 0;
        valB = stepOrder[getStepLabel(b.status)] || 0;
      } else if (sortBy === "pre_score") {
        valA = getIcpLevel(a) ? (a.fit_score ?? a.pre_score ?? 0) : -1;
        valB = getIcpLevel(b) ? (b.fit_score ?? b.pre_score ?? 0) : -1;
      } else if (sortBy === "created_at") {
        valA = new Date(a.created_at || 0).getTime();
        valB = new Date(b.created_at || 0).getTime();
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    setDisplayProspects(sorted);
  }, [
    initialProspects,
    activeProspectTab,
    searchQuery,
    filterStep,
    filterIcp,
    filterEmail,
    sortBy,
    sortOrder,
  ]);

  // Fetch data based on active tab
  useEffect(() => {
    if (!isProspectsModalOpen) return;

    const fetchData = async () => {
      setIsLoadingProspects(true);
      try {
        if (activeProspectTab === "all") {
          const { data, error } = await getOrganizationProspects();
          if (!error && data) setDisplayProspects(normalizeProspectList(data));
        } else if (activeProspectTab === "lists") {
          const { data, error } = await getContactLists();
          if (!error && data) {
            setContactLists(data);
            if (data.length > 0 && !selectedListId) {
              setSelectedListId(data[0].id);
            }
          }
          if (selectedListId) {
            const { data: listProspects, error: listError } =
              await getProspectsByList(selectedListId);
            if (!listError && listProspects)
              setDisplayProspects(normalizeProspectList(listProspects));
          } else {
            setDisplayProspects([]);
          }
        } else {
          setDisplayProspects(normalizeProspectList(initialProspects));
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setIsLoadingProspects(false);
      }
    };

    fetchData();
  }, [
    activeProspectTab,
    isProspectsModalOpen,
    selectedListId,
    initialProspects,
  ]);
   const [selectedIds, setSelectedIds] = useState<string[]>([]);
 
   useEffect(() => {
     if (!isProspectsModalOpen) {
       setSelectedIds([]);
     }
   }, [isProspectsModalOpen]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [qualifyingIds, setQualifyingIds] = useState<string[]>([]);
  const [sequenceDecisionIds, setSequenceDecisionIds] = useState<string[]>([]);
  const [campaignName, setCampaignName] = useState(
    campaign.display_name || "Campagne Sans Nom",
  );
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
      params.set("view", view);
    } else {
      params.delete("view");
    }
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const toggleFlowModal = (open: boolean) => {
    updateUrlView(open ? "flow" : null);
  };

  const toggleProspectsModal = (open: boolean) => {
    updateUrlView(open ? "contacts" : null);
  };

  const toggleSettingsModal = (open: boolean) => {
    updateUrlView(open ? "settings" : null);
  };

  const getStepLabel = (status: string) => {
    switch (status) {
      case "discovered":
      case "qualified":
        return "Step 1";
      case "contacted":
        return "Step 2";
      case "replied":
        return "Step 3";
      case "converted":
        return "End";
      default:
        return "Step 1";
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
    if (
      !confirm(t("delete_confirm_bulk", { count: ids.length }))
    )
      return;
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
    const currentList = isProspectsModalOpen
      ? displayProspects
      : initialProspects;
    if (selectedIds.length === currentList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentList.map((p: Prospect) => p.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const patchProspects = (updatedProspects: Prospect[]) => {
    if (updatedProspects.length === 0) return;
    const normalized = normalizeProspectList(updatedProspects);
    const byId = new Map(normalized.map((prospect) => [prospect.id, prospect]));

    setDisplayProspects((prev) =>
      prev.map((prospect) => {
        const updated = byId.get(prospect.id);
        return updated ? { ...prospect, ...updated } : prospect;
      }),
    );

    setSelectedProspect((prev) => {
      if (!prev) return prev;
      const updated = byId.get(prev.id);
      return updated ? ({ ...prev, ...updated } as Prospect) : prev;
    });
  };

  const handleQualify = async (ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
    if (uniqueIds.length === 0) return;

    setQualifyingIds((prev) => Array.from(new Set([...prev, ...uniqueIds])));
    try {
      const result = await qualifyProspects(uniqueIds);

      patchProspects(result.data as Prospect[]);
      setSelectedIds((prev) => prev.filter((id) => !uniqueIds.includes(id)));

      if (result.errors.length > 0) {
        alert(result.errors.map((item) => item.error).join("\n"));
      }

      router.refresh();
    } catch (error: any) {
      alert(error?.message || "Erreur lors de la qualification");
    } finally {
      setQualifyingIds((prev) => prev.filter((id) => !uniqueIds.includes(id)));
    }
  };

  const handleSequenceDecision = async (
    prospectId: string,
    decision: SequenceDecision,
  ) => {
    if (sequenceDecisionIds.includes(prospectId)) return;

    if (
      decision === "removed" &&
      !confirm(t("remove_confirm"))
    ) {
      return;
    }

    setSequenceDecisionIds((prev) =>
      Array.from(new Set([...prev, prospectId])),
    );

    try {
      const result = await setProspectSequenceDecision(prospectId, decision);

      if (!result.success) {
        alert(result.error || "Erreur lors de la mise à jour de la séquence");
        return;
      }

      if (result.removed) {
        setDisplayProspects((prev) =>
          prev.filter((prospect) => prospect.id !== prospectId),
        );
        setSelectedIds((prev) => prev.filter((id) => id !== prospectId));
        setSelectedProspect((prev) => (prev?.id === prospectId ? null : prev));
      } else if (result.data) {
        patchProspects([result.data as Prospect]);
      }

      router.refresh();
    } catch (error: any) {
      alert(error?.message || "Erreur lors de la mise à jour de la séquence");
    } finally {
      setSequenceDecisionIds((prev) => prev.filter((id) => id !== prospectId));
    }
  };

  const [allCampaigns, setAllCampaigns] = useState<Campaign[]>([]);
  const [isTransferring, setIsTransferring] = useState(false);
  const [selectedMembership, setSelectedMembership] = useState<{
    campaigns: Record<string, string[]>;
    lists: Record<string, string[]>;
  }>({ campaigns: {}, lists: {} });

  useEffect(() => {
    // On charge les campagnes et listes au montage pour la bulle d'actions
    getOrganizationCampaigns().then((res) => {
      if (res.data) setAllCampaigns(res.data);
    });
    getContactLists().then((res) => {
      if (res.data) setContactLists(res.data);
    });
  }, []);

  useEffect(() => {
    if (isProspectsModalOpen) {
      getOrganizationCampaigns().then((res) => {
        if (res.data) setAllCampaigns(res.data);
      });
      getContactLists().then((res) => {
        if (res.data) setContactLists(res.data);
      });
    }
  }, [isProspectsModalOpen]);

  useEffect(() => {
    if (selectedIds.length > 0) {
      getProspectsMembership(selectedIds).then(setSelectedMembership);
    } else {
      setSelectedMembership({ campaigns: {}, lists: {} });
    }
  }, [selectedIds]);

  const handleMoveToCampaign = async (targetId: string) => {
    if (selectedIds.length === 0) return;
    setIsTransferring(true);
    try {
      const res = await moveProspectsToCampaign(selectedIds, targetId);
      if (res.success) {
        setSelectedIds([]);
        router.refresh();
      } else {
        alert(res.error);
      }
    } catch (err: any) {
      alert(err.message || "Erreur lors du transfert");
    } finally {
      setIsTransferring(false);
    }
  };

  const handleAddToList = async (listId: string) => {
    if (selectedIds.length === 0) return;
    setIsTransferring(true);
    try {
      const res = await addProspectsToList(selectedIds, listId);
      if (res.success) {
        setSelectedIds([]);
        router.refresh();
      } else {
        alert(res.error);
      }
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'ajout");
    } finally {
      setIsTransferring(false);
    }
  };

  const handleRemoveFromCampaignByIds = async (ids: string[]) => {
    if (ids.length === 0) return;
    setIsTransferring(true);
    try {
      const { removeFromCampaign } = await import("@/lib/flows/actions");
      const res = await removeFromCampaign(ids);
      if (res.success) {
        setSelectedIds([]);
        router.refresh();
      } else {
        alert(res.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleRemoveFromListByIds = async (ids: string[], listId: string) => {
    if (ids.length === 0) return;
    setIsTransferring(true);
    try {
      const { removeFromList } = await import("@/lib/flows/actions");
      const res = await removeFromList(ids, listId);
      if (res.success) {
        setSelectedIds([]);
        router.refresh();
      } else {
        alert(res.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTransferring(false);
    }
  };

  const isPaused = campaign.status === "paused";
  const extensionStats = extensionOverview?.action_stats || {};
  const runnerIsCloud = extensionOverview?.runner_type === "cloud";
  const selectedProspects = displayProspects.filter((prospect) =>
    selectedIds.includes(prospect.id),
  );
  const hasSelectedQualifiableProspects = selectedProspects.some(
    (prospect) => !isProspectQualificationDone(prospect),
  );

  return (
    <div className="flex flex-col w-full bg-black text-white font-sans">
      <TopLine />

      {/* DASHBOARD CONTENT */}
      <div className="p-8 w-full space-y-20">
        <motion.section {...fade} className="ml-0 max-w-6xl">
          <div className="flex flex-wrap items-end gap-x-12 gap-y-9 md:gap-x-16">
            {[
              [t("total_prospects"), initialProspects.length],
              [t("status"), tProspecting(`status_${campaign.status}`) || campaign.status],
            ].map(([label, value], index) => (
              <div key={label}>
                <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/34">
                  {label}
                </p>
                <p className="text-5xl font-semibold leading-none tracking-normal text-white md:text-7xl">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </motion.section>

        <div className="flex flex-col gap-16 lg:flex-row lg:items-start lg:gap-20">
          <motion.section
            {...fade}
            transition={{ delay: 0.06 }}
            className="w-full pt-3 lg:w-[62%]"
          >
            <div className="flex items-center justify-between mb-8">
              <SectionHeading>{t("contacts")}</SectionHeading>
              <div className="flex items-center gap-4">
                <Button
                  onClick={toggleStatus}
                  disabled={isStatusLoading}
                  className={`h-9 gap-2 text-xs font-bold border transition-all ${isPaused ? "bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white" : "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"}`}
                >
                  {isStatusLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : isPaused ? (
                    <Play className="size-3.5" />
                  ) : (
                    <Pause className="size-3.5" />
                  )}
                  {isPaused
                    ? t("play_campaign")
                    : t("pause_campaign")}
                </Button>
                <button
                  onClick={() => toggleProspectsModal(true)}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors group/zoom"
                  title="Agrandir la liste"
                >
                  <Maximize2 className="size-4 text-white/20 group-hover/zoom:text-white transition-colors" />
                </button>
              </div>
            </div>

            <div className="divide-y divide-[#1F1F1F]">
              {displayProspects.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-white/30 italic">
                    {t("no_contact_found")}
                  </p>
                </div>
              ) : (
                displayProspects.slice(0, 6).map((p: Prospect, i: number) => {
                  const icpMeta = getIcpMeta(p);
                  const isQualifying = qualifyingIds.includes(p.id);
                  const isQualified = isProspectQualificationDone(p);
                  const isSequenceDecisionLoading =
                    sequenceDecisionIds.includes(p.id);
                  const { title, company } = getTitleAndCompany(
                    p.role,
                    p.company_name,
                  );
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedProspect(p);
                        toggleProspectsModal(true);
                      }}
                      className="group flex items-center justify-between gap-8 py-6 transition duration-300 hover:pl-3 hover:bg-white/[0.018] cursor-pointer"
                    >
                      <div className="flex items-center gap-5">
                        <ProspectAvatar
                          name={p.decision_maker || p.company_name}
                          photoUrl={p.photo_url}
                          colorIndex={i}
                          size="size-12"
                        />
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-lg font-medium text-white group-hover:text-blue-400 transition-colors truncate">
                                {p.decision_maker
                                  ? p.decision_maker
                                      .split(/[,|•]/)[0]
                                      .split(/\s-\s/)[0]
                                      .trim()
                                  : "Inconnu"}
                              </p>
                              {(p.linkedin_url || p.profile_url) && (
                                <a
                                  href={p.linkedin_url || p.profile_url || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1 rounded-md bg-[#0077b5]/10 text-[#0077b5] hover:bg-[#0077b5]/20 transition-all active:scale-90"
                                >
                                  <LinkedinIcon className="size-3" />
                                </a>
                              )}
                            </div>
                          <div className="flex flex-col mt-0.5 min-w-0">
                            <p className="text-sm text-white/40 truncate">
                              {title}
                            </p>
                            {company && (
                              <p className="text-[11px] text-white/20 truncate">
                                {company}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-8 shrink-0">
                        <div className="hidden md:flex flex-col items-center w-16">
                          <p className="text-[10px] text-white/20 uppercase tracking-widest mb-1.5 font-bold">
                            Step
                          </p>
                          <span
                            className={cn(
                              "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                              p.status === "converted"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-blue-500/10 text-blue-400 border-blue-500/20",
                            )}
                          >
                            {getStepLabel(p.status)}
                          </span>
                        </div>
                        <div className="hidden sm:flex flex-col items-center w-16">
                          <p className="text-[10px] text-white/20 uppercase tracking-widest mb-1.5 font-bold">
                            ICP
                          </p>
                          <span
                            className={cn(
                              "px-2.5 py-1 rounded-md text-[10px] font-bold border",
                              icpMeta.className,
                            )}
                          >
                            {icpMeta.shortLabel}
                          </span>
                        </div>
                        <div className="hidden xl:flex flex-col items-center w-32">
                          <p className="text-[10px] text-white/20 uppercase tracking-widest mb-1.5 font-bold">
                            Suite
                          </p>
                          <SequenceDecisionControls
                            prospect={p}
                            compact
                            isLoading={isSequenceDecisionLoading}
                            onDecision={handleSequenceDecision}
                          />
                        </div>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQualify([p.id]);
                          }}
                          disabled={isQualifying || isQualified}
                          title={
                            isQualified
                              ? "Qualification déjà effectuée"
                              : "Qualifier le prospect"
                          }
                          className={cn(
                            "size-10 rounded-full border flex items-center justify-center p-0 transition-all active:scale-90 disabled:cursor-not-allowed",
                            isQualified
                              ? "bg-white/[0.025] text-white/20 border-white/5"
                              : "bg-white/5 hover:bg-white/10 text-white border-white/10",
                          )}
                        >
                          {isQualifying ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="size-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
              {displayProspects.length > 6 && (
                <div className="py-8 text-center">
                  <button
                    onClick={() => toggleProspectsModal(true)}
                    className="text-[10px] font-bold text-white/20 hover:text-white uppercase tracking-[0.2em] transition-colors flex items-center gap-2 mx-auto"
                  >
                    {t("view_all_prospects", { count: displayProspects.length })}{" "}
                    <ChevronRight className="size-3" />
                  </button>
                </div>
              )}
            </div>
          </motion.section>

          <div className="w-full space-y-16 lg:w-[34%]">
            <motion.section
              {...fade}
              transition={{ delay: 0.1 }}
              className="pt-3"
            >
              <div className="flex items-center justify-between mb-8">
                <SectionHeading>{t("sequence")}</SectionHeading>
                <button
                  onClick={() => toggleFlowModal(true)}
                  className="text-xs font-bold text-white/40 hover:text-white transition-colors flex items-center gap-2"
                >
                  {t("edit")} <Edit2 className="size-3" />
                </button>
              </div>
              <div
                onClick={() => toggleFlowModal(true)}
                className="p-6 rounded-2xl border border-white/5 bg-white/[0.015] hover:bg-white/[0.025] transition-all group cursor-pointer relative overflow-hidden"
              >
                <div
                  className="absolute inset-0 opacity-[0.03]"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                    backgroundSize: "12px 12px",
                  }}
                />
                <div className="relative z-10">
                  {sequenceSteps && sequenceSteps.length > 0 ? (
                    <div className="space-y-4">
                      {sequenceSteps.slice(0, 4).map((step, i) => (
                        <div
                          key={`glimpse-${i}`}
                          className="flex items-center gap-4"
                        >
                          <div
                            className={`p-2 rounded-lg bg-white/5 border border-white/5 ${step.action_type === "wait" ? "text-amber-400" : "text-blue-400"}`}
                          >
                            {step.action_type === "trigger" ? (
                              <Search className="size-3.5" />
                            ) : step.action_type === "wait" ? (
                              <Clock className="size-3.5" />
                            ) : (
                              <LinkedinIcon className="size-3.5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {getActionLabel(step.name, t)}
                            </p>
                            <p className="text-[10px] text-white/30 uppercase tracking-widest mt-0.5">
                              {step.action_type}
                            </p>
                          </div>
                          {stepCounts[step.id] > 0 && (
                            <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1.5">
                              <Users className="size-2.5 text-emerald-400" />
                              <span className="text-[10px] font-black text-emerald-400">
                                {stepCounts[step.id]}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                      {sequenceSteps.length > 4 && (
                        <p className="text-[10px] text-white/20 font-bold uppercase tracking-[0.2em] text-center pt-2">
                          +{sequenceSteps.length - 4} étapes supplémentaires
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Zap className="size-8 text-white/10 mb-4" />
                      <p className="text-sm text-white/40">
                        {t("no_flow")}
                      </p>
                      <p className="text-[10px] text-white/20 uppercase tracking-widest mt-1">
                        {t("click_to_create")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.section>

            <motion.section {...fade} transition={{ delay: 0.12 }}>
              <div className="flex items-center justify-between mb-8">
                <SectionHeading>{t("integration")}</SectionHeading>
                <button
                  onClick={() => router.push("/integrations")}
                  className="text-xs font-bold text-white/40 hover:text-white transition-colors"
                >
                  {t("manage")}
                </button>
              </div>
              <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.015] space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "size-9 rounded-xl border flex items-center justify-center",
                        extensionOverview?.is_online
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                          : "bg-amber-500/10 border-amber-500/20 text-amber-400",
                      )}
                    >
                      <LinkedinIcon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">
                        {extensionOverview?.is_online
                          ? t("connected")
                          : runnerIsCloud
                            ? t("to_reconnect")
                            : t("offline")}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "size-2 rounded-full shrink-0",
                      extensionOverview?.is_online
                        ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.45)]"
                        : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.35)]",
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    [t("sent"), extensionStats.sent || 0],
                    [t("replies"), extensionStats.replies || 0],
                    [t("errors"), extensionStats.failed || 0],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-xl bg-white/[0.025] p-3"
                    >
                      <p className="text-lg font-semibold text-white leading-none">
                        {value}
                      </p>
                      <p className="mt-2 text-[9px] font-bold uppercase tracking-widest text-white/25">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>

            <motion.section {...fade} transition={{ delay: 0.14 }}>
              <div className="flex items-center justify-between mb-8">
                <SectionHeading>{t("configuration")}</SectionHeading>
                <button
                  onClick={() => toggleSettingsModal(true)}
                  className="text-xs font-bold text-white/40 hover:text-white transition-colors"
                >
                  {t("manage")}
                </button>
              </div>
              <div className="space-y-5">
                {[
                  {
                    label: t("target"),
                    value: (() => {
                      const icp = campaign.config?.target_icp;
                      const sectors = [
                        ...(icp?.sectors || []),
                        ...(icp?.industries || []),
                      ].filter((s: string) => s && s !== "N/A");
                      const personas = (campaign.config?.personas || []).filter(
                        (p: string) => p && p !== "N/A",
                      );

                      const sectorPart =
                        sectors.length > 0 ? sectors.slice(0, 1)[0] : "";
                      const personaPart =
                        personas.length > 0 ? personas.slice(0, 2).join(", ") : "";

                      if (sectorPart && personaPart) {
                        return `${sectorPart} / ${personaPart}${personas.length > 2 ? ".." : ""}`;
                      } else if (personaPart) {
                        return `${personaPart}${personas.length > 2 ? ".." : ""}`;
                      } else if (sectorPart) {
                        return `${sectorPart}${sectors.length > 1 ? ".." : ""}`;
                      }

                      const locations = (icp?.locations || []).filter(
                        (l: string) => l && l !== "N/A",
                      );
                      if (locations.length > 0) {
                        return locations.slice(0, 2).join(", ");
                      }

                      return t("no_config");
                    })(),
                  },
                  { label: t("channel"), value: "LinkedIn" },
                  {
                    label: t("pace"),
                    value: `${campaign.config?.prospection?.prospects_per_day || 20}/jour`,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between"
                  >
                    <span className="text-xs text-white/34 uppercase tracking-widest font-medium">
                      {item.label}
                    </span>
                    <span className="text-sm text-white/80 font-medium">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </motion.section>
          </div>
        </div>

        <motion.section
          {...fade}
          transition={{ delay: 0.18 }}
          className="max-w-5xl pb-20"
        >
          <SectionHeading>{t("activity")}</SectionHeading>
          <div className="relative ml-2 mt-8 space-y-7 before:absolute before:left-[4px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-[#1F1F1F]">
            {activities.length === 0 ? (
              <p className="pl-8 text-sm text-white/20 italic">
                {t("no_recent_logs")}
              </p>
            ) : (
              activities.map((act) => (
                <div
                  key={act.id}
                  className="relative flex gap-7 pl-8 transition duration-200 hover:translate-x-1"
                >
                  <span className="absolute left-0 top-2 size-2.5 rounded-full bg-white/70 ring-4 ring-black" />
                  <span className="w-16 text-sm text-white/40 tabular-nums">
                    {new Date(act.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <div className="flex-1">
                    <span className="text-sm text-white/78 font-medium">
                      {formatActivity(act)}
                    </span>
                    <p className="text-[12px] text-white/30 mt-1 leading-relaxed">
                      {act.detail ||
                        (act.type?.includes("message")
                          ? t("msg_sent_via_linkedin")
                          : t("system_action"))}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.section>
      </div>

      <AnimatePresence>
        {isProspectsModalOpen && (
          <div className="fixed inset-0 z-50 flex flex-col bg-[#050505]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative w-full h-full bg-[#050505] flex flex-col overflow-hidden"
            >
              <div className="px-6 py-3 border-b border-[#1F1F1F] flex items-center justify-between shrink-0 bg-[#080808]/50 backdrop-blur-xl relative z-[100]">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                      <User className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h2 className="text-sm font-bold text-white tracking-tight shrink-0">
                          Contacts
                        </h2>
                        <span className="text-white/20 font-light">—</span>
                        <h3 className="text-xs font-medium text-white/60 truncate max-w-[100px] lg:max-w-[150px]">
                          {campaignName}
                        </h3>
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 shrink-0">
                          <StatusDot status={campaign.status} />
                          <span className="text-[8px] text-white/40 uppercase font-bold tracking-wider">
                            {t(`status_${campaign.status}` as any)}
                          </span>
                        </div>
                      </div>
                      <p className="text-[8px] text-white/30 uppercase tracking-widest font-bold">
                        {displayProspects.length} prospects
                      </p>
                    </div>
                  </div>

                  <div className="h-6 w-px bg-[#1F1F1F] shrink-0" />

                  {/* SUB TABS */}
                  <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-[#1F1F1F] shrink-0">
                    <button
                      onClick={() => {
                        setActiveProspectTab("campaign");
                        setSelectedIds([]);
                      }}
                      className={cn(
                        "px-3 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all",
                        activeProspectTab === "campaign"
                          ? "bg-white/[0.06] text-white"
                          : "text-white/40 hover:text-white",
                      )}
                    >
                      {t("tab_campaign")}
                    </button>
                    <button
                      onClick={() => {
                        setActiveProspectTab("lists");
                        setSelectedIds([]);
                      }}
                      className={cn(
                        "px-3 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all",
                        activeProspectTab === "lists"
                          ? "bg-white/[0.06] text-white"
                          : "text-white/40 hover:text-white",
                      )}
                    >
                      {t("tab_lists")}
                    </button>
                    <button
                      onClick={() => {
                        setActiveProspectTab("all");
                        setSelectedIds([]);
                      }}
                      className={cn(
                        "px-3 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all",
                        activeProspectTab === "all"
                          ? "bg-white/[0.06] text-white"
                          : "text-white/40 hover:text-white",
                      )}
                    >
                      {t("tab_all")}
                    </button>
                  </div>

                  {activeProspectTab === "lists" && contactLists.length > 0 && (
                    <>
                      <div className="h-6 w-px bg-[#1F1F1F] shrink-0" />
                      <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-lg border border-[#1F1F1F] shrink-0">
                        <FolderOpen className="size-3 text-white/30" />
                        <select
                          value={selectedListId || ""}
                          onChange={(e) => {
                            setSelectedListId(e.target.value);
                            setSelectedIds([]);
                          }}
                          className="bg-transparent text-[9px] font-bold text-white/70 uppercase tracking-wider focus:outline-none cursor-pointer"
                        >
                          {contactLists.map((list) => (
                            <option
                              key={list.id}
                              value={list.id}
                              className="bg-[#050505]"
                            >
                              {list.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 lg:gap-3 shrink-0">
                  <div className="relative group min-w-0">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-white/20 group-focus-within:text-blue-400 transition-colors" />
                    <input
                      type="text"
                      placeholder={t("search_placeholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-black/40 border border-[#1F1F1F] rounded-lg pl-7 pr-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 w-[110px] lg:w-[150px] transition-all"
                    />
                  </div>
                  <div className="relative">
                    <Button
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                      variant="outline"
                      className={cn(
                        "border-[#1F1F1F] bg-black/40 text-white/60 hover:text-white gap-1.5 h-8 rounded-lg px-2.5 text-[9px] font-bold uppercase tracking-wider shrink-0",
                        (filterStep !== "all" ||
                          filterIcp !== "all" ||
                          filterEmail !== "all") &&
                          "text-blue-400 border-blue-500/30 bg-blue-500/5",
                      )}
                    >
                      <Filter className="size-3" />
                      <span className="hidden md:inline">{t("filters")}</span>
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
                            <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">
                              {t("advanced_filters")}
                            </h4>
                            <button
                              onClick={() => {
                                setFilterStep("all");
                                setFilterIcp("all");
                                setFilterEmail("all");
                                setSortBy("created_at");
                                setSortOrder("desc");
                              }}
                              className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-wider"
                            >
                              {t("reset")}
                            </button>
                          </div>

                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] text-white/20 uppercase tracking-widest font-bold">
                                  {t("sort_by")}
                                </label>
                                <select
                                  value={sortBy}
                                  onChange={(e) => setSortBy(e.target.value)}
                                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white focus:outline-none focus:border-blue-500/50"
                                >
                                  <option value="created_at">
                                    {t("import_date")}
                                  </option>
                                  <option value="pre_score">ICP</option>
                                  <option value="step">Step</option>
                                </select>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] text-white/20 uppercase tracking-widest font-bold">
                                  {t("order")}
                                </label>
                                <select
                                  value={sortOrder}
                                  onChange={(e) =>
                                    setSortOrder(
                                      e.target.value as "asc" | "desc",
                                    )
                                  }
                                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white focus:outline-none focus:border-blue-500/50"
                                >
                                  <option value="desc">{t("descending")}</option>
                                  <option value="asc">{t("ascending")}</option>
                                </select>
                              </div>
                            </div>

                            <div className="h-px bg-white/5 my-2" />

                            <div className="space-y-2">
                              <label className="text-[10px] text-white/20 uppercase tracking-widest font-bold">
                                Step
                              </label>
                              <select
                                value={filterStep}
                                onChange={(e) => setFilterStep(e.target.value)}
                                className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                              >
                                <option value="all">{t("all_steps")}</option>
                                <option value="Step 1">Step 1</option>
                                <option value="Step 2">Step 2</option>
                                <option value="Step 3">Step 3</option>
                                <option value="End">End</option>
                              </select>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] text-white/20 uppercase tracking-widest font-bold">
                                ICP
                              </label>
                              <select
                                value={filterIcp}
                                onChange={(e) => setFilterIcp(e.target.value)}
                                className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                              >
                                <option value="all">{t("all_levels")}</option>
                                <option value="high">{t("icp_high")}</option>
                                <option value="medium">{t("icp_medium")}</option>
                                <option value="low">{t("icp_low")}</option>
                              </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] text-white/20 uppercase tracking-widest font-bold">
                                  {t("filter_email")}
                                </label>
                                <select
                                  value={filterEmail}
                                  onChange={(e) => setFilterEmail(e.target.value)}
                                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                                >
                                  <option value="all">{t("filter_all")}</option>
                                  <option value="has">{t("has_email")}</option>
                                  <option value="no">{t("no_email")}</option>
                                </select>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <Button
                    variant="outline"
                    className="border-[#1F1F1F] bg-black/40 text-white/60 hover:text-white gap-1.5 h-8 rounded-lg px-2.5 text-[9px] font-bold uppercase tracking-wider shrink-0"
                    onClick={() => {
                      // Logic depends on activeProspectTab
                      console.log("Exporting", activeProspectTab);
                    }}
                  >
                    <Download className="size-3" />
                    <span className="hidden md:inline">{t("export")}</span>
                  </Button>
                  <div className="w-[1px] h-6 bg-[#1F1F1F] mx-1" />
                  <div className="relative">
                    <Button
                      onClick={() => setIsAddLeadsOpen(!isAddLeadsOpen)}
                      className="bg-blue-600 hover:bg-blue-500 text-white gap-1.5 h-8 rounded-lg px-3 text-[9px] font-bold uppercase tracking-wider shadow-lg shadow-blue-600/10 border-t border-blue-400/20 shrink-0"
                    >
                      <Zap className="size-3" />
                      <span className="hidden lg:inline">
                        {t("add_leads")}
                      </span>
                      <span className="lg:hidden">{t("add_btn_short")}</span>
                      <ChevronDown
                        className={cn(
                          "size-3 transition-transform",
                          isAddLeadsOpen ? "rotate-180" : "",
                        )}
                      />
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
                              <span className="text-[9px] font-bold text-white/40 uppercase tracking-[0.2em]">
                                {t("data_source")}
                              </span>
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
                    onClick={() => {
                      toggleProspectsModal(false);
                      setSelectedProspect(null);
                    }}
                    className="size-8 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/20 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all ml-2"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden flex">
                <div
                  className={`flex-1 overflow-auto p-8 ${selectedProspect ? "hidden lg:block lg:border-r lg:border-[#1F1F1F]" : ""}`}
                >
                  <div className="divide-y divide-[#1F1F1F]">
                    {isLoadingProspects ? (
                      <div className="py-20 text-center">
                        <Loader2 className="size-8 animate-spin text-blue-500 mx-auto mb-4" />
                        <p className="text-white/30 text-[10px] font-bold uppercase tracking-[0.2em]">
                          {t("loading_prospects")}
                        </p>
                      </div>
                    ) : displayProspects.length === 0 ? (
                      <div className="py-20 text-center">
                        <User className="size-8 text-white/10 mx-auto mb-4" />
                        <p className="text-white/30 text-[10px] font-bold uppercase tracking-[0.2em]">
                          {t("no_prospect_found")}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-6 px-6 py-4 bg-white/[0.02] border-b border-[#1F1F1F]">
                          <div className="flex items-center gap-4 min-w-[280px] flex-1">
                            <input
                              type="checkbox"
                              checked={
                                selectedIds.length ===
                                  displayProspects.length &&
                                displayProspects.length > 0
                              }
                              onChange={toggleSelectAll}
                              className="size-4 rounded border-[#1F1F1F] bg-black/40 text-blue-500 focus:ring-blue-500/20 cursor-pointer"
                            />
                            <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">
                              {t("contacts")}
                            </span>
                          </div>

                          <div className="flex items-center gap-8 shrink-0">
                            <div className="hidden lg:flex flex-col items-center w-20">
                              <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">
                                {t("imported_col")}
                              </span>
                            </div>
                            <div className="hidden md:flex flex-col items-center w-16">
                              <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">
                                {t("step_col")}
                              </span>
                            </div>
                            <div className="hidden sm:flex flex-col items-center w-16">
                              <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">
                                {t("icp_col")}
                              </span>
                            </div>
                            <div className="hidden xl:flex flex-col items-center w-32">
                              <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">
                                {t("suite_col")}
                              </span>
                            </div>
                            <div className="w-9 flex justify-center">
                              <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">
                                {t("actions_col")}
                              </span>
                            </div>
                          </div>
                        </div>
                        {displayProspects.map((p, i) => {
                          const isSelected = selectedIds.includes(p.id);
                          const icpMeta = getIcpMeta(p);
                          const isQualifying = qualifyingIds.includes(p.id);
                          const isQualified = isProspectQualificationDone(p);
                          const isSequenceDecisionLoading =
                            sequenceDecisionIds.includes(p.id);
                          const { title, company } = getTitleAndCompany(
                            p.role,
                            p.company_name,
                          );
                          return (
                            <div
                              key={`modal-${p.id}`}
                              onClick={() => setSelectedProspect(p)}
                              className={cn(
                                "group flex items-center justify-between gap-8 px-6 py-6 transition duration-300 hover:bg-white/[0.018] cursor-pointer border-b border-[#1F1F1F]/50 last:border-0",
                                selectedProspect?.id === p.id &&
                                  "bg-white/[0.03]",
                                isSelected && "bg-blue-500/[0.02]",
                              )}
                            >
                              <div className="flex items-center gap-5 min-w-[280px] flex-1">
                                <div
                                  className="shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSelectOne(p.id)}
                                    className="size-4 rounded border-[#1F1F1F] bg-black/40 text-blue-500 focus:ring-blue-500/20 cursor-pointer"
                                  />
                                </div>
                                <ProspectAvatar
                                  name={p.decision_maker || p.company_name}
                                  photoUrl={p.photo_url}
                                  colorIndex={i}
                                  size="size-12"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-lg font-medium text-white group-hover:text-blue-400 transition-colors truncate">
                                      {p.decision_maker
                                        ? p.decision_maker
                                            .split(/[,|•]/)[0]
                                            .split(/\s-\s/)[0]
                                            .trim()
                                        : "Inconnu"}
                                    </p>
                                    {(p.linkedin_url || p.profile_url) && (
                                      <a
                                        href={p.linkedin_url || p.profile_url || "#"}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="p-1.5 rounded-lg bg-[#0077b5]/10 text-[#0077b5] hover:bg-[#0077b5]/20 transition-all active:scale-90 flex-shrink-0"
                                      >
                                        <LinkedinIcon className="size-3.5" />
                                      </a>
                                    )}
                                  </div>
                                  <div className="flex flex-col mt-0.5 min-w-0">
                                    <p className="text-sm text-white/40 truncate">
                                      {title}
                                    </p>
                                    {company && (
                                      <p className="text-[11px] text-white/20 truncate">
                                        {company}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-8 shrink-0">
                                <div className="hidden lg:flex flex-col items-center w-20">
                                  <p className="text-[10px] text-white/20 uppercase tracking-widest mb-1.5 font-bold">
                                    {t("imported_at")}
                                  </p>
                                  <span className="text-[11px] text-white/60 font-medium tracking-tight">
                                    {p.created_at
                                      ? new Date(
                                          p.created_at,
                                        ).toLocaleDateString(undefined, {
                                          day: "2-digit",
                                          month: "2-digit",
                                        })
                                      : "—"}
                                  </span>
                                </div>
                                <div className="hidden md:flex flex-col items-center w-16">
                                  <p className="text-[10px] text-white/20 uppercase tracking-widest mb-1.5 font-bold">
                                    Step
                                  </p>
                                  <span
                                    className={cn(
                                      "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                      p.status === "converted"
                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                        : "bg-blue-500/10 text-blue-400 border-blue-500/20",
                                    )}
                                  >
                                    {getStepLabel(p.status)}
                                  </span>
                                </div>
                                <div className="hidden sm:flex flex-col items-center w-16">
                                  <p className="text-[10px] text-white/20 uppercase tracking-widest mb-1.5 font-bold">
                                    ICP
                                  </p>
                                  <span
                                    className={cn(
                                      "px-2.5 py-1 rounded-md text-[10px] font-bold border",
                                      icpMeta.className,
                                    )}
                                  >
                                    {icpMeta.shortLabel}
                                  </span>
                                </div>
                                <div className="hidden xl:flex flex-col items-center w-32">
                                  <p className="text-[10px] text-white/20 uppercase tracking-widest mb-1.5 font-bold">
                                    Suite
                                  </p>
                                  <SequenceDecisionControls
                                    prospect={p}
                                    compact
                                    isLoading={isSequenceDecisionLoading}
                                    onDecision={handleSequenceDecision}
                                  />
                                </div>
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQualify([p.id]);
                                  }}
                                  disabled={
                                    qualifyingIds.includes(p.id) || isQualified
                                  }
                                  variant="ghost"
                                  title={
                                    isQualified
                                      ? "Qualification déjà effectuée"
                                      : "Qualifier le prospect"
                                  }
                                  className={cn(
                                    "size-9 rounded-full p-0 border transition-all active:scale-90 disabled:cursor-not-allowed",
                                    isQualified
                                      ? "bg-white/[0.025] text-white/20 border-white/5"
                                      : "bg-white/5 hover:bg-white/10 text-white/40 hover:text-white border-white/5",
                                  )}
                                >
                                  {qualifyingIds.includes(p.id) ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="size-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                </div>

                {selectedProspect && (
                  <div className="w-full lg:w-[450px] xl:w-[500px] bg-[#080808] border-l border-[#1F1F1F] flex flex-col shrink-0">
                    <div className="p-6 border-b border-[#1F1F1F] flex items-center justify-between bg-[#080808] z-10 shrink-0">
                      <h3 className="text-xl font-bold tracking-tight">
                        {t("prospect_details")}
                      </h3>
                      <button
                        onClick={() => setSelectedProspect(null)}
                        className="size-8 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white transition-all shadow-lg"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
                      <div className="flex flex-col items-center text-center gap-4">
                        <div className="size-24 rounded-2xl bg-white/[0.03] flex items-center justify-center overflow-hidden border border-[#1F1F1F] shrink-0 shadow-2xl">
                          {selectedProspect.photo_url ? (
                            <img
                              src={selectedProspect.photo_url}
                              alt={selectedProspect.decision_maker}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-3xl font-bold text-white/20">
                              {selectedProspect.decision_maker?.charAt(0) ||
                                "U"}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center justify-center gap-3">
                            <h2 className="text-2xl font-bold text-white tracking-tight">
                              {selectedProspect.decision_maker || t("unknown")}
                            </h2>
                            {(selectedProspect.linkedin_url || selectedProspect.profile_url) && (
                              <a
                                href={selectedProspect.linkedin_url || selectedProspect.profile_url || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-[#0077b5]/10 text-[#0077b5] hover:bg-[#0077b5]/20 transition-all active:scale-90 flex-shrink-0"
                              >
                                <LinkedinIcon className="size-4" />
                              </a>
                            )}
                          </div>
                          {(() => {
                            const { title, company } = getTitleAndCompany(
                              selectedProspect.role,
                              selectedProspect.company_name,
                            );
                            return (
                              <div className="flex flex-col items-center mt-2">
                                <p className="text-white/60 font-medium text-lg">
                                  {title}
                                </p>
                                {company && (
                                  <p className="text-white/30 text-base mt-1">
                                    {company}
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="grid grid-cols-1">
                        <div className="p-5 rounded-xl bg-white/[0.03] border border-[#1F1F1F] flex flex-col items-center justify-center text-center">
                          <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold mb-1.5">
                            ICP
                          </p>
                          <span
                            className={cn(
                              "px-3 py-1.5 rounded-md text-[11px] font-bold border",
                              getIcpMeta(selectedProspect).className,
                            )}
                          >
                            {getIcpMeta(selectedProspect).label}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                          <CheckCircle2 className="size-3" /> {t("qualification")}
                        </h4>
                        <div className="p-6 rounded-xl bg-white/[0.03] border border-[#1F1F1F] space-y-5">
                          <div className="space-y-2">
                            <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">
                              {t("reason")}
                            </p>
                            <div className="text-[13px] text-white/60 leading-relaxed space-y-2">
                              {selectedProspect.qualification_reason &&
                                selectedProspect.qualification_reason.split('\n').map((line, idx) => (
                                  <p key={idx} className="flex gap-2">
                                    <span className="text-blue-400 mt-1 shrink-0">•</span>
                                    <span>{line.replace(/^[•\-\*]\s?/, '')}</span>
                                  </p>
                                ))
                              }
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Suite de séquence section moved here */}
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                          <Send className="size-3" /> {t("sequence_suite")}
                        </h4>
                        <div className="p-5 rounded-xl bg-white/[0.03] border border-[#1F1F1F] space-y-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-[13px] font-medium text-white/70">
                                {getSequenceDecision(selectedProspect) ===
                                "confirmed"
                                  ? t("sequence_confirmed")
                                  : getSequenceDecision(selectedProspect) ===
                                      "paused"
                                    ? t("sequence_paused")
                                    : getSequenceDecision(selectedProspect) ===
                                        "removed"
                                      ? t("removed_from_campaign")
                                      : isProspectQualificationDone(
                                            selectedProspect,
                                          )
                                        ? t("waiting_decision")
                                        : t("qualification_required")}
                              </p>
                              <p className="text-[11px] text-white/30 mt-1">
                                {t("sequence_help_text")}
                              </p>
                            </div>
                          </div>
                          <SequenceDecisionControls
                            prospect={selectedProspect}
                            isLoading={sequenceDecisionIds.includes(
                              selectedProspect.id,
                            )}
                            onDecision={handleSequenceDecision}
                            className="justify-start"
                          />
                        </div>
                      </div>

                      {/* IA Insights section moved here */}
                      {(() => {
                        const qualResult = (selectedProspect.extra_data as any)?.qualification?.result;
                        const insights = qualResult?.prospect_insights;
                        if (!insights) return null;

                        return (
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                              <Sparkles className="size-3" /> {t("ia_insights")}
                            </h4>
                            <div className="p-6 rounded-xl bg-blue-500/[0.02] border border-blue-500/10 space-y-6">
                              {insights.career_context && (
                                <div className="space-y-2">
                                  <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">
                                    {t("career_evolution")}
                                  </p>
                                  <p className="text-[13px] text-white/80 leading-relaxed italic">
                                    "{insights.career_context}"
                                  </p>
                                </div>
                              )}

                              {insights.suggested_opening && (
                                <div className="space-y-2">
                                  <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">
                                    {t("suggested_opening")}
                                  </p>
                                  <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5">
                                    <p className="text-[13px] text-blue-400/80 leading-relaxed font-medium">
                                      {insights.suggested_opening}
                                    </p>
                                  </div>
                                </div>
                              )}

                              {insights.personalization_hooks?.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">
                                    {t("personalization_hooks")}
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {insights.personalization_hooks.map((hook: string, i: number) => (
                                      <span key={i} className="px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/10 text-[10px] text-white/60 font-medium">
                                        {hook}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Company Description section moved here */}
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] px-1">
                          {t("description_label")}
                        </h4>
                        <div className="p-6 rounded-xl bg-white/[0.03] border border-[#1F1F1F]">
                          <p className="text-[13px] text-white/50 leading-relaxed italic">
                            {getProspectCompanyDescription(selectedProspect)
                              ? `"${getProspectCompanyDescription(selectedProspect)}"`
                              : t("no_description")}
                          </p>
                        </div>
                      </div>

                      {/* Basic Information Section */}
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                          <Info className="size-3" /> {t("basic_information")}
                        </h4>
                        <div className="p-6 rounded-xl bg-white/[0.03] border border-[#1F1F1F] space-y-6">
                          <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                            <div className="space-y-1.5">
                              <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">
                                {t("industry")}
                              </p>
                              <div className="flex items-center gap-2 text-[13px] text-white/70">
                                <Building2 className="size-3.5 text-white/20 shrink-0" />
                                <span className="truncate">
                                  {getProspectIndustry(selectedProspect) ||
                                    "N/A"}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">
                                {t("size")}
                              </p>
                              <div className="flex items-center gap-2 text-[13px] text-white/70">
                                <Users className="size-3.5 text-white/20 shrink-0" />
                                <span className="truncate">
                                  {getProspectCompanySize(selectedProspect) ||
                                    "N/A"}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">
                                {t("location_label")}
                              </p>
                              <div className="flex items-center gap-2 text-[13px] text-white/70">
                                <MapPin className="size-3.5 text-white/20 shrink-0" />
                                <span className="truncate">
                                  {getProspectLocation(selectedProspect) ||
                                    "N/A"}
                                </span>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">
                                {t("website_label")}
                              </p>
                              <div className="flex items-center gap-2 text-[13px] text-white/70 overflow-hidden">
                                <Globe className="size-3.5 text-white/20 shrink-0" />
                                {getProspectWebsite(selectedProspect) ? (
                                  <a
                                    href={
                                      getProspectWebsite(
                                        selectedProspect,
                                      )!.startsWith("http")
                                        ? getProspectWebsite(selectedProspect)!
                                        : `https://${getProspectWebsite(selectedProspect)!}`
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-400 hover:text-blue-300 transition-colors truncate"
                                  >
                                    {getProspectWebsite(
                                      selectedProspect,
                                    )!.replace(/^https?:\/\//, "")}
                                  </a>
                                ) : (
                                  "N/A"
                                )}
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">
                                {t("imported_at")}
                              </p>
                              <div className="flex items-center gap-2 text-[13px] text-white/70">
                                <Clock className="size-3.5 text-white/20 shrink-0" />
                                <span>
                                  {selectedProspect.created_at
                                    ? new Date(
                                        selectedProspect.created_at,
                                      ).toLocaleDateString(undefined, {
                                        day: "2-digit",
                                        month: "long",
                                        year: "numeric",
                                      })
                                    : "—"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="pt-5 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5 overflow-hidden">
                              <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">
                                {t("email_detected")}
                              </p>
                              <div className="flex items-center gap-2 text-[13px] text-white/70 overflow-hidden">
                                <Mail className="size-3.5 text-white/20 shrink-0" />
                                {selectedProspect.email ? (
                                  <a
                                    href={`mailto:${selectedProspect.email}`}
                                    className="text-blue-400 hover:text-blue-300 transition-colors truncate"
                                  >
                                    {selectedProspect.email}
                                  </a>
                                ) : (
                                  "N/A"
                                )}
                              </div>
                            </div>
                            <div className="space-y-1.5 overflow-hidden">
                              <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">
                                {t("phone_detected")}
                              </p>
                              <div className="flex items-center gap-2 text-[13px] text-white/70 overflow-hidden">
                                <Phone className="size-3.5 text-white/20 shrink-0" />
                                {selectedProspect.phone ? (
                                  <a
                                    href={`tel:${selectedProspect.phone}`}
                                    className="text-blue-400 hover:text-blue-300 transition-colors truncate"
                                  >
                                    {selectedProspect.phone}
                                  </a>
                                ) : (
                                  "N/A"
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="pt-5 border-t border-white/5 space-y-2 overflow-hidden">
                            <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">
                              {t("company_linkedin")}
                            </p>
                            <div className="flex items-center gap-2 text-[13px] text-white/70">
                              <Link className="size-3.5 text-white/20 shrink-0" />
                              {getProspectCompanyLinkedin(selectedProspect) ? (
                                <a
                                  href={
                                    getProspectCompanyLinkedin(
                                      selectedProspect,
                                    )!
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-400 hover:text-blue-300 transition-colors truncate flex items-center gap-1.5"
                                >
                                  {t("company_link")}{" "}
                                  <ExternalLink className="size-3" />
                                </a>
                              ) : (
                                "N/A"
                              )}
                            </div>
                          </div>
                        </div>
                      </div>



                      {/* Experience Section */}
                      {(() => {
                        const rawExp = selectedProspect.raw_data?.experience || selectedProspect.extra_data?.experience;
                        if (!Array.isArray(rawExp) || rawExp.length === 0) return null;

                        return (
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                              <Briefcase className="size-3" /> {t("experience_label")}
                            </h4>
                            <div className="space-y-3">
                              {rawExp.map((exp: any, i: number) => (
                                <div key={i} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                                  <div className="flex justify-between items-start gap-4">
                                    <p className="text-[13px] font-bold text-white/90">
                                      {exp.title || exp.role}
                                    </p>
                                    <span className="text-[10px] font-medium text-white/30 shrink-0">
                                      {exp.duration || exp.time}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-white/50">
                                    {exp.company || exp.companyName}
                                  </p>
                                  {exp.description && (
                                    <p className="text-[11px] text-white/30 leading-relaxed mt-2 line-clamp-3">
                                      {exp.description}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Sticky Footer Action */}
                    <div className="p-6 border-t border-[#1F1F1F] bg-[#080808]/80 backdrop-blur-xl shrink-0">
                      <Button
                        onClick={() => handleQualify([selectedProspect.id])}
                        disabled={
                          qualifyingIds.includes(selectedProspect.id) ||
                          isProspectQualificationDone(selectedProspect)
                        }
                        className={cn(
                          "w-full h-12 rounded-xl gap-3 font-bold text-base transition-all active:scale-95 disabled:cursor-not-allowed",
                          isProspectQualificationDone(selectedProspect)
                            ? "bg-white/[0.04] text-white/30 border border-white/5"
                            : "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.2)]",
                        )}
                      >
                        {qualifyingIds.includes(selectedProspect.id) ? (
                          <Loader2 className="size-5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-5" />
                        )}
                        {isProspectQualificationDone(selectedProspect)
                          ? t("prospect_qualified")
                          : t("qualify_prospect")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {isFlowModalOpen && (
          <SequenceBuilderModal
            campaignId={campaign.id}
            onClose={() => toggleFlowModal(false)}
            initialSteps={sequenceSteps || []}
            prospects={initialProspects}
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
        {isCsvModalOpen && (
          <CsvImportModal
            onClose={() => setIsCsvModalOpen(false)}
            campaignId={campaign.id}
            listId={selectedListId}
          />
        )}
      </AnimatePresence>

      {/* FLOATING ACTION BAR */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0, x: "-50%" }}
            animate={{ y: 0, opacity: 1, x: "-50%" }}
            exit={{ y: 100, opacity: 0, x: "-50%" }}
            className="fixed bottom-8 left-1/2 z-[200] flex items-center gap-2 p-2 bg-[#0A0A0A]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl"
          >
            <div className="flex items-center gap-3 pr-6 border-r border-white/5">
              <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold text-xs">
                {selectedIds.length}
              </div>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                {t("selected_n", { n: selectedIds.length })}
              </p>
            </div>

            <div className="flex items-center gap-2 pl-3">
              <Button
                onClick={() =>
                  handleQualify(
                    selectedProspects
                      .filter(
                        (prospect) => !isProspectQualificationDone(prospect),
                      )
                      .map((prospect) => prospect.id),
                  )
                }
                disabled={
                  selectedIds.some((id) => qualifyingIds.includes(id)) ||
                  !hasSelectedQualifiableProspects
                }
                variant="ghost"
                className={cn(
                  "h-9 gap-2 text-[10px] font-bold uppercase tracking-widest disabled:cursor-not-allowed",
                  hasSelectedQualifiableProspects
                    ? "text-blue-400 hover:text-blue-300 hover:bg-blue-500/5"
                    : "text-white/20",
                )}
              >
                {selectedIds.some((id) => qualifyingIds.includes(id)) ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-3.5" />
                )}
                {t("qualify")}
              </Button>

              <div className="relative group/menu">
                <Button
                  variant="ghost"
                  className="h-9 gap-2 text-[10px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/5"
                >
                  <ArrowRightLeft className="size-3.5" />
                  {t("transfer")}
                </Button>
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#0A0A0A] border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all p-2 max-h-80 overflow-y-auto">
                  <p className="px-3 py-2 text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] border-b border-white/5 mb-1">
                    {t("to_campaign")}
                  </p>
                  {allCampaigns.length > 0 ? (
                    allCampaigns.map((c) => {
                      const members = selectedMembership.campaigns[c.id] || [];
                      const countIn = selectedIds.filter((id) =>
                        members.includes(id),
                      ).length;
                      const isAllIn = countIn === selectedIds.length;
                      const isCurrent = c.id === campaign.id;

                      return (
                        <button
                          key={c.id}
                          disabled={isAllIn || isTransferring}
                          onClick={() => handleMoveToCampaign(c.id)}
                          className={cn(
                            "w-full px-3 py-2 rounded-lg text-left text-[11px] font-medium transition-colors flex items-center justify-between",
                            isAllIn
                              ? "text-white/20 cursor-not-allowed bg-white/[0.02]"
                              : "text-white/60 hover:text-white hover:bg-white/5",
                          )}
                        >
                          <span className="truncate mr-2">
                            {c.display_name}
                          </span>
                          {isCurrent ? (
                            <span className="text-[8px] opacity-40 shrink-0">
                              {t("current_label")}
                            </span>
                          ) : isAllIn ? (
                            <span className="text-[8px] opacity-40 shrink-0">
                              (Tous présents)
                            </span>
                          ) : countIn > 0 ? (
                            <span className="text-[8px] text-blue-400 shrink-0">
                              ({countIn} déjà)
                            </span>
                          ) : null}
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-3 py-4 text-center">
                      <p className="text-[10px] text-white/20 italic">
                        Aucune campagne active
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="relative group/menu">
                <Button
                  variant="ghost"
                  className="h-9 gap-2 text-[10px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/5"
                >
                  <CopyPlus className="size-3.5" />
                  Ajouter à
                </Button>
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#0A0A0A] border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all p-2 max-h-80 overflow-y-auto">
                  <p className="px-3 py-2 text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] border-b border-white/5 mb-1">
                    Vers une liste
                  </p>
                  {contactLists.length > 0 ? (
                    contactLists.map((l) => {
                      const members = selectedMembership.lists[l.id] || [];
                      const countIn = selectedIds.filter((id) =>
                        members.includes(id),
                      ).length;
                      const isAllIn = countIn === selectedIds.length;

                      return (
                        <button
                          key={l.id}
                          disabled={isAllIn || isTransferring}
                          onClick={() => handleAddToList(l.id)}
                          className={cn(
                            "w-full px-3 py-2 rounded-lg text-left text-[11px] font-medium transition-colors flex items-center justify-between",
                            isAllIn
                              ? "text-white/20 cursor-not-allowed bg-white/[0.02]"
                              : "text-white/60 hover:text-white hover:bg-white/5",
                          )}
                        >
                          <span className="truncate mr-2">{l.name}</span>
                          {isAllIn ? (
                            <span className="text-[8px] opacity-40 shrink-0">
                              (Tous présents)
                            </span>
                          ) : countIn > 0 ? (
                            <span className="text-[8px] text-blue-400 shrink-0">
                              ({countIn} déjà)
                            </span>
                          ) : null}
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-3 py-4 text-center">
                      <p className="text-[10px] text-white/20 italic">
                        Aucune liste trouvée
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="relative group/menu">
                <Button
                  variant="ghost"
                  className="h-9 gap-2 text-[10px] font-bold uppercase tracking-widest text-red-400/60 hover:text-red-400 hover:bg-red-500/5"
                >
                  <XCircle className="size-3.5" />
                  Retirer
                </Button>
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#0A0A0A] border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all p-2 max-h-80 overflow-y-auto">
                  <p className="px-3 py-2 text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] border-b border-white/5 mb-1">
                    Retirer de...
                  </p>

                  <p className="px-3 py-2 text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] mb-1">
                    Des campagnes
                  </p>

                  {allCampaigns.map((c) => {
                    const members = selectedMembership.campaigns[c.id] || [];
                    const countIn = selectedIds.filter((id) =>
                      members.includes(id),
                    ).length;
                    if (countIn === 0) return null;

                    return (
                      <button
                        key={c.id}
                        disabled={isTransferring}
                        onClick={async () => {
                          if (
                            confirm(
                              `Retirer ${countIn} prospect(s) de la campagne "${c.display_name}" ?`,
                            )
                          ) {
                            await handleRemoveFromCampaignByIds(
                              selectedIds.filter((id) => members.includes(id)),
                            );
                          }
                        }}
                        className="w-full px-3 py-2 rounded-lg text-left text-[11px] font-medium text-white/60 hover:text-red-400 hover:bg-red-500/5 transition-colors flex items-center justify-between"
                      >
                        <span className="truncate mr-2">{c.display_name}</span>
                        <span className="text-[8px] opacity-40 shrink-0">
                          ({countIn} présents)
                        </span>
                      </button>
                    );
                  })}

                  <div className="h-px bg-white/5 my-1" />
                  <p className="px-3 py-2 text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] mb-1">
                    Des listes
                  </p>

                  {contactLists.map((l) => {
                    const members = selectedMembership.lists[l.id] || [];
                    const countIn = selectedIds.filter((id) =>
                      members.includes(id),
                    ).length;
                    if (countIn === 0) return null;

                    return (
                      <button
                        key={l.id}
                        disabled={isTransferring}
                        onClick={async () => {
                          if (
                            confirm(
                              `Retirer ${countIn} prospect(s) de la liste "${l.name}" ?`,
                            )
                          ) {
                            await handleRemoveFromListByIds(
                              selectedIds.filter((id) => members.includes(id)),
                              l.id,
                            );
                          }
                        }}
                        className="w-full px-3 py-2 rounded-lg text-left text-[11px] font-medium text-white/60 hover:text-red-400 hover:bg-red-500/5 transition-colors flex items-center justify-between"
                      >
                        <span className="truncate mr-2">{l.name}</span>
                        <span className="text-[8px] opacity-40 shrink-0">
                          ({countIn} présents)
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button
                onClick={() => handleDelete(selectedIds)}
                disabled={isDeleting}
                variant="ghost"
                className="h-9 gap-2 text-[10px] font-bold uppercase tracking-widest text-red-500/60 hover:text-red-400 hover:bg-red-500/5"
              >
                {isDeleting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                Supprimer
              </Button>

              <div className="w-[1px] h-4 bg-white/5 mx-2" />

              <Button
                onClick={() => setSelectedIds([])}
                variant="ghost"
                className="h-9 px-4 text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white"
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

function LinkedInExtensionModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
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
                    <h2 className="text-xl font-bold text-white tracking-tight">
                      Extension LinkedIn Verytis
                    </h2>
                    <p className="text-sm text-white/40 mt-1">
                      Prospectez directement depuis le réseau n°1
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/5 rounded-xl transition-colors text-white/20 hover:text-white"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="space-y-6 mb-10">
                <div className="flex gap-4">
                  <div className="size-6 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center shrink-0 border border-blue-500/20">
                    1
                  </div>
                  <div>
                    <h4 className="text-[13px] font-bold text-white mb-1">
                      Installez l'extension
                    </h4>
                    <p className="text-[12px] text-white/40 leading-relaxed">
                      Téléchargez l'extension Verytis Pro sur le Chrome Web
                      Store pour commencer le scraping.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="size-6 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center shrink-0 border border-blue-500/20">
                    2
                  </div>
                  <div>
                    <h4 className="text-[13px] font-bold text-white mb-1">
                      Activez "Verytis Pro"
                    </h4>
                    <p className="text-[12px] text-white/40 leading-relaxed">
                      Une bulle flottante apparaîtra sur LinkedIn.
                      Connectez-vous avec votre identifiant client.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="size-6 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center shrink-0 border border-blue-500/20">
                    3
                  </div>
                  <div>
                    <h4 className="text-[13px] font-bold text-white mb-1">
                      Scrapez en un clic
                    </h4>
                    <p className="text-[12px] text-white/40 leading-relaxed">
                      Allez sur n'importe quel profil, recherche ou post et
                      cliquez sur "Ajouter à la campagne".
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={() => router.push("/integrations")}
                  variant="outline"
                  className="h-12 rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10 font-bold gap-2"
                >
                  <Settings className="size-4" /> Voir l'Intégration
                </Button>
                <Button
                  onClick={() => window.open("https://linkedin.com", "_blank")}
                  className="h-12 rounded-2xl bg-[#0077b5] hover:bg-[#0077b5]/90 text-white font-bold gap-2"
                >
                  <ExternalLink className="size-4" /> Ouvrir LinkedIn
                </Button>
              </div>
            </div>

            <div className="bg-[#0077b5]/5 border-t border-white/5 p-4 text-center">
              <p className="text-[10px] text-[#0077b5] font-bold uppercase tracking-widest">
                L'IA s'occupe de l'enrichissement automatiquement
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
