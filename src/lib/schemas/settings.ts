import { z } from "zod";

export const settingsSchema = z.object({
  // Profile
  first_name: z.string().min(1, "Prénom requis"),
  last_name: z.string().min(1, "Nom requis"),
  email: z.string().email("Email invalide"),
  avatar_url: z.string().url().optional().or(z.literal("")),

  // Organization
  company_name: z.string().min(2, "Nom d'entreprise requis"),
  industry: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),

  // AI Config
  openai_api_key: z.string().optional(),
  
  // Strategy
  min_fit_score: z.number().min(0).max(100),
  tone: z.string().optional().or(z.literal("")),
  offer_type: z.string().optional().or(z.literal("")),
  message_style: z.string().optional().or(z.literal("")),
  
  // ICP & Targeting
  excluded_sectors: z.array(z.string()),
  required_fields: z.array(z.string()),

  // Default prospecting playbook
  prospection_playbook_goal: z.string().optional().or(z.literal("")),
  prospection_playbook_method: z.string().optional().or(z.literal("")),
  prospection_qualification_rules: z.string().optional().or(z.literal("")),
  prospection_priority_rules: z.string().optional().or(z.literal("")),
  prospection_exclusion_rules: z.string().optional().or(z.literal("")),
  prospection_message_angle: z.string().optional().or(z.literal("")),
  prospection_require_human_review: z.boolean(),
  prospection_auto_accept_above: z.number().min(0).max(100),
  prospection_review_min: z.number().min(0).max(100),
  prospection_review_max: z.number().min(0).max(100),
  prospection_reject_below: z.number().min(0).max(100),

  // Limits
  daily_cost_limit: z.number().min(0),
  daily_prospect_limit: z.number().min(0),
  daily_message_limit: z.number().min(0),


  // Flows
  active_flows: z.array(z.object({
    key: z.string(),
    label: z.string(),
    status: z.string(),
  })),

  // Auth
  user_role: z.string().optional(),
});





export type SettingsForm = z.infer<typeof settingsSchema>;
