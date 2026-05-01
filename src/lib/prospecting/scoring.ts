export type PreScoreLevel = "high" | "medium" | "low";

type UnknownRecord = Record<string, unknown>;

export interface PreScoreResult {
  score: number;
  level: PreScoreLevel;
  details: {
    role: boolean;
    industry: boolean;
    location: boolean;
    company: boolean;
    url: boolean;
    targetDescriptionOverlap: boolean;
  };
}

export interface NormalizedCampaignCriteria {
  id?: string;
  name: string;
  objective: string;
  targetDescription: string;
  targetRoles: string[];
  targetIndustries: string[];
  targetLocations: string[];
  targetCompanySize: string[];
  tone: string;
  source: string;
}

export interface NormalizedProspectData {
  id?: string;
  source: string;
  fullName: string;
  roleTitle: string;
  companyName: string;
  companyDescription: string;
  location: string;
  profileUrl: string;
  websiteUrl: string;
  rawText: string;
}

const STOP_WORDS = new Set([
  "avec",
  "chez",
  "dans",
  "des",
  "du",
  "elle",
  "est",
  "les",
  "leur",
  "leurs",
  "notre",
  "nous",
  "pour",
  "qui",
  "que",
  "sur",
  "une",
  "vous",
  "your",
  "and",
  "the",
  "for",
  "with",
]);

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[,;\n|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function asRecord(value: unknown): UnknownRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as UnknownRecord;
  }
  return {};
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalizeText(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getCompany(prospect: UnknownRecord): UnknownRecord {
  const company = prospect.company;
  if (Array.isArray(company)) return asRecord(company[0]);
  return asRecord(company);
}

function objectToSearchableText(value: unknown, depth = 0): string {
  if (value == null || depth > 2) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => objectToSearchableText(item, depth + 1)).join(" ");
  }
  if (typeof value === "object") {
    return Object.values(value as UnknownRecord)
      .map((item) => objectToSearchableText(item, depth + 1))
      .join(" ");
  }
  return "";
}

export function normalizeCampaignCriteria(campaign: UnknownRecord | null | undefined): NormalizedCampaignCriteria {
  const config = asRecord(campaign?.config);
  const targetIcp = asRecord(config.target_icp);
  const prospection = asRecord(config.prospection);

  const targetRoles = unique([
    ...toArray(campaign?.target_roles),
    ...toArray(config.target_roles),
    ...toArray(config.personas),
    ...toArray(config.roles),
    pickString(prospection.decision_maker),
  ]);

  const targetIndustries = unique([
    ...toArray(campaign?.target_industries),
    ...toArray(config.target_industries),
    ...toArray(targetIcp.industries),
    ...toArray(targetIcp.sectors),
    pickString(prospection.sector),
  ]);

  const targetLocations = unique([
    ...toArray(campaign?.target_locations),
    ...toArray(config.target_locations),
    ...toArray(targetIcp.locations),
    ...toArray(targetIcp.geographies),
    pickString(prospection.location),
  ]);

  const targetCompanySize = unique([
    ...toArray(campaign?.target_company_size),
    ...toArray(config.target_company_size),
    ...toArray(targetIcp.company_size),
    ...toArray(targetIcp.company_sizes),
  ]);

  return {
    id: pickString(campaign?.id) || undefined,
    name: pickString(campaign?.name, campaign?.display_name),
    objective: pickString(campaign?.objective, config.objective, config.offer, campaign?.description),
    targetDescription: pickString(campaign?.target_description, config.target_description, config.offer, campaign?.description),
    targetRoles,
    targetIndustries,
    targetLocations,
    targetCompanySize,
    tone: pickString(campaign?.tone, config.tone, "Professionnel et direct"),
    source: pickString(campaign?.source, config.source, toArray(config.sources)[0], "linkedin"),
  };
}

export function normalizeProspectData(prospect: UnknownRecord): NormalizedProspectData {
  const extraData = asRecord(prospect.extra_data);
  const rawData = prospect.raw_data ?? extraData.raw_data ?? extraData;
  const company = getCompany(prospect);

  const companyDescription = pickString(
    prospect.company_description,
    company.description,
    extraData.company_description,
    extraData.about,
    extraData.original_headline,
    prospect.role
  );

  const rawText = [
    objectToSearchableText(rawData),
    objectToSearchableText(extraData),
    objectToSearchableText(company),
  ].join(" ");

  return {
    id: pickString(prospect.id) || undefined,
    source: pickString(prospect.source),
    fullName: pickString(prospect.full_name, prospect.decision_maker, prospect.name),
    roleTitle: pickString(prospect.role_title, prospect.role, prospect.title, extraData.original_headline),
    companyName: pickString(prospect.company_name, prospect.company, company.name),
    companyDescription,
    location: pickString(prospect.location, company.location, extraData.location),
    profileUrl: pickString(prospect.profile_url, prospect.linkedin_url),
    websiteUrl: pickString(prospect.website_url, prospect.website),
    rawText,
  };
}

