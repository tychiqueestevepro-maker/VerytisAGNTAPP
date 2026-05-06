"use client";

import { useState, useEffect } from "react";
import { 
  Search, 
  Filter, 
  Download, 
  Zap, 
  User, 
  Loader2, 
  X,
  CheckCircle2,
  MoreHorizontal,
  ChevronDown,
  ArrowRight,
  Pause,
  XCircle,
  ExternalLink,
  Settings,
  Mail,
  Phone,
  Clock,
  MapPin,
  Globe,
  Info,
  Building2,
  Users,
  Send,
  Save,
  Trash2,
  Plus,
  PlusCircle,
  Linkedin as LinkedinLucide
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  getOrganizationProspects, 
  getContactLists, 
  getProspectsByList,
  setProspectSequenceDecision,
  updateProspectPersonalization,
  qualifyProspects,
  deleteContactList,
  createContactList
} from "@/lib/flows/actions";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  ProspectAvatar, 
  getTitleAndCompany, 
  getStepLabel,
  getProspectIndustry,
  getProspectCompanySize,
  getProspectWebsite,
  getProspectCompanyDescription,
  getIcpMeta,
  isProspectQualificationDone
} from "./prospect-shared";
import { LinkedinIcon } from "@/components/layout/custom-icons";
import { CsvImportModal } from "./csv-import-modal";

