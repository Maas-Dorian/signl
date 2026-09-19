import { XMLParser } from "fast-xml-parser";
import { LINKEDIN_QUERIES, SIGNAL_TERMS } from "./config.js";
import {
  fetchText,
  postJson,
  scoreSignal,
  stripHtml,
  toArray,
  uniqueByUrl,
} from "./utils.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

function normalizeSerperResult(item, query) {
  return {
    source: "linkedin",
    kind: "result",
    sourceId: item.link || "",
    community: "LinkedIn public web",
    author: "",
    title: stripHtml(item.title || ""),
    text: stripHtml(item.snippet || ""),
    url: item.link || "",
    createdAt: null,
    indexedAt: item.date || null,
    discoveredAt: new Date().toISOString(),
    timestampConfidence: "search-index-only",
    discoveryProvider: "serper",
    discoveryQuery: query,
  };
}

function parseBingRss(xml, query) {
  const parsed = parser.parse(xml);
  const items = toArray(parsed?.rss?.channel?.item);

  return items
    .filter((item) => String(item?.link || "").includes("linkedin.com"))
    .map((item) => ({
      source: "linkedin",
      kind: "result",
      sourceId: item?.guid?.["#text"] || item?.guid || item?.link || "",
      community: "LinkedIn public web",
      author: "",
      title: stripHtml(item?.title || ""),
      text: stripHtml(item?.description || ""),
      url: item?.link || "",
      createdAt: null,
      indexedAt: item?.pubDate || null,
      discoveredAt: new Date().toISOString(),
      timestampConfidence: "search-index-only",
      discoveryProvider: "bing-fallback",
      discoveryQuery: query,
    }));
}

async function fetchSerperQuery(query) {
  const q = `site:linkedin.com/posts ${query}`;

  const data = await postJson(
    "https://google.serper.dev/search",
    {
      q,
      gl: "us",
      hl: "en",
      num: 20,
      tbs: "qdr:d",
    },
    {
      "X-API-KEY": process.env.SERPER_API_KEY,
    }
  );

  return (data?.organic || [])
    .filter((item) => String(item?.link || "").includes("linkedin.com"))
    .map((item) => normalizeSerperResult(item, query))
    .map((item) => scoreSignal(item, SIGNAL_TERMS))
    .filter((item) => item.matchedTerms.length > 0);
}

async function fetchBingQuery(query) {
  const q = `site:linkedin.com/posts ${query}`;
  const url = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(q)}`;
  const xml = await fetchText(url);

  return parseBingRss(xml, query)
    .map((item) => scoreSignal(item, SIGNAL_TERMS))
    .filter((item) => item.matchedTerms.length > 0);
}

async function fetchQuery(query) {
  if (process.env.SERPER_API_KEY) {
    try {
      return await fetchSerperQuery(query);
    } catch (error) {
      console.error(`[linkedin:serper] ${query}: ${error.message}; falling back to Bing`);
    }
  }

  try {
    return await fetchBingQuery(query);
  } catch (error) {
    console.error(`[linkedin:bing] ${query}: ${error.message}`);
    return [];
  }
}

export async function collectLinkedIn() {
  const groups = await Promise.all(LINKEDIN_QUERIES.map(fetchQuery));
  return uniqueByUrl(groups.flat()).sort((a, b) => b.score - a.score);
}
