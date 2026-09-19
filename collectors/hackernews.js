import { HN_QUERIES, HOURS_BACK, SIGNAL_TERMS } from "./config.js";
import { fetchJson, isWithinHours, scoreSignal, stripHtml, uniqueByUrl } from "./utils.js";

const STRONG_HN_MATCHES = [
  /\bagent debugging\b/i,
  /\bllm debugging\b/i,
  /\bwrong tool\b/i,
  /\btool call(?:ing|s)?\b/i,
  /\bfunction call(?:ing|s)?\b/i,
  /\blanggraph\b/i,
  /\blangsmith\b/i,
  /\blangfuse\b/i,
  /\bllm trac(?:e|es|ing)\b/i,
  /\bagent observability\b/i,
  /\bagent (?:failed|failure|stuck|looping)\b/i,
  /\bmulti[- ]agent debugging\b/i,
];

const AI_CONTEXT_PATTERNS = [
  /\bllm\b/i,
  /\blanguage model\b/i,
  /\bai agent\b/i,
  /\bagentic\b/i,
  /\blanggraph\b/i,
  /\blangchain\b/i,
  /\blangsmith\b/i,
  /\blangfuse\b/i,
  /\bcrewai\b/i,
  /\bautogen\b/i,
  /\btool call(?:ing|s)?\b/i,
  /\bfunction call(?:ing|s)?\b/i,
  /\bretrieval\b/i,
  /\brag\b/i,
  /\bprompt\b/i,
  /\bmodel call\b/i,
];

const PAIN_PATTERNS = [
  /\bdebug(?:ging)?\b/i,
  /\bwrong\b/i,
  /\bincorrect\b/i,
  /\bunexpected\b/i,
  /\bfailed?\b/i,
  /\bfailure\b/i,
  /\bstuck\b/i,
  /\bbug\b/i,
  /\bissue\b/i,
  /\bproblem\b/i,
  /\bretry\b/i,
  /\bloop(?:ing)?\b/i,
  /\btrace|tracing\b/i,
  /\bobservability\b/i,
  /\bcan't figure out\b/i,
  /\bcannot figure out\b/i,
];

function hasRelevantHnPain(item) {
  // For comments, judge the comment itself. Do not let a relevant story title
  // make an unrelated reply look like a Traser signal.
  const text =
    item.kind === "comment"
      ? item.text || ""
      : `${item.title || ""} ${item.text || ""}`;

  if (STRONG_HN_MATCHES.some((pattern) => pattern.test(text))) return true;

  const hasAiContext = AI_CONTEXT_PATTERNS.some((pattern) => pattern.test(text));
  const hasPain = PAIN_PATTERNS.some((pattern) => pattern.test(text));

  return hasAiContext && hasPain;
}

function scoreHnItem(item) {
  // HN comment cards keep the parent story title for display, but relevance
  // scoring must only use the comment body or every reply under a relevant
  // story inherits that story's keywords.
  if (item.kind !== "comment") return scoreSignal(item, SIGNAL_TERMS);

  const displayTitle = item.title;
  const scored = scoreSignal(
    {
      ...item,
      title: "",
    },
    SIGNAL_TERMS
  );

  return {
    ...scored,
    title: displayTitle,
  };
}

async function fetchQuery(query, kind) {
  const params = new URLSearchParams({
    query,
    tags: kind === "comment" ? "comment" : "story",
    hitsPerPage: "40",
  });

  const data = await fetchJson(
    `https://hn.algolia.com/api/v1/search_by_date?${params.toString()}`
  );

  return (data.hits || [])
    .map((hit) => {
      const isComment = kind === "comment";
      return {
        source: "hackernews",
        kind,
        sourceId: `hn:${hit.objectID}`,
        community: "Hacker News",
        author: hit.author || "",
        title: isComment
          ? hit.story_title || "Hacker News comment"
          : hit.title || "Hacker News story",
        text: isComment
          ? stripHtml(hit.comment_text || "")
          : stripHtml(hit.story_text || ""),
        url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
        createdAt: hit.created_at || null,
        discoveredAt: new Date().toISOString(),
        timestampConfidence: "source",
        discoveryQuery: query,
      };
    })
    .filter((item) => isWithinHours(item.createdAt, HOURS_BACK))
    .filter(hasRelevantHnPain)
    .map(scoreHnItem)
    .filter((item) => item.matchedTerms.length > 0)
    .filter((item) => item.relevanceScore >= 35);
}

export async function collectHackerNews() {
  const jobs = HN_QUERIES.flatMap((query) =>
    ["story", "comment"].map(async (kind) => {
      try {
        return await fetchQuery(query, kind);
      } catch (error) {
        console.error(`[hackernews:${kind}] ${query}: ${error.message}`);
        return [];
      }
    })
  );

  const groups = await Promise.all(jobs);
  return uniqueByUrl(groups.flat()).sort((a, b) => b.score - a.score);
}
