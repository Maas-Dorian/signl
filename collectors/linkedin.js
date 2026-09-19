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
      sourceId: item?.guid?.["#text"] || item?.guid || item?.link || "",
      community: "LinkedIn public web",
      author: "",
      title: stripHtml(item?.title || ""),
      text: stripHtml(item?.description || ""),
      url: item?.link || "",
      // Bing's RSS date is useful as a search freshness hint, but it is NOT
      // guaranteed to be the original LinkedIn post publication time.
      createdAt: null,
      indexedAt: item?.pubDate || null,
      discoveredAt: new Date().toISOString(),
      timestampConfidence: "search-index-only",
      discoveryQuery: query,
    }));
}

export async function collectLinkedIn() {
  const all = [];

  for (const query of LINKEDIN_QUERIES) {
    const q = `site:linkedin.com/posts ${query}`;
    const url = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(q)}`;

    try {
      const xml = await fetchText(url);
      const items = parseBingRss(xml, query)
        .map((item) => scoreSignal(item, SIGNAL_TERMS))
        .filter((item) => item.matchedTerms.length > 0);

      all.push(...items);
    } catch (error) {
      console.error(`[linkedin] ${query}: ${error.message}`);
    }
  }

  return uniqueByUrl(all).sort((a, b) => b.score - a.score);
}
