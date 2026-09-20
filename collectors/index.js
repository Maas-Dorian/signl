import { collectCompanies } from "./companies.js";
import { collectGitHub } from "./github.js";
import { collectHackerNews } from "./hackernews.js";
import { collectLinkedIn } from "./linkedin.js";
import { collectReddit } from "./reddit.js";

const MIN_SCORE = Number(process.env.MIN_SCORE || 25);

function ageLabel(item) {
  if (!item.createdAt) return "time unknown";
  const hours = Math.max(0, (Date.now() - new Date(item.createdAt).getTime()) / 36e5);
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m ago`;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function printSignals(items) {
  const filtered = items
    .filter((item) => item.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  if (!filtered.length) {
    console.log("No signals above the current score threshold.");
    return;
  }

  for (const item of filtered) {
    console.log("\n" + "=".repeat(80));
    console.log(
      `[${item.source.toUpperCase()}] ${item.kind || "result"} | score=${item.score} | rel=${item.relevanceScore} | urgency=${item.urgencyScore} | ${ageLabel(item)}`
    );
    console.log(`${item.community || ""} | ownership=${item.ownership} | artifact=${item.artifactLikelihood}`);
    console.log(item.title || "(no title)");
    if (item.text) console.log(item.text.slice(0, 350));
    console.log(`matched: ${item.matchedTerms.join(", ")}`);
    if (item.artifactMatches?.length) console.log(`artifacts: ${item.artifactMatches.join(", ")}`);
    console.log(item.url);
  }

  console.log(`\n${filtered.length} signal(s) above MIN_SCORE=${MIN_SCORE}.`);
}

function printCompanies(result) {
  console.log("\n" + "#".repeat(80));
  console.log(
    `Company radar: ${result.coverage.companiesTotal} watched, ${result.coverage.companiesWithEvidence} with public evidence, ${result.coverage.highFitSignals} high-fit complaint signals.`
  );

  for (const company of result.companies.slice(0, 15)) {
    console.log("\n" + "-".repeat(80));
    console.log(
      `${company.name} | priority=${company.priority} | account=${company.accountScore} | matches=${company.evidenceCount} | high-fit=${company.highFitCount}`
    );
    console.log(company.productShape);
    if (company.shapes.length) console.log(`observed: ${company.shapes.join(", ")}`);
    console.log(`next: ${company.nextAction}`);
    for (const evidence of company.evidence.slice(0, 2)) {
      console.log(`  - [${evidence.sourceSurface}] fit=${evidence.fitScore} ${evidence.title}`);
      console.log(`    ${evidence.url}`);
    }
  }
}

async function main() {
  console.log("Scanning Reddit, LinkedIn, GitHub, Hacker News, and target companies...");

  const [reddit, linkedin, github, hackernews, companies] = await Promise.all([
    collectReddit(),
    collectLinkedIn(),
    collectGitHub(),
    collectHackerNews(),
    collectCompanies(),
  ]);

  console.log(
    `Found ${reddit.length} Reddit, ${linkedin.length} LinkedIn, ${github.length} GitHub, and ${hackernews.length} HN candidates.`
  );

  printCompanies(companies);
  printSignals([...reddit, ...linkedin, ...github, ...hackernews]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
