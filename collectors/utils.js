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

const ARTIFACT_TERMS = [
  "trace",
  "traces",
  "logs",
  "log",
  "langsmith",
  "langfuse",
  "span",
  "spans",
  "run id",
  "execution",
  "json",
  "export",
  "trajectory",
  "events",
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
  const matches = ARTIFACT_TERMS.filter((term) => haystack.includes(term));
  let level = "low";

  if (matches.length >= 2 || (ownership === "firsthand" && matches.length >= 1)) {
    level = "high";
  } else if (matches.length === 1) {
    level = "medium";
  }

  return {
    level,
    matches: [...new Set(matches)],
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

  if (technical) relevanceScore += 16;
  if (pain) relevanceScore += 14;
  if (/\b(success|succeeded|completed|200|green)\b.*\b(wrong|incorrect|bad|unexpected)\b/i.test(haystack)) {
    relevanceScore += 18;
  }
  if (/\b(wrong tool|tool choice|tool selection|state|retrieval|retry|trace|span)\b/i.test(haystack)) {
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

  relevanceScore = Math.min(100, relevanceScore);
  urgencyScore = Math.min(100, urgencyScore);

  const score = Math.min(
    100,
    Math.round(relevanceScore * 0.62 + urgencyScore * 0.38)
  );

  return {
    ...item,
    score,
    relevanceScore,
    urgencyScore,
    ownership,
    firsthand: ownership === "firsthand",
    artifactLikelihood: artifact.level,
    artifactMatches: artifact.matches,
    matchedTerms: [...new Set(matchedTerms)],
  };
}

export async function fetchText(url, headers = {}) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "TraserSignalRadar/0.2 local research tool",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      ...headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(7000),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }

  return response.text();
}


export async function fetchJson(url, headers = {}) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "TraserSignalRadar/0.2",
      Accept: "application/json",
      ...headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(7000),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }

  return response.json();
}


export async function postJson(url, body, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "User-Agent": "TraserSignalRadar/0.2",
      Accept: "application/json",
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(7000),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }

  return response.json();
}
