"use client";

import { useEffect, useMemo, useState } from "react";

const OUTCOMES = [
  "Relevant",
  "Engaged",
  "Concrete incident",
  "Artifact available",
  "Asked to try",
  "Started Traser",
  "Blocked",
  "Completed investigation",
  "Useful",
  "Not useful",
  "Repeat use",
  "Ignore",
];

const BLOCKERS = [
  "",
  "Could not export trace",
  "Unsupported format",
  "No trace available",
  "Privacy/company restriction",
  "Did not have time",
  "Problem already solved",
  "Not painful enough",
  "Traser import failed",
  "Traser result not useful",
  "Other",
];

const STORAGE_KEY = "traser-signal-radar-outcomes-v2";
const BLOCKER_KEY = "traser-signal-radar-blockers-v1";
const LEGACY_STORAGE_KEY = "traser-signal-radar-outcomes-v1";

const STAGE_RANK = {
  Relevant: 1,
  Engaged: 2,
  "Concrete incident": 3,
  "Artifact available": 4,
  "Asked to try": 5,
  "Started Traser": 6,
  Blocked: 6,
  "Completed investigation": 7,
  Useful: 8,
  "Not useful": 8,
  "Repeat use": 9,
  Ignore: 0,
};

function migrateLegacy(value) {
  if (value === "Responded") return "Engaged";
  if (value === "Trace requested") return "Asked to try";
  if (value === "Trace received") return "Artifact available";
  if (value === "Used Traser") return "Started Traser";
  return value;
}

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

