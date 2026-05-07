export type ProspectionRule = {
  name: string;
  description: string;
  weight: number;
  keywords: string[];
};

export type ProspectionPlaybook = {
  version: "v1";
  goal: string;
  method: string;
  qualification_rules: ProspectionRule[];
  exclusion_rules: ProspectionRule[];
  priority_rules: ProspectionRule[];
  validation_policy: {
    auto_accept_above: number;
    human_review_between: [number, number];
    reject_below: number;
    require_human_validation: boolean;
  };
  message_strategy: {
    tone: string;
    angle: string;
    cta: string;
    avoid: string[];
  };
  operating_rules: {
    source_policy: string;
    dedupe_policy: string;
    human_review_triggers: string[];
    next_action_for_high: string;
    next_action_for_medium: string;
    next_action_for_low: string;
  };
};

export type PlaybookContext = {
  goal?: string;
  offer?: string;
  tone?: string;
  roles?: string[];
  industries?: string[];
  companySizes?: string[];
  locations?: string[];
  exclusions?: string[];
};

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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
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
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function linesToRules(value: string, baseWeight = 20): ProspectionRule[] {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({
      name: line.length > 48 ? `rule_${index + 1}` : line,
      description: line,
      weight: baseWeight,
      keywords: line
        .split(/[,;|]/)
        .map((item) => item.trim())
        .filter(Boolean),
    }));
}

export function rulesToLines(rules: unknown): string {
  if (!Array.isArray(rules)) return "";
  return rules
    .map((rule) => {
      const record = asRecord(rule);
      return pickString(record.description, record.name);
    })
    .filter(Boolean)
    .join("\n");
}

export function buildDefaultProspectionPlaybook(context: PlaybookContext = {}): ProspectionPlaybook {
  const roles = unique(context.roles ?? []);
  const industries = unique(context.industries ?? []);
  const companySizes = unique(context.companySizes ?? []);
  const locations = unique(context.locations ?? []);
  const exclusions = unique(context.exclusions ?? []);
  const goal = pickString(
    context.goal,
    context.offer,
    "Transformer une liste brute en opportunites commerciales qualifiees."
  );

  return {
    version: "v1",
    goal,
    method: "Importer une liste brute, appliquer le playbook commercial, prioriser les meilleurs comptes, preparer le message et garder une validation humaine sur les cas limites.",
    qualification_rules: [
      {
        name: "decision_maker",
        description: "Le prospect doit pouvoir decider ou influencer l'achat.",
        weight: 30,
        keywords: roles,
      },
      {
        name: "company_fit",
        description: "La societe doit correspondre aux secteurs, tailles et zones cibles.",
        weight: 30,
        keywords: [...industries, ...companySizes, ...locations],
      },
      {
        name: "business_need",
        description: "Prioriser les structures avec un process repetitif, commercial ou operationnel, qui peut etre automatise.",
        weight: 25,
        keywords: ["process", "operation", "prospection", "crm", "recrutement", "support", "automatisation"],
      },
    ],
    exclusion_rules: [
      ...exclusions.map((value) => ({
        name: value,
        description: `Exclusion explicite: ${value}`,
        weight: 50,
        keywords: [value],
      })),
      {
        name: "low_authority",
        description: "Exclure les profils sans pouvoir de decision apparent.",
        weight: 30,
        keywords: ["stagiaire", "intern", "student", "etudiant", "alternant"],
      },
    ],
    priority_rules: [
      {
        name: "timing_signal",
        description: "Prioriser croissance, recrutement, lancement, nouvelle offre ou forte activite.",
        weight: 20,
        keywords: ["recrute", "hiring", "lancement", "croissance", "nouvelle offre", "expansion"],
      },
      {
        name: "strong_icp_match",
        description: "Prioriser les prospects qui cumulent role cible, societe cible et contexte clair.",
        weight: 20,
        keywords: [...roles, ...industries],
      },
    ],
    validation_policy: {
      auto_accept_above: 80,
      human_review_between: [50, 79],
      reject_below: 50,
      require_human_validation: true,
    },
    message_strategy: {
      tone: context.tone || "professionnel, direct et utile",
      angle: "automatisation du process existant de la structure",
      cta: "proposer un echange court pour comprendre leur maniere d'operer",
      avoid: ["promesses vagues", "IA magique", "scraping massif", "ton trop commercial"],
    },
    operating_rules: {
      source_policy: "Importer ou ajouter des prospects, puis qualifier avant toute action.",
      dedupe_policy: "Ignorer les doublons et conserver l'historique des decisions.",
      human_review_triggers: ["score moyen", "donnees manquantes", "message peu personnalise"],
      next_action_for_high: "preparer le message et proposer validation",
      next_action_for_medium: "mettre en revue humaine",
      next_action_for_low: "rejeter ou garder en veille",
    },
  };
}

export function normalizeProspectionPlaybook(raw: unknown, context: PlaybookContext = {}): ProspectionPlaybook {
  const defaults = buildDefaultProspectionPlaybook(context);
  const candidate = asRecord(raw);
  const validationPolicy = asRecord(candidate.validation_policy);
  const messageStrategy = asRecord(candidate.message_strategy);
  const operatingRules = asRecord(candidate.operating_rules);
  const reviewRange = Array.isArray(validationPolicy.human_review_between)
    ? validationPolicy.human_review_between
    : defaults.validation_policy.human_review_between;

  return {
    ...defaults,
    ...candidate,
    version: "v1",
    goal: pickString(candidate.goal, defaults.goal),
    method: pickString(candidate.method, defaults.method),
    qualification_rules: Array.isArray(candidate.qualification_rules) && candidate.qualification_rules.length
      ? candidate.qualification_rules as ProspectionRule[]
      : defaults.qualification_rules,
    exclusion_rules: Array.isArray(candidate.exclusion_rules) && candidate.exclusion_rules.length
      ? candidate.exclusion_rules as ProspectionRule[]
      : defaults.exclusion_rules,
    priority_rules: Array.isArray(candidate.priority_rules) && candidate.priority_rules.length
      ? candidate.priority_rules as ProspectionRule[]
      : defaults.priority_rules,
    validation_policy: {
      ...defaults.validation_policy,
      ...validationPolicy,
      human_review_between: [
        Number(reviewRange[0] ?? defaults.validation_policy.human_review_between[0]),
        Number(reviewRange[1] ?? defaults.validation_policy.human_review_between[1]),
      ],
      auto_accept_above: Number(validationPolicy.auto_accept_above ?? defaults.validation_policy.auto_accept_above),
      reject_below: Number(validationPolicy.reject_below ?? defaults.validation_policy.reject_below),
      require_human_validation: validationPolicy.require_human_validation === false ? false : true,
    },
    message_strategy: {
      ...defaults.message_strategy,
      ...messageStrategy,
      avoid: toArray(messageStrategy.avoid).length ? toArray(messageStrategy.avoid) : defaults.message_strategy.avoid,
    },
    operating_rules: {
      ...defaults.operating_rules,
      ...operatingRules,
      human_review_triggers: toArray(operatingRules.human_review_triggers).length
        ? toArray(operatingRules.human_review_triggers)
        : defaults.operating_rules.human_review_triggers,
    },
  };
}
