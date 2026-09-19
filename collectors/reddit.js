import { XMLParser } from "fast-xml-parser";
import { HOURS_BACK, REDDIT_SUBREDDITS, SIGNAL_TERMS } from "./config.js";
import { fetchText, isWithinHours, scoreSignal, stripHtml, toArray, uniqueByUrl } from "./utils.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

function getLink(entry) {
  const links = toArray(entry.link);
  const preferred = links.find((link) => link?.["@_rel"] === "alternate") || links[0];
  if (typeof preferred === "string") return preferred;
  return preferred?.["@_href"] || "";
}

function parseFeed(xml, subreddit) {
  const parsed = parser.parse(xml);
  const entries = toArray(parsed?.feed?.entry);

  return entries.map((entry) => {
    const content = entry?.content?.["#text"] ?? entry?.content ?? entry?.summary?.["#text"] ?? entry?.summary ?? "";
    const author = entry?.author?.name || "";

    return {
      source: "reddit",
      sourceId: entry?.id || getLink(entry),
      community: `r/${subreddit}`,
      author: String(author).replace(/^\/u\//, ""),
      title: stripHtml(entry?.title || ""),
      text: stripHtml(content),
      url: getLink(entry),
      createdAt: entry?.published || entry?.updated || null,
      discoveredAt: new Date().toISOString(),
      timestampConfidence: "source",
    };
  });
}

export async function collectReddit() {
  const all = [];

  for (const subreddit of REDDIT_SUBREDDITS) {
    const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/new/.rss?limit=100`;

    try {
      const xml = await fetchText(url);
      const items = parseFeed(xml, subreddit)
        .filter((item) => isWithinHours(item.createdAt, HOURS_BACK))
        .map((item) => scoreSignal(item, SIGNAL_TERMS))
        .filter((item) => item.matchedTerms.length > 0);

      all.push(...items);
    } catch (error) {
      console.error(`[reddit] ${subreddit}: ${error.message}`);
    }
  }

  return uniqueByUrl(all).sort((a, b) => b.score - a.score);
}
