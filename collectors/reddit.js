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

function parseFeed(xml, subreddit, kind) {
  const parsed = parser.parse(xml);
  const entries = toArray(parsed?.feed?.entry);

  return entries.map((entry) => {
    const content =
      entry?.content?.["#text"] ??
      entry?.content ??
      entry?.summary?.["#text"] ??
      entry?.summary ??
      "";
    const author = entry?.author?.name || "";

    return {
      source: "reddit",
      kind,
      sourceId: entry?.id || getLink(entry),
      community: `r/${subreddit}`,
      author: String(author).replace(/^\/u\//, ""),
      title: stripHtml(entry?.title || (kind === "comment" ? "Reddit comment" : "")),
      text: stripHtml(content),
      url: getLink(entry),
      createdAt: entry?.published || entry?.updated || null,
      discoveredAt: new Date().toISOString(),
      timestampConfidence: "source",
    };
  });
}

async function fetchSubredditFeed(subreddit, kind) {
  const path = kind === "comment" ? "comments/.rss?limit=100" : "new/.rss?limit=100";
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/${path}`;
  const xml = await fetchText(url);

  return parseFeed(xml, subreddit, kind)
    .filter((item) => isWithinHours(item.createdAt, HOURS_BACK))
    .map((item) => scoreSignal(item, SIGNAL_TERMS))
    .filter((item) => item.matchedTerms.length > 0);
}

export async function collectReddit() {
  const all = [];

  for (const subreddit of REDDIT_SUBREDDITS) {
    for (const kind of ["post", "comment"]) {
      try {
        all.push(...(await fetchSubredditFeed(subreddit, kind)));
      } catch (error) {
        console.error(`[reddit:${kind}] ${subreddit}: ${error.message}`);
      }
    }
  }

  return uniqueByUrl(all).sort((a, b) => b.score - a.score);
}
