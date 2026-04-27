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
  ExternalLink,
  X,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { analyzeWebsite, type AnalysisResult } from "@/lib/flows/analyze";

type FlowStatus = "active" | "paused" | "setup_required" | "disabled";

interface Campaign {
  id: string;
  display_name: string;
  status: FlowStatus;
  created_at: string;
  config?: {
    target_icp?: { sectors?: string[]; locations?: string[] };
    prospection?: { prospects_per_day?: number; sector?: string; location?: string };
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
  return <span className="flex size-2 rounded-full bg-zinc-500" />;
};

const STATUS_LABEL: Record<string, string> = {
  active: "Actif",
  paused: "En pause",
  setup_required: "Configuration requise",
  disabled: "Désactivé",
};

// ─── Scan Lines ──────────────────────────────────────────────────────────────
const SCAN_LINES = [
  "Accès au site web…",
  "Lecture de la structure…",
  "Détection du secteur d'activité…",
  "Identification de l'offre principale…",
  "Analyse du positionnement…",
  "Inférence des cibles prioritaires…",
  "Calibrage du ton de communication…",
  "Finalisation de la stratégie…",
];

// ─── Full Countries List (Simplified for UI, but exhaustive) ────────────────
const ALL_COUNTRIES = [
  "Afghanistan", "Afrique du Sud", "Albanie", "Algérie", "Allemagne", "Andorre", "Angola", "Arabie Saoudite", "Argentine", "Arménie", "Australie", "Autriche", "Azerbaïdjan", 
  "Bahamas", "Bahreïn", "Bangladesh", "Barbade", "Belgique", "Belize", "Bénin", "Bhoutan", "Biélorussie", "Birmanie", "Bolivie", "Bosnie-Herzégovine", "Botswana", "Brésil", "Brunei", "Bulgarie", "Burkina Faso", "Burundi",
  "Cambodge", "Cameroun", "Canada", "Cap-Vert", "Chili", "Chine", "Chypre", "Colombie", "Comores", "Congo", "Corée du Nord", "Corée du Sud", "Costa Rica", "Côte d'Ivoire", "Croatie", "Cuba",
  "Danemark", "Djibouti", "Dominique", 
  "Égypte", "Émirats Arabes Unis", "Équateur", "Érythrée", "Espagne", "Estonie", "États-Unis", "Éthiopie",
  "Fidji", "Finlande", "France",
  "Gabon", "Gambie", "Géorgie", "Ghana", "Grèce", "Grenade", "Guatemala", "Guinée", "Guyana",
  "Haïti", "Honduras", "Hongrie",
  "Inde", "Indonésie", "Irak", "Iran", "Irlande", "Islande", "Israël", "Italie",
  "Jamaïque", "Japon", "Jordanie",
  "Kazakhstan", "Kenya", "Kirghizistan", "Kiribati", "Koweït",
  "Laos", "Lesotho", "Lettonie", "Liban", "Libéria", "Libye", "Liechtenstein", "Lituanie", "Luxembourg",
  "Macédoine", "Madagascar", "Malaisie", "Malawi", "Maldives", "Mali", "Malte", "Maroc", "Maurice", "Mauritanie", "Mexique", "Moldavie", "Monaco", "Mongolie", "Monténégro", "Mozambique",
  "Namibie", "Nauru", "Népal", "Nicaragua", "Niger", "Nigéria", "Norvège", "Nouvelle-Zélande",
  "Oman", "Ouganda", "Ouzbékistan",
  "Pakistan", "Palaos", "Panama", "Papouasie-Nouvelle-Guinée", "Paraguay", "Pays-Bas", "Pérou", "Philippines", "Pologne", "Portugal",
  "Qatar",
  "République Centrafricaine", "République Démocratique du Congo", "République Dominicaine", "République Tchèque", "Roumanie", "Royaume-Uni", "Russie", "Rwanda",
  "Saint-Christophe-et-Niévès", "Sainte-Lucie", "Saint-Marin", "Saint-Vincent-et-les Grenadines", "Salomon", "Salvador", "Samoa", "Sao Tomé-et-Principe", "Sénégal", "Serbie", "Seychelles", "Sierra Leone", "Singapour", "Slovaquie", "Slovénie", "Somalie", "Soudan", "Sri Lanka", "Suède", "Suisse", "Suriname", "Swaziland", "Syrie",
  "Tadjikistan", "Tanzanie", "Tchad", "Thaïlande", "Timor oriental", "Togo", "Tonga", "Trinité-et-Tobago", "Tunisie", "Turkménistan", "Turquie", "Tuvalu",
  "Ukraine", "Uruguay",
  "Vanuatu", "Vatican", "Venezuela", "Vietnam",
  "Yémen",
  "Zambie", "Zimbabwe"
].sort();

// ─── Wizard Steps Definition ────────────────────────────────────────────────
const WIZARD_STEPS = [
  { key: "offer", icon: Package, title: "Votre offre", subtitle: "Décrivez ce que vous vendez en 2-3 phrases." },
  { key: "icp", icon: Target, title: "Cible ICP", subtitle: "Secteurs et décideurs à privilégier." },
  { key: "location", icon: MapPin, title: "Localisation", subtitle: "Zones géographiques cibles." },
  { key: "sources", icon: Search, title: "Sources", subtitle: "Canaux de recherche de prospects." },
  { key: "tone", icon: MessageSquare, title: "Ton des messages", subtitle: "Style rédactionnel de l'IA." },
  { key: "ops", icon: Settings2, title: "Règles opérationnelles", subtitle: "Volume et critères d'injection." },
];

// ---------------------------------------------------------------------------
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
  const [isPending, startTransition] = useTransition();

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
  const [tone, setTone] = useState("Professionnel et direct");
  
