"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Plus,
  MessageSquare,
  Mail,
  Clock,
  GitBranch,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit2,
  Zap,
  Save,
  ChevronDown,
  Loader2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { generateAndSaveSequence } from "@/lib/flows/actions";
import { TopLine } from "@/components/layout/top-line";
import { SectionHeading } from "@/components/layout/section-heading";
import { cn } from "@/lib/utils";

const fade = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

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

export const CHANNELS = {
  LINKEDIN: "LinkedIn",
  GENERAL: "Général",
} as const;

export const ACTIONS = [
  { type: "linkedin", name: "Voir profil", channel: CHANNELS.LINKEDIN },
  {
    type: "linkedin",
    name: "Ajouter sans message",
    channel: CHANNELS.LINKEDIN,
  },
  {
    type: "linkedin",
    name: "Ajouter avec message",
    channel: CHANNELS.LINKEDIN,
  },
  { type: "linkedin", name: "Envoyer message", channel: CHANNELS.LINKEDIN },
  { type: "linkedin", name: "Relance message", channel: CHANNELS.LINKEDIN },
  {
    type: "linkedin",
    name: "Créer action extension",
    channel: CHANNELS.LINKEDIN,
  },

  { type: "wait", name: "Attendre X jours", channel: CHANNELS.GENERAL },
  { type: "wait", name: "Attendre une réponse", channel: CHANNELS.GENERAL },

  { type: "end", name: "Stopper la séquence", channel: CHANNELS.GENERAL },
  { type: "end", name: "Passer en suivi manuel", channel: CHANNELS.GENERAL },
  { type: "end", name: "Marquer comme chaud", channel: CHANNELS.GENERAL },
  { type: "end", name: "Réessayer", channel: CHANNELS.GENERAL },
  { type: "end", name: "Signaler erreur", channel: CHANNELS.GENERAL },
];

export const CONDITIONS = [
  "SI linkedin_url existe",
  "SI invitation acceptée (LinkedIn)",
  "SI message envoyé (LinkedIn)",
  "SI réponse reçue (LinkedIn)",
  "SI Score ICP >= seuil",
  "SI doublon détecté",
];

export const VARIABLES = [
  "{{first_name}}",
  "{{last_name}}",
  "{{company}}",
  "{{role}}",
  "{{location}}",
];

export type StepNode = {
  id: string;
  type: string; // 'linkedin', 'gmail', 'wait', 'condition', 'end'
  name: string; // The action name or condition name
  channel?: string;
  config: {
    message?: string;
    subject?: string;
    days?: number;
    yesBranch?: StepNode[];
    noBranch?: StepNode[];
  };
};

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

// Icon mapping
const getIconForType = (type: string, channel?: string) => {
  if (channel === CHANNELS.LINKEDIN) return LinkedinIcon;
  if (type === "wait") return Clock;
  if (type === "condition") return GitBranch;
  if (type === "end") return AlertCircle;
  return Zap;
};

const getColorForType = (type: string, channel?: string) => {
  if (channel === CHANNELS.LINKEDIN)
    return "text-blue-400 bg-blue-500/10 border-blue-500/20";
  if (type === "wait")
    return "text-amber-400 bg-amber-500/10 border-amber-500/20";
  if (type === "condition")
    return "text-purple-400 bg-purple-500/10 border-purple-500/20";
  return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
};

interface SequenceBuilderProps {
  initialSteps: any[];
  campaignId?: string;
  onClose: () => void;
  onSave?: (steps: StepNode[]) => void;
  prospects?: any[];
}

const recursiveMapSteps = (nodes: any[]): StepNode[] => {
  return (nodes || []).map((s) => ({
    id: s.id || generateId(),
    type: s.type || s.action_type || "linkedin",
    name: s.name || "Nouvelle action",
    channel: s.config?.channel || CHANNELS.LINKEDIN,
    config: {
      ...s.config,
      yesBranch: s.config?.yesBranch
        ? recursiveMapSteps(s.config.yesBranch)
        : [],
      noBranch: s.config?.noBranch ? recursiveMapSteps(s.config.noBranch) : [],
    },
  }));
};

