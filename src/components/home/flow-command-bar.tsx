"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Send, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface FlowContext {
  id: string;
  name: string;
  status?: string;
}

interface Flow {
  id: string;
  display_name: string;
  contextLabel: string;
  placeholder?: string;
  contexts: FlowContext[];
}

export function FlowCommandBar({ initialFlows, onSend }: { initialFlows: Flow[]; onSend?: (text: string) => void }) {
  const flows = initialFlows || [];
  const t = useTranslations("FlowCommandBar");
  
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [selectedContext, setSelectedContext] = useState<FlowContext | null>(null);
  const [inputValue, setInputValue] = useState("");
  
  const [showFlowList, setShowFlowList] = useState(false);
  const [showContextList, setShowContextList] = useState(false);

  // Sync state when props change
  useEffect(() => {
    if (flows.length > 0) {
      setSelectedFlow(flows[0]);
      setSelectedContext(flows[0].contexts[0] || null);
    }
  }, [flows]);

  const handleSubmit = () => {
    if (!inputValue.trim()) return;
    onSend?.(inputValue);
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  // Sync context when flow changes
  const handleFlowChange = (flow: Flow) => {
    setSelectedFlow(flow);
    setSelectedContext(flow.contexts[0] || null);
    setShowFlowList(false);
  };

  // Render even if flows are empty, with fallback labels
  const currentFlow = selectedFlow || { id: "assistant", display_name: t("assistant"), placeholder: t("ask_anything"), contexts: [], contextLabel: t("context") };

  return (
    <div className="absolute bottom-6 left-0 right-0 z-50 flex justify-center px-6 pointer-events-none">
      <div className="relative group w-full max-w-5xl pointer-events-auto">
        {/* Background Glow - Stabilized */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[180%] -z-10 bg-indigo-500/5 blur-[80px] rounded-full" />
        
        {/* The Bar - Premium Glassmorphism */}
        <div className="flex h-[76px] items-center gap-1 bg-[#050505]/80 backdrop-blur-[16px] border border-white/[0.08] rounded-2xl px-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-500 group-hover:border-white/20">
          
          {/* Flow Selector */}
          <div className="relative px-3 border-r border-white/10 h-full flex items-center min-w-[140px]">
            <button 
              onClick={() => setShowFlowList(!showFlowList)}
              className="flex flex-col items-start transition-opacity hover:opacity-80"
            >
              <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">{t("flow")}</span>
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-white">{currentFlow.display_name}</span>
                <ChevronDown className={cn("size-3 text-white/40 transition-transform", showFlowList && "rotate-180")} />
              </div>
            </button>
            
            <AnimatePresence>
              {showFlowList && flows.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: -8, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute bottom-full left-0 mb-2 w-[220px] bg-[#0A0A0A] border border-white/10 rounded-xl p-1.5 shadow-2xl backdrop-blur-xl z-50"
                >
                  <div className="py-1 px-2 text-[10px] font-bold text-white/30 uppercase tracking-widest border-b border-white/5 mb-1.5">
                    {t("select_flow")}
                  </div>
                  <div className="space-y-1">
                    {flows.map((flow) => (
                      <button
                        key={flow.id}
                        onClick={() => handleFlowChange(flow)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all",
                          currentFlow.id === flow.id ? "bg-indigo-500/10 text-indigo-400" : "text-white/60 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        {flow.display_name}
                        {currentFlow.id === flow.id && <div className="size-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]" />}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Input Area */}
          <div className="flex-1 px-4 flex items-center h-full">
            <input 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={currentFlow.placeholder}
              className="w-full bg-transparent border-none outline-none text-white placeholder:text-white/20 text-sm"
            />
          </div>

          {/* Context Selector */}
          <div className="relative px-3 h-full flex items-center min-w-[160px]">
            <button 
              onClick={() => setShowContextList(!showContextList)}
              className="flex flex-col items-start transition-opacity hover:opacity-80"
            >
              <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">{currentFlow.contextLabel}</span>
              <div className="flex items-center gap-2">
                {selectedContext && (
                  <div className={cn(
                    "size-2 rounded-full",
                    selectedContext.status === "active" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]"
                  )} />
                )}
                <span className="text-sm font-medium text-white/80">{selectedContext?.name || t("none")}</span>
                <ChevronDown className={cn("size-3 text-white/40 transition-transform", showContextList && "rotate-180")} />
              </div>
            </button>

            <AnimatePresence>
              {showContextList && currentFlow.contexts.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: -8, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute bottom-full right-0 mb-2 w-[240px] bg-[#0A0A0A] border border-white/10 rounded-xl p-1.5 shadow-2xl backdrop-blur-xl z-50"
                >
                  <div className="py-1 px-2 text-[10px] font-bold text-white/30 uppercase tracking-widest border-b border-white/5 mb-1.5">
                    {currentFlow.contextLabel}
                  </div>
                  <div className="space-y-1">
                    {currentFlow.contexts.map((ctx) => (
                      <button
                        key={ctx.id}
                        onClick={() => {
                          setSelectedContext(ctx);
                          setShowContextList(false);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all",
                          selectedContext?.id === ctx.id ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "size-1.5 rounded-full",
                            ctx.status === "active" ? "bg-emerald-500" : "bg-orange-500"
                          )} />
                          {ctx.name}
                        </div>
                        {selectedContext?.id === ctx.id && <Check className="size-3.5 text-indigo-400" />}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Send Button */}
          <div className="px-2">
            <button
              onClick={handleSubmit}
              className={cn(
                "size-11 rounded-xl flex items-center justify-center transition-all duration-500 shadow-lg",
                inputValue.trim() 
                  ? "bg-indigo-600 text-white shadow-indigo-600/30 hover:bg-indigo-500 hover:shadow-indigo-600/50 hover:-translate-y-0.5 active:translate-y-0 active:scale-95" 
                  : "bg-white/[0.03] text-white/10 cursor-not-allowed"
              )}
              disabled={!inputValue.trim()}
            >
              <Send className={cn("size-[18px] transition-all duration-500", inputValue.trim() ? "translate-x-0.5 -translate-y-0.5 opacity-100" : "opacity-40")} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
