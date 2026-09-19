import { HN_QUERIES, HOURS_BACK, SIGNAL_TERMS } from "./config.js";
import { fetchJson, isWithinHours, scoreSignal, stripHtml, uniqueByUrl } from "./utils.js";

async function fetchQuery(query, kind) {
  const params = new URLSearchParams({
    query,
    tags: kind === "comment" ? "comment" : "story",
    hitsPerPage: "30",
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
    .map((item) => scoreSignal(item, SIGNAL_TERMS))
    .filter((item) => item.matchedTerms.length > 0);
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
