import { XMLParser } from "fast-xml-parser";
import { HOURS_BACK, REDDIT_SUBREDDITS, SIGNAL_TERMS } from "./config.js";
import { fetchText, isWithinHours, postJson, scoreSignal, stripHtml, toArray, uniqueByUrl } from "./utils.js";

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
      discoveryQuery: `r/${subreddit}`,
    };
  });
}

async function fetchSubredditFeed(subreddit, kind) {
  const path = kind === "comment" ? "comments/.rss?limit=100" : "new/.rss?limit=100";
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/${path}`;
  const xml = await fetchText(url);
  const parsed = parseFeed(xml, subreddit, kind);
  const recent = parsed.filter((item) => isWithinHours(item.createdAt, HOURS_BACK));
  const matched = recent
    .map((item) => scoreSignal(item, SIGNAL_TERMS))
    .filter((item) => item.matchedTerms.length > 0);

  return {
    kind,
    rawCount: parsed.length,
    recentCount: recent.length,
    matched,
  };
}

async function fetchSerperFallback(subreddit) {
  if (!process.env.SERPER_API_KEY) return [];

  const q = `site:reddit.com/r/${subreddit} ("agent debugging" OR "wrong tool" OR "wrong output" OR retry OR trace OR "agent state")`;
  const data = await postJson(
    "https://google.serper.dev/search",
    {
      q,
      gl: "us",
      hl: "en",
      num: 10,
      tbs: "qdr:w",
    },
    {
      "X-API-KEY": process.env.SERPER_API_KEY,
    }
  );

  return (data?.organic || [])
    .filter((item) => String(item?.link || "").includes(`reddit.com/r/${subreddit}`))
    .map((item) => ({
      source: "reddit",
      kind: "result",
      sourceId: item.link || "",
      community: `r/${subreddit}`,
      author: "",
      title: stripHtml(item.title || ""),
      text: stripHtml(item.snippet || ""),
      url: item.link || "",
      createdAt: null,
      indexedAt: item.date || null,
      discoveredAt: new Date().toISOString(),
      timestampConfidence: "search-index-only",
      discoveryProvider: "serper-reddit-fallback",
      discoveryQuery: `r/${subreddit}`,
    }))
    .map((item) => scoreSignal(item, SIGNAL_TERMS))
    .filter((item) => item.matchedTerms.length > 0);
}

async function collectSubreddit(subreddit) {
  const kinds = ["post", "comment"];
  const settled = await Promise.allSettled(kinds.map((kind) => fetchSubredditFeed(subreddit, kind)));

  const items = [];
  const errors = [];
  let rawCount = 0;
  let recentCount = 0;
  const kindsOk = [];

  settled.forEach((result, index) => {
    const kind = kinds[index];
    if (result.status === "fulfilled") {
      kindsOk.push(kind);
      rawCount += result.value.rawCount;
      recentCount += result.value.recentCount;
      items.push(...result.value.matched);
    } else {
      errors.push({
        kind,
        message: result.reason?.message || `${kind} feed failed`,
      });
      console.error(`[reddit:${kind}] ${subreddit}: ${errors[errors.length - 1].message}`);
    }
  });

  let fallbackUsed = false;
  if (kindsOk.length === 0 && process.env.SERPER_API_KEY) {
    try {
      const fallbackItems = await fetchSerperFallback(subreddit);
      if (fallbackItems.length > 0) {
        items.push(...fallbackItems);
        fallbackUsed = true;
      }
    } catch (error) {
      errors.push({
        kind: "serper-fallback",
        message: error.message || "Serper fallback failed",
      });
      console.error(`[reddit:serper] ${subreddit}: ${error.message}`);
    }
  }

  return {
    subreddit,
    community: `r/${subreddit}`,
    items: uniqueByUrl(items),
    coverage: {
      subreddit,
      community: `r/${subreddit}`,
      rawCount,
      recentCount,
      matchedCount: items.length,
      kindsOk,
      errors,
      fallbackUsed,
      status:
        kindsOk.length === kinds.length
          ? "ok"
          : kindsOk.length > 0
            ? "partial"
            : fallbackUsed
              ? "search-fallback"
              : "failed",
    },
  };
}

export async function collectRedditDetailed() {
  const groups = await Promise.all(REDDIT_SUBREDDITS.map(collectSubreddit));
  const items = uniqueByUrl(groups.flatMap((group) => group.items)).sort((a, b) => {
    if ((b.activationReadiness || 0) !== (a.activationReadiness || 0)) {
      return (b.activationReadiness || 0) - (a.activationReadiness || 0);
    }
    return b.score - a.score;
  });

  return {
    items,
    coverage: groups.map((group) => group.coverage),
  };
}

export async function collectReddit() {
  const result = await collectRedditDetailed();
  return result.items;
}
