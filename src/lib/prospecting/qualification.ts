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
  suggested_message: string;
}

const QualificationResultSchema = z.object({
  qualification_level: z.enum(["high", "medium", "low"]),
  qualification_reason: z.string().min(1),
  suggested_message: z.string().min(1),
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

export function qualificationLabel(level?: string | null): string {
  if (level === "high") return "Qualification élevée";
  if (level === "medium") return "Qualification moyenne";
  if (level === "low") return "Qualification faible";
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
  "suggested_message": "message court prêt à envoyer"
}

Règles :
- Base qualification_level sur l'adéquation entre le prospect et l'objectif de campagne.
- Explique clairement pourquoi le prospect est adapté ou non.
- Adapte suggested_message au ton demandé.
- N'invente aucune information absente.
- Si les données sont insuffisantes, mets medium ou low et explique-le.
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