export function SequenceBuilderModal({
  initialSteps,
  campaignId,
  onClose,
  onSave,
  prospects = [],
}: SequenceBuilderProps) {
  const router = useRouter();
  const [steps, setSteps] = useState<StepNode[]>(() => {
    if (initialSteps && initialSteps.length > 0) {
      return recursiveMapSteps(initialSteps);
    }
    return [
      {
        id: generateId(),
        type: "condition",
        name: "Si le profil LinkedIn est trouvé",
        config: {
          yesBranch: [
            {
              id: generateId(),
              type: "linkedin",
              name: "Voir profil",
              channel: CHANNELS.LINKEDIN,
              config: {},
            },
          ],
          noBranch: [
            {
              id: generateId(),
              type: "linkedin",
              name: "Créer action extension",
              channel: CHANNELS.LINKEDIN,
              config: {},
            },
          ],
        },
      },
    ];
  });

  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [selectedProspect, setSelectedProspect] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Track individual prospect overrides
  // Map: prospectId -> stepId -> personalizedMessage
  const [prospectOverrides, setProspectOverrides] = useState<
    Record<string, Record<string, string>>
  >(() => {
    const initial: Record<string, Record<string, string>> = {};
    prospects.forEach((p) => {
      if (p.extra_data?.personalized_sequence) {
        // The personalized_sequence is usually an array of { step_id, message }
        const seq = p.extra_data.personalized_sequence;
        if (Array.isArray(seq)) {
          const map: Record<string, string> = {};
          seq.forEach((s: any) => {
            if (s.step_id) map[s.step_id] = s.message;
          });
          initial[p.id] = map;
        }
      }
    });
    return initial;
  });

  const formatConditionLabel = (label: string, prospect: any) => {
    const name = prospect
      ? prospect.decision_maker?.split(" ")[0] || "le prospect"
      : "le prospect";

    // Normalize and personalize technical labels
    return label
      .replace(
        /SI linkedin_url existe/i,
        `Si le profil LinkedIn de ${name} est trouvé`,
      )
      .replace(/SI invitation acceptée/i, `Si ${name} a accepté l'invitation`)
      .replace(/SI réponse reçue/i, `Si ${name} a répondu`)
      .replace(/SI le prospect a répondu/i, `Si ${name} a répondu`)
      .replace(/le prospect/i, name);
  };

  const replaceVariables = (text: string, prospect: any, stepId?: string) => {
    // If we have a manual override for this prospect and step, use it!
    if (prospect && stepId && prospectOverrides[prospect.id]?.[stepId]) {
      return prospectOverrides[prospect.id][stepId];
    }

    if (!text || !prospect) return text;
    return text
      .replace(/{{first_name}}/g, prospect.decision_maker?.split(" ")[0] || "")
      .replace(
        /{{last_name}}/g,
        prospect.decision_maker?.split(" ").slice(1).join(" ") || "",
      )
      .replace(/{{company}}/g, prospect.company_name || "")
      .replace(/{{role}}/g, prospect.role || "")
      .replace(/{{location}}/g, prospect.location || "");
  };

  // Flatten tree to find step
  const findStep = (nodes: StepNode[], id: string): StepNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.config.yesBranch) {
        const found = findStep(node.config.yesBranch, id);
        if (found) return found;
      }
      if (node.config.noBranch) {
        const found = findStep(node.config.noBranch, id);
        if (found) return found;
      }
    }
    return null;
  };

  const updateStep = (
    nodes: StepNode[],
    id: string,
    updates: Partial<StepNode>,
  ): StepNode[] => {
    return nodes.map((node) => {
      if (node.id === id) {
        return {
          ...node,
          ...updates,
          config: { ...node.config, ...updates.config },
        };
      }
      return {
        ...node,
        config: {
          ...node.config,
          yesBranch: node.config.yesBranch
            ? updateStep(node.config.yesBranch, id, updates)
            : undefined,
          noBranch: node.config.noBranch
            ? updateStep(node.config.noBranch, id, updates)
            : undefined,
        },
      };
    });
  };

  const deleteStep = (nodes: StepNode[], id: string): StepNode[] => {
    return nodes
      .filter((node) => node.id !== id)
      .map((node) => ({
        ...node,
        config: {
          ...node.config,
          yesBranch: node.config.yesBranch
            ? deleteStep(node.config.yesBranch, id)
            : undefined,
          noBranch: node.config.noBranch
            ? deleteStep(node.config.noBranch, id)
            : undefined,
        },
      }));
  };

  const addStep = (
    nodes: StepNode[],
    targetId: string,
    newStep: StepNode,
    branch?: "yes" | "no",
  ): StepNode[] => {
    // If targetId is 'root', we just push to nodes
    if (targetId === "root") {
      return [...nodes, newStep];
    }

    // Otherwise we need to add it AFTER targetId, or INSIDE targetId if it's a branch
    const newNodes: StepNode[] = [];
    for (const node of nodes) {
      if (node.id === targetId) {
        if (branch === "yes") {
          newNodes.push({
            ...node,
            config: {
              ...node.config,
              yesBranch: [...(node.config.yesBranch || []), newStep],
            },
          });
        } else if (branch === "no") {
          newNodes.push({
            ...node,
            config: {
              ...node.config,
              noBranch: [...(node.config.noBranch || []), newStep],
            },
          });
        } else {
          newNodes.push(node);
          newNodes.push(newStep);
        }
      } else {
        newNodes.push({
          ...node,
          config: {
            ...node.config,
            yesBranch: node.config.yesBranch
              ? addStep(node.config.yesBranch, targetId, newStep, branch)
              : undefined,
            noBranch: node.config.noBranch
              ? addStep(node.config.noBranch, targetId, newStep, branch)
              : undefined,
          },
        });
      }
    }
    return newNodes;
  };

  const editingStep = editingStepId ? findStep(steps, editingStepId) : null;

  const handleSave = async () => {
    // 1. Save global template
    if (onSave) onSave(steps);

    // 2. Save individual personalizations (Overrides)
    const { bulkUpdateProspectPersonalizations } =
      await import("@/lib/flows/actions");

    const updates = Object.entries(prospectOverrides).map(
      ([prospectId, stepOverrides]) => {
        const personalizedSequence = Object.entries(stepOverrides).map(
          ([stepId, message]) => ({
            step_id: stepId,
            message: message,
          }),
        );
        return { prospectId, personalizedSequence };
      },
    );

    if (updates.length > 0) {
      await bulkUpdateProspectPersonalizations(updates);
    }

    onClose();
  };

  const handleAiGenerate = async () => {
    if (!campaignId) return;
    setIsGenerating(true);
    const res = await generateAndSaveSequence(campaignId);
    if (res.success) {
      // Reload or update local state? For now, close and let parent re-fetch if needed,
      // but actually we want to see the result.
      // Easiest is to close and let the user re-open if we don't have a way to refresh steps easily here.
      // But let's try to just alert and close.
      window.location.reload();
    } else {
      alert(res.error || "Erreur lors de la génération");
    }
    setIsGenerating(false);
  };

  const computeStepIndices = (
    nodes: StepNode[],
    startNum = 1,
    suffix = "",
  ): Record<string, string> => {
    const indices: Record<string, string> = {};
    let currentNum = startNum;

    nodes.forEach((node) => {
      const label = `${currentNum}${suffix}`;
      indices[node.id] = label;

      if (node.type === "condition") {
        const SUFFIX_MAP: Record<string, [string, string]> = {
          "": ["a", "b"],
          a: ["c", "d"],
          b: ["c", "d"],
          c: ["e", "f"],
          d: ["e", "f"],
          e: ["g", "h"],
          f: ["g", "h"],
        };
        const [nextYes, nextNo] = SUFFIX_MAP[suffix] || [
          suffix + "1",
          suffix + "2",
        ];

        if (node.config.yesBranch) {
          Object.assign(
            indices,
            computeStepIndices(node.config.yesBranch, currentNum + 1, nextYes),
          );
        }
        if (node.config.noBranch) {
          Object.assign(
            indices,
            computeStepIndices(node.config.noBranch, currentNum + 1, nextNo),
          );
        }
      }
      currentNum++;
    });
    return indices;
  };
  const stepIndices = computeStepIndices(steps);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black overflow-hidden font-sans">
      <TopLine />
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar for Action Addition / Sequence Overview */}
        <div className="w-80 bg-[#050505] border-r border-white/10 flex flex-col shrink-0 relative z-10">
          <div className="p-8 border-b border-white/5 flex items-center justify-between">
            <SectionHeading>Actions</SectionHeading>
            <button
              onClick={onClose}
              className="p-2 text-white/20 hover:text-white transition-colors hover:bg-white/5 rounded-lg"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest">
                LinkedIn
              </h3>
              {ACTIONS.filter((a) => a.channel === CHANNELS.LINKEDIN).map(
                (a) => (
                  <DraggableAction key={a.name} action={a} />
                ),
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest">
                Général & Conditions
              </h3>
              <DraggableAction
                action={{ type: "condition", name: "Condition SI/SINON" }}
              />
              {ACTIONS.filter((a) => a.channel === CHANNELS.GENERAL).map(
                (a) => (
                  <DraggableAction key={a.name} action={a} />
                ),
              )}
            </div>
          </div>

          <div className="p-4 border-t border-white/10 bg-[#0a0a0a] space-y-2">
            {campaignId && (
              <Button
                onClick={handleAiGenerate}
                disabled={isGenerating}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 border-none shadow-[0_0_15px_rgba(16,185,129,0.3)]"
              >
                {isGenerating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Zap className="size-4" />
                )}
                Générer avec l'IA
              </Button>
            )}
            <Button
              onClick={handleSave}
              className="w-full bg-white text-black hover:bg-white/90 font-bold gap-2"
            >
              <Save className="size-4" /> Enregistrer la séquence
            </Button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 overflow-auto relative flex flex-col">
          {/* Context Switcher Header */}
          <div className="h-16 border-b border-white/5 bg-black/40 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-20">
            <div className="flex items-center gap-3 p-1.5 bg-white/[0.03] border border-white/10 rounded-2xl shadow-inner">
              <button
                onClick={() => setSelectedProspect(null)}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${
                  !selectedProspect
                    ? "bg-white text-black shadow-[0_10px_20px_rgba(255,255,255,0.1)] scale-105"
                    : "text-white/30 hover:text-white hover:bg-white/5"
                }`}
              >
                Structure Globale
              </button>
              <div className="w-px h-5 bg-white/10 mx-1" />
              <div className="relative group">
                <button
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-3 ${
                    selectedProspect
                      ? "bg-blue-600 text-white shadow-[0_10px_30px_rgba(37,99,235,0.3)] scale-105"
                      : "text-white/30 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Users className="size-3.5" />
                  {selectedProspect
                    ? selectedProspect.decision_maker
                    : "Personnalisation Prospect"}
                  <ChevronDown className="size-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                </button>

                {/* Dropdown for prospects */}
                <div className="absolute top-full left-0 mt-3 w-72 bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 overflow-hidden translate-y-2 group-hover:translate-y-0">
                  <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">
                      Sélectionner un prospect
                    </p>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto p-2 scrollbar-hide">
                    {prospects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProspect(p)}
                        className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-200 ${
                          selectedProspect?.id === p.id
                            ? "bg-blue-500/10 text-white ring-1 ring-blue-500/20"
                            : "text-white/50 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <div className="size-10 rounded-lg bg-white/5 overflow-hidden border border-white/5 shadow-lg">
                          {p.photo_url ? (
                            <img
                              src={p.photo_url}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Users className="size-4 m-3 text-white/20" />
                          )}
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="text-[13px] font-bold truncate tracking-tight">
                            {p.decision_maker}
                          </p>
                          <p className="text-[10px] text-white/30 font-medium truncate mt-0.5">
                            {p.company_name}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase tracking-widest">
                <div
                  className={`size-1.5 rounded-full ${selectedProspect ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"}`}
                />
                Mode :{" "}
                {selectedProspect ? "Aperçu Prospect" : "Édition Campagne"}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto relative">
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                backgroundSize: "40px 40px",
              }}
            />

            <div className="min-w-max min-h-full p-20 flex flex-col items-center">
              <div className="mb-6 px-4 py-2 rounded-full text-xs font-bold text-white/60 bg-white/5 border border-white/10 shadow-lg">
                Début de séquence
              </div>

              <SequenceTree
                nodes={steps}
                stepIndices={stepIndices}
                selectedProspect={selectedProspect}
                replaceVariables={replaceVariables}
                formatConditionLabel={formatConditionLabel}
                onEdit={setEditingStepId}
                onAdd={(parentId, step, branch) =>
                  setSteps((s) => addStep(s, parentId, step, branch))
                }
              />

              <AddNodeButton
                previousStep={steps[steps.length - 1]}
                onClick={(step) => setSteps((s) => addStep(s, "root", step))}
              />

              <div className="mt-8 size-4 rounded-full border-4 border-white/20 bg-[#0A0A0A]" />
            </div>
          </div>
        </div>

        {/* Edit Panel */}
        <AnimatePresence>
          {editingStep && (
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 bottom-0 w-[400px] bg-[#0c0c0c] border-l border-white/10 shadow-2xl z-50 flex flex-col"
            >
              <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#050505]">
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = getIconForType(
                      editingStep.type,
                      editingStep.channel,
                    );
                    const color = getColorForType(
                      editingStep.type,
                      editingStep.channel,
                    );
                    return (
                      <div className={`p-2 rounded-lg border ${color}`}>
                        <Icon className="size-4" />
                      </div>
                    );
                  })()}
                  <h3 className="font-bold text-white">Éditer l'étape</h3>
                </div>
                <button
                  onClick={() => setEditingStepId(null)}
                  className="p-1.5 text-white/40 hover:text-white bg-white/5 rounded-md"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {editingStep.type === "condition" ? (
                  <div className="space-y-4">
                    <label className="text-xs text-white/50 uppercase tracking-widest font-bold">
                      Choix de la condition
                    </label>
                    <select
                      value={editingStep.name}
                      onChange={(e) =>
                        setSteps((s) =>
                          updateStep(s, editingStep.id, {
                            name: e.target.value,
                          }),
                        )
                      }
                      className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30"
                    >
                      {CONDITIONS.map((c) => (
                        <option key={c} value={c}>
                          {formatConditionLabel(c, selectedProspect)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : editingStep.type === "wait" ? (
                  <div className="space-y-4">
                    <label className="text-xs text-white/50 uppercase tracking-widest font-bold">
                      Nombre de jours
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={editingStep.config.days || 1}
                      onChange={(e) =>
                        setSteps((s) =>
                          updateStep(s, editingStep.id, {
                            config: { days: parseInt(e.target.value) },
                            name: `Attendre ${e.target.value} jours`,
                          }),
                        )
                      }
                      className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30"
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs text-white/50 uppercase tracking-widest font-bold">
                        Action
                      </label>
                      <p className="text-sm font-medium text-white">
                        {editingStep.name}{" "}
                        {editingStep.channel ? `(${editingStep.channel})` : ""}
                      </p>
                    </div>
                    {(editingStep.config.message !== undefined ||
                      editingStep.name.includes("message") ||
                      editingStep.name.includes("Invitation")) && (
                      <div className="space-y-6">
                        {selectedProspect ? (
                          <>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs text-blue-400 uppercase tracking-widest font-bold">
                                    Message Individuel
                                  </label>
                                  {prospectOverrides[selectedProspect.id]?.[
                                    editingStep.id
                                  ] ? (
                                    <div className="flex items-center gap-1.5 text-[9px] text-blue-400/60 font-bold uppercase">
                                      <CheckCircle2 className="size-2.5" /> IA
                                      Personnalisé / Édité
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 text-[9px] text-white/30 font-bold uppercase">
                                      <AlertCircle className="size-2.5" />{" "}
                                      Utilise le modèle générique
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {campaignId &&
                                    !prospectOverrides[selectedProspect.id]?.[
                                      editingStep.id
                                    ] && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2 text-[10px] bg-blue-500/5 border-blue-500/20 text-blue-400 hover:bg-blue-500/10"
                                        onClick={async () => {
                                          // Trigger individual qualification/personalization
                                          // For now, let's just simulate or call an action
                                          alert(
                                            "Génération de la personnalisation IA en cours...",
                                          );
                                        }}
                                      >
                                        <Zap className="size-3 mr-1" /> Générer
                                        IA
                                      </Button>
                                    )}
                                  <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 font-bold">
                                    PRIORITAIRE
                                  </span>
                                </div>
                              </div>
                              <textarea
                                rows={8}
                                value={
                                  prospectOverrides[selectedProspect.id]?.[
                                    editingStep.id
                                  ] ??
                                  replaceVariables(
                                    editingStep.config.message || "",
                                    selectedProspect,
                                  )
                                }
                                onChange={(e) =>
                                  setProspectOverrides((prev) => ({
                                    ...prev,
                                    [selectedProspect.id]: {
                                      ...(prev[selectedProspect.id] || {}),
                                      [editingStep.id]: e.target.value,
                                    },
                                  }))
                                }
                                className="w-full bg-blue-500/5 border border-blue-500/20 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/40 resize-none font-sans shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                                placeholder={`Adaptez le message spécifiquement pour ${selectedProspect.decision_maker.split(" ")[0]}...`}
                              />
                              <p className="text-[10px] text-blue-400/60 italic">
                                Ce texte est prioritaire et sera envoyé à ce
                                prospect. Si vide, le modèle global sera
                                utilisé.
                              </p>
                            </div>

                            <div className="pt-6 border-t border-white/5 space-y-3 opacity-40 hover:opacity-100 transition-opacity group">
                              <div className="flex items-center justify-between">
                                <label className="text-xs text-white/40 uppercase tracking-widest font-bold group-hover:text-white/60">
                                  Modèle Global (Campagne entière)
                                </label>
                                <span className="text-[9px] text-white/20 font-bold uppercase">
                                  Fallback
                                </span>
                              </div>
                              <textarea
                                rows={4}
                                value={editingStep.config.message || ""}
                                onChange={(e) =>
                                  setSteps((s) =>
                                    updateStep(s, editingStep.id, {
                                      config: { message: e.target.value },
                                    }),
                                  )
                                }
                                className="w-full bg-[#111] border border-white/5 rounded-lg px-4 py-3 text-[13px] text-white/60 focus:outline-none focus:border-white/20 resize-none font-sans"
                                placeholder="Votre message générique..."
                              />
                              <div className="flex flex-wrap gap-2 pt-1">
                                {VARIABLES.map((v) => (
                                  <button
                                    key={v}
                                    onClick={() =>
                                      setSteps((s) =>
                                        updateStep(s, editingStep.id, {
                                          config: {
                                            message:
                                              (editingStep.config.message ||
                                                "") + v,
                                          },
                                        }),
                                      )
                                    }
                                    className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                                  >
                                    {v}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs text-white/50 uppercase tracking-widest font-bold">
                                  Modèle de message (Campagne entière)
                                </label>
                              </div>
                              <textarea
                                rows={10}
                                value={editingStep.config.message || ""}
                                onChange={(e) =>
                                  setSteps((s) =>
                                    updateStep(s, editingStep.id, {
                                      config: { message: e.target.value },
                                    }),
                                  )
                                }
                                className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 resize-none font-sans"
                                placeholder="Votre message avec variables..."
                              />
                              <div className="flex flex-wrap gap-2 pt-2">
                                {VARIABLES.map((v) => (
                                  <button
                                    key={v}
                                    onClick={() =>
                                      setSteps((s) =>
                                        updateStep(s, editingStep.id, {
                                          config: {
                                            message:
                                              (editingStep.config.message ||
                                                "") + v,
                                          },
                                        }),
                                      )
                                    }
                                    className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                                  >
                                    {v}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="p-4 border-t border-white/10 bg-[#050505] flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSteps((s) => deleteStep(s, editingStep.id));
                    setEditingStepId(null);
                  }}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-2"
                >
                  <Trash2 className="size-4" /> Supprimer
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------

function DraggableAction({ action }: { action: any }) {
  // We use HTML5 drag and drop or just simple click to add (for simplicity in this implementation)
  const Icon = getIconForType(action.type, action.channel);
  const color = getColorForType(action.type, action.channel);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/json", JSON.stringify(action));
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/10 cursor-grab active:cursor-grabbing transition-colors"
    >
      <div className={`p-1.5 rounded-lg border ${color}`}>
        <Icon className="size-4" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-white">{action.name}</p>
      </div>
      <div className="p-1 rounded bg-white/5 text-white/40">
        <Plus className="size-3" />
      </div>
    </div>
  );
}

function SequenceTree({
  nodes,
  stepIndices,
  onEdit,
  onAdd,
  selectedProspect,
  replaceVariables,
  formatConditionLabel,
  previousStep,
}: {
  nodes: StepNode[];
  stepIndices: Record<string, number>;
  onEdit: (id: string) => void;
  onAdd: (parentId: string, step: StepNode, branch?: "yes" | "no") => void;
  selectedProspect?: any;
  replaceVariables?: (text: string, prospect: any, stepId?: string) => string;
  formatConditionLabel?: (label: string, prospect: any) => string;
  previousStep?: StepNode;
}) {
  return (
    <div className="flex flex-col items-center gap-6">
      {nodes.map((node, index) => (
        <div
          key={node.id}
          className="flex flex-col items-center relative z-10 w-full"
        >
          <NodeCard
            node={node}
            stepNumber={stepIndices[node.id]}
            onEdit={onEdit}
            selectedProspect={selectedProspect}
            replaceVariables={replaceVariables}
            formatConditionLabel={formatConditionLabel}
          />

          {node.type === "condition" ? (
            <div className="flex flex-col items-center">
              <div className="flex mt-6 w-[600px] relative justify-center">
                {/* Branch Lines */}
                <div className="absolute top-0 left-1/4 right-1/4 h-px bg-white/20" />
                <div className="absolute top-0 left-1/4 w-px h-6 bg-white/20" />
                <div className="absolute top-0 right-1/4 w-px h-6 bg-white/20" />
                <div className="absolute -top-6 left-1/2 w-px h-6 bg-white/20" />

                <div className="flex-1 flex flex-col items-center pt-6 px-4">
                  <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 mb-6 border border-emerald-500/30">
                    OUI
                  </div>
                  {node.config.yesBranch && node.config.yesBranch.length > 0 ? (
                    <SequenceTree
                      nodes={node.config.yesBranch}
                      stepIndices={stepIndices}
                      onEdit={onEdit}
                      onAdd={onAdd}
                      selectedProspect={selectedProspect}
                      replaceVariables={replaceVariables}
                      formatConditionLabel={formatConditionLabel}
                      previousStep={node}
                    />
                  ) : (
                    <AddNodeButton
                      previousStep={node}
                      onClick={(step) => onAdd(node.id, step, "yes")}
                    />
                  )}
                </div>
                <div className="flex-1 flex flex-col items-center pt-6 px-4">
                  <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 mb-6 border border-red-500/30">
                    NON
                  </div>
                  {node.config.noBranch && node.config.noBranch.length > 0 ? (
                    <SequenceTree
                      nodes={node.config.noBranch}
                      stepIndices={stepIndices}
                      onEdit={onEdit}
                      onAdd={onAdd}
                      selectedProspect={selectedProspect}
                      replaceVariables={replaceVariables}
                      formatConditionLabel={formatConditionLabel}
                      previousStep={node}
                    />
                  ) : (
                    <AddNodeButton
                      previousStep={node}
                      onClick={(step) => onAdd(node.id, step, "no")}
                    />
                  )}
                </div>
              </div>

              {/* Join Connector */}
              {index < nodes.length - 1 && (
                <div className="flex flex-col items-center w-[600px] relative h-12">
                  <div className="absolute top-0 left-1/4 right-1/4 h-px bg-white/20" />
                  <div className="absolute top-0 left-1/4 w-px h-full bg-white/20" />
                  <div className="absolute top-0 right-1/4 w-px h-full bg-white/20" />
                  <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-white/20" />
                  <div className="absolute top-full left-1/2 w-px h-6 bg-white/20" />
                </div>
              )}
            </div>
          ) : (
            // Next item connector
            index < nodes.length - 1 && (
              <div className="w-px h-6 bg-white/20 my-2" />
            )
          )}
        </div>
      ))}
    </div>
  );
}

function NodeCard({
  node,
  stepNumber,
  onEdit,
  selectedProspect,
  replaceVariables,
  formatConditionLabel,
}: {
  node: StepNode;
  stepNumber?: number;
  onEdit: (id: string) => void;
  selectedProspect?: any;
  replaceVariables?: (text: string, prospect: any, stepId?: string) => string;
  formatConditionLabel?: (label: string, prospect: any) => string;
}) {
  const Icon = getIconForType(node.type, node.channel);
  const color = getColorForType(node.type, node.channel);

  const displayName =
    node.type === "condition" && formatConditionLabel
      ? formatConditionLabel(node.name, selectedProspect)
      : node.name;

  return (
    <div
      onClick={() => onEdit(node.id)}
      className="w-[340px] bg-[#0A0A0A] border border-white/10 hover:border-blue-500/40 rounded-2xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.4)] cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 group relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-lg border shrink-0 transition-colors ${color} group-hover:bg-white/5`}
        >
          <Icon className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {stepNumber && (
              <span className="text-[10px] font-bold bg-white/10 text-white/70 px-1.5 py-0.5 rounded uppercase">
                Step {stepNumber}
              </span>
            )}
            <p className="text-sm font-bold text-white leading-tight truncate">
              {displayName}
            </p>
          </div>
          {node.channel && (
            <p className="text-[10px] uppercase tracking-wider text-white/40">
              {node.channel}
            </p>
          )}
          {node.config.days && (
            <p className="text-xs text-white/50 mt-1 flex items-center gap-1.5">
              <Clock className="size-3" /> {node.config.days} jour(s)
            </p>
          )}
        </div>
      </div>

      {node.config.message && (
        <div className="mt-3 p-3 rounded-lg bg-white/[0.03] border border-white/5 group-hover:bg-white/5 transition-colors">
          <p className="text-[11px] text-white/60 line-clamp-3 leading-relaxed font-sans italic">
            {selectedProspect && replaceVariables
              ? replaceVariables(node.config.message, selectedProspect, node.id)
              : node.config.message}
          </p>
        </div>
      )}
    </div>
  );
}

function AddNodeButton({
  onClick,
  previousStep,
}: {
  onClick: (step: StepNode) => void;
  previousStep?: StepNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Intelligent suggestions logic
  let suggestions = ACTIONS.filter((a) =>
    ["Voir profil", "Envoyer message"].includes(a.name),
  );

  if (previousStep) {
    if (previousStep.name === "Voir profil") {
      suggestions = ACTIONS.filter((a) =>
        [
          "Ajouter avec message",
          "Ajouter sans message",
          "Envoyer message",
        ].includes(a.name),
      );
    } else if (
      previousStep.name.includes("Ajouter") ||
      previousStep.name.includes("message")
    ) {
      suggestions = ACTIONS.filter((a) =>
        ["Attendre X jours", "Relance message"].includes(a.name),
      );
    } else if (previousStep.type === "wait") {
      suggestions = ACTIONS.filter((a) =>
        ["Envoyer message", "Voir profil"].includes(a.name),
      );
    } else {
      suggestions = ACTIONS.filter((a) =>
        ["Envoyer message", "Attendre X jours"].includes(a.name),
      );
    }
  }

  const otherActions = ACTIONS.filter((a) => !suggestions.includes(a));

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/json");
    if (data) {
      const action = JSON.parse(data);
      onClick({
        id: generateId(),
        type:
          action.type ||
          (action.name === "Condition SI/SINON" ? "condition" : "linkedin"),
        name: action.name,
        channel: action.channel,
        config: {},
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="relative flex flex-col items-center z-20 my-2">
      <div className="w-px h-6 bg-white/20 mb-2" />
      <button
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => setIsOpen(!isOpen)}
        className="size-8 rounded-full bg-blue-500 hover:bg-blue-400 text-white flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-transform hover:scale-110 border-2 border-[#050505]"
      >
        <Plus className="size-4" />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 w-64 bg-[#0A0A0A] border border-white/10 rounded-xl shadow-2xl overflow-y-auto max-h-[400px] py-2 z-50">
          <div className="px-3 py-1 text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/5">
            Suggestions
          </div>
          {suggestions.map((a) => (
            <button
              key={a.name}
              onClick={() => {
                onClick({
                  id: generateId(),
                  type: a.type,
                  name: a.name,
                  channel: a.channel,
                  config: {},
                });
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-white/90 hover:text-white hover:bg-white/10 flex items-center gap-2"
            >
              {a.name}
            </button>
          ))}
          <div className="border-t border-white/10 my-1" />
          <button
            onClick={() => {
              onClick({
                id: generateId(),
                type: "condition",
                name: CONDITIONS[0],
                channel: CHANNELS.GENERAL,
                config: { yesBranch: [], noBranch: [] },
              });
              setIsOpen(false);
            }}
            className="w-full text-left px-4 py-2 text-sm text-purple-400 hover:bg-purple-500/10 flex items-center gap-2 font-medium"
          >
            Condition SI/SINON
          </button>
          <div className="border-t border-white/10 my-1" />
          <div className="px-3 py-1 text-[10px] font-bold text-white/40 uppercase tracking-widest bg-white/5">
            Autres actions
          </div>
          {otherActions.map((a) => (
            <button
              key={a.name}
              onClick={() => {
                onClick({
                  id: generateId(),
                  type: a.type,
                  name: a.name,
                  channel: a.channel,
                  config: {},
                });
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-white/50 hover:text-white hover:bg-white/5 flex items-center gap-2"
            >
              {a.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
