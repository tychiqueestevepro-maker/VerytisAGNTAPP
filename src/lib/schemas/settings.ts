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

