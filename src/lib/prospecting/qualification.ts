import OpenAI from "openai";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  normalizeCampaignCriteria,
  normalizeProspectData,
  preScoreLabel,
  preScoreProspect,
} from "./scoring";

export type QualificationLevel = "high" | "medium" | "low";

export interface LLMQualificationResult {
  qualification_level: QualificationLevel;
  qualification_reason: string;
  personalization_hooks: string[];
}

const QualificationResultSchema = z.object({
  qualification_level: z.enum(["high", "medium", "low"]),
  qualification_reason: z.string().min(1),
  personalization_hooks: z.array(z.string()).default([]),
}).strict();

const SYSTEM_PROMPT = `
Tu es un assistant de qualification commerciale B2B.
Ton rôle est d'évaluer si un prospect correspond à l'objectif d'une campagne de prospection.
Tu dois être strict, factuel et ne jamais inventer d'informations.
Tu dois répondre uniquement en JSON valide.
`.trim();

const OMITTED_BINARY_VALUE = "[contenu image/binaire omis]";
const TEXTUAL_CONTEXT_LIMIT = 9000;

function truncateText(value: string, max = 1200): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function sanitizeForPrompt(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    if (value.startsWith("data:image/") || value.length > 20_000) return OMITTED_BINARY_VALUE;
    return truncateText(value);
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 30).map((item) => sanitizeForPrompt(item, depth + 1));
  }
  if (typeof value === "object") {
    if (depth >= 4) return "[objet imbriqué omis]";

    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((acc, [key, item]) => {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("photo_data") ||
        lowerKey.includes("image_data") ||
        lowerKey.includes("base64")
      ) {
        acc[key] = OMITTED_BINARY_VALUE;
        return acc;
      }

      acc[key] = sanitizeForPrompt(item, depth + 1);
      return acc;
    }, {});
  }
  return String(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function pickText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function toTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => typeof item === "string" ? item.trim() : "")
    .filter(Boolean)
    .slice(0, 8);
}

function firstRecord(...values: unknown[]): Record<string, unknown> {
  for (const value of values) {
    const record = asRecord(value);
    if (Object.keys(record).length > 0) return record;
  }
  return {};
}

function firstArray(...values: unknown[]): unknown[] {
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) return value.slice(0, 8);
  }
  return [];
}

function boolValue(...values: unknown[]): boolean {
  return values.some(value => value === true || value === "true" || value === "yes" || value === "1");
}

function extractPersonalizationInsights(prospectInput: Record<string, unknown>) {
  const extraData = asRecord(prospectInput.extra_data);
  const rawData = asRecord(prospectInput.raw_data ?? extraData.raw_data);
  const currentExperience = firstRecord(
    prospectInput.currentExperience,
    prospectInput.current_experience,
    rawData.currentExperience,
    rawData.current_experience,
    extraData.currentExperience,
    extraData.current_experience
  );
  const experiences = firstArray(
    prospectInput.experiences,
    rawData.experiences,
    extraData.experiences
  );
  const experienceHighlights = [
    ...toTextArray(prospectInput.experienceHighlights),
    ...toTextArray(prospectInput.experience_highlights),
    ...toTextArray(rawData.experienceHighlights),
    ...toTextArray(rawData.experience_highlights),
    ...toTextArray(extraData.experienceHighlights),
    ...toTextArray(extraData.experience_highlights),
  ].slice(0, 8);
  const personalizationSignals = [
    ...toTextArray(prospectInput.personalizationSignals),
    ...toTextArray(prospectInput.personalization_signals),
    ...toTextArray(rawData.personalizationSignals),
    ...toTextArray(rawData.personalization_signals),
    ...toTextArray(extraData.personalizationSignals),
    ...toTextArray(extraData.personalization_signals),
  ].slice(0, 8);
  const currentRoleStart = pickText(
    prospectInput.currentRoleStart,
    prospectInput.current_role_start,
    rawData.currentRoleStart,
    rawData.current_role_start,
    extraData.currentRoleStart,
    extraData.current_role_start,
    currentExperience.start
  );
  const currentRoleDuration = pickText(
    prospectInput.currentRoleDuration,
    prospectInput.current_role_duration,
    rawData.currentRoleDuration,
    rawData.current_role_duration,
    extraData.currentRoleDuration,
    extraData.current_role_duration,
    currentExperience.duration
  );
  const currentRoleIsRecent = boolValue(
    prospectInput.currentRoleIsRecent,
    prospectInput.current_role_is_recent,
    rawData.currentRoleIsRecent,
    rawData.current_role_is_recent,
    extraData.currentRoleIsRecent,
    extraData.current_role_is_recent,
    currentExperience.isRecent
  );

  const inferredSignals = [...personalizationSignals];
  const title = pickText(currentExperience.title);
  const company = pickText(currentExperience.company);
  const dateRange = pickText(currentExperience.dateRange);

  if (currentRoleIsRecent && inferredSignals.length === 0) {
    inferredSignals.push(
      ["Prise de poste récente", title, company ? `chez ${company}` : "", dateRange ? `(${dateRange})` : ""]
        .filter(Boolean)
        .join(" ")
    );
  }

  return {
    current_experience: currentExperience,
    experiences,
    experience_highlights: experienceHighlights,
    personalization_signals: inferredSignals.slice(0, 8),
    current_role_start: currentRoleStart || null,
    current_role_duration: currentRoleDuration || null,
    current_role_is_recent: currentRoleIsRecent,
  };
}

