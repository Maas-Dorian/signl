# Traser Signal Radar

Traser Signal Radar is a quick local-first tool for finding recent public discussions that look like active AI-agent debugging pain.

The current prototype runs on your Mac and uses temporary, no-key discovery paths while official Reddit Data API access is pending.

## Current sources

### Reddit

The collector reads each configured subreddit's public `new/.rss` feed, keeps recent posts, and filters/scorers them locally.

Current communities:

- r/LangChain
- r/AI_Agents
- r/LocalLLaMA
- r/LLMDevs

This is intentionally a temporary path. It makes only a few read requests per scan and does not automate posting, commenting, voting, messaging, or outreach. If Reddit approves Data API access, this collector should be replaced with the official authenticated API.

### LinkedIn

LinkedIn does not expose a general public API for arbitrary global post search. The temporary collector therefore queries Bing's public RSS search results for indexed `linkedin.com/posts` pages.

Important limitation: Bing can help discover public LinkedIn posts, but its RSS timestamp is not guaranteed to be the original LinkedIn publication time. LinkedIn results are therefore marked `timestampConfidence: "search-index-only"` and should not be treated as real-time monitoring.

## What the tool does

```text
Reddit RSS ───────┐
                  ├─ normalize ─ score ─ dedupe ─ print candidates
Bing → LinkedIn ──┘
```

The score currently favors:

- first-person problem language
- words indicating something is wrong or actively failing
- agent/LLM debugging terminology
- recent Reddit posts
- matching Traser-relevant failure terms

## Run locally

Requirements:

- Node.js 20+

Then:

```bash
git clone https://github.com/Maas-Dorian/signl.git
cd signl
npm install
npm run scan
```

Optional environment variables:

```bash
HOURS_BACK=72 MIN_SCORE=25 npm run scan
```

`HOURS_BACK` controls how old Reddit posts may be.

`MIN_SCORE` controls what gets printed to the terminal.

## Current project structure

```text
.
├── README.md
├── package.json
└── collectors/
    ├── config.js
    ├── index.js
    ├── linkedin.js
    ├── reddit.js
    └── utils.js
```

## Next steps

Once this basic collection path proves useful:

1. replace Reddit RSS with the approved Reddit Data API
2. add Hacker News and GitHub collectors
3. persist seen URLs so repeated scans do not alert twice
4. add notifications for high-scoring new signals
5. tune scoring based on which signals actually produce real Traser investigations
