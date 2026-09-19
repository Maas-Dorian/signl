import { NextResponse } from "next/server";
import { collectLinkedIn } from "../../../collectors/linkedin.js";
import { collectReddit } from "../../../collectors/reddit.js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const startedAt = Date.now();

  const [redditResult, linkedinResult] = await Promise.allSettled([
    collectReddit(),
    collectLinkedIn(),
  ]);

  const reddit = redditResult.status === "fulfilled" ? redditResult.value : [];
  const linkedin = linkedinResult.status === "fulfilled" ? linkedinResult.value : [];

  const errors = [];
  if (redditResult.status === "rejected") {
    errors.push({ source: "reddit", message: redditResult.reason?.message || "Reddit collector failed" });
  }
  if (linkedinResult.status === "rejected") {
    errors.push({ source: "linkedin", message: linkedinResult.reason?.message || "LinkedIn collector failed" });
  }

  const signals = [...reddit, ...linkedin].sort((a, b) => {
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
      comments: signals.filter((item) => item.kind === "comment").length,
      firsthand: signals.filter((item) => item.firsthand).length,
      highArtifact: signals.filter((item) => item.artifactLikelihood === "high").length,
    },
    errors,
    signals,
  });
}
