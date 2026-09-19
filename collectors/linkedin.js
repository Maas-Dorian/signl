import { XMLParser } from "fast-xml-parser";
import { LINKEDIN_QUERIES, SIGNAL_TERMS } from "./config.js";
import { fetchText, scoreSignal, stripHtml, toArray, uniqueByUrl } from "./utils.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

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
      discoveryQuery: query,
    }));
}

async function fetchQuery(query) {
  const q = `site:linkedin.com/posts ${query}`;
  const url = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(q)}`;

  try {
    const xml = await fetchText(url);
    return parseBingRss(xml, query)
      .map((item) => scoreSignal(item, SIGNAL_TERMS))
      .filter((item) => item.matchedTerms.length > 0);
  } catch (error) {
    console.error(`[linkedin] ${query}: ${error.message}`);
    return [];
  }
}

export async function collectLinkedIn() {
  const groups = await Promise.all(LINKEDIN_QUERIES.map(fetchQuery));
  return uniqueByUrl(groups.flat()).sort((a, b) => b.score - a.score);
}