function personKey(item) {
  const author = String(item.author || "").trim().toLowerCase();
  return author ? `${item.source}:${author}` : "";
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

function sourceActionLabel(item) {
  if (item.source === "reddit") {
    return item.kind === "comment" ? "Open Reddit comment ↗" : "Open Reddit post ↗";
  }
  if (item.source === "github") return "Open GitHub issue ↗";
  if (item.source === "hackernews") {
    return item.kind === "comment" ? "Open HN comment ↗" : "Open HN story ↗";
  }
  if (item.source === "linkedin") return "Open LinkedIn post ↗";
  return "Open source ↗";
}

function compatibilityLabel(value) {
  if (value === "high") return "LangSmith-ready";
  if (value === "partial") return "light transform";
  if (value === "adapter-needed") return "adapter needed";
  return "unknown compatibility";
}

function isAtLeast(outcome, stage) {
  return (STAGE_RANK[outcome] || 0) >= STAGE_RANK[stage];
}

export default function Home() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [outcomes, setOutcomes] = useState({});
  const [blockers, setBlockers] = useState({});
  const [source, setSource] = useState("all");
  const [ownership, setOwnership] = useState("all");
  const [kind, setKind] = useState("all");
  const [community, setCommunity] = useState("all");
  const [minActivation, setMinActivation] = useState(35);
  const [showIgnored, setShowIgnored] = useState(false);
  const [companyPriority, setCompanyPriority] = useState("all");
  const [companyCategory, setCompanyCategory] = useState("all");
  const [showAllCompanies, setShowAllCompanies] = useState(false);

  useEffect(() => {
    try {
      const savedV2 = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "{}");
      const migrated = Object.fromEntries(
        Object.entries(legacy).map(([key, value]) => [key, migrateLegacy(value)])
      );
      setOutcomes({ ...migrated, ...savedV2 });
      setBlockers(JSON.parse(localStorage.getItem(BLOCKER_KEY) || "{}"));
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
    const next = { ...outcomes, [key]: value };
    setOutcomes(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function setBlocker(item, value) {
    const key = signalKey(item);
    const next = { ...blockers, [key]: value };
    setBlockers(next);
    localStorage.setItem(BLOCKER_KEY, JSON.stringify(next));
  }

  const rawSignals = data?.signals || [];

  const people = useMemo(() => {
    const map = new Map();
    for (const item of rawSignals) {
      const key = personKey(item);
      if (!key) continue;
      const current = map.get(key) || { count: 0, highestStage: "", author: item.author, source: item.source };
      current.count += 1;
      const outcome = outcomes[signalKey(item)];
      if ((STAGE_RANK[outcome] || 0) > (STAGE_RANK[current.highestStage] || 0)) {
        current.highestStage = outcome;
      }
      map.set(key, current);
    }
    return map;
  }, [rawSignals, outcomes]);

  const signals = useMemo(() => {
    return rawSignals.filter((item) => {
      const outcome = outcomes[signalKey(item)];
      if (!showIgnored && outcome === "Ignore") return false;
      if (source !== "all" && item.source !== source) return false;
      if (ownership !== "all" && item.ownership !== ownership) return false;
      if (kind !== "all" && (item.kind || "result") !== kind) return false;
      if (community !== "all" && item.community !== community) return false;
      if ((item.activationReadiness || 0) < minActivation) return false;
      return true;
    });
  }, [rawSignals, outcomes, source, ownership, kind, community, minActivation, showIgnored]);

  const conversionRows = useMemo(() => {
    const groups = new Map();
    for (const item of rawSignals) {
      const label = item.discoveryQuery || sourceLabel(item.source);
      const current = groups.get(label) || { label, found: 0, engaged: 0, started: 0, completed: 0, useful: 0 };
      current.found += 1;
      const outcome = outcomes[signalKey(item)];
      if (isAtLeast(outcome, "Engaged")) current.engaged += 1;
      if (isAtLeast(outcome, "Started Traser")) current.started += 1;
      if (isAtLeast(outcome, "Completed investigation")) current.completed += 1;
      if (outcome === "Useful" || outcome === "Repeat use") current.useful += 1;
      groups.set(label, current);
    }

    return [...groups.values()]
      .sort((a, b) =>
        b.completed - a.completed ||
        b.started - a.started ||
        b.engaged - a.engaged ||
        b.found - a.found
      )
      .slice(0, 10);
  }, [rawSignals, outcomes]);

  const stats = data?.counts || {};
  const companyAccounts = data?.companies?.accounts || [];
  const companyCoverage = data?.companies?.coverage;
  const companyCategories = [...new Set(companyAccounts.map((company) => company.category).filter(Boolean))].sort();
  const filteredCompanies = companyAccounts.filter((company) => {
    if (companyPriority !== "all" && company.priority !== companyPriority) return false;
    if (companyCategory !== "all" && company.category !== companyCategory) return false;
    return true;
  });
  const visibleCompanies = showAllCompanies ? filteredCompanies : filteredCompanies.slice(0, 12);
  const redditCoverage = data?.reddit?.coverage || [];
  const redditCommunities = redditCoverage.map((entry) => entry.community);
  const blockedCount = Object.values(outcomes).filter((value) => value === "Blocked").length;
  const completedCount = Object.values(outcomes).filter((value) => isAtLeast(value, "Completed investigation")).length;

  return (
    <main>
      <header className="topbar">
        <div>
          <p className="eyebrow">TRASER</p>
          <h1>Signal Radar</h1>
          <p className="subhead">
            Find the people most likely to have a Traser-shaped incident, usable evidence, and a reason to try the product now.
          </p>
        </div>
        <button className="refresh" onClick={refresh} disabled={loading}>
          {loading ? "Scanning..." : "Refresh signals"}
        </button>
      </header>

      <section className="stats">
        <div className="stat"><span>Total found</span><strong>{stats.total ?? "—"}</strong></div>
        <div className="stat"><span>Activation-ready</span><strong>{stats.activationReady ?? "—"}</strong></div>
        <div className="stat"><span>Concrete incidents</span><strong>{stats.concreteIncident ?? "—"}</strong></div>
        <div className="stat"><span>High artifact chance</span><strong>{stats.highArtifact ?? "—"}</strong></div>
        <div className="stat"><span>Firsthand</span><strong>{stats.firsthand ?? "—"}</strong></div>
        <div className="stat"><span>Completed</span><strong>{completedCount}</strong></div>
        <div className="stat"><span>Blocked</span><strong>{blockedCount}</strong></div>
        <div className="stat"><span>Non-fit flags</span><strong>{stats.nonFit ?? "—"}</strong></div>
        <div className="stat"><span>Target companies</span><strong>{stats.targetCompanies ?? "—"}</strong></div>
        <div className="stat"><span>Companies w/ evidence</span><strong>{stats.companiesWithEvidence ?? "—"}</strong></div>
        <div className="stat"><span>High-fit complaints</span><strong>{stats.companyHighFitSignals ?? "—"}</strong></div>
      </section>

      <section className="company-radar">
        <div className="company-radar-head">
          <div className="section-title">
            <h2>Company pain radar</h2>
            <p>
              50 small agent-native companies. Public customer complaints are discovery evidence only, not proof of the internal root cause.
              {companyCoverage ? ` ${companyCoverage.companiesWithEvidence} companies have matching public evidence this scan.` : ""}
            </p>
          </div>

          <div className="company-filters">
            <label>
              Priority
              <select value={companyPriority} onChange={(event) => setCompanyPriority(event.target.value)}>
                <option value="all">All</option>
                <option value="A">A</option>
                <option value="B">B</option>
              </select>
            </label>
            <label>
              Category
              <select value={companyCategory} onChange={(event) => setCompanyCategory(event.target.value)}>
                <option value="all">All categories</option>
                {companyCategories.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {companyCoverage?.errors?.length > 0 && (
          <div className="notice">
            Company review search had {companyCoverage.errors.length} failed batch{companyCoverage.errors.length === 1 ? "" : "es"}. The 50-company watchlist is still shown.
          </div>
        )}

        <div className="company-grid">
          {visibleCompanies.map((company) => (
            <article className="company-card" key={company.id}>
              <div className="company-card-head">
                <div>
                  <div className="company-meta">
                    <span className={`priority priority-${company.priority.toLowerCase()}`}>Priority {company.priority}</span>
                    <span>{company.category}</span>
                    {company.teamSize ? <span>{company.teamSize} people</span> : null}
                  </div>
                  <h3>{company.name}</h3>
                </div>
                <div className="company-score">
                  <strong className={scoreClass(company.accountScore)}>{company.accountScore}</strong>
                  <span>account score</span>
                </div>
              </div>

              <p className="company-shape">{company.productShape}</p>

              <div className="company-counts">
                <span><strong>{company.evidenceCount}</strong> public matches</span>
                <span><strong>{company.highFitCount}</strong> high-fit</span>
              </div>

              <div className="chips company-chips">
                {(company.shapes?.length ? company.shapes : company.watchFor || []).slice(0, 5).map((value) => (
                  <span className={company.shapes?.includes(value) ? "positive" : ""} key={value}>
                    {company.shapes?.includes(value) ? `observed: ${value}` : `watch: ${value}`}
                  </span>
                ))}
              </div>

              {company.evidence?.length > 0 ? (
                <div className="company-evidence">
                  {company.evidence.slice(0, 3).map((evidence) => (
                    <a href={evidence.url} target="_blank" rel="noreferrer" key={evidence.sourceId || evidence.url}>
                      <div>
                        <span>{evidence.sourceSurface}</span>
                        <strong>{evidence.title || "Public complaint"}</strong>
                        {evidence.text && <small>{evidence.text.slice(0, 180)}</small>}
                      </div>
                      <b className={scoreClass(evidence.fitScore)}>{evidence.fitScore}</b>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="company-empty">No matching public complaint surfaced in this scan. Keep it on the watchlist; do not manufacture a Traser angle.</p>
              )}

              <div className="company-next">
                <span>Next action</span>
                <p>{company.nextAction}</p>
              </div>

              <a className="company-source-link" href={company.sourceUrl} target="_blank" rel="noreferrer">
                Open seed source ↗
              </a>
            </article>
          ))}
        </div>

        {filteredCompanies.length > 12 && (
          <button className="show-more-companies" type="button" onClick={() => setShowAllCompanies((value) => !value)}>
            {showAllCompanies ? "Show top 12" : `Show all ${filteredCompanies.length} companies`}
          </button>
        )}
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

        <label>
          Reddit community
          <select value={community} onChange={(e) => setCommunity(e.target.value)}>
            <option value="all">All communities</option>
            {redditCommunities.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>

        <label className="score-control">
          Minimum activation
          <div className="range-row">
            <input
              type="range"
              min="0"
              max="100"
              value={minActivation}
              onChange={(e) => setMinActivation(Number(e.target.value))}
            />
            <span>{minActivation}</span>
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

      {redditCoverage.length > 0 && (
        <section className="reddit-coverage">
          <div className="section-title">
            <h2>Reddit coverage</h2>
            <p>
              Scanning {data?.reddit?.communitiesTotal ?? redditCoverage.length} communities,
              {" "}{data?.reddit?.communitiesHealthy ?? 0} healthy feeds,
              {" "}{data?.reddit?.communitiesWithMatches ?? 0} with Traser-relevant matches this scan.
            </p>
          </div>
          <div className="coverage-grid">
            {redditCoverage.map((entry) => (
              <button
                key={entry.community}
                className={`coverage-card ${community === entry.community ? "active" : ""}`}
                onClick={() => setCommunity(community === entry.community ? "all" : entry.community)}
                type="button"
              >
                <span>{entry.community}</span>
                <strong>{entry.matchedCount}</strong>
                <small>{entry.status} · {entry.recentCount} recent scanned</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {error && <div className="notice error">{error}</div>}
      {data?.errors?.length > 0 && (
        <div className="notice">
          Some sources had errors: {data.errors.map((item) => item.source).join(", ")}.
        </div>
      )}

      {conversionRows.length > 0 && (
        <section className="conversion-panel">
          <div className="section-title">
            <h2>Which searches turn into usage?</h2>
            <p>Local outcomes only. This gets more useful as you mark real conversations and investigations.</p>
          </div>
          <div className="conversion-table">
            <div className="conversion-row conversion-head">
              <span>Source / query</span><span>Found</span><span>Engaged</span><span>Started</span><span>Completed</span><span>Useful</span>
            </div>
            {conversionRows.map((row) => (
              <div className="conversion-row" key={row.label}>
                <span title={row.label}>{row.label}</span>
                <span>{row.found}</span>
                <span>{row.engaged}</span>
                <span>{row.started}</span>
                <span>{row.completed}</span>
                <span>{row.useful}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="list-header">
        <div>
          <h2>{signals.length} activation candidates</h2>
          <p>
            {data?.scannedAt ? `Last scan ${new Date(data.scannedAt).toLocaleTimeString()}` : "Waiting for first scan"}
          </p>
        </div>
      </section>

      <section className="signals">
        {loading && !data && <div className="empty">Scanning sources...</div>}

        {!loading && signals.length === 0 && (
          <div className="empty">
            Nothing matches these filters yet. Lower the minimum activation score or refresh later.
          </div>
        )}

        {signals.map((item) => {
          const key = signalKey(item);
          const outcome = outcomes[key];
          const person = people.get(personKey(item));
          const blocker = blockers[key] || "";

          return (
            <article className="signal" key={key}>
              <div className="signal-top">
                <div className="source-line">
                  <span className={`source ${item.source}`}>{sourceLabel(item.source)}</span>
                  <span>{item.community}</span>
                  <span>{item.kind || "indexed result"}</span>
                  <span>{ageLabel(item.createdAt)}</span>
                  {item.author && <span>@{item.author}</span>}
                  {person?.count > 1 && <span className="relationship-pill">seen in {person.count} signals</span>}
                </div>
                {outcome && <span className="outcome-pill">{outcome}</span>}
              </div>

              <h3>
                <a className="signal-title-link" href={item.url} target="_blank" rel="noreferrer">
                  {item.title || "Untitled signal"}
                </a>
              </h3>
              {item.text && <p className="snippet">{item.text.slice(0, 620)}</p>}

              <div className="source-link-row">
                <a className="source-link-button" href={item.url} target="_blank" rel="noreferrer">
                  {sourceActionLabel(item)}
                </a>
                <span className="source-url" title={item.url}>{item.url}</span>
              </div>

              <div className="score-grid">
                <div>
                  <span>Activation</span>
                  <strong className={scoreClass(item.activationReadiness)}>{item.activationReadiness}</strong>
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
                  <span>Artifact</span>
                  <strong>{item.artifactLikelihood}</strong>
                </div>
                <div>
                  <span>Compatibility</span>
                  <strong>{compatibilityLabel(item.artifactCompatibility)}</strong>
                </div>
              </div>

              <div className="chips">
                {item.concreteIncident && <span className="positive">concrete incident</span>}
                {item.multistep && <span className="positive">multi-step</span>}
                {item.artifactPlatforms?.slice(0, 3).map((platform) => (
                  <span className="artifact" key={`${platform.name}-${platform.compatibility}`}>
                    {platform.name}: {platform.compatibility}
                  </span>
                ))}
                {item.nonFitReasons?.map((reason) => (
                  <span className="nonfit" key={reason}>non-fit: {reason}</span>
                ))}
                {item.matchedTerms?.slice(0, 6).map((term) => (
                  <span key={term}>{term}</span>
                ))}
              </div>

              {item.source === "linkedin" && (
                <p className="timestamp-note">
                  LinkedIn timing is search-index timing only, not a verified original-post timestamp.
                </p>
              )}

              <div className="actions">
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

                {(outcome === "Blocked" || blocker) && (
                  <label className="blocker-control">
                    Blocker
                    <select value={blocker} onChange={(e) => setBlocker(item, e.target.value)}>
                      {BLOCKERS.map((value) => (
                        <option key={value || "none"} value={value}>{value || "Choose blocker"}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
