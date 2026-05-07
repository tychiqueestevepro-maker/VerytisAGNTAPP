import type { NormalizedCampaignCriteria, NormalizedProspectData } from "./scoring";

export type RecentSerpSignal = {
  title: string;
  url: string;
  snippet: string;
  source: string;
  published_at: string | null;
  query: string;
  freshness: "dated_by_serp" | "filtered_recent_not_dated";
  recency_filter: string;
};

export type RecentSerpContext = {
  used: boolean;
  reason?: string;
  generated_at: string;
  recency_months: number;
  queries: string[];
  sources: RecentSerpSignal[];
};

type SerpOrganicResult = {
  title?: string;
  link?: string;
  displayed_link?: string;
  source?: string;
  snippet?: string;
  date?: string;
  position?: number;
};

type SerpApiResponse = {
  organic_results?: SerpOrganicResult[];
  error?: string;
};

const DEFAULT_RECENCY_MONTHS = 3;
const DEFAULT_TIMEOUT_MS = 5500;
const DEFAULT_MAX_QUERIES = 2;
const DEFAULT_RESULTS_PER_QUERY = 5;

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function serpApiKey(): string {
  return (
    process.env.SERPAPI_API_KEY ||
    process.env.SERP_API_KEY ||
    ""
  ).trim();
}

function compact(value: string, max = 280): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
}

function quoted(value: string): string {
  const clean = value.replace(/"/g, "").trim();
  return clean ? `"${clean}"` : "";
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function recencyToken(months: number): string {
  const safeMonths = Math.min(Math.max(Math.round(months), 1), 12);
  return safeMonths === 1 ? "qdr:m" : `qdr:m${safeMonths}`;
}

function buildQueries(
  prospect: NormalizedProspectData,
  campaign: NormalizedCampaignCriteria,
): string[] {
  const company = quoted(prospect.companyName);
  if (!company) return [];

  const industry = campaign.targetIndustries[0] ? quoted(campaign.targetIndustries[0]) : "";
  const role = prospect.roleTitle ? quoted(prospect.roleTitle) : "";
  const location = prospect.location || campaign.targetLocations[0] || "";
  const offerHint = campaign.targetDescription || campaign.objective;
  const offerWords = uniqueStrings(
    offerHint
      .split(/\s+/)
      .map((word) => word.replace(/[^\p{L}\p{N}-]/gu, "").trim())
      .filter((word) => word.length >= 5)
      .slice(0, 4),
  );

  return uniqueStrings([
    `${company} actualite OR annonce OR lancement OR recrutement OR recrute OR hiring OR croissance OR partenariat`,
    [company, industry, location, offerWords.slice(0, 2).join(" ")].filter(Boolean).join(" "),
    [company, role, "LinkedIn OR nomination OR prise de poste"].filter(Boolean).join(" "),
  ]).slice(0, DEFAULT_MAX_QUERIES);
}

async function fetchSerpResults(
  query: string,
  recencyMonths: number,
  resultsPerQuery: number,
): Promise<SerpOrganicResult[]> {
  const key = serpApiKey();
  if (!key) throw new Error("SERPAPI_API_KEY ou SERP_API_KEY manquant");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), envNumber("SERP_TIMEOUT_MS", DEFAULT_TIMEOUT_MS));
  const params = new URLSearchParams({
    engine: "google",
    q: query,
    api_key: key,
    hl: process.env.SERP_HL || "fr",
    gl: process.env.SERP_GL || "fr",
    num: String(resultsPerQuery),
    safe: "active",
    filter: "0",
    tbs: recencyToken(recencyMonths),
  });

  try {
    const response = await fetch(`https://serpapi.com/search?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`SERP HTTP ${response.status}`);

    const payload = await response.json() as SerpApiResponse;
    if (payload.error) throw new Error(payload.error);

    return (payload.organic_results ?? []).slice(0, resultsPerQuery);
  } finally {
    clearTimeout(timeout);
  }
}

export async function getRecentSerpContextForQualification(
  prospect: NormalizedProspectData,
  campaign: NormalizedCampaignCriteria,
): Promise<RecentSerpContext> {
  const generatedAt = new Date().toISOString();
  const recencyMonths = Math.min(Math.max(envNumber("SERP_RECENCY_MONTHS", DEFAULT_RECENCY_MONTHS), 1), 12);
  const resultsPerQuery = Math.min(Math.max(envNumber("SERP_RESULTS_PER_QUERY", DEFAULT_RESULTS_PER_QUERY), 1), 10);
  const queries = buildQueries(prospect, campaign);

  if (!queries.length) {
    return {
      used: false,
      reason: "Entreprise absente, aucune requete SERP fiable construite",
      generated_at: generatedAt,
      recency_months: recencyMonths,
      queries: [],
      sources: [],
    };
  }

  if (!serpApiKey()) {
    return {
      used: false,
      reason: "Cle SERP non configuree",
      generated_at: generatedAt,
      recency_months: recencyMonths,
      queries,
      sources: [],
    };
  }

  const sources: RecentSerpSignal[] = [];
  const seenUrls = new Set<string>();
  const recencyFilter = `Google SERP ${recencyMonths} dernier(s) mois`;

  const resultSets = await Promise.all(queries.map(async (query) => {
    try {
      const results = await fetchSerpResults(query, recencyMonths, resultsPerQuery);
      return { query, results };
    } catch (error) {
      console.warn("[prospecting] Recent SERP qualification skipped for query", {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      return { query, results: [] };
    }
  }));

  for (const { query, results } of resultSets) {
    for (const result of results) {
      const url = result.link?.trim();
      const title = result.title?.trim();
      if (!url || !title || seenUrls.has(url)) continue;

      seenUrls.add(url);
      sources.push({
        title: compact(title, 160),
        url,
        snippet: compact(result.snippet ?? "", 420),
        source: result.source || result.displayed_link || hostFromUrl(url),
        published_at: result.date?.trim() || null,
        query,
        freshness: result.date ? "dated_by_serp" : "filtered_recent_not_dated",
        recency_filter: recencyFilter,
      });
    }
  }

  return {
    used: sources.length > 0,
    reason: sources.length > 0 ? undefined : "Aucune source recente pertinente retournee par SERP",
    generated_at: generatedAt,
    recency_months: recencyMonths,
    queries,
    sources: sources.slice(0, 8),
  };
}
