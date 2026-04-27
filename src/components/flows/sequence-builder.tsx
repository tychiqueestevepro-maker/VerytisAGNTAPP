"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Plus, MessageSquare, Mail, Clock, GitBranch, 
  CheckCircle2, AlertCircle, Trash2, Edit2, Zap, Save, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const CHANNELS = {
  LINKEDIN: "LinkedIn",
  GMAIL: "Gmail",
  GENERAL: "Général"
} as const;

export const ACTIONS = [
  { type: "linkedin", name: "Voir profil", channel: CHANNELS.LINKEDIN },
  { type: "linkedin", name: "Ajouter sans message", channel: CHANNELS.LINKEDIN },
  { type: "linkedin", name: "Ajouter avec message", channel: CHANNELS.LINKEDIN },
  { type: "linkedin", name: "Envoyer message", channel: CHANNELS.LINKEDIN },
  { type: "linkedin", name: "Relance message", channel: CHANNELS.LINKEDIN },
  { type: "linkedin", name: "Créer action extension", channel: CHANNELS.LINKEDIN },
  
  { type: "gmail", name: "Envoyer email", channel: CHANNELS.GMAIL },
  { type: "gmail", name: "Relance email", channel: CHANNELS.GMAIL },
  { type: "gmail", name: "Programmer envoi", channel: CHANNELS.GMAIL },
  
  { type: "wait", name: "Attendre X jours", channel: CHANNELS.GENERAL },
  
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
  "SI email existe",
  "SI email envoyé (Gmail)",
  "SI email ouvert (Gmail)",
  "SI email cliqué (Gmail)",
  "SI réponse reçue (LinkedIn ou Gmail)",
  "SI fit_score >= seuil",
  "SI doublon détecté"
];

export const VARIABLES = ["{{first_name}}", "{{last_name}}", "{{company}}", "{{role}}", "{{location}}"];

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
  if (channel === CHANNELS.LINKEDIN) return MessageSquare;
  if (channel === CHANNELS.GMAIL) return Mail;
  if (type === "wait") return Clock;
  if (type === "condition") return GitBranch;
  if (type === "end") return AlertCircle;
  return Zap;
};

const getColorForType = (type: string, channel?: string) => {
  if (channel === CHANNELS.LINKEDIN) return "text-blue-400 bg-blue-500/10 border-blue-500/20";
  if (channel === CHANNELS.GMAIL) return "text-red-400 bg-red-500/10 border-red-500/20";
  if (type === "wait") return "text-amber-400 bg-amber-500/10 border-amber-500/20";
  if (type === "condition") return "text-purple-400 bg-purple-500/10 border-purple-500/20";
  return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
};

interface SequenceBuilderProps {
  initialSteps: any[];
  onClose: () => void;
  onSave?: (steps: StepNode[]) => void;
}

