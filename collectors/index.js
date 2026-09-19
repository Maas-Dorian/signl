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
    console.log(`[${item.source.toUpperCase()}] score=${item.score} | ${ageLabel(item)}`);
    console.log(item.community || "");
    console.log(item.title || "(no title)");
    if (item.text) console.log(item.text.slice(0, 350));
    console.log(`matched: ${item.matchedTerms.join(", ")}`);
    console.log(item.url);

    if (item.source === "linkedin") {
      console.log("LinkedIn time note: discovered through Bing; original post time is not verified.");
    }
  }

  console.log(`\n${filtered.length} signal(s) above MIN_SCORE=${MIN_SCORE}.`);
}

async function main() {
  console.log("Scanning Reddit RSS and LinkedIn public search indexes...");

  const [reddit, linkedin] = await Promise.all([
    collectReddit(),
    collectLinkedIn(),
  ]);

  console.log(`Found ${reddit.length} Reddit candidates and ${linkedin.length} LinkedIn candidates.`);
  printSignals([...reddit, ...linkedin]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
