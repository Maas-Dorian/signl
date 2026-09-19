import { NextResponse } from "next/server";
import { collectGitHub } from "../../../collectors/github.js";
import { collectHackerNews } from "../../../collectors/hackernews.js";
import { collectLinkedIn } from "../../../collectors/linkedin.js";
import { collectReddit } from "../../../collectors/reddit.js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

export async function GET() {
  const startedAt = Date.now();

  const [redditResult, linkedinResult, githubResult, hackerNewsResult] = await Promise.allSettled([
    collectReddit(),
    collectLinkedIn(),
    collectGitHub(),
    collectHackerNews(),
  ]);

  const reddit = redditResult.status === "fulfilled" ? redditResult.value : [];
  const linkedin = linkedinResult.status === "fulfilled" ? linkedinResult.value : [];
  const github = githubResult.status === "fulfilled" ? githubResult.value : [];
  const hackernews = hackerNewsResult.status === "fulfilled" ? hackerNewsResult.value : [];

  const errors = [];
  const results = [
    ["reddit", redditResult],
    ["linkedin", linkedinResult],
    ["github", githubResult],
    ["hackernews", hackerNewsResult],
  ];

  for (const [source, result] of results) {
    if (result.status === "rejected") {
      errors.push({
        source,
        message: result.reason?.message || `${source} collector failed`,
      });
    }
  }

  const signals = [...reddit, ...linkedin, ...github, ...hackernews].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    return bt - at;
  });

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
      highArtifact: signals.filter((item) => item.artifactLikelihood === "high").length,
    },
    errors,
    signals,
  });
}
