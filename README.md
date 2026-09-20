# Traser Signal Radar

A small signal dashboard for finding companies and engineers who appear to be experiencing Traser-relevant AI-agent failures right now.

The goal is not generic lead generation. Signl now works in two directions: developer-side investigation signals and customer-side product complaints. Customer complaints help identify which agent companies may be hurting; technical signals help determine whether the failure shape is actually relevant to Traser.

## What it covers now

- Reddit posts and comments
- GitHub public issues
- Hacker News stories and comments
- LinkedIn discovery through Serper/Google results, with Bing RSS as a fallback
- a 50-company agent-native watchlist that searches public review surfaces for customer-visible failures
- a curated 50-company agent-native watchlist
- public complaint discovery across Trustpilot, Reddit, G2, Capterra, Product Hunt, and Reviews.io search results
- company-level aggregation with Traser-shaped failure classifications
- relevance, urgency, and activation-readiness scoring
- firsthand-problem and concrete-incident detection
- multi-step investigation-fit detection
- explicit non-fit penalties
- artifact/platform detection and current Traser compatibility hints
- browser-local activation/outcome tracking
- blocker tracking when someone does not complete an investigation
- source/query conversion summaries
- lightweight repeated-author relationship hints
- company-level account scoring from public complaint evidence, with local stages for Watch → Reproduce → Contacted → Investigation
- a simple Vercel-ready dashboard

## Company pain radar

Signl keeps a curated watchlist of 50 relatively small agent-native companies spanning browser agents, coding agents, voice agents, support agents, workflow automation, financial agents, GTM agents, and AI coworkers.

The company collector does not treat a bad review as proof that Traser found the company's internal bug. It uses indexed public complaints as discovery evidence and looks for symptom shapes such as:

- completed-but-wrong behavior
- retry or loop behavior
- duplicate external side effects
- wrong external actions
- state or memory drift
- handoff or verification failures

Obvious billing, customer-service, login, outage, and refund-only complaints are penalized so Signl does not manufacture a Traser angle where one is not supported.

To control Serper usage, the 50 companies are searched in five batches rather than one API call per company. When Serper is unavailable, Bing RSS is used as a fallback. Search-engine dates remain discovery hints, not verified event timestamps.

The company dashboard shows:

- account score
- watchlist priority
- product shape
- public evidence count
- high-fit complaint count
- observed failure shapes
- direct evidence links
- a suggested next action

The intended workflow is:

public customer symptom → company → confirm Traser-shaped failure → identify technical owner → reproduce only when credible → ask to investigate a real run.

## Company pain radar

Signl also tracks 50 smaller agent-native companies selected for the kind of multi-step, tool-using, customer-facing workflows where Traser may be useful.

The watchlist lives in `collectors/company-watchlist.js`. It intentionally includes a mix of browser/computer-use agents, coding agents, voice agents, support agents, CRM/GTM agents, financial agents, and autonomous operations products.

The company collector does not assume that a bad review proves a Traser problem. It uses public search results from surfaces such as:

- Trustpilot
- Reddit
- G2
- Capterra
- Product Hunt
- Reviews.io

Searches are batched to avoid 50 separate API calls on every refresh. Results are then mapped back to companies and classified for customer-visible failure shapes such as:

- completed-but-wrong behavior
- retry loops
- duplicate side effects
- wrong external actions
- state or memory drift
- handoff or verification failures

Obvious billing, support, login, outage, and refund-dispute complaints are penalized so they do not masquerade as Traser validation.

The dashboard keeps the distinction explicit:

```text
customer complaint
→ possible failure shape
→ inspect evidence
→ reproduce only when credible
→ identify technical owner
→ ask for a real Traser investigation
```

Company stages are stored locally in the browser. Marking an account `Ignore` hides it from the active view; `Show all 50` lets you restore it.

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

The dashboard calls `/api/signals`, which runs Reddit, LinkedIn, GitHub, Hacker News, and the company pain collector server-side. The company watchlist remains visible even when no matching complaint is found.

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
- claim that a customer complaint reveals the company's internal root cause

The point is to get from fresh public evidence to the right person, the right incident, and an actual Traser investigation faster.