export function ProspectsFullTable() {
  const t = useTranslations("Cockpit");
  const router = useRouter();
  
  const [prospects, setProspects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "lists">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [contactLists, setContactLists] = useState<any[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<any | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [qualifyingIds, setQualifyingIds] = useState<string[]>([]);
  const [sequenceDecisionIds, setSequenceDecisionIds] = useState<string[]>([]);

  const searchParams = useSearchParams();
  const listParam = searchParams.get("list");

  useEffect(() => {
    if (listParam) {
      setSelectedListId(listParam);
      setActiveTab("lists");
    } else {
      setSelectedListId(null);
    }
  }, [listParam]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (activeTab === "all") {
          const { data } = await getOrganizationProspects();
          if (data) setProspects(data);
        } else {
          const { data: lists } = await getContactLists();
          if (lists) {
            setContactLists(lists);
          }
          if (selectedListId) {
            const { data: listProspects } = await getProspectsByList(selectedListId);
            if (listProspects) setProspects(listProspects);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [activeTab, selectedListId]);

  const handleListSelect = (id: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) {
      params.set("list", id);
    } else {
      params.delete("list");
    }
    router.push(`?${params.toString()}`);
  };

  const filteredProspects = prospects.filter(p => {
    const matchesSearch = !searchQuery || 
      p.decision_maker?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.company_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProspects.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProspects.map(p => p.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(x => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleQualify = async (ids: string[]) => {
    if (ids.length === 0) return;
    setQualifyingIds(prev => [...prev, ...ids]);
    try {
      await qualifyProspects(ids);
      // Refresh local data
      const { data } = await getOrganizationProspects();
      if (data) setProspects(data);
    } finally {
      setQualifyingIds(prev => prev.filter(id => !ids.includes(id)));
    }
  };

  const handleSequenceDecision = async (prospectId: string, decision: string) => {
    setSequenceDecisionIds(prev => [...prev, prospectId]);
    try {
      await setProspectSequenceDecision(prospectId, decision as any);
      // Update local state
      setProspects(prev => prev.map(p => p.id === prospectId ? { ...p, extra_data: { ...p.extra_data, sequence_decision: decision } } : p));
    } finally {
      setSequenceDecisionIds(prev => prev.filter(id => id !== prospectId));
    }
  };


  return (
    <div className="flex flex-col h-full bg-black relative overflow-hidden">
      {/* HEADER */}
      <div className="px-8 py-6 border-b border-[#1F1F1F] flex items-center justify-between bg-[#080808]/50 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Users className="size-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Base Contacts</h1>
              <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold">
                {filteredProspects.length} prospects au total
              </p>
            </div>
          </div>

          <div className="h-8 w-px bg-white/5 mx-2" />

          {/* TABS */}
          <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setActiveTab("all")}
              className={cn(
                "px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                activeTab === "all" ? "bg-white/[0.08] text-white" : "text-white/40 hover:text-white"
              )}
            >
              Tous les prospects
            </button>
            <button
              onClick={() => {
                setActiveTab("lists");
                handleListSelect(null);
              }}
              className={cn(
                "px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                activeTab === "lists" ? "bg-white/[0.08] text-white" : "text-white/40 hover:text-white"
              )}
            >
              Par listes
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/20 group-focus-within:text-blue-400 transition-colors" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-black/40 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 w-64 transition-all"
            />
          </div>
          
          <Button 
            onClick={() => setIsImportModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white h-11 rounded-xl px-6 font-bold uppercase text-[10px] tracking-wider shadow-lg shadow-blue-600/20"
          >
            <Zap className="size-4 mr-2" /> Ajouter des leads
          </Button>

          {activeTab === "lists" && (
            <Button 
              onClick={async () => {
                const name = prompt("Nom de la nouvelle liste :");
                if (name) {
                  const res = await createContactList(name);
                  if (res.success) {
                    const { data: lists } = await getContactLists();
                    if (lists) setContactLists(lists);
                  }
                }
              }}
              variant="outline"
              className="border-white/10 text-white/70 hover:bg-white/5 h-11 rounded-xl px-6 font-bold uppercase text-[10px] tracking-wider"
            >
              <Plus className="size-4 mr-2" /> Créer une liste
            </Button>
          )}
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex overflow-hidden">
        {/* TABLE SECTION */}
        <div className={cn("flex-1 overflow-auto p-0", selectedProspect && "hidden lg:block lg:border-r lg:border-[#1F1F1F]")}>
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center">
              <Loader2 className="size-10 animate-spin text-blue-500 mb-4" />
              <p className="text-white/20 font-bold uppercase tracking-[0.2em] text-[10px]">Chargement de la base...</p>
            </div>
          ) : activeTab === "lists" && !selectedListId ? (
            <div className="flex-1 overflow-auto">
              <div className="divide-y divide-[#1F1F1F]">
                {contactLists.map((list) => (
                  <div
                    key={list.id}
                    onClick={() => handleListSelect(list.id)}
                    className="group flex items-center justify-between px-8 py-5 hover:bg-white/[0.02] transition-all cursor-pointer border-b border-[#1F1F1F]/50 last:border-0"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 rounded-xl bg-white/[0.03] text-white/20 group-hover:bg-blue-500/10 group-hover:text-blue-400 transition-colors">
                        <Users className="size-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                          {list.name}
                        </h3>
                        <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest mt-0.5">
                          Créée le {new Date(list.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm("Supprimer cette liste ? Les contacts ne seront pas supprimés de la base.")) {
                            await deleteContactList(list.id);
                            setContactLists(prev => prev.filter(l => l.id !== list.id));
                          }
                        }}
                        className="p-2 rounded-lg bg-white/0 hover:bg-red-500/10 text-white/10 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                        title="Supprimer la liste"
                      >
                        <Trash2 className="size-4" />
                      </button>
                      <ArrowRight className="size-4 text-white/10 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : filteredProspects.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-30">
              <User className="size-16 mb-4" />
              <p className="font-bold uppercase tracking-[0.2em] text-xs">Aucun prospect trouvé</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1F1F1F]">
              {/* TABLE HEADER */}
              <div className="flex items-center gap-6 px-8 py-4 bg-white/[0.02] border-b border-[#1F1F1F] sticky top-0 z-20 backdrop-blur-md">
                {activeTab === "lists" && selectedListId && (
                  <button 
                    onClick={() => handleListSelect(null)}
                    className="flex items-center gap-2 mr-4 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all text-[10px] font-bold uppercase tracking-wider"
                  >
                    <ArrowRight className="size-3 rotate-180" /> Retour
                  </button>
                )}
                <div className="flex items-center gap-5 min-w-[280px] flex-1">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredProspects.length && filteredProspects.length > 0}
                    onChange={toggleSelectAll}
                    className="size-4 rounded border-[#1F1F1F] bg-black/40 text-blue-500 focus:ring-blue-500/20 cursor-pointer"
                  />
                  <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Prospects</span>
                </div>
                <div className="flex items-center gap-8 shrink-0">
                  <div className="hidden lg:flex flex-col items-center w-28">
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Email</span>
                  </div>
                  <div className="hidden md:flex flex-col items-center w-24">
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Téléphone</span>
                  </div>
                  <div className="w-20 flex justify-center">
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Importé</span>
                  </div>
                </div>
              </div>

              {/* TABLE BODY */}
              {filteredProspects.map((p, i) => {
                const isSelected = selectedIds.includes(p.id);
                const { title, company } = getTitleAndCompany(p.role, p.company_name);
                
                return (
                  <div 
                    key={p.id} 
                    onClick={() => setSelectedProspect(p)}
                    className={cn(
                      "group flex items-center justify-between gap-8 px-8 py-6 transition duration-300 hover:bg-white/[0.018] cursor-pointer border-b border-[#1F1F1F]/50 last:border-0",
                      selectedProspect?.id === p.id && "bg-white/[0.03]",
                      isSelected && "bg-blue-500/[0.02]"
                    )}
                  >
                    <div className="flex items-center gap-5 min-w-[280px] flex-1">
                      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
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
                            {p.decision_maker || "Inconnu"}
                          </p>
                          {(p.linkedin_url || p.profile_url) && (
                            <a 
                              href={p.linkedin_url || p.profile_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 rounded-lg bg-[#0077b5]/10 text-[#0077b5] hover:bg-[#0077b5]/20 transition-all"
                            >
                              <LinkedinIcon className="size-3.5" />
                            </a>
                          )}
                        </div>
                        <div className="flex flex-col mt-0.5 min-w-0">
                          <p className="text-sm text-white/40 truncate">{title}</p>
                          {company && <p className="text-[11px] text-white/20 truncate">{company}</p>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-8 shrink-0">
                      <div className="hidden lg:flex flex-col items-center w-28">
                        <span className="text-[11px] text-white/40 truncate max-w-[110px]">
                          {p.email || "—"}
                        </span>
                      </div>
                      <div className="hidden md:flex flex-col items-center w-24">
                        <span className="text-[11px] text-white/40 truncate">
                          {p.phone || "—"}
                        </span>
                      </div>
                      <div className="w-20 flex flex-col items-center">
                        <span className="text-[11px] text-white/60 font-medium tracking-tight">
                          {p.created_at ? new Date(p.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* DETAILS PANEL (MATCHING DASHBOARD) */}
        <AnimatePresence>
          {selectedProspect && (
            <motion.div 
              initial={{ x: 500, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 500, opacity: 0 }}
              className="w-full lg:w-[450px] xl:w-[500px] bg-[#080808] border-l border-[#1F1F1F] flex flex-col shrink-0 z-30"
            >
              <div className="p-6 border-b border-[#1F1F1F] flex items-center justify-between bg-[#080808] shrink-0">
                <h3 className="text-xl font-bold tracking-tight">Détails Prospect</h3>
                <button 
                  onClick={() => setSelectedProspect(null)}
                  className="size-8 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white transition-all shadow-lg"
                >
                  <X className="size-4" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* Header Profile */}
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="size-24 rounded-2xl bg-white/[0.03] flex items-center justify-center overflow-hidden border border-[#1F1F1F] shrink-0 shadow-2xl">
                    {selectedProspect.photo_url ? (
                      <img src={selectedProspect.photo_url} alt={selectedProspect.decision_maker} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl font-bold text-white/20">{selectedProspect.decision_maker?.[0] || "?"}</span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">{selectedProspect.decision_maker || "Inconnu"}</h2>
                    <p className="text-white/60 font-medium text-lg mt-1">{selectedProspect.role}</p>
                    <p className="text-white/20 text-sm">{selectedProspect.company_name}</p>
                  </div>
                </div>

                {/* Score Badges */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 rounded-xl bg-white/[0.03] border border-[#1F1F1F] flex flex-col items-center justify-center text-center">
                    <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold mb-1.5">Score ICP</p>
                    <span className={cn("px-3 py-1.5 rounded-md text-[11px] font-bold border", getIcpMeta(selectedProspect).className)}>
                      {getIcpMeta(selectedProspect).shortLabel}
                    </span>
                  </div>
                  <div className="p-5 rounded-xl bg-white/[0.03] border border-[#1F1F1F] flex flex-col items-center justify-center text-center">
                    <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold mb-1.5">Status Qualif</p>
                    <span className={cn(
                      "px-3 py-1.5 rounded-md text-[11px] font-bold border",
                      isProspectQualificationDone(selectedProspect) ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/[0.03] text-white/40 border-white/10"
                    )}>
                      {isProspectQualificationDone(selectedProspect) ? "QUALIFIÉ" : "À QUALIFIER"}
                    </span>
                  </div>
                </div>

                {/* Company Information */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                    <Building2 className="size-3" /> Société
                  </h4>
                  <div className="p-6 rounded-xl bg-white/[0.03] border border-[#1F1F1F] space-y-6">
                    <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Nom</p>
                        <div className="flex items-center gap-2 text-[13px] text-white/70">
                          <Building2 className="size-3.5 text-white/20 shrink-0" />
                          <span className="truncate">{selectedProspect.company_name || "N/A"}</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Secteur</p>
                        <div className="flex items-center gap-2 text-[13px] text-white/70">
                          <Globe className="size-3.5 text-white/20 shrink-0" />
                          <span className="truncate">{getProspectIndustry(selectedProspect) || "N/A"}</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Taille</p>
                        <div className="flex items-center gap-2 text-[13px] text-white/70">
                          <Users className="size-3.5 text-white/20 shrink-0" />
                          <span className="truncate">{getProspectCompanySize(selectedProspect) || "N/A"}</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Site Web</p>
                        <div className="flex items-center gap-2 text-[13px] text-blue-400">
                          <ExternalLink className="size-3.5 text-white/20 shrink-0" />
                          {getProspectWebsite(selectedProspect) ? (
                            <a href={getProspectWebsite(selectedProspect)!} target="_blank" rel="noreferrer" className="truncate hover:underline">
                              {getProspectWebsite(selectedProspect)!.replace(/^https?:\/\//, "")}
                            </a>
                          ) : "N/A"}
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-5 border-t border-white/5 space-y-2">
                      <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">À propos de l'entreprise</p>
                      <p className="text-[12px] text-white/50 leading-relaxed italic">
                        {getProspectCompanyDescription(selectedProspect) 
                          ? `"${getProspectCompanyDescription(selectedProspect)}"` 
                          : "Aucune description disponible."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Experience Section */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                    <Send className="size-3" /> Expériences
                  </h4>
                  <div className="space-y-4">
                    {selectedProspect.extra_data?.experiences?.length > 0 ? (
                      selectedProspect.extra_data.experiences.map((exp: any, idx: number) => (
                        <div key={idx} className="p-5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-blue-500/20 transition-all flex gap-4">
                          <div className="size-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0 border border-white/5">
                            <Building2 className="size-5 text-white/20" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white leading-tight">{exp.title || "Poste"}</p>
                            <p className="text-[11px] text-white/40 mt-1">{exp.company || "Entreprise"}</p>
                            {exp.duration && <p className="text-[10px] text-white/20 mt-1 flex items-center gap-1.5"><Clock className="size-3" /> {exp.duration}</p>}
                            {exp.description && (
                              <p className="text-[11px] text-white/30 mt-3 leading-relaxed border-l border-white/5 pl-3">
                                {exp.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 rounded-xl bg-white/[0.03] border border-dashed border-white/10 text-center">
                        <p className="text-[12px] text-white/30 italic">Aucune expérience détaillée n'a été scrapée pour le moment.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                    <Mail className="size-3" /> Coordonnées
                  </h4>
                  <div className="p-6 rounded-xl bg-white/[0.03] border border-[#1F1F1F] space-y-4">
                    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Email</span>
                      <span className="text-[13px] text-white/70">{selectedProspect.email || "N/A"}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Téléphone</span>
                      <span className="text-[13px] text-white/70">{selectedProspect.phone || "N/A"}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Localisation</span>
                      <span className="text-[13px] text-white/70">{selectedProspect.location || "N/A"}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Importé le</span>
                      <span className="text-[13px] text-white/70">{selectedProspect.created_at ? new Date(selectedProspect.created_at).toLocaleDateString() : "—"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Qualify */}
              <div className="p-6 border-t border-[#1F1F1F] bg-[#080808]/80 backdrop-blur-xl shrink-0">
                <Button 
                  onClick={() => handleQualify([selectedProspect.id])}
                  disabled={qualifyingIds.includes(selectedProspect.id) || isProspectQualificationDone(selectedProspect)}
                  className={cn(
                    "w-full h-12 rounded-xl gap-3 font-bold text-base transition-all",
                    isProspectQualificationDone(selectedProspect) ? "bg-white/[0.04] text-white/30" : "bg-blue-600 hover:bg-blue-500 text-white"
                  )}
                >
                  {isProspectQualificationDone(selectedProspect) ? "Qualifié" : "Lancer la qualification IA"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* SELECTION BAR */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0, x: "-50%" }}
            animate={{ y: 0, opacity: 1, x: "-50%" }}
            exit={{ y: 100, opacity: 0, x: "-50%" }}
            className="fixed bottom-8 left-1/2 z-[200] flex items-center gap-2 p-2 bg-[#0A0A0A]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl"
          >
            <div className="flex items-center gap-3 pr-6 border-r border-white/5">
              <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold text-xs">{selectedIds.length}</div>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Sélectionnés</p>
            </div>
            <div className="flex items-center gap-2 pl-3">
              <Button 
                onClick={() => handleQualify(selectedIds)}
                variant="ghost" 
                className="h-9 gap-2 text-[10px] font-bold uppercase tracking-widest text-blue-400 hover:bg-blue-500/5"
              >
                Qualifier
              </Button>
              <Button variant="ghost" onClick={() => setSelectedIds([])} className="h-9 px-4 text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white">Annuler</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isImportModalOpen && (
          <CsvImportModal 
            onClose={() => setIsImportModalOpen(false)}
            listId={selectedListId}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
