# Traser Signal Radar

A small signal dashboard for finding people who appear to be experiencing Traser-relevant AI-agent debugging pain right now.

The goal is not generic lead generation. Signl is optimized for one outcome: finding people who are likely to have a concrete Traser-shaped incident, usable execution evidence, and enough urgency to actually try the product.

## What it covers now

- Reddit posts and comments
- GitHub public issues
- Hacker News stories and comments
- LinkedIn discovery through Serper/Google results, with Bing RSS as a fallback
- relevance, urgency, and activation-readiness scoring
- firsthand-problem and concrete-incident detection
- multi-step investigation-fit detection
- explicit non-fit penalties
- artifact/platform detection and current Traser compatibility hints
- browser-local activation/outcome tracking
- blocker tracking when someone does not complete an investigation
- source/query conversion summaries
- lightweight repeated-author relationship hints
- a simple Vercel-ready dashboard

## Signal model

Every result is scored and labeled with:

- relevance: how closely the content matches Traser's investigation problem
- urgency: whether the person appears to be dealing with the problem now
- activation readiness: whether the signal combines fit, urgency, firsthand ownership, a concrete incident, multi-step behavior, and a likely usable artifact
- ownership: firsthand, secondhand, or general discussion
- artifact likelihood: whether a trace, log, run, span, export, or other execution artifact is likely available
- artifact compatibility: whether the mentioned source is currently close to Traser's ingestion path
- non-fit reasons: common cases that should be deprioritized instead of being forced into the Traser thesis

Activation readiness is intentionally more important than generic AI-debugging relevance.

### Current compatibility hints

These labels are discovery hints, not blanket native-support claims.

- LangSmith: high, because Traser now has a first-class adapter path, with live-export verification still required before claiming universal compatibility
- Langfuse: partial, currently expected to need a light transform
- Arize Phoenix/OpenInference: partial, currently expected to need a light transform
- OpenTelemetry: adapter needed
- Braintrust: adapter needed
- generic JSON/traces/logs: unknown until the shape is inspected

## Activation tracking

The dashboard lets you mark the real progression from a signal to product use:

- Relevant
- Engaged
- Concrete incident
- Artifact available
- Asked to try
- Started Traser
- Blocked
- Completed investigation
- Useful
- Not useful
- Repeat use
- Ignore

If someone is blocked, Signl can record why:

- could not export trace
- unsupported format
- no trace available
- privacy/company restriction
- did not have time
- problem already solved
- not painful enough
- Traser import failed
- Traser result not useful
- other

These records stay in browser local storage for now. Signl intentionally does not act as a CRM or upload private trace data.

The dashboard also groups outcomes by discovery query so it becomes possible to see which searches produce interesting conversations versus actual Traser usage.

## Sources

### Reddit

Current communities:

- r/LangChain
- r/AI_Agents
- r/aiagents
- r/learnAIAgents
- r/LocalLLaMA
- r/LLMDevs
- r/MCP
- r/RAG

The Reddit collector scans each configured subreddit independently for both new posts and new comments. The dashboard exposes per-subreddit feed health, recent items scanned, and matched signal counts so one community cannot silently masquerade as full Reddit coverage. If both RSS feeds for a subreddit fail and `SERPER_API_KEY` is configured, Signl uses a targeted Google/Serper search fallback for that subreddit. This should still be replaced by the approved Reddit Data API when access is granted.

New communities should be kept only if they produce qualified conversations or investigations. Signl should not become a broad Reddit monitoring tool.

### GitHub

The GitHub collector searches newly-created public issues for Traser-relevant problem language such as agent debugging, wrong tool selection, wrong outputs, LangGraph/LangSmith debugging, state bugs, retries, duplicate effects, and side effects.

A token is optional for the prototype, but adding a read-only `GITHUB_TOKEN` in Vercel is recommended because unauthenticated GitHub Search API limits are much tighter.

The current collector searches issues, not GitHub Discussions.

### Hacker News

Hacker News is queried through the public Algolia HN Search API.

Stories and comments are filtered for actual AI/agent debugging pain before scoring. Comment relevance is based on the comment itself, so an unrelated reply does not inherit relevance merely because the parent story mentions agents or tracing.

No API key is required.

### LinkedIn

LinkedIn does not expose a general public API for arbitrary global post search. The collector therefore uses Serper as the primary discovery layer for Google results that point to indexed `linkedin.com/posts` pages.

Set `SERPER_API_KEY` to enable Serper. The collector searches Google with a last-24-hours filter and requests up to 20 results per query. If the Serper key is missing or Serper fails, Signl falls back to Bing public RSS search results.

LinkedIn timestamps are not treated as guaranteed original post timestamps. Search-engine dates are discovery hints only.

## Run locally

Requires Node.js 20.9+.

```bash
git clone https://github.com/Maas-Dorian/signl.git
cd signl
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

The terminal scanner also works:

```bash
npm run scan
```

Optional:

```bash
HOURS_BACK=24 MIN_SCORE=40 npm run scan
```

For better GitHub API limits:

```bash
GITHUB_TOKEN=github_pat_xxx npm run scan
```

## Deploy to Vercel

1. Import this GitHub repository into Vercel.
2. Keep Framework Preset as Next.js.
3. Deploy.
4. Add `SERPER_API_KEY` as a Vercel environment variable for Google-powered LinkedIn discovery through Serper.
5. Optional but recommended: add `GITHUB_TOKEN` as a Vercel environment variable using a minimal read-only token.

The dashboard calls `/api/signals`, which runs all four collectors server-side and merges the results.

Important: Reddit may occasionally rate-limit or reject RSS requests from cloud/datacenter IPs. If that happens, the dashboard still loads using the other sources. Official Reddit API access is the durable fix.

## Deliberate non-goals

For now this does not:

- automate outreach
- scrape logged-in LinkedIn pages
- enrich people with sales data
- act as a full CRM
- use an LLM for every result
- claim that a generic debugging mention validates Traser
- automatically turn every adjacent debugging problem into a Traser lead

The point is to get from fresh public evidence to the right person, the right incident, and an actual Traser investigation faster.
