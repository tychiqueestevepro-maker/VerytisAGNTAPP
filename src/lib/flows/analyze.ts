"use server";

import OpenAI from "openai";
import * as cheerio from "cheerio";
import { getUserWithProfile } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un expert en Sales Ops et stratégie Go-to-Market B2B.
Tu analyses du contenu brut de site web pour configurer un système de prospection automatisé.

ENTRÉE:
Contenu (texte/HTML/résumé). Interpréter intelligemment.

OBJECTIF:
Déduire logiquement TOUS les secteurs et TOUS les rôles potentiellement intéressés par l'offre, en réfléchissant étape par étape (Chain of Thought).

MÉTHODOLOGIE ET RÉFLEXION LOGIQUE:
1. "reasoning" : Commence par expliquer ta logique en quelques phrases. Analyse le problème résolu (ex: "flux métier"). Demande-toi : Quels secteurs ont ce problème ? (ex: Finance, E-commerce, SaaS, Conseil...). Quelles fonctions gèrent ce problème ? (ex: CEO, CTO, Head of Ops, Head of Sales). Élargis ta réflexion pour ne pas te limiter à un seul choix !
2. Identifier les secteurs (industries) -> IL EST CRUCIAL D'AVOIR PLUSIEURS CHOIX si la logique s'y prête.
3. Identifier les PERSONAS (rôles exacts) -> IL EST CRUCIAL D'AVOIR PLUSIEURS CHOIX variés. APPLIQUE LA MÊME LOGIQUE D'EXHAUSTIVITÉ QUE POUR LES SECTEURS (ex: techniques, opérationnels, direction). Ne te limite jamais à un seul rôle si plusieurs sont pertinents.
4. Identifier la/les localisation(s) ciblée(s) -> UNIQUEMENT DES PAYS (ex: France, Belgique, États-Unis), déduits depuis la langue du site.
5. Déduire les sources de prospection -> IL EST NORMAL D'AVOIR PLUSIEURS CHOIX.

RÈGLES:
- Secteurs : Max 5. Sois exhaustif et logique.
- Rôles : Max 6. Rôles décisionnaires = TITRES DE POSTES SPÉCIFIQUES.
- Localisation : UNIQUEMENT DES PAYS.
- Sources : Choisir UNIQUEMENT parmi ["LinkedIn", "Site web", "Annuaires sectoriels", "Google Maps", "Réseaux sociaux", "Base de données clients"]

TON:
Choisir STRICTEMENT un seul parmi :
"Professionnel et direct" | "Chaleureux et humain" | "Stratégique et analytique" | "Concis et percutant" | "Éducatif et pédagogue"

FORMAT DE SORTIE:
JSON strict uniquement

{
  "reasoning": "Ta réflexion logique décomposée en séquence pour trouver les multiples secteurs et rôles cibles...",
  "offer": "Problème + Solution + Différenciation (3 phrases max)",
  "icp_industries": ["Industrie 1", "Industrie 2", "Industrie 3"],
  "icp_roles": ["Titre 1", "Titre 2", "Titre 3"],
  "locations": ["Pays 1", "Pays 2"],
  "sources": ["LinkedIn", "Site web"],
  "tone": "ton choisi"
}`;

// ─── Scraper ──────────────────────────────────────────────────────────────────

async function scrapeText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; VerytisBot/1.0)" },
    signal: AbortSignal.timeout(8000),
  });

  const html = await response.text();
  const $ = cheerio.load(html);

  // Supprimer les balises inutiles
  $("script, style, nav, footer, iframe, noscript").remove();

  // Extraire le texte visible
  const text = $("body").text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000); // limiter les tokens

  return text;
}

// ─── Fetch OpenAI key from Supabase ──────────────────────────────────────────

async function getOpenAIKey(clientId: string): Promise<string> {
  const supabase = createSupabaseServiceClient();

  console.log("DEBUG: getOpenAIKey pour clientId:", clientId);

  // 1. Essayer de récupérer la clé spécifique au client
  const { data: clientData, error: clientError } = await supabase
    .from("client_configs")
    .select("extra_config")
    .eq("client_id", clientId)
    .single();

  if (clientError) console.log("DEBUG: Erreur clientData (souvent normal):", clientError.message);
  
  const clientKey = clientData?.extra_config?.openai_api_key;
  if (clientKey) {
    console.log("DEBUG: Clé client trouvée.");
    return clientKey as string;
  }

  // 2. Fallback sur la clé Master stockée dans Supabase (global_configs)
  console.log("DEBUG: Tentative fallback global_configs...");
  const { data: globalData, error: globalError } = await supabase
    .from("global_configs")
    .select("value")
    .eq("key", "openai_master_key")
    .single();

  if (globalError) console.error("DEBUG: Erreur globalData (CRITIQUE):", globalError.message);

  const globalKey = globalData?.value;
  if (globalKey) {
    console.log("DEBUG: Clé globale trouvée.");
    return globalKey as string;
  }

  // 3. Fallback ultime sur la clé Master (env)
  console.log("DEBUG: Tentative fallback .env...");
  const masterKey = process.env.OPENAI_API_KEY;
  if (masterKey) {
    console.log("DEBUG: Clé env trouvée.");
    return masterKey;
  }

  const diagnostics = {
    clientId,
    hasClientData: !!clientData,
    clientError: clientError?.message || "none",
    hasGlobalData: !!globalData,
    globalError: globalError?.message || "none",
    hasEnvKey: !!process.env.OPENAI_API_KEY,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.split(".")[0], // masquer pour sécurité
  };

  throw new Error(`Aucune clé OpenAI trouvée. Diagnostics: ${JSON.stringify(diagnostics)}`);
}

// ─── Main Action ──────────────────────────────────────────────────────────────

export interface AnalysisResult {
  offer: string;
  icp_industries: string[];
  icp_roles: string[];
  locations: string[];
  sources: string[];
  tone: string;
}

export async function analyzeWebsite(url: string): Promise<{ data: AnalysisResult | null; error: string | null }> {
  // 1. Auth
  const user = await getUserWithProfile();
  if (!user?.profile?.client_id) {
    return { data: null, error: "Non authentifié" };
  }

  // 2. Récupérer la clé OpenAI depuis Supabase
  let apiKey: string;
  try {
    apiKey = await getOpenAIKey(user.profile.client_id);
  } catch (e: any) {
    return { data: null, error: e.message };
  }

  // 3. Scraper le site
  let siteText: string;
  try {
    siteText = await scrapeText(url);
  } catch {
    return { data: null, error: "Impossible d'accéder au site web. Vérifiez l'URL." };
  }

  if (!siteText || siteText.length < 100) {
    return { data: null, error: "Contenu du site trop limité pour l'analyse." };
  }

  // 4. Appel OpenAI
  try {
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Voici le contenu du site ${url} :\n\n${siteText}` },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return { data: null, error: "Réponse vide de l'IA." };

    const result = JSON.parse(raw) as AnalysisResult;
    return { data: result, error: null };
  } catch (e: any) {
    return { data: null, error: "Erreur lors de l'analyse IA : " + e.message };
  }
}