export function qualificationLabel(level?: string | null): string {
  if (level === "high") return "ICP élevé";
  if (level === "medium") return "ICP moyen";
  if (level === "low") return "ICP faible";
  return "Non qualifié";
}

export async function getOpenAIKeyForClient(clientId: string): Promise<string> {
  const supabase = createSupabaseServiceClient();

  const { data: clientData } = await supabase
    .from("client_configs")
    .select("extra_config")
    .eq("client_id", clientId)
    .maybeSingle();

  const clientKey = clientData?.extra_config?.openai_api_key;
  if (typeof clientKey === "string" && clientKey.trim()) return clientKey;

  const { data: globalData } = await supabase
    .from("global_configs")
    .select("value")
    .eq("key", "openai_master_key")
    .maybeSingle();

  const globalKey = globalData?.value;
  if (typeof globalKey === "string" && globalKey.trim()) return globalKey;

  const envKey = process.env.OPENAI_API_KEY;
  if (envKey) return envKey;

  throw new Error("Aucune clé OpenAI disponible pour qualifier ce prospect.");
}

export async function qualifyProspectWithLLM(
  prospectInput: Record<string, unknown>,
  campaignInput: Record<string, unknown>,
  apiKey: string
): Promise<LLMQualificationResult> {
  const campaign = normalizeCampaignCriteria(campaignInput);
  const prospect = normalizeProspectData(prospectInput);
  const personalization = extractPersonalizationInsights(prospectInput);
  const savedLevel = prospectInput.pre_score_level === "high" || prospectInput.pre_score_level === "medium" || prospectInput.pre_score_level === "low"
    ? prospectInput.pre_score_level
    : "low";
  const preScore = typeof prospectInput.pre_score === "number"
    ? {
        score: prospectInput.pre_score,
        level: savedLevel,
      }
    : preScoreProspect(prospectInput, campaignInput);

  const usefulPayload = {
    campagne: {
      id: campaign.id,
      nom: campaign.name,
      objectif: campaign.objective,
      description_de_la_cible: campaign.targetDescription,
      roles_cibles: campaign.targetRoles,
      secteurs_cibles: campaign.targetIndustries,
      localisations_cibles: campaign.targetLocations,
      tailles_entreprise_cibles: campaign.targetCompanySize,
      ton_demande: campaign.tone,
      source_campagne: campaign.source,
      configuration_complete: sanitizeForPrompt(campaignInput),
    },
    prospect: {
      nom: prospect.fullName,
      role: prospect.roleTitle,
      entreprise: prospect.companyName,
      description_entreprise_ou_profil: prospect.companyDescription,
      localisation: prospect.location,
      source: prospect.source,
      url_profil: prospect.profileUrl,
      site_web: prospect.websiteUrl,
      signaux_de_personnalisation: personalization,
      contexte_collecte: prospect.rawText.slice(0, TEXTUAL_CONTEXT_LIMIT),
      donnees_collectees_completes: sanitizeForPrompt(prospectInput),
    },
    pre_score_automatique: {
      niveau: preScore.level,
      libelle: preScoreLabel(preScore.level),
      score_interne: preScore.score,
    },
  };

  const userPrompt = `
Evalue ce prospect pour la campagne ci-dessous.

${JSON.stringify(usefulPayload, null, 2)}

Sortie obligatoire :
{
  "qualification_level": "high" | "medium" | "low",
  "qualification_reason": "max 3 phrases",
  "personalization_hooks": ["faits précis utilisables pour personnaliser le message"]
}

Règles :
- Base qualification_level sur l'adéquation entre le prospect et l'objectif de campagne.
- Explique clairement pourquoi le prospect est adapté ou non avec des éléments précis du profil, de l'entreprise et du parcours.
- Si l'ancienneté, une prise de poste, une évolution interne ou une expérience passée intéressante est disponible, ajoute-la dans personalization_hooks.
- N'invente aucune information absente.
- Si les données sont insuffisantes, mets medium ou low et explique-le.
- **Langue** : Tu DOIS impérativement rédiger qualification_reason et personalization_hooks en ${(campaignInput.config as any)?.language || 'français'}.
`.trim();

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_QUALIFICATION_MODEL || "gpt-4o",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Réponse vide du LLM.");

  const parsed = JSON.parse(raw);
  return QualificationResultSchema.parse(parsed);
}
