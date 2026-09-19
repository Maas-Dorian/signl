# Traser Signal Radar

Traser Signal Radar is a small, local-first research tool for discovering recent public developer discussions about AI-agent and multi-step AI debugging problems.

The initial version is intended to run locally on macOS. It will collect a limited set of public posts and issue metadata from approved sources, normalize them into a common format, rank them by recency and technical relevance, and surface links for manual review.

## Intended sources

- Reddit, pending approved Data API access
- GitHub public issues and discussions
- Hacker News via the Algolia API

## Intended Reddit use

The Reddit collector is intended to read recent public posts from a small set of developer communities and identify discussions related to topics such as:

- agent debugging
- wrong or unexpected tool calls
- successful-but-wrong executions
- state and retry problems
- unexpected outputs
- trace investigation

The tool is not intended to automate posting, commenting, voting, messaging, or outreach. It will not attempt to identify anonymous users, create user profiles, resell Reddit data, or use Reddit content to train machine-learning models.

A human will review any surfaced result before deciding whether to visit or participate in the original discussion.

## Local development

This repository is an initial skeleton for the local prototype. Collector implementations will be added as API access is configured.

```bash
npm install
npm run start
```

## Project structure

```text
.
├── README.md
├── collectors/
└── package.json
```
