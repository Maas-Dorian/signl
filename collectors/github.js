import { GITHUB_QUERIES, HOURS_BACK, SIGNAL_TERMS } from "./config.js";
import { fetchJson, isWithinHours, scoreSignal, uniqueByUrl } from "./utils.js";

function repoName(repositoryUrl = "") {
  const parts = String(repositoryUrl).split("/").filter(Boolean);
  return parts.length >= 2 ? parts.slice(-2).join("/") : "GitHub";
}

async function fetchQuery(query) {
  const params = new URLSearchParams({
    q: query,
    sort: "created",
    order: "desc",
    per_page: "20",
  });

  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const data = await fetchJson(
    `https://api.github.com/search/issues?${params.toString()}`,
    headers
  );

  return (data.items || [])
    .filter((item) => !item.pull_request)
    .map((item) => ({
      source: "github",
      kind: "issue",
      sourceId: `github:${item.id}`,
      community: repoName(item.repository_url),
      author: item.user?.login || "",
      title: item.title || "",
      text: item.body || "",
      url: item.html_url,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      discoveredAt: new Date().toISOString(),
      timestampConfidence: "source",
      discoveryQuery: query,
    }))
    .filter((item) => isWithinHours(item.createdAt, HOURS_BACK))
    .map((item) => scoreSignal(item, SIGNAL_TERMS))
    .filter((item) => item.matchedTerms.length > 0);
}

export async function collectGitHub() {
  const groups = await Promise.all(
    GITHUB_QUERIES.map(async (query) => {
      try {
        return await fetchQuery(query);
      } catch (error) {
        console.error(`[github] ${query}: ${error.message}`);
        return [];
      }
    })
  );

  return uniqueByUrl(groups.flat()).sort((a, b) => b.score - a.score);
}
