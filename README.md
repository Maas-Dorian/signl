# Traser Signal Radar

A small signal dashboard for finding people who appear to be experiencing Traser-relevant AI-agent debugging pain right now.

The goal is not generic lead generation. It is to surface fresh, firsthand problem signals that can turn into real Traser investigations.

## What it covers now

- Reddit posts
- Reddit comments
- GitHub public issues
- Hacker News stories
- Hacker News comments
- LinkedIn discovery through Serper/Google results, with Bing RSS as a fallback
- separate relevance and urgency scores
- firsthand-problem detection
- trace/artifact likelihood detection
- browser-local outcome tracking
- a simple Vercel-ready dashboard

## Signal model

Every result is scored and labeled with:

- relevance score: how closely the content matches Traser's actual investigation problem
- urgency score: whether the person appears to be dealing with the problem now
- ownership: firsthand, secondhand, or general discussion
- artifact likelihood: whether a trace, log, LangSmith/Langfuse run, export, span, or other execution artifact is likely available
- overall score: weighted relevance + urgency

The dashboard also lets you record outcomes:

- Relevant
- Responded
- Trace requested
- Trace received
- Used Traser
- Ignore

Those outcomes are stored in the browser for now. There is intentionally no CRM or database yet.

## Sources

### Reddit

Current communities:

- r/LangChain
- r/AI_Agents
- r/LocalLLaMA
- r/LLMDevs

The temporary Reddit collector reads the public newest-post and newest-comment RSS feeds. This should be replaced by the approved Reddit Data API when access is granted.

### GitHub

The GitHub collector searches newly-created public issues for Traser-relevant problem language such as agent debugging, wrong tool selection, wrong outputs, LangGraph debugging, LangSmith debugging, and agent state bugs.

A token is optional for the prototype, but adding a read-only `GITHUB_TOKEN` in Vercel is recommended because unauthenticated GitHub Search API limits are much tighter.

The current collector searches issues, not GitHub Discussions.

### Hacker News

Hacker News is queried through the public Algolia HN Search API. Both recent stories and comments are checked and then passed through the same relevance, urgency, firsthand, and artifact scoring used by the other sources.

No API key is required.

### LinkedIn

LinkedIn does not expose a general public API for arbitrary global post search. The collector therefore uses Serper as the primary discovery layer for Google results that point to indexed `linkedin.com/posts` pages.

Set `SERPER_API_KEY` to enable Serper. The collector searches Google with a last-24-hours filter and requests up to 20 results per query. If the Serper key is missing or Serper fails, Signl falls back to Bing's public RSS search results.

LinkedIn timestamps are still not treated as guaranteed original post timestamps. Search-engine dates are useful discovery hints, but they are not equivalent to a LinkedIn-native publication timestamp.

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

## Structure

```text
.
├── app/
│   ├── api/signals/route.js
│   ├── globals.css
│   ├── layout.js
│   └── page.js
├── collectors/
│   ├── config.js
│   ├── github.js
│   ├── hackernews.js
│   ├── index.js
│   ├── linkedin.js
│   ├── reddit.js
│   └── utils.js
├── package.json
└── README.md
```

## Deliberate non-goals

For now this does not:

- automate outreach
- scrape logged-in LinkedIn pages
- enrich people with sales data
- act as a CRM
- use an LLM for every result
- claim a generic debugging mention validates Traser

The point is to find fresh incidents, get to the conversation faster, ask for the run, and learn which signals actually turn into Traser usage.
