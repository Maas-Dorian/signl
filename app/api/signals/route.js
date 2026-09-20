import { NextResponse } from "next/server";
import { collectCompanies } from "../../../collectors/companies.js";
import { collectGitHub } from "../../../collectors/github.js";
import { collectHackerNews } from "../../../collectors/hackernews.js";
import { collectLinkedIn } from "../../../collectors/linkedin.js";
import { collectRedditDetailed } from "../../../collectors/reddit.js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

export async function GET() {
  const startedAt = Date.now();

  const [redditResult, linkedinResult, githubResult, hackerNewsResult, companyResult] =
    await Promise.allSettled([
      collectRedditDetailed(),
      collectLinkedIn(),
      collectGitHub(),
      collectHackerNews(),
      collectCompanies(),
    ]);

  const redditDetailed =
    redditResult.status === "fulfilled"
      ? redditResult.value
      : { items: [], coverage: [] };

  const reddit = redditDetailed.items || [];
  const redditCoverage = redditDetailed.coverage || [];
  const linkedin = linkedinResult.status === "fulfilled" ? linkedinResult.value : [];
  const github = githubResult.status === "fulfilled" ? githubResult.value : [];
  const hackernews = hackerNewsResult.status === "fulfilled" ? hackerNewsResult.value : [];
  const companiesDetailed =
    companyResult.status === "fulfilled"
      ? companyResult.value
      : {
          companies: [],
          signals: [],
          coverage: {
            companiesTotal: 50,
            companiesWithEvidence: 0,
            highFitSignals: 0,
            searches: 0,
            providers: [],
            errors: [],
          },
        };

  const errors = [];
  const results = [
    ["reddit", redditResult],
    ["linkedin", linkedinResult],
    ["github", githubResult],
    ["hackernews", hackerNewsResult],
    ["companies", companyResult],
  ];

  for (const [source, result] of results) {
    if (result.status === "rejected") {
      errors.push({
        source,
        message: result.reason?.message || `${source} collector failed`,
      });
    }
  }

  for (const message of companiesDetailed.coverage?.errors || []) {
    errors.push({ source: "companies", message });
  }

  const signals = [...reddit, ...linkedin, ...github, ...hackernews].sort((a, b) => {
    if ((b.activationReadiness || 0) !== (a.activationReadiness || 0)) {
      return (b.activationReadiness || 0) - (a.activationReadiness || 0);
    }
    if (b.score !== a.score) return b.score - a.score;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    return bt - at;
  });

  const redditCommunityCounts = Object.fromEntries(
    redditCoverage.map((entry) => [entry.community, entry.matchedCount])
  );

  return NextResponse.json({
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    counts: {
      total: signals.length,
      reddit: reddit.length,
      linkedin: linkedin.length,
      github: github.length,
      hackernews: hackernews.length,
      comments: signals.filter((item) => item.kind === "comment").length,
      firsthand: signals.filter((item) => item.firsthand).length,
      concreteIncident: signals.filter((item) => item.concreteIncident).length,
      highArtifact: signals.filter((item) => item.artifactLikelihood === "high").length,
      activationReady: signals.filter((item) => (item.activationReadiness || 0) >= 70).length,
      nonFit: signals.filter((item) => (item.nonFitReasons || []).length > 0).length,
      targetCompanies: companiesDetailed.coverage?.companiesTotal ?? 50,
      companiesWithEvidence: companiesDetailed.coverage?.companiesWithEvidence ?? 0,
      companyHighFitSignals: companiesDetailed.coverage?.highFitSignals ?? 0,
    },
    reddit: {
      coverage: redditCoverage,
      communityCounts: redditCommunityCounts,
      communitiesWithMatches: redditCoverage.filter((entry) => entry.matchedCount > 0).length,
      communitiesHealthy: redditCoverage.filter((entry) => entry.status === "ok").length,
      communitiesTotal: redditCoverage.length,
    },
    companies: {
      accounts: companiesDetailed.companies || [],
      signals: companiesDetailed.signals || [],
      coverage: companiesDetailed.coverage || {},
    },
    errors,
    signals,
  });
}
