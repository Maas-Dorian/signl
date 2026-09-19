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
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

export function scoreSignal(item, terms) {
  const haystack = `${item.title || ""} ${item.text || ""}`.toLowerCase();
  let score = 0;
  const matches = [];

  for (const term of terms) {
    if (haystack.includes(term.toLowerCase())) {
      matches.push(term);
      score += 8;
    }
  }

  const firstPerson = /\b(i|i'm|im|we|we're|our|my)\b/i.test(haystack);
  const pain = /\b(can't|cannot|stuck|broken|failing|failed|wrong|incorrect|unexpected|hours|production)\b/i.test(haystack);
  const technical = /\b(agent|llm|langgraph|langchain|langsmith|langfuse|tool|trace|retrieval|state|retry)\b/i.test(haystack);

  if (firstPerson) score += 15;
  if (pain) score += 20;
  if (technical) score += 10;

  if (item.createdAt) {
    const ageHours = (Date.now() - new Date(item.createdAt).getTime()) / 36e5;
    if (ageHours <= 3) score += 20;
    else if (ageHours <= 24) score += 12;
    else if (ageHours <= 72) score += 5;
  }

  return {
    ...item,
    score: Math.min(score, 100),
    matchedTerms: [...new Set(matches)],
  };
}

export async function fetchText(url, headers = {}) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "TraserSignalRadar/0.1 local research tool",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      ...headers,
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }

  return response.text();
}
