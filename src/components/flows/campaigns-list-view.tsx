"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Briefcase,
  MoreHorizontal,
  ArrowRight,
  Play,
  Pause,
  Loader2,
  Globe,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Search,
  User,
  MapPin,
  Target,
  MessageSquare,
  Package,
  Layers,
  Settings2,
  Activity,
  ExternalLink,
  Zap,
  X,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { analyzeWebsite, type AnalysisResult } from "@/lib/flows/analyze";

import { useTranslations, useLocale } from "next-intl";

type CampaignStatus = "active" | "paused" | "archived" | "draft";

interface Campaign {
  id: string;
  display_name: string;
  status: CampaignStatus;
  created_at: string;
  config?: {
    target_icp?: {
      sectors?: string[];
      industries?: string[];
      locations?: string[];
      company_size?: string[];
    };
    prospection?: { prospects_per_day?: number; sector?: string; location?: string; search_time?: string };
    personas?: string[];
    tone?: string;
    injection?: { auto_add?: boolean; prioritize_linkedin?: boolean };
  };
}

const StatusDot = ({ status }: { status: string }) => {
  if (status === "active")
    return (
      <span className="flex size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
    );
  if (status === "paused")
    return (
      <span className="flex size-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
    );
  return <span className="flex size-2 rounded-full bg-zinc-500" /> ;
};

