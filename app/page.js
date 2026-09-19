"use client";

import { useEffect, useMemo, useState } from "react";

const OUTCOMES = [
  "Relevant",
  "Responded",
  "Trace requested",
  "Trace received",
  "Used Traser",
  "Ignore",
];

const STORAGE_KEY = "traser-signal-radar-outcomes-v1";

function ageLabel(value) {
  if (!value) return "time unverified";
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms)) return "time unknown";
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function signalKey(item) {
  return item.sourceId || item.url;
}

function scoreClass(value) {
  if (value >= 75) return "hot";
  if (value >= 50) return "warm";
  return "cool";
}

function sourceLabel(source) {
  if (source === "hackernews") return "Hacker News";
  if (source === "github") return "GitHub";
  if (source === "linkedin") return "LinkedIn";
  if (source === "reddit") return "Reddit";
  return source;
}

export default function Home() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [outcomes, setOutcomes] = useState({});
  const [source, setSource] = useState("all");
  const [ownership, setOwnership] = useState("all");
  const [kind, setKind] = useState("all");
  const [minScore, setMinScore] = useState(35);
  const [showIgnored, setShowIgnored] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      setOutcomes(saved);
    } catch {}
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/signals", { cache: "no-store" });
      if (!response.ok) throw new Error(`Scan failed with ${response.status}`);
      setData(await response.json());
    } catch (err) {
      setError(err.message || "Scan failed");
    } finally {
      setLoading(false);
    }
  }

  function setOutcome(item, value) {
    const key = signalKey(item);
    const next = {
      ...outcomes,
      [key]: value,
    };
    setOutcomes(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  const signals = useMemo(() => {
    const raw = data?.signals || [];
    return raw.filter((item) => {
      const outcome = outcomes[signalKey(item)];
      if (!showIgnored && outcome === "Ignore") return false;
      if (source !== "all" && item.source !== source) return false;
      if (ownership !== "all" && item.ownership !== ownership) return false;
      if (kind !== "all" && (item.kind || "result") !== kind) return false;
      if (item.score < minScore) return false;
      return true;
    });
  }, [data, outcomes, source, ownership, kind, minScore, showIgnored]);

  const stats = data?.counts || {};

  return (
    <main>
      <header className="topbar">
        <div>
          <p className="eyebrow">TRASER</p>
          <h1>Signal Radar</h1>
          <p className="subhead">
            Find people who appear to be actively experiencing the debugging problem Traser is built for.
          </p>
        </div>
        <button className="refresh" onClick={refresh} disabled={loading}>
          {loading ? "Scanning..." : "Refresh signals"}
        </button>
      </header>

      <section className="stats">
        <div className="stat"><span>Total found</span><strong>{stats.total ?? "—"}</strong></div>
        <div className="stat"><span>Reddit</span><strong>{stats.reddit ?? "—"}</strong></div>
        <div className="stat"><span>GitHub</span><strong>{stats.github ?? "—"}</strong></div>
        <div className="stat"><span>Hacker News</span><strong>{stats.hackernews ?? "—"}</strong></div>
        <div className="stat"><span>LinkedIn</span><strong>{stats.linkedin ?? "—"}</strong></div>
        <div className="stat"><span>Firsthand</span><strong>{stats.firsthand ?? "—"}</strong></div>
        <div className="stat"><span>High artifact chance</span><strong>{stats.highArtifact ?? "—"}</strong></div>
      </section>

      <section className="controls">
        <label>
          Source
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">All</option>
            <option value="reddit">Reddit</option>
            <option value="github">GitHub</option>
            <option value="hackernews">Hacker News</option>
            <option value="linkedin">LinkedIn</option>
          </select>
        </label>

        <label>
          Ownership
          <select value={ownership} onChange={(e) => setOwnership(e.target.value)}>
            <option value="all">All</option>
            <option value="firsthand">Firsthand</option>
            <option value="secondhand">Secondhand</option>
            <option value="general">General</option>
          </select>
        </label>

        <label>
          Type
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="all">All</option>
            <option value="post">Reddit post</option>
            <option value="comment">Comment</option>
            <option value="issue">GitHub issue</option>
            <option value="story">HN story</option>
            <option value="result">Indexed result</option>
          </select>
        </label>

        <label className="score-control">
          Minimum score
          <div className="range-row">
            <input
              type="range"
              min="0"
              max="100"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
            />
            <span>{minScore}</span>
          </div>
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={showIgnored}
            onChange={(e) => setShowIgnored(e.target.checked)}
          />
          Show ignored
        </label>
      </section>

      {error && <div className="notice error">{error}</div>}
      {data?.errors?.length > 0 && (
        <div className="notice">
          Some sources had errors: {data.errors.map((item) => item.source).join(", ")}.
        </div>
      )}

      <section className="list-header">
        <div>
          <h2>{signals.length} visible signals</h2>
          <p>
            {data?.scannedAt ? `Last scan ${new Date(data.scannedAt).toLocaleTimeString()}` : "Waiting for first scan"}
          </p>
        </div>
      </section>

      <section className="signals">
        {loading && !data && <div className="empty">Scanning sources...</div>}

        {!loading && signals.length === 0 && (
          <div className="empty">
            Nothing matches these filters yet. Lower the minimum score or refresh later.
          </div>
        )}

        {signals.map((item) => {
          const key = signalKey(item);
          const outcome = outcomes[key];
          return (
            <article className="signal" key={key}>
              <div className="signal-top">
                <div className="source-line">
                  <span className={`source ${item.source}`}>{sourceLabel(item.source)}</span>
                  <span>{item.community}</span>
                  <span>{item.kind || "indexed result"}</span>
                  <span>{ageLabel(item.createdAt)}</span>
                </div>
                {outcome && <span className="outcome-pill">{outcome}</span>}
              </div>

              <h3>
                <a className="signal-title-link" href={item.url} target="_blank" rel="noreferrer">
                  {item.title || "Untitled signal"}
                </a>
              </h3>
              {item.text && <p className="snippet">{item.text.slice(0, 620)}</p>}

              <div className="score-grid">
                <div>
                  <span>Overall</span>
                  <strong className={scoreClass(item.score)}>{item.score}</strong>
                </div>
                <div>
                  <span>Relevance</span>
                  <strong className={scoreClass(item.relevanceScore)}>{item.relevanceScore}</strong>
                </div>
                <div>
                  <span>Urgency</span>
                  <strong className={scoreClass(item.urgencyScore)}>{item.urgencyScore}</strong>
                </div>
                <div>
                  <span>Ownership</span>
                  <strong>{item.ownership}</strong>
                </div>
                <div>
                  <span>Artifact chance</span>
                  <strong>{item.artifactLikelihood}</strong>
                </div>
              </div>

              <div className="chips">
                {item.matchedTerms?.slice(0, 8).map((term) => (
                  <span key={term}>{term}</span>
                ))}
                {item.artifactMatches?.slice(0, 5).map((term) => (
                  <span className="artifact" key={`artifact-${term}`}>artifact: {term}</span>
                ))}
              </div>

              {item.source === "linkedin" && (
                <p className="timestamp-note">
                  LinkedIn timing is search-index timing only, not a verified original-post timestamp.
                </p>
              )}

              <div className="actions">
                <a href={item.url} target="_blank" rel="noreferrer">Open source</a>
                <div className="outcomes">
                  {OUTCOMES.map((value) => (
                    <button
                      key={value}
                      className={outcome === value ? "active" : ""}
                      onClick={() => setOutcome(item, value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
