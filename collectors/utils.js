const FIRSTHAND_PATTERNS = [
  /\b(i|i'm|i’m|im|my|mine)\b/i,
  /\b(we|we're|we’re|our|ours)\b/i,
  /\b(in our|on our|for our)\s+(agent|system|app|workflow|production|stack)\b/i,
];

const STRONG_URGENCY_PATTERNS = [
  /\bright now\b/i,
  /\bcurrently\b/i,
  /\bstuck\b/i,
  /\bcan't figure out\b/i,
  /\bcannot figure out\b/i,
  /\bkeeps? (failing|breaking|calling|looping|happening)\b/i,
  /\bproduction (issue|incident|failure|bug)\b/i,
  /\bspent (\w+ )?(hours?|all day)\b/i,
  /\bblocked\b/i,
];

const PAIN_PATTERNS = [
  /\b(can't|cannot|broken|failing|failed|wrong|incorrect|unexpected|bug|issue|problem)\b/i,
  /\bdoesn't work\b/i,
  /\bnot working\b/i,
  /\bweird behavior\b/i,
];

const TECHNICAL_PATTERNS = [
  /\b(agent|llm|langgraph|langchain|langsmith|langfuse|tool|trace|span|retrieval|state|retry|evaluator|workflow)\b/i,
];

const CONCRETE_INCIDENT_PATTERNS = [
  /\b(our|my|we)\b.{0,60}\b(run|agent|workflow|system|trace|tool|production)\b/i,
  /\b(yesterday|today|last night|this morning|in production|prod)\b/i,
  /\b(spent|took)\b.{0,20}\b(hours?|minutes?|day)\b/i,
  /\b(success|succeeded|completed|200|green)\b.{0,80}\b(wrong|incorrect|bad|unexpected|duplicate)\b/i,
];

const MULTISTEP_PATTERNS = [
  /\b(retry|handoff|upstream|downstream|state|planner|evaluator|retrieval|tool call|multi[- ]agent|workflow)\b/i,
  /\b(step|span|trace|run)\b.{0,60}\b(step|span|trace|run)\b/i,
  /\b(write|tool|agent)\b.{0,80}\b(readback|read-back|next step|later|retry|state)\b/i,
];

const NON_FIT_RULES = [
  { reason: "basic setup/install problem", pattern: /\b(install|installation|npm install|pip install|module not found|package not found|dependency error)\b/i, penalty: 24 },
  { reason: "auth/API-key setup", pattern: /\b(api key|invalid key|unauthorized|401|403|oauth setup|login issue)\b/i, penalty: 18 },
  { reason: "ordinary crash/exception", pattern: /\b(stack trace|syntaxerror|typeerror|segfault|compile error|build failed)\b/i, penalty: 18 },
  { reason: "generic model-quality complaint", pattern: /\b(model is dumb|hallucinat(?:e|ed|ing)|bad answers? generally|model quality)\b/i, penalty: 16 },
  { reason: "isolated retrieval/embedding issue", pattern: /\b(embedding lookup|vector search only|embedding model)\b/i, penalty: 12 },
];

const ARTIFACT_DEFINITIONS = [
  { term: "langsmith", platform: "LangSmith", compatibility: "high" },
  { term: "langfuse", platform: "Langfuse", compatibility: "partial" },
  { term: "phoenix", platform: "Arize Phoenix", compatibility: "partial" },
  { term: "openinference", platform: "Arize Phoenix/OpenInference", compatibility: "partial" },
  { term: "opentelemetry", platform: "OpenTelemetry", compatibility: "adapter-needed" },
  { term: "otel", platform: "OpenTelemetry", compatibility: "adapter-needed" },
  { term: "braintrust", platform: "Braintrust", compatibility: "adapter-needed" },
  { term: "trace", platform: "Generic trace", compatibility: "unknown" },
  { term: "traces", platform: "Generic trace", compatibility: "unknown" },
  { term: "span", platform: "Generic spans", compatibility: "unknown" },
  { term: "spans", platform: "Generic spans", compatibility: "unknown" },
  { term: "json", platform: "JSON export", compatibility: "unknown" },
  { term: "export", platform: "Export", compatibility: "unknown" },
  { term: "logs", platform: "Logs", compatibility: "unknown" },
  { term: "log", platform: "Logs", compatibility: "unknown" },
  { term: "run id", platform: "Run ID", compatibility: "unknown" },
  { term: "trajectory", platform: "Trajectory", compatibility: "unknown" },
  { term: "events", platform: "Events", compatibility: "unknown" },
];

export function stripHtml(value = "") {
  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function toArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function isWithinHours(dateValue, hours) {
  if (!dateValue) return true;
  const timestamp = new Date(dateValue).getTime();
  if (Number.isNaN(timestamp)) return true;
  return Date.now() - timestamp <= hours * 60 * 60 * 1000;
}

export function uniqueByUrl(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.sourceId || item.url;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function detectOwnership(haystack) {
  const firsthand = FIRSTHAND_PATTERNS.some((pattern) => pattern.test(haystack));
  if (firsthand) return "firsthand";

  if (/\b(a client|a customer|someone on our team|one of our users)\b/i.test(haystack)) {
    return "secondhand";
  }

  return "general";
}

function detectArtifacts(haystack, ownership) {
  const matches = ARTIFACT_DEFINITIONS.filter((item) => haystack.includes(item.term));
  const unique = [];
  const seen = new Set();

  for (const item of matches) {
    const key = `${item.platform}:${item.compatibility}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  let level = "low";
  if (unique.length >= 2 || (ownership === "firsthand" && unique.length >= 1)) level = "high";
  else if (unique.length === 1) level = "medium";

  const compatibilityRank = { high: 4, partial: 3, unknown: 2, "adapter-needed": 1 };
  const best = unique
    .slice()
    .sort((a, b) => (compatibilityRank[b.compatibility] || 0) - (compatibilityRank[a.compatibility] || 0))[0];

  return {
    level,
    matches: [...new Set(matches.map((item) => item.term))],
    platforms: unique.map((item) => ({
      name: item.platform,
      compatibility: item.compatibility,
    })),
    bestCompatibility: best?.compatibility || "unknown",
  };
}

function detectNonFit(haystack) {
  const matches = NON_FIT_RULES.filter((rule) => rule.pattern.test(haystack));
  return {
    reasons: matches.map((rule) => rule.reason),
    penalty: Math.min(55, matches.reduce((total, rule) => total + rule.penalty, 0)),
  };
}

export function scoreSignal(item, terms) {
  const haystack = `${item.title || ""} ${item.text || ""}`.toLowerCase();
  const matchedTerms = [];

  let relevanceScore = 0;
  for (const term of terms) {
    if (haystack.includes(term.toLowerCase())) {
      matchedTerms.push(term);
      relevanceScore += 6;
    }
  }

  const technical = TECHNICAL_PATTERNS.some((pattern) => pattern.test(haystack));
  const pain = PAIN_PATTERNS.some((pattern) => pattern.test(haystack));
  const ownership = detectOwnership(haystack);
  const concreteIncident = CONCRETE_INCIDENT_PATTERNS.some((pattern) => pattern.test(haystack));
  const multistep = MULTISTEP_PATTERNS.some((pattern) => pattern.test(haystack));
  const nonFit = detectNonFit(haystack);

  if (technical) relevanceScore += 16;
  if (pain) relevanceScore += 14;
  if (concreteIncident) relevanceScore += 12;
  if (multistep) relevanceScore += 12;
  if (/\b(success|succeeded|completed|200|green)\b.*\b(wrong|incorrect|bad|unexpected|duplicate)\b/i.test(haystack)) {
    relevanceScore += 18;
  }
  if (/\b(wrong tool|tool choice|tool selection|state|retrieval|retry|trace|span|handoff|side effect)\b/i.test(haystack)) {
    relevanceScore += 10;
  }
  if (ownership === "firsthand") relevanceScore += 8;

  let urgencyScore = 0;
  if (pain) urgencyScore += 22;
  if (STRONG_URGENCY_PATTERNS.some((pattern) => pattern.test(haystack))) urgencyScore += 35;
  if (ownership === "firsthand") urgencyScore += 16;
  if (/\b(today|yesterday|this morning|tonight|this week)\b/i.test(haystack)) urgencyScore += 12;

  if (item.createdAt) {
    const ageHours = Math.max(0, (Date.now() - new Date(item.createdAt).getTime()) / 36e5);
    if (ageHours <= 3) urgencyScore += 30;
    else if (ageHours <= 12) urgencyScore += 24;
    else if (ageHours <= 24) urgencyScore += 18;
    else if (ageHours <= 72) urgencyScore += 8;
  }

  const artifact = detectArtifacts(haystack, ownership);
  if (artifact.level === "high") relevanceScore += 8;
  else if (artifact.level === "medium") relevanceScore += 4;

  relevanceScore = Math.min(100, Math.max(0, relevanceScore - nonFit.penalty));
  urgencyScore = Math.min(100, urgencyScore);

  let activationReadiness = 0;
  activationReadiness += Math.round(relevanceScore * 0.28);
  activationReadiness += Math.round(urgencyScore * 0.18);
  if (ownership === "firsthand") activationReadiness += 18;
  if (concreteIncident) activationReadiness += 14;
  if (multistep) activationReadiness += 12;
  if (artifact.level === "high") activationReadiness += 14;
  else if (artifact.level === "medium") activationReadiness += 7;
  if (artifact.bestCompatibility === "high") activationReadiness += 10;
  else if (artifact.bestCompatibility === "partial") activationReadiness += 5;
  else if (artifact.bestCompatibility === "adapter-needed") activationReadiness -= 4;
  activationReadiness -= nonFit.penalty;

  activationReadiness = Math.min(100, Math.max(0, activationReadiness));

  const score = Math.min(
    100,
    Math.round(relevanceScore * 0.42 + urgencyScore * 0.23 + activationReadiness * 0.35)
  );

  return {
    ...item,
    score,
    relevanceScore,
    urgencyScore,
    activationReadiness,
    ownership,
    firsthand: ownership === "firsthand",
    concreteIncident,
    multistep,
    artifactLikelihood: artifact.level,
    artifactMatches: artifact.matches,
    artifactPlatforms: artifact.platforms,
    artifactCompatibility: artifact.bestCompatibility,
    nonFitReasons: nonFit.reasons,
    nonFitPenalty: nonFit.penalty,
    matchedTerms: [...new Set(matchedTerms)],
  };
}

export async function fetchText(url, headers = {}) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "TraserSignalRadar/0.3 local research tool",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      ...headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(7000),
  });

  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.text();
}

export async function fetchJson(url, headers = {}) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "TraserSignalRadar/0.3",
      Accept: "application/json",
      ...headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(7000),
  });

  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.json();
}

export async function postJson(url, body, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "User-Agent": "TraserSignalRadar/0.3",
      Accept: "application/json",
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(7000),
  });

  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.json();
}
