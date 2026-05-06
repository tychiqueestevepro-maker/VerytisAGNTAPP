"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FlowCommandBar } from "@/components/home/flow-command-bar";
import { getClientFlows, getFlowCampaigns } from "@/lib/flows/actions";
import { useTranslations } from "next-intl";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
}

export default function HomePage() {
  const [flows, setFlows] = useState<any[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("Dashboard");

  useEffect(() => {
    async function loadData() {
      const { data: rawFlows } = await getClientFlows();
      const enriched = await Promise.all(
        (rawFlows || []).map(async (flow) => {
          const { data: campaigns } = await getFlowCampaigns(flow.id);
          return {
            ...flow,
            contexts: (campaigns || []).map((c: any) => ({ 
              id: c.id, 
              name: c.display_name,
              status: c.status
            })),
            contextLabel: flow.flow_key === "prospecting" ? t("campaign") : t("context")
          };
        })
      );
      setFlows(enriched);
    }
    loadData();
  }, [t]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (text: string) => {
    const userMsg: Message = { id: Date.now().toString(), text, sender: "user" };
    setMessages(prev => [...prev, userMsg]);

    // Auto reply after a short delay
    setTimeout(() => {
      const botMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        text: t("bot_reply"), 
        sender: "bot" 
      };
      setMessages(prev => [...prev, botMsg]);
    }, 600);
  };

  return (
    <div className="relative flex flex-col h-screen w-full overflow-hidden">
      {/* Background Atmosphere - Scoped to Home only */}
      <div className="fixed inset-0 bg-black -z-20" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,#1e1b4b,transparent_70%)] opacity-40 -z-10" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_100%,#312e81,transparent_50%)] opacity-20 -z-10" />
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.01] brightness-100 pointer-events-none -z-10" />
      
      {/* Grid Pattern */}
      <div 
        className="fixed inset-0 opacity-[0.05] -z-10 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.1) 0.5px, transparent 0.5px)`,
          backgroundSize: '64px 64px'
        }}
      />

      {/* Chat History Area - Scrollable internal container */}
      <div 
        ref={scrollRef}
        className="flex-1 w-full overflow-y-auto pt-10 pb-40 space-y-12 scroll-smooth no-scrollbar"
      >
        <AnimatePresence mode="popLayout">
          {messages.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center pt-20"
            >

              <h1 className="text-3xl font-bold text-white mb-4 tracking-tight">{t("title")}</h1>
              <p className="text-white/30 text-sm max-w-sm text-center leading-relaxed">
                {t("subtitle")}
              </p>
            </motion.div>


          ) : (
            messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative flex w-full ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {/* Full-screen width Aura Layer - Optimized for Sidebar Motion */}
                <div className={`absolute -inset-y-60 ${msg.sender === "user" ? "right-0" : "left-0"} w-2/3 z-0 pointer-events-none`}>
                  <motion.div
                    className="h-full w-full blur-[60px]"
                    animate={{
                      opacity: [0.2, 0.35, 0.2],
                    }}
                    transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                    style={{
                      transform: 'translate3d(0,0,0)',
                      background: msg.sender === "user"
                        ? "radial-gradient(circle at 100% 50%, #db2777 0%, transparent 70%)"
                        : "radial-gradient(circle at 0% 50%, #7c3aed 0%, transparent 70%)"
                    }}
                  />
                </div>

                {/* Centered Bubble Container */}
                <div className="w-full max-w-5xl mx-auto px-6 flex flex-col items-center relative z-10">
                  <div className={`w-full flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[70%]">
                      <div className={`
                        px-6 py-4 rounded-2xl text-[15px] leading-relaxed shadow-2xl backdrop-blur-sm border transition-all duration-300
                        ${msg.sender === "user" 
                          ? "bg-black/60 text-white rounded-tr-none border-pink-500/20 shadow-[0_0_30px_rgba(236,72,153,0.03)]" 
                          : "bg-[#080808]/60 text-white/90 rounded-tl-none border-violet-500/20 shadow-[0_0_30px_rgba(139,92,246,0.03)]"}
                      `}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
      
      {/* Command Bar - Absolute within the h-screen container */}
      <div className="absolute bottom-8 left-0 right-0 pointer-events-none z-50">
        <FlowCommandBar initialFlows={flows} onSend={handleSend} />
      </div>
    </div>
  );
}
