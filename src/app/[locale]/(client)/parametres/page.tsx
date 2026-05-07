"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import { SectionHeading } from "@/components/layout/section-heading";
import { TopLine } from "@/components/layout/top-line";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { settingsSchema, type SettingsForm } from "@/lib/schemas/settings";
import { getSettings, updateSettings, getOrganizationMembers } from "@/lib/actions/settings";
import { cn } from "@/lib/utils";
import { User, Building2, Users, Target, Save, Loader2, CheckCircle2, Globe } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";

export default function ParametresPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [members, setMembers] = useState<any[]>([]);

  const t = useTranslations("Settings");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema) as any,

    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      company_name: "",
      avatar_url: "",
      industry: "",
      website: "",
      openai_api_key: "",
      min_fit_score: 70,
      tone: "",
      offer_type: "",
      message_style: "short",
      excluded_sectors: [],
      required_fields: [],
      prospection_playbook_goal: "",
      prospection_playbook_method: "",
      prospection_qualification_rules: "",
      prospection_priority_rules: "",
      prospection_exclusion_rules: "",
      prospection_message_angle: "",
      prospection_require_human_review: true,
      prospection_auto_accept_above: 80,
      prospection_review_min: 50,
      prospection_review_max: 79,
      prospection_reject_below: 50,
      daily_cost_limit: 0,
      daily_prospect_limit: 0,
      daily_message_limit: 0,
      active_flows: [] as { key: string; label: string; status: string }[],
    }
  });



  const userRole = form.watch("user_role");
  const tabs = [
    { id: "profile", label: t("tab_profile"), icon: User },
    { id: "organization", label: t("tab_organization"), icon: Building2 },
    { id: "prospection", label: t("tab_prospection"), icon: Target },
    ...(userRole === "owner" ? [{ id: "members", label: t("tab_members"), icon: Users }] : []),
  ];

  useEffect(() => {
    async function loadSettings() {
      const { data, error } = await getSettings();
      if (data) {
        form.reset(data);
      }
      setIsLoading(false);
    }
    loadSettings();
  }, [form]);

  useEffect(() => {
    if (activeTab === "members") {
      async function loadMembers() {
        const { data } = await getOrganizationMembers();
        if (data) setMembers(data);
      }
      loadMembers();
    }
  }, [activeTab]);


  const onSubmit = async (data: SettingsForm) => {
    setIsSaving(true);
    try {
      const result = await updateSettings(data);
      if (result.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else if (result.error) {
        alert(result.error);
      }
    } catch (err) {
      console.error("Submission error:", err);
      alert(t("unexpected_error"));
    } finally {
      setIsSaving(false);
    }
  };

  // Log validation errors for debugging
  useEffect(() => {
    if (Object.keys(form.formState.errors).length > 0) {
      console.log("Validation errors:", form.formState.errors);
    }
  }, [form.formState.errors]);


  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-white/20" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <TopLine />
      <div className="flex items-center justify-between mb-8">
        <SectionHeading>{t("title")}</SectionHeading>
        <Button 
          onClick={form.handleSubmit(onSubmit)}
          disabled={isSaving}
          className="bg-white text-black hover:bg-white/90 px-6 rounded-full h-10 transition-all active:scale-95"
        >
          {isSaving ? (
            <Loader2 className="size-4 animate-spin mr-2" />
          ) : saveSuccess ? (
            <CheckCircle2 className="size-4 mr-2 text-green-600" />
          ) : (
            <Save className="size-4 mr-2" />
          )}
          {saveSuccess ? tCommon("saved") : tCommon("save")}
        </Button>
      </div>

      <div className="flex gap-12">
        {/* Tabs Sidebar */}
        <div className="w-48 shrink-0 flex flex-col gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200",
                  active 
                    ? "bg-white/10 text-white font-medium" 
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                )}
              >
                <Icon className={cn("size-4", active ? "text-white" : "text-white/30")} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              {activeTab === "profile" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <FormField 
                      label={t("first_name")} 
                      register={form.register("first_name")} 
                      error={form.formState.errors.first_name?.message}
                    />
                    <FormField 
                      label={t("last_name")} 
                      register={form.register("last_name")} 
                      error={form.formState.errors.last_name?.message}
                    />
                  </div>
                  <FormField 
                    label={t("email")} 
                    type="email"
                    register={form.register("email")} 
                    error={form.formState.errors.email?.message}
                    disabled
                  />
                  <FormField 
                    label={t("avatar_url")} 
                    register={form.register("avatar_url")} 
                    error={form.formState.errors.avatar_url?.message}
                    placeholder="https://..."
                  />

                  {/* Language Selector */}
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase tracking-[0.15em] text-white/40 block">
                      {t("language")}
                    </span>
                    <div className="flex gap-2">
                      {["fr", "en"].map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => router.replace(pathname, { locale: l })}
                          className={cn(
                            "flex-1 h-11 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2",
                            locale === l
                              ? "bg-white/10 border-white/20 text-white"
                              : "bg-white/[0.03] border-white/5 text-white/40 hover:bg-white/[0.05] hover:border-white/10"
                          )}
                        >
                          <Globe className={cn("size-3.5", locale === l ? "text-white" : "text-white/20")} />
                          {t(`languages.${l}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "organization" && (
                <div className="space-y-6">
                  <FormField 
                    label={t("company_name")} 
                    register={form.register("company_name")} 
                    error={form.formState.errors.company_name?.message}
                  />
                  <FormField 
                    label={t("industry")} 
                    register={form.register("industry")} 
                    error={form.formState.errors.industry?.message}
                  />
                  <FormField 
                    label={t("website")} 
                    register={form.register("website")} 
                    error={form.formState.errors.website?.message}
                    placeholder="https://..."
                  />
                </div>
              )}

              {activeTab === "prospection" && (
                <div className="space-y-8">
                  <div className="space-y-3">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60 block">
                      {t("prospection_playbook")}
                    </span>
                    <p className="text-sm text-white/40 leading-relaxed">
                      {t("prospection_playbook_desc")}
                    </p>
                  </div>

                  <FormField
                    label={t("playbook_goal")}
                    register={form.register("prospection_playbook_goal")}
                    error={form.formState.errors.prospection_playbook_goal?.message}
                  />

                  <TextAreaField
                    label={t("playbook_method")}
                    register={form.register("prospection_playbook_method")}
                    error={form.formState.errors.prospection_playbook_method?.message}
                    rows={3}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <TextAreaField
                      label={t("qualification_rules")}
                      register={form.register("prospection_qualification_rules")}
                      error={form.formState.errors.prospection_qualification_rules?.message}
                      rows={7}
                    />
                    <TextAreaField
                      label={t("priority_rules")}
                      register={form.register("prospection_priority_rules")}
                      error={form.formState.errors.prospection_priority_rules?.message}
                      rows={7}
                    />
                    <TextAreaField
                      label={t("exclusion_rules")}
                      register={form.register("prospection_exclusion_rules")}
                      error={form.formState.errors.prospection_exclusion_rules?.message}
                      rows={7}
                    />
                  </div>

                  <TextAreaField
                    label={t("message_angle")}
                    register={form.register("prospection_message_angle")}
                    error={form.formState.errors.prospection_message_angle?.message}
                    rows={3}
                  />

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <NumberField
                      label={t("auto_accept_above")}
                      register={form.register("prospection_auto_accept_above", { valueAsNumber: true })}
                      error={form.formState.errors.prospection_auto_accept_above?.message}
                    />
                    <NumberField
                      label={t("review_min")}
                      register={form.register("prospection_review_min", { valueAsNumber: true })}
                      error={form.formState.errors.prospection_review_min?.message}
                    />
                    <NumberField
                      label={t("review_max")}
                      register={form.register("prospection_review_max", { valueAsNumber: true })}
                      error={form.formState.errors.prospection_review_max?.message}
                    />
                    <NumberField
                      label={t("reject_below")}
                      register={form.register("prospection_reject_below", { valueAsNumber: true })}
                      error={form.formState.errors.prospection_reject_below?.message}
                    />
                  </div>

                  <label className="flex items-start gap-3 p-4 rounded-2xl border border-white/10 bg-white/[0.03] cursor-pointer">
                    <input
                      type="checkbox"
                      {...form.register("prospection_require_human_review")}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-medium text-white">{t("require_human_review")}</span>
                      <span className="block text-xs text-white/40 leading-relaxed mt-1">{t("require_human_review_desc")}</span>
                    </span>
                  </label>
                </div>
              )}

              {activeTab === "members" && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60 block mb-6">{t("organization_members")}</span>
                    <div className="grid grid-cols-1 gap-4">
                      {members.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/10 rounded-2xl hover:bg-white/[0.05] transition-all group">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-white">{member.first_name} {member.last_name}</span>
                            <span className="text-[10px] uppercase tracking-wider text-white/30 font-semibold mt-1">
                              {t(`roles.${member.role || 'member'}`)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            {member.role !== 'owner' && (
                              <button className="text-[11px] font-medium text-red-400/60 hover:text-red-400 transition-colors px-3 py-1.5 hover:bg-red-400/10 rounded-lg">
                                {t("remove")}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                    </div>
                    
                    <button className="mt-6 w-full py-3 border border-dashed border-white/10 rounded-2xl text-[13px] text-white/30 hover:border-white/20 hover:text-white/50 transition-all">
                      {t("invite")}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, register, error, type = "text", placeholder, disabled }: any) {
  return (
    <div className="space-y-2">
      <span className="text-[10px] uppercase tracking-[0.15em] text-white/40 block">{label}</span>
      <Input 
        type={type}
        disabled={disabled}
        placeholder={placeholder}
        {...register}
        className={cn(
          "bg-white/[0.03] border-white/10 focus:border-white/30 transition-all h-11",
          error && "border-red-500/50 focus:border-red-500/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      />
      {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function NumberField({ label, register, error }: any) {
  return (
    <div className="space-y-2">
      <span className="text-[10px] uppercase tracking-[0.15em] text-white/40 block">{label}</span>
      <Input
        type="number"
        min={0}
        max={100}
        {...register}
        className={cn(
          "bg-white/[0.03] border-white/10 focus:border-white/30 transition-all h-11",
          error && "border-red-500/50 focus:border-red-500/50"
        )}
      />
      {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function TextAreaField({ label, register, error, rows = 4 }: any) {
  return (
    <div className="space-y-2">
      <span className="text-[10px] uppercase tracking-[0.15em] text-white/40 block">{label}</span>
      <textarea
        rows={rows}
        {...register}
        className={cn(
          "w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-all resize-none",
          error && "border-red-500/50 focus:border-red-500/50"
        )}
      />
      {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function TagInput({ label, value = [], onChange, placeholder }: any) {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      if (!value.includes(inputValue.trim())) {
        onChange([...value, inputValue.trim()]);
      }
      setInputValue("");
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t: string) => t !== tag));
  };

  return (
    <div className="space-y-2">
      <span className="text-[10px] uppercase tracking-[0.15em] text-white/40 block">{label}</span>
      <div className="flex flex-wrap gap-2 p-2 bg-white/[0.03] border border-white/10 rounded-lg focus-within:border-white/30 transition-all min-h-11">
        {(value || []).map((tag: string) => (
          <span 
            key={tag} 
            className="flex items-center gap-1.5 px-2 py-1 bg-white/10 rounded-md text-[13px] text-white/90 border border-white/5"
          >
            {tag}
            <button 
              type="button" 
              onClick={() => removeTag(tag)}
              className="text-white/40 hover:text-white transition-colors"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-white/20 min-w-[120px] h-7"
        />
      </div>
    </div>
  );
}