export function SequenceBuilderModal({ initialSteps, onClose, onSave }: SequenceBuilderProps) {
  // Convert flat DB steps or existing tree to our state
  const [steps, setSteps] = useState<StepNode[]>(() => {
    if (initialSteps && initialSteps.length > 0) {
      // Map existing DB data to our tree structure
      // For now, assuming DB might just have flat or tree if it was saved via our UI
      return initialSteps.map(s => {
        // If it comes from DB, try to infer
        return {
          id: s.id || generateId(),
          type: s.action_type || 'linkedin',
          name: s.name || 'Nouvelle action',
          channel: s.config?.channel || CHANNELS.LINKEDIN,
          config: s.config || {}
        };
      });
    }
    return [
      {
        id: generateId(),
        type: "condition",
        name: "SI linkedin_url existe",
        config: {
          yesBranch: [{ id: generateId(), type: "linkedin", name: "Voir profil", channel: CHANNELS.LINKEDIN, config: {} }],
          noBranch: [{ id: generateId(), type: "gmail", name: "Envoyer email", channel: CHANNELS.GMAIL, config: {} }]
        }
      }
    ];
  });

  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  
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

  const updateStep = (nodes: StepNode[], id: string, updates: Partial<StepNode>): StepNode[] => {
    return nodes.map(node => {
      if (node.id === id) {
        return { ...node, ...updates, config: { ...node.config, ...updates.config } };
      }
      return {
        ...node,
        config: {
          ...node.config,
          yesBranch: node.config.yesBranch ? updateStep(node.config.yesBranch, id, updates) : undefined,
          noBranch: node.config.noBranch ? updateStep(node.config.noBranch, id, updates) : undefined,
        }
      };
    });
  };

  const deleteStep = (nodes: StepNode[], id: string): StepNode[] => {
    return nodes.filter(node => node.id !== id).map(node => ({
      ...node,
      config: {
        ...node.config,
        yesBranch: node.config.yesBranch ? deleteStep(node.config.yesBranch, id) : undefined,
        noBranch: node.config.noBranch ? deleteStep(node.config.noBranch, id) : undefined,
      }
    }));
  };

  const addStep = (nodes: StepNode[], targetId: string, newStep: StepNode, branch?: 'yes' | 'no'): StepNode[] => {
    // If targetId is 'root', we just push to nodes
    if (targetId === 'root') {
      return [...nodes, newStep];
    }
    
    // Otherwise we need to add it AFTER targetId, or INSIDE targetId if it's a branch
    const newNodes: StepNode[] = [];
    for (const node of nodes) {
      if (node.id === targetId) {
        if (branch === 'yes') {
          newNodes.push({
            ...node,
            config: { ...node.config, yesBranch: [...(node.config.yesBranch || []), newStep] }
          });
        } else if (branch === 'no') {
          newNodes.push({
            ...node,
            config: { ...node.config, noBranch: [...(node.config.noBranch || []), newStep] }
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
            yesBranch: node.config.yesBranch ? addStep(node.config.yesBranch, targetId, newStep, branch) : undefined,
            noBranch: node.config.noBranch ? addStep(node.config.noBranch, targetId, newStep, branch) : undefined,
          }
        });
      }
    }
    return newNodes;
  };

  const editingStep = editingStepId ? findStep(steps, editingStepId) : null;

  const handleSave = () => {
    if (onSave) onSave(steps);
    // Ideally here we transform our tree back to a flat array or keep it nested in config, 
    // depending on the backend logic.
    onClose();
  };

  let stepCounter = 1;
  const stepIndices: Record<string, number> = {};
  const computeStepIndices = (nodes: StepNode[]) => {
    for (const node of nodes) {
      stepIndices[node.id] = stepCounter++;
      if (node.config.yesBranch) computeStepIndices(node.config.yesBranch);
      if (node.config.noBranch) computeStepIndices(node.config.noBranch);
    }
  };
  computeStepIndices(steps);

  return (
    <div className="fixed inset-0 z-[100] flex bg-black/90 backdrop-blur-sm overflow-hidden">
      {/* Sidebar for Action Addition / Sequence Overview */}
      <div className="w-80 bg-[#050505] border-r border-white/10 flex flex-col shrink-0 relative z-10">
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-emerald-400" />
            <h2 className="font-bold text-white">Séquence Flow</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/40 hover:text-white transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest">LinkedIn</h3>
            {ACTIONS.filter(a => a.channel === CHANNELS.LINKEDIN).map(a => (
              <DraggableAction key={a.name} action={a} />
            ))}
          </div>
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest">Gmail</h3>
            {ACTIONS.filter(a => a.channel === CHANNELS.GMAIL).map(a => (
              <DraggableAction key={a.name} action={a} />
            ))}
          </div>
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest">Général & Conditions</h3>
            <DraggableAction action={{ type: "condition", name: "Condition SI/SINON" }} />
            {ACTIONS.filter(a => a.channel === CHANNELS.GENERAL).map(a => (
              <DraggableAction key={a.name} action={a} />
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-white/10 bg-[#0a0a0a]">
          <Button onClick={handleSave} className="w-full bg-white text-black hover:bg-white/90 font-bold gap-2">
            <Save className="size-4" /> Enregistrer la séquence
          </Button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 overflow-auto relative">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        
        <div className="min-w-max min-h-full p-20 flex flex-col items-center">
          <div className="mb-6 px-4 py-2 rounded-full text-xs font-bold text-white/60 bg-white/5 border border-white/10 shadow-lg">
            Début de séquence
          </div>
          
          <SequenceTree 
            nodes={steps} 
            stepIndices={stepIndices}
            onEdit={setEditingStepId} 
            onAdd={(parentId, step, branch) => setSteps(s => addStep(s, parentId, step, branch))}
          />

          <AddNodeButton previousStep={steps[steps.length - 1]} onClick={(step) => setSteps(s => addStep(s, 'root', step))} />
          
          <div className="mt-8 size-4 rounded-full border-4 border-white/20 bg-[#0A0A0A]" />
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
                  const Icon = getIconForType(editingStep.type, editingStep.channel);
                  const color = getColorForType(editingStep.type, editingStep.channel);
                  return <div className={`p-2 rounded-lg border ${color}`}><Icon className="size-4" /></div>;
                })()}
                <h3 className="font-bold text-white">Éditer l'étape</h3>
              </div>
              <button onClick={() => setEditingStepId(null)} className="p-1.5 text-white/40 hover:text-white bg-white/5 rounded-md">
                <X className="size-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {editingStep.type === 'condition' ? (
                <div className="space-y-4">
                  <label className="text-xs text-white/50 uppercase tracking-widest font-bold">Choix de la condition</label>
                  <select 
                    value={editingStep.name}
                    onChange={e => setSteps(s => updateStep(s, editingStep.id, { name: e.target.value }))}
                    className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30"
                  >
                    {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              ) : editingStep.type === 'wait' ? (
                <div className="space-y-4">
                  <label className="text-xs text-white/50 uppercase tracking-widest font-bold">Nombre de jours</label>
                  <input 
                    type="number" 
                    min="1"
                    value={editingStep.config.days || 1}
                    onChange={e => setSteps(s => updateStep(s, editingStep.id, { config: { days: parseInt(e.target.value) }, name: `Attendre ${e.target.value} jours` }))}
                    className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30"
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-xs text-white/50 uppercase tracking-widest font-bold">Action</label>
                    <p className="text-sm font-medium text-white">{editingStep.name} {editingStep.channel ? `(${editingStep.channel})` : ''}</p>
                  </div>

                  {editingStep.channel === CHANNELS.GMAIL && (
                    <div className="space-y-2">
                      <label className="text-xs text-white/50 uppercase tracking-widest font-bold">Sujet de l'email</label>
                      <input 
                        type="text"
                        value={editingStep.config.subject || ''}
                        onChange={e => setSteps(s => updateStep(s, editingStep.id, { config: { subject: e.target.value } }))}
                        className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30"
                        placeholder="Sujet..."
                      />
                    </div>
                  )}

                  {((editingStep.channel === CHANNELS.LINKEDIN && editingStep.name.includes("message")) || editingStep.channel === CHANNELS.GMAIL) && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-white/50 uppercase tracking-widest font-bold">Message</label>
                      </div>
                      <textarea 
                        rows={8}
                        value={editingStep.config.message || ''}
                        onChange={e => setSteps(s => updateStep(s, editingStep.id, { config: { message: e.target.value } }))}
                        className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 resize-none font-sans"
                        placeholder="Votre message ici..."
                      />
                      <div className="flex flex-wrap gap-2 pt-2">
                        {VARIABLES.map(v => (
                          <button 
                            key={v}
                            onClick={() => setSteps(s => updateStep(s, editingStep.id, { config: { message: (editingStep.config.message || '') + v } }))}
                            className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-4 border-t border-white/10 bg-[#050505] flex gap-3">
              <Button variant="ghost" onClick={() => { setSteps(s => deleteStep(s, editingStep.id)); setEditingStepId(null); }} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-2">
                <Trash2 className="size-4" /> Supprimer
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
      <div className={`p-1.5 rounded-lg border ${color}`}><Icon className="size-4" /></div>
      <div className="flex-1">
        <p className="text-sm font-medium text-white">{action.name}</p>
      </div>
      <div className="p-1 rounded bg-white/5 text-white/40"><Plus className="size-3" /></div>
    </div>
  );
}

function SequenceTree({ nodes, stepIndices, onEdit, onAdd, previousStep }: { nodes: StepNode[], stepIndices: Record<string, number>, onEdit: (id: string) => void, onAdd: (parentId: string, step: StepNode, branch?: 'yes'|'no') => void, previousStep?: StepNode }) {
  return (
    <div className="flex flex-col items-center gap-6">
      {nodes.map((node, index) => (
        <div key={node.id} className="flex flex-col items-center relative z-10 w-full">
          <NodeCard node={node} stepNumber={stepIndices[node.id]} onEdit={onEdit} />
          
          {node.type === 'condition' ? (
            <div className="flex mt-6 w-[600px] relative justify-center">
              {/* Branch Lines */}
              <div className="absolute top-0 left-1/4 right-1/4 h-px bg-white/20" />
              <div className="absolute top-0 left-1/4 w-px h-6 bg-white/20" />
              <div className="absolute top-0 right-1/4 w-px h-6 bg-white/20" />
              <div className="absolute -top-6 left-1/2 w-px h-6 bg-white/20" />

              <div className="flex-1 flex flex-col items-center pt-6 px-4">
                <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 mb-6 border border-emerald-500/30">OUI</div>
                {node.config.yesBranch && node.config.yesBranch.length > 0 ? (
                  <SequenceTree nodes={node.config.yesBranch} stepIndices={stepIndices} onEdit={onEdit} onAdd={onAdd} previousStep={node} />
                ) : (
                  <AddNodeButton previousStep={node} onClick={(step) => onAdd(node.id, step, 'yes')} />
                )}
              </div>
              <div className="flex-1 flex flex-col items-center pt-6 px-4">
                <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 mb-6 border border-red-500/30">NON</div>
                {node.config.noBranch && node.config.noBranch.length > 0 ? (
                  <SequenceTree nodes={node.config.noBranch} stepIndices={stepIndices} onEdit={onEdit} onAdd={onAdd} previousStep={node} />
                ) : (
                  <AddNodeButton previousStep={node} onClick={(step) => onAdd(node.id, step, 'no')} />
                )}
              </div>
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

function NodeCard({ node, stepNumber, onEdit }: { node: StepNode, stepNumber?: number, onEdit: (id: string) => void }) {
  const Icon = getIconForType(node.type, node.channel);
  const color = getColorForType(node.type, node.channel);
  
  return (
    <div 
      onClick={() => onEdit(node.id)}
      className="w-[300px] bg-[#0c0c0c] border border-white/10 hover:border-white/30 rounded-xl p-4 shadow-xl cursor-pointer transition-all hover:scale-[1.02]"
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg border shrink-0 ${color}`}>
          <Icon className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {stepNumber && <span className="text-[10px] font-bold bg-white/10 text-white/70 px-1.5 py-0.5 rounded uppercase">Step {stepNumber}</span>}
            <p className="text-sm font-bold text-white leading-tight">{node.name}</p>
          </div>
          {node.channel && (
            <p className="text-[10px] uppercase tracking-wider text-white/40">{node.channel}</p>
          )}
          {node.config.days && <p className="text-xs text-white/50 mt-1">{node.config.days} jour(s)</p>}
        </div>
      </div>
    </div>
  );
}

function AddNodeButton({ onClick, previousStep }: { onClick: (step: StepNode) => void, previousStep?: StepNode }) {
  const [isOpen, setIsOpen] = useState(false);

  // Intelligent suggestions logic
  let suggestions = ACTIONS.filter(a => ["Voir profil", "Envoyer message"].includes(a.name));
  
  if (previousStep) {
    if (previousStep.name === "Voir profil") {
      suggestions = ACTIONS.filter(a => ["Ajouter avec message", "Ajouter sans message", "Envoyer message"].includes(a.name));
    } else if (previousStep.name.includes("Ajouter") || previousStep.name.includes("message") || previousStep.name.includes("email")) {
      suggestions = ACTIONS.filter(a => ["Attendre X jours", "Relance message", "Relance email"].includes(a.name));
    } else if (previousStep.type === "wait") {
      suggestions = ACTIONS.filter(a => ["Envoyer message", "Envoyer email", "Voir profil"].includes(a.name));
    } else {
      suggestions = ACTIONS.filter(a => ["Envoyer message", "Envoyer email", "Attendre X jours"].includes(a.name));
    }
  }

  const otherActions = ACTIONS.filter(a => !suggestions.includes(a));

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/json");
    if (data) {
      const action = JSON.parse(data);
      onClick({
        id: generateId(),
        type: action.type || (action.name === 'Condition SI/SINON' ? 'condition' : 'linkedin'),
        name: action.name,
        channel: action.channel,
        config: {}
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
          <div className="px-3 py-1 text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/5">Suggestions</div>
          {suggestions.map(a => (
            <button 
              key={a.name}
              onClick={() => { onClick({ id: generateId(), type: a.type, name: a.name, channel: a.channel, config: {} }); setIsOpen(false); }}
              className="w-full text-left px-4 py-2 text-sm text-white/90 hover:text-white hover:bg-white/10 flex items-center gap-2"
            >
              {a.name}
            </button>
          ))}
          <div className="border-t border-white/10 my-1" />
          <button 
            onClick={() => { onClick({ id: generateId(), type: 'condition', name: CONDITIONS[0], config: {} }); setIsOpen(false); }}
            className="w-full text-left px-4 py-2 text-sm text-purple-400 hover:bg-purple-500/10 flex items-center gap-2 font-medium"
          >
            Condition SI/SINON
          </button>
          <div className="border-t border-white/10 my-1" />
          <div className="px-3 py-1 text-[10px] font-bold text-white/40 uppercase tracking-widest bg-white/5">Autres actions</div>
          {otherActions.map(a => (
            <button 
              key={a.name}
              onClick={() => { onClick({ id: generateId(), type: a.type, name: a.name, channel: a.channel, config: {} }); setIsOpen(false); }}
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