  // Custom Input Helpers
  const [customIndustry, setCustomIndustry] = useState("");
  const [customRole, setCustomRole] = useState("");

  // Ops Settings
  const [prospectsPerDay, setProspectsPerDay] = useState(20);
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

    const result = await analyzeWebsite(url.trim());

    if (result.error || !result.data) {
      setAnalyzeError(result.error || "Erreur lors de l'analyse.");
      setPhase("url");
      return;
    }

    const d = result.data;
    setOffer(d.offer || "");
    setIndustries(d.icp_industries || []);
    setRoles(d.icp_roles || []);
    setLocations(d.locations || ["France"]);
    setSources(d.sources || ["LinkedIn"]);
    setTone(d.tone || "Professionnel et direct");

    try {
      const host = new URL(url.trim()).hostname.replace("www.", "");
      setCampaignName(`Prospection – ${host}`);
    } catch {
      setCampaignName("Nouvelle campagne");
    }

    setPhase("wizard");
  };

  const handleCreate = async () => {
    try {
      setAnalyzeError(null);
      const config = {
        target_icp: { 
          sectors: industries, 
          locations: locations,
          company_size: ["Startup", "PME", "ETI"]
        },
        personas: roles,
        tone: tone,
        sources: sources,
        offer: offer,
        prospection: {
          mode: "auto",
          prospects_per_day: prospectsPerDay,
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
      };

      const result = await createAction(campaignName || "Prospection IA", config);
      
      if (result.error) {
        setAnalyzeError(result.error);
        return;
      }

      if (result.data?.id) {
        startTransition(() => {
          router.push(`/flows/prospecting/${result.data.id}`);
        });
      } else {
        setAnalyzeError("Une erreur inconnue est survenue (pas d'ID reçu).");
      }
    } catch (e: any) {
      setAnalyzeError(e.message || "Erreur lors de la communication avec le serveur.");
    }
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
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Flow - Prospection</p>
                <h1 className="text-4xl font-bold text-white tracking-tight">Configuration</h1>
                <p className="text-white/40">Définissez la stratégie de vos agents de prospection.</p>
              </div>

              <div className="py-12">
                <div className="size-16 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center mx-auto mb-8">
                  <Globe className="size-8 text-white/40" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">Analysons votre site</h2>
                <p className="text-sm text-white/40 mb-10 max-w-md mx-auto leading-relaxed">
                  Notre IA va lire votre site web, comprendre votre offre et pré-remplir automatiquement toute la configuration de vos agents.
                </p>

                <div className="flex gap-2 max-w-md mx-auto">
                  <input
                    autoFocus
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                    placeholder="https://votre-site.com"
                    className="flex-1 h-12 px-5 bg-white/[0.03] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-white/30 transition-all"
                  />
                  <Button 
                    onClick={handleAnalyze} 
                    disabled={!url.trim()}
                    className="h-12 px-6 bg-white text-black hover:bg-white/90 font-bold rounded-xl gap-2 transition-all active:scale-95"
                  >
                    Analyser <ArrowRight className="size-4" />
                  </Button>
                </div>
                
                <button 
                  onClick={() => setPhase("wizard")}
                  className="mt-6 text-xs text-white/20 hover:text-white/40 underline underline-offset-4 transition-colors"
                >
                  Configurer manuellement
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
                  <ArrowLeft className="size-3" /> Retour à mes campagnes
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
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 mb-2">Flow - Prospection</p>
                <h1 className="text-4xl font-bold text-white mb-2">Configuration</h1>
                <p className="text-white/40 text-sm">Définissez la stratégie de vos agents de prospection.</p>
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
                    Étape {currentStep + 1} sur 6
                  </span>
                </div>

                <div className="flex-1">
                  {currentStep === 0 && (
                    <div className="space-y-6">
                      <textarea
                        value={offer}
                        onChange={(e) => setOffer(e.target.value)}
                        placeholder="Ex: Nous aidons les startups SaaS à automatiser leur prospection LinkedIn..."
                        className="w-full h-40 bg-white/[0.03] border border-white/10 rounded-2xl p-6 text-sm text-white/80 focus:outline-none focus:border-white/30 resize-none leading-relaxed"
                      />
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/30">Nom de la campagne</label>
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
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/30">Secteurs d'activité</label>
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
                              placeholder="Ajouter un secteur..." 
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
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/30">Décideurs cibles</label>
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
                              placeholder="Ajouter un rôle..." 
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
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/30">Sélectionner les pays</label>
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
                            <option value="" className="bg-[#0A0A0A]">Choisir un pays...</option>
                            {ALL_COUNTRIES.map(c => (
                              <option key={c} value={c} className="bg-[#0A0A0A]">{c}</option>
                            ))}
                          </select>
                          <ChevronDown className="size-4 text-white/20 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                      
                      <div className="space-y-4 pt-6 border-t border-white/5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/30">Pays ciblés ({locations.length})</label>
                        <div className="flex flex-wrap gap-2">
                          {locations.length === 0 ? (
                            <p className="text-xs text-white/20 italic">Aucun pays sélectionné.</p>
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
                    <div className="space-y-3">
                      {["LinkedIn", "Google Maps", "Annuaires sectoriels", "Base de données clients"].map(s => {
                        const active = sources.includes(s);
                        return (
                          <button
                            key={s}
                            onClick={() => toggleTag(sources, s, setSources)}
                            className={`w-full h-14 rounded-2xl border px-6 flex items-center justify-between transition-all ${
                              active ? "bg-white/10 border-white/20 text-white" : "bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/5"
                            }`}
                          >
                            <span className="text-sm font-medium">{s}</span>
                            {active && <CheckCircle2 className="size-4 text-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.3)]" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {currentStep === 4 && (
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        "Professionnel et direct",
                        "Chaleureux et humain",
                        "Stratégique et analytique",
                        "Concis et percutant",
                        "Éducatif et pédagogue"
                      ].map(t => (
                        <button
                          key={t}
                          onClick={() => setTone(t)}
                          className={`h-24 rounded-2xl border px-6 text-left transition-all relative overflow-hidden group ${
                            tone === t ? "bg-white/10 border-white/20 text-white" : "bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/5"
                          }`}
                        >
                          {tone === t && (
                            <motion.div layoutId="tone-highlight" className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                          )}
                          <p className="text-sm font-bold mb-1 relative z-10">{t}</p>
                          <p className="text-[10px] opacity-40 relative z-10 leading-relaxed">Parfait pour {t.toLowerCase()}.</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {currentStep === 5 && (
                    <div className="space-y-8">
                      <div className="flex items-center justify-between p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <div className="flex items-center gap-4">
                          <div className="size-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                            <ActivityIcon className="size-5 text-emerald-500" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white mb-1">Prospects par jour</p>
                            <p className="text-[10px] text-white/30 font-medium">Volume quotidien de recherche et contact.</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <button onClick={() => setProspectsPerDay(Math.max(1, prospectsPerDay - 1))} className="size-10 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 transition-colors">-</button>
                          <input
                            type="number"
                            value={prospectsPerDay}
                            onChange={(e) => setProspectsPerDay(parseInt(e.target.value))}
                            className="w-14 h-10 bg-white/10 rounded-lg text-center font-bold text-white border-none focus:ring-2 focus:ring-white/10"
                          />
                          <button onClick={() => setProspectsPerDay(prospectsPerDay + 1)} className="size-10 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 transition-colors">+</button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => setAutoAdd(!autoAdd)}
                          className={`p-6 rounded-2xl border text-left transition-all ${
                            autoAdd ? "bg-emerald-500/10 border-emerald-500/20" : "bg-white/[0.02] border-white/5"
                          }`}
                        >
                          <CheckCircle2 className={`size-5 mb-4 ${autoAdd ? "text-emerald-500" : "text-white/10"}`} />
                          <p className="text-sm font-bold text-white mb-1">Injection automatique</p>
                          <p className="text-[10px] text-white/30 leading-relaxed">Ajouter les leads sans validation manuelle préalable.</p>
                        </button>
                        <button
                          onClick={() => setLinkedinRequired(!linkedinRequired)}
                          className={`p-6 rounded-2xl border text-left transition-all ${
                            linkedinRequired ? "bg-blue-500/10 border-blue-500/20" : "bg-white/[0.02] border-white/5"
                          }`}
                        >
                          <ExternalLink className={`size-5 mb-4 ${linkedinRequired ? "text-blue-500" : "text-white/10"}`} />
                          <p className="text-sm font-bold text-white mb-1">LinkedIn requis</p>
                          <p className="text-[10px] text-white/30 leading-relaxed">Prioriser les profils avec un lien LinkedIn vérifié.</p>
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
                      <ArrowLeft className="size-4" /> Précédent
                    </Button>
                    
                    <div className="flex gap-4">
                      {currentStep < WIZARD_STEPS.length - 1 ? (
                        <Button
                          onClick={() => setCurrentStep(currentStep + 1)}
                          className="bg-white text-black hover:bg-white/90 font-bold px-10 rounded-xl gap-2 h-12 shadow-xl shadow-white/5 transition-all active:scale-95"
                        >
                          Suivant <ArrowRight className="size-4" />
                        </Button>
                      ) : (
                        <Button
                          onClick={handleCreate}
                          disabled={isPending}
                          className="bg-white text-black hover:bg-white/90 font-bold px-12 rounded-xl h-12 shadow-xl shadow-white/5 transition-all active:scale-95 min-w-[200px]"
                        >
                          {isPending ? "Création en cours..." : "Finaliser la campagne"}
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
    <div className="w-full max-w-6xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Prospection IA</h1>
          <p className="text-white/40">Gérez vos campagnes de prospection et suivez les performances en temps réel.</p>
        </div>
        <Button
          onClick={() => { setMode("onboarding"); setPhase("url"); setCurrentStep(0); }}
          className="bg-white text-black hover:bg-white/90 gap-2 h-11 px-6 font-bold text-sm shadow-lg shadow-white/5 transition-all active:scale-95"
        >
          <Plus className="size-4" /> Nouvelle campagne
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

            {camp.config?.target_icp?.sectors && (
              <div className="relative z-10 mb-4 flex flex-wrap gap-2">
                {camp.config.target_icp.sectors.slice(0, 2).map(s => (
                  <span key={s} className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                    {s}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-auto pt-5 border-t border-white/5 grid grid-cols-2 gap-4 relative z-10">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-white/20 mb-1">Objectif/jour</p>
                <p className="text-xl font-bold text-white">{camp.config?.prospection?.prospects_per_day ?? "—"}</p>
              </div>
              <div className="flex items-center gap-2 mt-auto text-xs text-white/30 group-hover:text-white transition-colors">
                <span className="font-medium">Voir le Dashboard</span>
                <ArrowRight className="size-3 ml-auto group-hover:translate-x-1 transition-transform" />
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

function ActivityIcon(props: any) {
  return (
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
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
