import { XMLParser } from "fast-xml-parser";
import { COMPANY_WATCHLIST } from "./company-watchlist.js";
import { fetchText, postJson, stripHtml, toArray, uniqueByUrl } from "./utils.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

const BATCH_SIZE = 10;
const PUBLIC_REVIEW_SURFACES = [
  "trustpilot.com",
  "reddit.com",
  "g2.com",
  "capterra.com",
  "producthunt.com",
  "reviews.io",
];

const COMPLAINT_PATTERNS = [
  /\b(broken|wrong|incorrect|failed|failing|failure|bug|issue|problem|unusable)\b/i,
  /\bdoesn['’]?t work\b/i,
  /\bnot working\b/i,
  /\bkeeps? (doing|failing|retrying|repeating|calling|breaking)\b/i,
  /\b(hallucinated|hallucinating|made up)\b/i,
  /\b(never|didn['’]?t) (finish|complete|work|submit|send|update|book|call)\b/i,
];

const TRASER_SHAPES = [
  {
    label: "completed-but-wrong",
    pattern: /\b(done|finished|completed|success|successful|said it (?:was )?done)\b.{0,100}\b(wrong|incorrect|broken|didn['’]?t|not actually|nothing happened)\b/i,
  },
  {
    label: "retry-loop",
    pattern: /\b(retry|retried|retrying|keeps?|loop|again and again|repeatedly)\b/i,
  },
  {
    label: "duplicate-side-effect",
    pattern: /\b(duplicate|twice|double|repeated)\b.{0,80}\b(send|sent|charge|charged|book|booked|submit|submitted|call|called|update|updated|action)\b/i,
  },
  {
    label: "wrong-external-action",
    pattern: /\b(wrong|incorrect|unintended)\b.{0,80}\b(email|message|call|booking|appointment|record|customer|account|file|link|application|refund|action|tool)\b/i,
  },
  {
    label: "state-or-memory-drift",
    pattern: /\b(stale|forgot|forgotten|memory|context|wrong account|wrong customer|wrong tenant|mixed up|lost context|state)\b/i,
  },
  {
    label: "handoff-or-verification",
    pattern: /\b(handoff|transfer|verification|verify|approval|confirmed|confirmation)\b.{0,80}\b(failed|wrong|missing|skipped|incorrect|never)\b/i,
  },
];

const OBVIOUS_NON_TRASER = [
  { label: "billing/pricing", pattern: /\b(price|pricing|subscription|billing|charged too much|too expensive|credits? cost)\b/i, penalty: 18 },
  { label: "support/service", pattern: /\b(customer support|support team|no response|never replied|rude support|customer service)\b/i, penalty: 18 },
  { label: "login/account access", pattern: /\b(login|log in|sign in|password|account locked|verification email)\b/i, penalty: 14 },
  { label: "generic outage", pattern: /\b(outage|site down|website down|server down|downtime)\b/i, penalty: 14 },
  { label: "refund dispute", pattern: /\b(refund request|won['’]?t refund|refund policy|money back)\b/i, penalty: 12 },
];

const AMBIGUOUS_NAMES = new Set(["aside", "item", "marker", "nex", "lark"]);

function chunk(items, size) {
  const groups = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

function sourceSurface(url = "") {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.endsWith("trustpilot.com")) return "Trustpilot";
    if (host.endsWith("reddit.com")) return "Reddit";
    if (host.endsWith("g2.com")) return "G2";
    if (host.endsWith("capterra.com")) return "Capterra";
    if (host.endsWith("producthunt.com")) return "Product Hunt";
    if (host.endsWith("reviews.io")) return "Reviews.io";
    return host;
  } catch {
    return "Public web";
  }
}

function normalizedText(value = "") {
  return stripHtml(value).toLowerCase();
}

function companyMatchScore(company, haystack) {
  const name = company.name.toLowerCase();
  const queryTokens = company.queryName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !["the", "and", "agents", "agent", "startup"].includes(token));

  let score = 0;
  if (haystack.includes(name)) score += 4;
  for (const token of queryTokens) {
    if (haystack.includes(token)) score += 1;
  }

  if (AMBIGUOUS_NAMES.has(name)) {
    return score >= 6 ? score : 0;
  }

  return score >= 4 ? score : 0;
}

function findCompany(batch, item) {
  const haystack = normalizedText(`${item.title || ""} ${item.snippet || item.description || ""} ${item.link || ""}`);
  const matches = batch
    .map((company) => ({ company, score: companyMatchScore(company, haystack) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return matches[0]?.company;
}

function scoreComplaint(item, company) {
  const text = stripHtml(`${item.title || ""} ${item.text || ""}`);
  const haystack = text.toLowerCase();
  const complaint = COMPLAINT_PATTERNS.some((pattern) => pattern.test(haystack));
  const shapes = TRASER_SHAPES.filter((shape) => shape.pattern.test(haystack)).map((shape) => shape.label);
  const nonFit = OBVIOUS_NON_TRASER.filter((rule) => rule.pattern.test(haystack));

  let fitScore = 0;
  if (complaint) fitScore += 24;
  fitScore += Math.min(54, shapes.length * 18);
  if (/\b(agent|ai|workflow|automation|assistant|voice|browser|tool)\b/i.test(haystack)) fitScore += 8;
  if (/\b(done|completed|finished|success)\b/i.test(haystack) && /\b(wrong|failed|broken|didn['’]?t)\b/i.test(haystack)) fitScore += 12;
  fitScore -= nonFit.reduce((sum, rule) => sum + rule.penalty, 0);

  fitScore = Math.max(0, Math.min(100, fitScore));

  return {
    ...item,
    companyId: company.id,
    companyName: company.name,
    companyPriority: company.priority,
    complaint,
    traserShapes: shapes,
    nonFitReasons: nonFit.map((rule) => rule.label),
    fitScore,
    sourceSurface: sourceSurface(item.url),
  };
}

function buildSearchQuery(batch) {
  const companies = batch.map((company) => `"${company.queryName}"`).join(" OR ");
  const sites = PUBLIC_REVIEW_SURFACES.map((domain) => `site:${domain}`).join(" OR ");
  return `(${companies}) (${sites}) ("wrong" OR "broken" OR "failed" OR "doesn't work" OR "not working" OR "retry" OR "keeps" OR "completed" OR "duplicate" OR "bug")`;
}

function normalizeSerperResult(item, query, batch) {
  const company = findCompany(batch, item);
  if (!company) return null;

  return scoreComplaint(
    {
      source: "company-web",
      kind: "review-signal",
      sourceId: item.link || "",
      community: sourceSurface(item.link || ""),
      author: "",
      title: stripHtml(item.title || ""),
      text: stripHtml(item.snippet || ""),
      url: item.link || "",
      createdAt: null,
      indexedAt: item.date || null,
      discoveredAt: new Date().toISOString(),
      timestampConfidence: "search-index-only",
      discoveryProvider: "serper-company-watch",
      discoveryQuery: query,
    },
    company,
  );
}

function parseBingRss(xml, query, batch) {
  const parsed = parser.parse(xml);
  const items = toArray(parsed?.rss?.channel?.item);

  return items
    .map((item) => {
      const normalized = {
        title: stripHtml(item?.title || ""),
        snippet: stripHtml(item?.description || ""),
        link: item?.link || "",
      };
      const company = findCompany(batch, normalized);
      if (!company) return null;

      return scoreComplaint(
        {
          source: "company-web",
          kind: "review-signal",
          sourceId: item?.guid?.["#text"] || item?.guid || item?.link || "",
          community: sourceSurface(item?.link || ""),
          author: "",
          title: normalized.title,
          text: normalized.snippet,
          url: normalized.link,
          createdAt: null,
          indexedAt: item?.pubDate || null,
          discoveredAt: new Date().toISOString(),
          timestampConfidence: "search-index-only",
          discoveryProvider: "bing-company-watch",
          discoveryQuery: query,
        },
        company,
      );
    })
    .filter(Boolean);
}

async function searchBatch(batch) {
  const query = buildSearchQuery(batch);

  if (process.env.SERPER_API_KEY) {
    try {
      const data = await postJson(
        "https://google.serper.dev/search",
        {
          q: query,
          gl: "us",
          hl: "en",
          num: 20,
          tbs: "qdr:m",
        },
        {
          "X-API-KEY": process.env.SERPER_API_KEY,
        },
      );

      return {
        provider: "serper",
        query,
        items: (data?.organic || [])
          .map((item) => normalizeSerperResult(item, query, batch))
          .filter(Boolean),
        error: null,
      };
    } catch (error) {
      console.error(`[companies:serper] ${error.message}; falling back to Bing`);
    }
  }

  try {
    const url = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`;
    const xml = await fetchText(url);
    return {
      provider: "bing-fallback",
      query,
      items: parseBingRss(xml, query, batch),
      error: null,
    };
  } catch (error) {
    return {
      provider: process.env.SERPER_API_KEY ? "serper+bing-failed" : "bing-failed",
      query,
      items: [],
      error: error.message || "Company review search failed",
    };
  }
}

function aggregateCompanies(signals) {
  const byCompany = new Map(COMPANY_WATCHLIST.map((company) => [company.id, []]));

  for (const signal of signals) {
    if (byCompany.has(signal.companyId)) byCompany.get(signal.companyId).push(signal);
  }

  return COMPANY_WATCHLIST.map((company) => {
    const evidence = (byCompany.get(company.id) || [])
      .sort((a, b) => b.fitScore - a.fitScore)
      .slice(0, 8);

    const highFit = evidence.filter((item) => item.fitScore >= 55);
    const shapes = [...new Set(evidence.flatMap((item) => item.traserShapes || []))];
    const nonFit = [...new Set(evidence.flatMap((item) => item.nonFitReasons || []))];

    let accountScore = company.priority === "A" ? 32 : 22;
    accountScore += Math.min(24, evidence.length * 4);
    accountScore += Math.min(30, highFit.length * 10);
    accountScore += Math.min(14, shapes.length * 4);
    accountScore = Math.min(100, accountScore);

    return {
      ...company,
      accountScore,
      evidenceCount: evidence.length,
      highFitCount: highFit.length,
      shapes,
      nonFit,
      evidence,
      nextAction:
        highFit.length > 0
          ? "Inspect the strongest complaint, reproduce the failure shape if credible, then identify the technical owner."
          : evidence.length > 0
            ? "Review the public complaints manually before spending time on a reproduction."
            : "Watch for customer-visible failures before doing outbound.",
    };
  }).sort((a, b) => b.accountScore - a.accountScore || a.name.localeCompare(b.name));
}

export async function collectCompanies() {
  const batches = chunk(COMPANY_WATCHLIST, BATCH_SIZE);
  const results = await Promise.all(batches.map(searchBatch));
  const signals = uniqueByUrl(results.flatMap((result) => result.items))
    .filter((item) => item.complaint || item.traserShapes.length > 0)
    .sort((a, b) => b.fitScore - a.fitScore);

  return {
    companies: aggregateCompanies(signals),
    signals,
    coverage: {
      companiesTotal: COMPANY_WATCHLIST.length,
      companiesWithEvidence: new Set(signals.map((item) => item.companyId)).size,
      highFitSignals: signals.filter((item) => item.fitScore >= 55).length,
      searches: results.length,
      providers: [...new Set(results.map((result) => result.provider))],
      errors: results.filter((result) => result.error).map((result) => result.error),
    },
  };
}