// Onboarding Experience (Full Page)
// ---------------------------------------------------------------------------
export function CampaignsListView({ 
  campaigns, 
  createAction 
}: { 
  campaigns: Campaign[]; 
  createAction: (name: string, config?: Record<string, any>) => Promise<{ data: any; error: string | null }> 
}) {
  const router = useRouter();
  const t = useTranslations("Prospecting");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const STATUS_LABEL: Record<string, string> = {
    active: t("status_active"),
    paused: t("status_paused"),
    archived: t("status_archived"),
    draft: t("status_draft"),
  };

  const SCAN_LINES = [
    t("scan_1"),
    t("scan_2"),
    t("scan_3"),
    t("scan_4"),
    t("scan_5"),
    t("scan_6"),
    t("scan_7"),
    t("scan_8"),
  ];

  const WIZARD_STEPS = [
    { key: "offer", icon: Package, title: t("wizard_step_1_title"), subtitle: t("wizard_step_1_sub") },
    { key: "icp", icon: Target, title: t("wizard_step_2_title"), subtitle: t("wizard_step_2_sub") },
    { key: "location", icon: MapPin, title: t("wizard_step_3_title"), subtitle: t("wizard_step_3_sub") },
    { key: "tone", icon: MessageSquare, title: t("wizard_step_4_title"), subtitle: t("wizard_step_4_sub") },
    { key: "ops", icon: Settings2, title: t("wizard_step_5_title"), subtitle: t("wizard_step_5_sub") },
  ];

  // Mode: "list" or "onboarding"
  const [mode, setMode] = useState<"list" | "onboarding">(campaigns.length === 0 ? "onboarding" : "list");
  
  // Onboarding Phases: "url" | "analyzing" | "wizard"
  const [phase, setPhase] = useState<"url" | "analyzing" | "wizard">("url");
  const [currentStep, setCurrentStep] = useState(0);

  // States
  const [url, setUrl] = useState("");
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [scanIndex, setScanIndex] = useState(0);

  // Form States (pre-filled by IA)
  const [campaignName, setCampaignName] = useState("");
  const [offer, setOffer] = useState("");
  const [industries, setIndustries] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [tone, setTone] = useState(t("tones.professional"));
  
  // Custom Input Helpers
  const [customIndustry, setCustomIndustry] = useState("");
  const [customRole, setCustomRole] = useState("");

  // Ops Settings
  const [messagesPerDay, setMessagesPerDay] = useState(7);
  const [invitationsPerDay, setInvitationsPerDay] = useState(10);
  const [autoAdd, setAutoAdd] = useState(true);
  const [linkedinRequired, setLinkedinRequired] = useState(true);

  // Scan animation
  useEffect(() => {
    if (phase !== "analyzing") return;
    const interval = setInterval(() => {
      setScanIndex((prev) => (prev >= SCAN_LINES.length - 1 ? prev : prev + 1));
    }, 400);
    return () => clearInterval(interval);
  }, [phase]);

  const handleAnalyze = async () => {
    if (!url.trim()) return;
    setAnalyzeError(null);
    setScanIndex(0);
    setPhase("analyzing");

    const result = await analyzeWebsite(url.trim(), locale === "en" ? "english" : "français");

    if (result.error || !result.data) {
      setAnalyzeError(result.error || t("analyze_error"));
      setPhase("url");
      return;
    }

    const d = result.data;
    setOffer(d.offer || "");
    setIndustries(d.icp_industries || []);
    setRoles(d.icp_roles || []);
    setLocations(d.locations || t.raw("default_locations"));
    setSources(t.raw("default_sources"));
    setTone(d.tone || t("default_tone"));

    try {
      const host = new URL(url.trim()).hostname.replace("www.", "");
      setCampaignName(`${t("prospection_prefix")}${host}`);
    } catch {
      setCampaignName(t("new_campaign_default"));
    }

    setPhase("wizard");
  };

  const handleCreate = async () => {
    if (isPending) return;

    startTransition(async () => {
      setAnalyzeError(null);
      try {
        const config = {
          target_description: offer,
          target_icp: {
            industries,
            locations,
            company_size: t.raw("company_sizes")
          },
          personas: roles,
          tone: tone,
          sources: sources,
          offer: offer,
          prospection: {
            mode: "auto",
            messages_per_day: messagesPerDay,
            invitations_per_day: invitationsPerDay,
            search_time: "09:00",
            sector: industries[0] || "",
            location: locations[0] || "",
            decision_maker: roles[0] || "",
          },
          injection: {
            auto_add: autoAdd,
            ignore_duplicates: true,
            prioritize_linkedin: linkedinRequired,
          },
          language: locale === "en" ? "english" : "français",
        };

        const result = await createAction(campaignName || t("prospection_prefix"), config);
        
        if (result.error) {
          setAnalyzeError(result.error);
          return;
        }

        if (result.data?.id) {
          router.push(`/flows/prospecting/${result.data.id}`);
        } else {
          setAnalyzeError(t("unknown_error"));
        }
      } catch (e: any) {
        setAnalyzeError(e.message || t("server_error"));
      }
    });
  };

  const toggleTag = (arr: string[], val: string, setter: (v: string[]) => void) => {
    if (arr.includes(val)) setter(arr.filter((x) => x !== val));
    else setter([...arr, val]);
  };

  const addTag = (arr: string[], val: string, setter: (v: string[]) => void, clear: () => void) => {
    if (!val.trim()) return;
    if (!arr.includes(val.trim())) {
      setter([...arr, val.trim()]);
    }
    clear();
  };

  // ─── RENDERING ───

  if (mode === "onboarding") {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center py-12">
        <AnimatePresence mode="wait">
          {/* PHASE: URL */}
          {phase === "url" && (
            <motion.div
              key="url"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-xl text-center space-y-8"
            >
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">{t("onboarding_flow_label")}</p>
                <h1 className="text-4xl font-bold text-white tracking-tight">{t("onboarding_title")}</h1>
                <p className="text-white/40">{t("onboarding_subtitle")}</p>
              </div>

              <div className="py-12">
                <div className="size-16 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center mx-auto mb-8">
                  <Globe className="size-8 text-white/40" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">{t("analyze_title")}</h2>
                <p className="text-sm text-white/40 mb-10 max-w-md mx-auto leading-relaxed">
                  {t("analyze_desc")}
                </p>

                <div className="flex gap-2 max-w-md mx-auto">
                  <input
                    autoFocus
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                    placeholder={t("analyze_placeholder")}
                    className="flex-1 h-12 px-5 bg-white/[0.03] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-white/30 transition-all"
                  />
                  <Button 
                    onClick={handleAnalyze} 
                    disabled={!url.trim()}
                    className="h-12 px-6 bg-white text-black hover:bg-white/90 font-bold rounded-xl gap-2 transition-all active:scale-95"
                  >
                    {t("analyze_btn")} <ArrowRight className="size-4" />
                  </Button>
                </div>
                
                <button 
                  onClick={() => setPhase("wizard")}
                  className="mt-6 text-xs text-white/20 hover:text-white/40 underline underline-offset-4 transition-colors"
                >
                  {t("manual_config_btn")}
                </button>

                {analyzeError && (
                  <p className="mt-6 text-xs text-red-400 bg-red-500/10 border border-red-500/20 py-2 px-4 rounded-lg inline-block">
                    {analyzeError}
                  </p>
                )}
              </div>
              
              {campaigns.length > 0 && (
                <button 
                  onClick={() => setMode("list")}
                  className="text-xs text-white/30 hover:text-white/60 flex items-center gap-2 mx-auto"
                >
                  <ArrowLeft className="size-3" /> {t("back_to_campaigns")}
                </button>
              )}
            </motion.div>
          )}

          {/* PHASE: ANALYZING */}
          {phase === "analyzing" && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-lg text-center py-20"
            >
              <div className="relative size-24 mx-auto mb-12">
                <div className="absolute inset-0 rounded-full border-2 border-white/5" />
                <div className="absolute inset-0 rounded-full border-2 border-t-blue-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Globe className="size-8 text-white/20 animate-pulse" />
                </div>
              </div>

              <div className="space-y-4 max-w-xs mx-auto text-left">
                {SCAN_LINES.map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: i <= scanIndex ? 1 : 0.1, x: 0 }}
                    className="flex items-center gap-3 text-xs"
                  >
                    {i < scanIndex ? (
                      <CheckCircle2 className="size-3.5 text-emerald-500" />
                    ) : i === scanIndex ? (
                      <div className="size-3.5 rounded-full border border-blue-500/50 border-t-blue-500 animate-spin" />
                    ) : (
                      <div className="size-3.5 rounded-full bg-white/5" />
                    )}
                    <span className={i <= scanIndex ? "text-white/60" : "text-white/20"}>
                      {line}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* PHASE: WIZARD */}
          {phase === "wizard" && (
            <motion.div
              key="wizard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full max-w-4xl"
            >
              <div className="text-center mb-12">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 mb-2">{t("onboarding_flow_label")}</p>
                <h1 className="text-4xl font-bold text-white mb-2">{t("onboarding_title")}</h1>
                <p className="text-white/40 text-sm">{t("onboarding_subtitle")}</p>
              </div>

              {/* Progress Stepper */}
              <div className="flex items-center justify-between px-12 mb-12 relative">
                <div className="absolute top-5 left-20 right-20 h-px bg-white/5 -z-10" />
                {WIZARD_STEPS.map((step, i) => {
                  const Icon = step.icon;
                  const active = i === currentStep;
                  const completed = i < currentStep;
                  return (
                    <button
                      key={step.key}
                      onClick={() => i <= currentStep && setCurrentStep(i)}
                      className="flex flex-col items-center gap-3 group"
                    >
                      <div className={`size-10 rounded-xl border flex items-center justify-center transition-all ${
                        active ? "bg-white border-white text-black scale-110 shadow-lg shadow-white/10" : 
                        completed ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" :
                        "bg-white/[0.02] border-white/5 text-white/20"
                      }`}>
                        {completed ? <CheckCircle2 className="size-5" /> : <Icon className="size-5" />}
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        active ? "text-white" : "text-white/20"
                      }`}>
                        {step.title}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Step Content */}
              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-10 min-h-[400px] flex flex-col relative overflow-hidden shadow-2xl">
                <div className="absolute -top-24 -right-24 size-64 bg-blue-500/5 blur-[100px] rounded-full" />

                <div className="flex items-start justify-between mb-10">
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-xl bg-white/5 flex items-center justify-center">
                      {(() => { const Icon = WIZARD_STEPS[currentStep].icon; return <Icon className="size-6 text-white/40" /> })()}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{WIZARD_STEPS[currentStep].title}</h3>
                      <p className="text-sm text-white/40">{WIZARD_STEPS[currentStep].subtitle}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 bg-white/5 px-3 py-1 rounded-full font-mono">
                    {t("wizard_step_indicator", { current: currentStep + 1, total: 5 })}
                  </span>
                </div>

                <div className="flex-1">
                  {currentStep === 0 && (
                    <div className="space-y-6">
                      <textarea
                        value={offer}
                        onChange={(e) => setOffer(e.target.value)}
                        placeholder={t("offer_placeholder")}
                        className="w-full h-40 bg-white/[0.03] border border-white/10 rounded-2xl p-6 text-sm text-white/80 focus:outline-none focus:border-white/30 resize-none leading-relaxed"
                      />
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/30">{t("campaign_name")}</label>
                        <input
                          value={campaignName}
                          onChange={(e) => setCampaignName(e.target.value)}
                          className="w-full h-12 bg-white/[0.03] border border-white/10 rounded-xl px-4 text-sm text-white"
                        />
                      </div>
                    </div>
                  )}

                  {currentStep === 1 && (
                    <div className="space-y-8">
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/30">{t("sectors_label")}</label>
                        <div className="flex flex-wrap gap-2">
                          {industries.map(ind => (
                            <span key={ind} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
                              {ind} 
                              <button onClick={() => toggleTag(industries, ind, setIndustries)} className="hover:text-white transition-colors">
                                <X className="size-3" />
                              </button>
                            </span>
                          ))}
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-dashed border-white/10">
                            <input 
                              value={customIndustry}
                              onChange={(e) => setCustomIndustry(e.target.value)}
                              placeholder={t("add_sector")} 
                              className="bg-transparent text-xs text-white placeholder-white/20 border-none outline-none w-32"
                              onKeyDown={(e) => e.key === 'Enter' && addTag(industries, customIndustry, setIndustries, () => setCustomIndustry(""))}
                            />
                            <button onClick={() => addTag(industries, customIndustry, setIndustries, () => setCustomIndustry(""))} className="text-white/20 hover:text-white transition-colors">
                              <Plus className="size-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/30">{t("roles_label")}</label>
                        <div className="flex flex-wrap gap-2">
                          {roles.map(role => (
                            <span key={role} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium">
                              {role}
                              <button onClick={() => toggleTag(roles, role, setRoles)} className="hover:text-white transition-colors">
                                <X className="size-3" />
                              </button>
                            </span>
                          ))}
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-dashed border-white/10">
                            <input 
                              value={customRole}
                              onChange={(e) => setCustomRole(e.target.value)}
                              placeholder={t("add_role")} 
                              className="bg-transparent text-xs text-white placeholder-white/20 border-none outline-none w-32"
                              onKeyDown={(e) => e.key === 'Enter' && addTag(roles, customRole, setRoles, () => setCustomRole(""))}
                            />
                            <button onClick={() => addTag(roles, customRole, setRoles, () => setCustomRole(""))} className="text-white/20 hover:text-white transition-colors">
                              <Plus className="size-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep === 2 && (
                    <div className="space-y-8">
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/30">{t("countries_label")}</label>
                        <div className="relative group max-w-md">
                          <MapPin className="size-4 text-white/20 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-white/60 transition-colors" />
                          <select 
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val && !locations.includes(val)) setLocations([...locations, val]);
                              e.target.value = "";
                            }}
                            className="w-full h-14 bg-white/[0.03] border border-white/10 rounded-2xl pl-12 pr-6 text-sm text-white/80 focus:outline-none focus:border-white/30 transition-all appearance-none cursor-pointer"
                          >
                            <option value="" className="bg-[#0A0A0A]">{t("choose_country")}</option>
                            {(t.raw("countries") as string[]).sort().map(c => (
                              <option key={c} value={c} className="bg-[#0A0A0A]">{c}</option>
                            ))}
                          </select>
                          <ChevronDown className="size-4 text-white/20 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                      
                      <div className="space-y-4 pt-6 border-t border-white/5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/30">{t("targeted_countries")} ({locations.length})</label>
                        <div className="flex flex-wrap gap-2">
                          {locations.length === 0 ? (
                            <p className="text-xs text-white/20 italic">{t("no_country")}</p>
                          ) : (
                            locations.map(loc => (
                              <span key={loc} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold shadow-sm">
                                {loc}
                                <button onClick={() => toggleTag(locations, loc, setLocations)} className="hover:text-white transition-colors">
                                  <X className="size-3.5" />
                                </button>
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep === 3 && (
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        t("tones.professional"),
                        t("tones.warm"),
                        t("tones.strategic"),
                        t("tones.concise"),
                        t("tones.educational")
                      ].map(tItem => (
                        <button
                          key={tItem}
                          onClick={() => setTone(tItem)}
                          className={`h-24 rounded-2xl border px-6 text-left transition-all relative overflow-hidden group ${
                            tone === tItem ? "bg-white/10 border-white/20 text-white" : "bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/5"
                          }`}
                        >
                          {tone === tItem && (
                            <motion.div layoutId="tone-highlight" className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                          )}
                          <p className="text-sm font-bold mb-1 relative z-10">{tItem}</p>
                          <p className="text-[10px] opacity-40 relative z-10 leading-relaxed">{t("tone_perfect_for", { tone: tItem.toLowerCase() })}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {currentStep === 4 && (
                    <div className="space-y-8">
                      <div className="space-y-4">
                        {/* Messages Counter */}
                        <div className="flex items-center justify-between p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                          <div>
                            <p className="text-sm font-bold text-white mb-1">{t("ops_messages")}</p>
                            <p className="text-[10px] text-white/30 font-medium">{t("ops_messages_desc")}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <button onClick={() => setMessagesPerDay(Math.max(1, messagesPerDay - 1))} className="size-10 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 transition-colors">-</button>
                            <input
                              type="number"
                              value={messagesPerDay}
                              onChange={(e) => setMessagesPerDay(parseInt(e.target.value))}
                              className="w-14 h-10 bg-white/10 rounded-lg text-center font-bold text-white border-none focus:ring-2 focus:ring-white/10"
                            />
                            <button onClick={() => setMessagesPerDay(messagesPerDay + 1)} className="size-10 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 transition-colors">+</button>
                          </div>
                        </div>

                        {/* Invitations Counter */}
                        <div className="flex items-center justify-between p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                          <div>
                            <p className="text-sm font-bold text-white mb-1">{t("ops_invitations")}</p>
                            <p className="text-[10px] text-white/30 font-medium">{t("ops_invitations_desc")}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <button onClick={() => setInvitationsPerDay(Math.max(1, invitationsPerDay - 1))} className="size-10 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 transition-colors">-</button>
                            <input
                              type="number"
                              value={invitationsPerDay}
                              onChange={(e) => setInvitationsPerDay(parseInt(e.target.value))}
                              className="w-14 h-10 bg-white/10 rounded-lg text-center font-bold text-white border-none focus:ring-2 focus:ring-white/10"
                            />
                            <button onClick={() => setInvitationsPerDay(invitationsPerDay + 1)} className="size-10 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 transition-colors">+</button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => setAutoAdd(!autoAdd)}
                          className={`p-6 rounded-2xl border text-left transition-all ${
                            autoAdd ? "bg-white/[0.08] border-white/20" : "bg-white/[0.02] border-white/5"
                          }`}
                        >
                          <p className="text-sm font-bold text-white mb-1">{t("ops_auto")}</p>
                          <p className="text-[10px] text-white/30 leading-relaxed">{t("ops_auto_desc")}</p>
                        </button>
                        <button
                          onClick={() => setLinkedinRequired(!linkedinRequired)}
                          className={`p-6 rounded-2xl border text-left transition-all ${
                            linkedinRequired ? "bg-white/[0.08] border-white/20" : "bg-white/[0.02] border-white/5"
                          }`}
                        >
                          <p className="text-sm font-bold text-white mb-1">{t("ops_autonomous")}</p>
                          <p className="text-[10px] text-white/30 leading-relaxed">{t("ops_autonomous_desc")}</p>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-12 flex flex-col gap-6">
                  {analyzeError && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-xs"
                    >
                      <AlertCircle className="size-4 shrink-0" />
                      {analyzeError}
                    </motion.div>
                  )}

                  <div className="flex justify-between items-center">
                    <Button
                      variant="ghost"
                      onClick={() => currentStep > 0 ? setCurrentStep(currentStep - 1) : setPhase("url")}
                      className="text-white/30 hover:text-white hover:bg-white/5 gap-2 px-4 h-12"
                    >
                      <ArrowLeft className="size-4" /> {t("btn_prev")}
                    </Button>
                    
                    <div className="flex gap-4">
                      {currentStep < WIZARD_STEPS.length - 1 ? (
                        <Button
                          onClick={() => setCurrentStep(currentStep + 1)}
                          className="bg-white text-black hover:bg-white/90 font-bold px-10 rounded-xl gap-2 h-12 shadow-xl shadow-white/5 transition-all active:scale-95"
                        >
                          {t("btn_next")} <ArrowRight className="size-4" />
                        </Button>
                      ) : (
                        <Button
                          onClick={handleCreate}
                          disabled={isPending}
                          className="bg-white text-black hover:bg-white/90 font-bold px-12 rounded-xl h-12 shadow-xl shadow-white/5 transition-all active:scale-95 min-w-[200px]"
                        >
                          {isPending ? t("btn_creating") : t("btn_finalize")}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ─── LIST MODE ───
  return (
    <div className="w-full h-full px-8 py-8 overflow-y-auto">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">{t("list_title")}</h1>
          <p className="text-white/40">{t("list_subtitle")}</p>
        </div>
        <Button
          onClick={() => { setMode("onboarding"); setPhase("url"); setCurrentStep(0); }}
          className="bg-white text-black hover:bg-white/90 gap-2 h-11 px-6 font-bold text-sm shadow-lg shadow-white/5 transition-all active:scale-95"
        >
          <Plus className="size-4" /> {t("new_campaign")}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {campaigns.map((camp, i) => (
          <motion.div
            key={camp.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            whileHover={{ y: -4, borderColor: "rgba(255,255,255,0.1)" }}
            onClick={() => {
              startTransition(() => {
                router.push(`/flows/prospecting/${camp.id}`);
              });
            }}
            className="group cursor-pointer rounded-2xl border border-white/5 bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-all relative overflow-hidden flex flex-col shadow-lg shadow-black/40"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white/5 group-hover:bg-white/10 transition-colors">
                  <Briefcase className="size-5 text-white/70" />
                </div>
                <div>
                  <h3 className="text-white font-semibold leading-tight group-hover:text-white transition-colors">{camp.display_name}</h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <StatusDot status={camp.status} />
                    <span className="text-[10px] uppercase tracking-wider font-bold text-white/40">{STATUS_LABEL[camp.status] ?? camp.status}</span>
                  </div>
                </div>
              </div>
            </div>

            {(() => {
              const icp = camp.config?.target_icp;
              const combined = [
                ...(icp?.sectors || []),
                ...(icp?.industries || []),
              ].filter((s) => s && s !== "N/A");

              if (combined.length === 0) return null;

              return (
                <div className="relative z-10 mb-4 flex flex-wrap gap-2">
                  {combined.slice(0, 2).map((s) => (
                    <span
                      key={s}
                      className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-400 font-bold uppercase tracking-wider"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              );
            })()}

            <div className="mt-auto pt-5 border-t border-white/5 relative z-10">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-white/20 mb-1">{t("goal_per_day")}</p>
                <p className="text-xl font-bold text-white">{camp.config?.prospection?.prospects_per_day ?? "—"}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {(isPending) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Loader2 className="size-8 text-white animate-spin" />
        </div>
      )}
    </div>
  );
}
