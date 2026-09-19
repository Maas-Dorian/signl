# Traser Signal Radar

A small signal dashboard for finding people who appear to be experiencing Traser-relevant AI-agent debugging pain right now.

The goal is not generic lead generation. It is to surface fresh, firsthand problem signals that can turn into real Traser investigations.

## What it covers now

- Reddit posts
- Reddit comments
- temporary LinkedIn discovery through Bing's public RSS search index
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

## Current Reddit communities

- r/LangChain
- r/AI_Agents
- r/LocalLLaMA
- r/LLMDevs

The temporary Reddit collector reads the public newest-post and newest-comment RSS feeds. This should be replaced by the approved Reddit Data API when access is granted.

## LinkedIn limitation

LinkedIn does not expose a general public API for arbitrary global post search. The temporary collector queries Bing's public RSS search results for indexed linkedin.com/posts pages.

LinkedIn timestamps are therefore not treated as original post timestamps. LinkedIn results are marked as search-index-only and should not be treated as real-time monitoring.

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

The old terminal scanner still works:

```bash
npm run scan
```

Optional:

```bash
HOURS_BACK=24 MIN_SCORE=40 npm run scan
```

## Deploy to Vercel

1. Import this GitHub repository into Vercel.
2. Keep Framework Preset as Next.js.
3. No environment variables are required for the current temporary collectors.
4. Deploy.

Vercel will run the collectors through `/api/signals` when the dashboard refreshes.

Important: Reddit may occasionally rate-limit or reject RSS requests from cloud/datacenter IPs. If that happens, the dashboard will still load and report the source error rather than failing the entire scan. Official Reddit API access is the durable fix.

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
│   ├── index.js
│   ├── linkedin.js
│   ├── reddit.js
│   └── utils.js
├── package.json
└── README.md
```

## Deliberate non-goals

For now this does not:

- automate Reddit or LinkedIn outreach
- scrape logged-in LinkedIn pages
- enrich people with sales data
- act as a CRM
- use an LLM for every result
- claim a generic debugging mention validates Traser

The point is to find fresh incidents, get to the conversation faster, ask for the run, and learn which signals actually turn into Traser usage.