export function preScoreLevelFromScore(score: number): PreScoreLevel {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export function preScoreLabel(level?: string | null): string {
  if (level === "high") return "Pertinence élevée";
  if (level === "medium") return "Pertinence moyenne";
  return "Pertinence faible";
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function stem(token: string): string {
  return token.replace(/(ements|ement|ations|ation|iques|ique|trices|trice|teurs|teur|eurs|euses|euse|aux|eaux|es|s)$/i, "");
}

function tokenMatches(a: string, b: string): boolean {
  if (a === b) return true;

  const stemA = stem(a);
  const stemB = stem(b);
  if (stemA === stemB && stemA.length >= 4) return true;

  const prefixLength = Math.min(5, stemA.length, stemB.length);
  if (prefixLength >= 4 && stemA.slice(0, prefixLength) === stemB.slice(0, prefixLength)) {
    return true;
  }

  return false;
}

function matchesCriterion(text: string, criterion: string): boolean {
  const normalizedText = normalizeText(text);
  const normalizedCriterion = normalizeText(criterion);
  if (!normalizedText || !normalizedCriterion) return false;

  if (normalizedText.includes(normalizedCriterion)) return true;

  const criterionTokens = tokens(criterion);
  if (criterionTokens.length === 0) return false;

  const textTokens = tokens(text);
  const matched = criterionTokens.filter((criterionToken) =>
    textTokens.some((textToken) => tokenMatches(textToken, criterionToken))
  ).length;

  const requiredMatches = criterionTokens.length <= 2
    ? criterionTokens.length
    : Math.ceil(criterionTokens.length * 0.6);

  return matched >= requiredMatches;
}

function matchesAnyCriterion(text: string, criteria: string[]): boolean {
  return criteria.some((criterion) => matchesCriterion(text, criterion));
}

function hasMeaningfulOverlap(text: string, reference: string, minimumMatches = 2): boolean {
  const textTokens = tokens(text);
  const referenceTokens = tokens(reference);
  if (!textTokens.length || !referenceTokens.length) return false;

  const matched = referenceTokens.filter((referenceToken) =>
    textTokens.some((textToken) => tokenMatches(textToken, referenceToken))
  ).length;

  return matched >= minimumMatches || matched / referenceTokens.length >= 0.25;
}

export function preScoreProspect(prospectInput: UnknownRecord, campaignInput: UnknownRecord | null | undefined): PreScoreResult {
  const prospect = normalizeProspectData(prospectInput);
  const campaign = normalizeCampaignCriteria(campaignInput);

  const roleText = [prospect.roleTitle, prospect.rawText].join(" ");
  const industryText = [
    prospect.roleTitle,
    prospect.companyName,
    prospect.companyDescription,
    prospect.rawText,
  ].join(" ");
  const locationText = [prospect.location, prospect.rawText].join(" ");
  const fullProspectText = [
    prospect.fullName,
    prospect.roleTitle,
    prospect.companyName,
    prospect.companyDescription,
    prospect.location,
    prospect.rawText,
  ].join(" ");

  const targetDescriptionOverlap = Boolean(campaign.targetDescription)
    && hasMeaningfulOverlap(fullProspectText, campaign.targetDescription);

  const roleMatches = campaign.targetRoles.length > 0
    ? matchesAnyCriterion(roleText, campaign.targetRoles)
    : Boolean(campaign.targetDescription && hasMeaningfulOverlap(roleText, campaign.targetDescription, 1));

  const industryMatches = campaign.targetIndustries.length > 0
    ? matchesAnyCriterion(industryText, campaign.targetIndustries)
    : targetDescriptionOverlap;

  const locationMatches = campaign.targetLocations.length > 0
    ? matchesAnyCriterion(locationText, campaign.targetLocations)
    : Boolean(campaign.targetDescription && hasMeaningfulOverlap(locationText, campaign.targetDescription, 1));

  const hasCompany = Boolean(prospect.companyName);
  const hasUrl = Boolean(prospect.profileUrl || prospect.websiteUrl);

  const score =
    (roleMatches ? 30 : 0) +
    (industryMatches ? 25 : 0) +
    (locationMatches ? 20 : 0) +
    (hasCompany ? 15 : 0) +
    (hasUrl ? 10 : 0);

  return {
    score,
    level: preScoreLevelFromScore(score),
    details: {
      role: roleMatches,
      industry: industryMatches,
      location: locationMatches,
      company: hasCompany,
      url: hasUrl,
      targetDescriptionOverlap,
    },
  };
}
