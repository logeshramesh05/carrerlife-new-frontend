import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  getDashboard,
  refreshDashboard,
  getCachedDashboard,
  getSuggestions,
  getBenchmark,
} from "../api/dashboard";
import { friendlyApiError } from "../api/client";
import { timed } from "../utils/timing";
import { useAuth } from "../context/AuthContext";
import ProgressBar from "../components/ProgressBar";

const EMPTY_DASHBOARD = {
  interview: {},
  resume: {},
  scoreTrend: [],
  domainBreakdown: [],
  topMissingSkills: [],
  topStrengths: [],
  lastActivityAt: null,
};

const num = (v, d = 0) =>
  typeof v === "number" && Number.isFinite(v) ? v : d;
const fmt = (v, digits = 1) =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : Number(v).toFixed(digits);
const clamp100 = (v) => Math.min(100, Math.max(0, num(v, 0)));

/* ---------- human-friendly labels (UX: no raw enums / timestamps) ---------- */

function formatStage(stage) {
  if (!stage) return null;
  return String(stage)
    .toLowerCase()
    .split(/[_-\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatLastActive(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today at ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/* ---------- small SVG visualizations (no deps) ---------- */

function Donut({ value, size = 76, stroke = 10, label, sub }) {
  const v = clamp100(value);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone = v >= 70 ? "var(--good)" : v >= 40 ? "var(--warn)" : "var(--danger)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e9eae5" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
          style={{ font: "800 18px Manrope", fill: "var(--ink)" }}>
          {value === null || value === undefined ? "—" : Math.round(v)}
        </text>
      </svg>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{label}</div>
        {sub && <div className="page-sub" style={{ marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function DomainPie({ items }) {
  const total = items.reduce((a, d) => a + num(d.sessionCount, 0), 0) || 1;
  const colors = ["#2f5d50", "#7ba695", "#c9a86a", "#a94848", "#6d7fa3", "#9a6a28"];
  const R = 42, C = 2 * Math.PI * R;
  let offset = 0;
  const segs = items.slice(0, 4).map((d, i) => {
    const frac = num(d.sessionCount, 0) / total;
    const seg = { ...d, frac, dash: frac * C, off: offset, color: colors[i % colors.length] };
    offset -= frac * C;
    return seg;
  });
  return (
    <div className="domain-wrap">
      <svg width="180" height="180" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#eee" strokeWidth="20" />
        {segs.map((s, i) => (
          <circle key={i} cx="70" cy="70" r={R} fill="none" stroke={s.color} strokeWidth="20"
            strokeDasharray={`${s.dash} ${C - s.dash}`} strokeDashoffset={-s.off}
            transform="rotate(-90 70 70)" />
        ))}
        <text x="70" y="70" textAnchor="middle" dominantBaseline="central"
          style={{ font: "800 24px Manrope", fill: "var(--ink)" }}>{total}</text>
      </svg>
      <div className="domain-legend">
        {segs.map((s, i) => (
          <div key={i} className="domain-row" title={`${s.domain} — ${s.sessionCount} sessions, avg ${fmt(s.averageScore)}`}>
            <span className="domain-dot" style={{ background: s.color }} />
            <strong className="domain-name">{s.domain}</strong>
            <span className="page-sub">{s.sessionCount} · {Math.round(s.frac * 100)}%</span>
          </div>
        ))}
        {items.length > segs.length && (
          <div className="page-sub">+{items.length - segs.length} more topic{items.length - segs.length === 1 ? "" : "s"}</div>
        )}
      </div>
    </div>
  );
}

function TrendChart({ points }) {
  const W = 560, H = 260, P = 30;
  const vals = points.map((p) => clamp100(p.score));
  const max = 100;
  const step = points.length > 1 ? (W - P * 2) / (points.length - 1) : 0;
  const midX = P + (W - P * 2) / 2;
  const coords = vals.map((v, i) => [
    points.length === 1 ? midX : P + i * step,
    H - P - (v / max) * (H - P * 2),
  ]);
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "300px", display: "block" }} preserveAspectRatio="none" role="img" aria-label="Score trend chart">
      {[0, 50, 100].map((g) => {
        const y = H - P - (g / 100) * (H - P * 2);
        return (
          <g key={g}>
            <line x1={P} x2={W - 8} y1={y} y2={y} stroke="#e6e7e1" strokeWidth="1" />
            <text x={2} y={y + 4} style={{ fontSize: 10, fill: "var(--faint)" }}>{g}</text>
          </g>
        );
      })}
      {coords.length > 1 && <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
      {coords.map((c, i) => (
        <g key={i}>
          <circle cx={c[0]} cy={c[1]} r="5" fill="var(--accent)" stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {vals.length <= 12 && (
            <text x={c[0]} y={c[1] - 10} textAnchor="middle" style={{ fontSize: 10, fontWeight: 700, fill: "var(--ink)" }}>
              {Math.round(vals[i])}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function SkillRankList({ items, emptyText, tone }) {
  const [expanded, setExpanded] = useState(null);
  if (!items.length) return <p className="page-sub">{emptyText}</p>;
  return (
    <ol className={`skill-rank ${tone === "good" ? "is-good" : "is-focus"}`}>
      {items.map((s, i) => {
        const open = expanded === `${tone}-${i}`;
        return (
          <li
            key={s.skill}
            className={`skill-rank-row${open ? " is-expanded" : ""}`}
            title={open ? "Click to collapse" : `${s.skill} — click to expand`}
            onClick={() => setExpanded(open ? null : `${tone}-${i}`)}
            style={{ cursor: "pointer" }}
          >
            <span className="skill-rank-num" aria-hidden="true">{i + 1}</span>
            <span className="skill-rank-name">{s.skill}</span>
            <span className="skill-count" title={`Seen in ${s.occurrences ?? 0} sessions`}>
              {s.occurrences ?? 0}×
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- page ---------- */

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(() => getCachedDashboard());
  const [suggestions, setSuggestions] = useState(null);
  const [benchmark, setBenchmark] = useState(null);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(true);
  const abortRef = useRef(null);

  const load = (force = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError("");
    setUpdating(true);
    const hasCache = Boolean(getCachedDashboard());
    const main = hasCache && !force
      ? timed("dashboard-revalidate", refreshDashboard(undefined, { signal: controller.signal }))
      : timed("dashboard", getDashboard(undefined, { signal: controller.signal }));
    main.then((d) => { if (!controller.signal.aborted) setData(d); })
      .catch((err) => {
        if (err?.code === "ERR_CANCELED" || controller.signal.aborted) return;
        if (!getCachedDashboard() && !data) setError(friendlyApiError(err, "Failed to load dashboard"));
      });
    timed("dash-extra", Promise.allSettled([getSuggestions(), getBenchmark()]))
      .then(([s, b]) => {
        if (controller.signal.aborted) return;
        if (s.status === "fulfilled") setSuggestions(s.value);
        if (b.status === "fulfilled") setBenchmark(b.value);
      })
      .finally(() => { if (!controller.signal.aborted) setUpdating(false); });
  };

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const view = data ?? EMPTY_DASHBOARD;
  if (error && !data) {
    return (
      <div className="page">
        <p className="error">{error}</p>
        <button type="button" className="secondary" onClick={() => load(true)} style={{ marginTop: 12 }}>Retry</button>
      </div>
    );
  }

  const interview = view.interview ?? {};
  const resume = view.resume ?? {};
  const scoreTrend = Array.isArray(view.scoreTrend) ? view.scoreTrend : [];
  const domainBreakdown = Array.isArray(view.domainBreakdown) ? view.domainBreakdown : [];
  const topMissingSkills = Array.isArray(view.topMissingSkills) ? view.topMissingSkills : [];
  const topStrengths = Array.isArray(view.topStrengths) ? view.topStrengths : [];

  const totalSessions = num(interview.totalSessions);
  const completedSessions = num(interview.completedSessions);
  const completionRate = totalSessions ? Math.round((completedSessions / totalSessions) * 100) : 0;

  const firstName = user?.name?.split(" ")?.[0] || "";
  const friendlyStage = formatStage(suggestions?.careerStage);
  const lastActive = formatLastActive(view.lastActivityAt);
  const hasProgress = totalSessions > 0 || num(resume.resumesUploaded) > 0;

  return (
    <div className="page dash-page">
      <div className="page-header dash-hero">
        <div>
          <h2>{firstName ? `Welcome back, ${firstName}` : "Overview"}</h2>
          <div className="dash-meta">
            {lastActive ? (
              <span className="dash-pill">Last active · {lastActive}</span>
            ) : (
              <span className="dash-pill">New here — start your first practice</span>
            )}
            {friendlyStage && <span className="dash-pill dash-pill-stage">{friendlyStage}</span>}
            {updating && <span className="dash-pill dash-pill-muted">Updating…</span>}
          </div>
        </div>
        <div className="dash-actions">
          <Link className="button button-primary" to="/interview">
            {hasProgress ? "Continue practicing" : "Start practicing"}
            <span aria-hidden="true">→</span>
          </Link>
          <button type="button" className="secondary" onClick={() => load(true)} disabled={updating}>
            {updating ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>
      {error && <p className="error" style={{ marginBottom: 12 }}>{error}</p>}

      {/* KPI ROW — compact, one line */}
      <div className="dash-kpis">
        <div className={`stat-card dash-tile${updating ? " is-loading" : ""}`}>
          <h3>Interviews</h3>
          <div className="stat-big">{totalSessions}<span> sessions</span></div>
          <div className="stat-card-row"><span>Completed</span><b>{completedSessions}</b></div>
          <div className="stat-card-row"><span>Questions answered</span><b>{num(interview.totalQuestionsAnswered)}</b></div>
          <ProgressBar label="Finished" value={completionRate} max={100} suffix="%" />
        </div>
        <div className={`stat-card dash-tile${updating ? " is-loading" : ""}`}>
          <h3>Interview scores</h3>
          <Donut value={interview.averageScore} label={`Average ${fmt(interview.averageScore)}`} sub={`Best ${fmt(interview.bestScore)}`} />
          <div className="dash-tight">
            <ProgressBar label="Average score" value={num(interview.averageScore)} max={100} />
            <ProgressBar label="Best score" value={num(interview.bestScore)} max={100} />
          </div>
        </div>
        <div className={`stat-card dash-tile${updating ? " is-loading" : ""}`}>
          <h3>Resume</h3>
          <div className="stat-big">{num(resume.resumesUploaded)}<span> uploaded</span></div>
          <div className="stat-card-row"><span>Analyses run</span><b>{num(resume.analysesRun)}</b></div>
          <ProgressBar label="Job match" value={num(resume.averageMatchScore)} max={100} suffix="%" />
          <ProgressBar label="Resume quality (ATS)" value={num(resume.averageAtsScore)} max={100} suffix="%" />
        </div>
        <div className={`stat-card dash-tile${updating ? " is-loading" : ""}`}>
          <h3>How you compare</h3>
          {benchmark ? (
            <>
              <ProgressBar label="Your interviews" value={num(benchmark.yourAverageScore)} max={100} />
              <ProgressBar label="Others on average" value={num(benchmark.typicalAverageScore)} max={100} />
              <ProgressBar label="Your resume (ATS)" value={num(benchmark.yourAverageAtsScore)} max={100} suffix="%" />
              <ProgressBar label="Others' resumes (ATS)" value={num(benchmark.typicalAverageAtsScore)} max={100} suffix="%" />
            </>
          ) : (
            <p className="page-sub">Do one interview and one resume check to see how you compare. No pressure. Start when ready.</p>
          )}
        </div>
      </div>

      {/* PERFORMANCE GRID — trend, topics, skills */}
      <div className="dash-main">
        <div className="stat-card dash-tile dash-trend">
          <h3>How you're improving <span className="dash-hint">Last 5 sessions</span></h3>
          <p className="page-sub dash-desc">Your latest scores, oldest to newest. Every small step counts.</p>
          {scoreTrend.length === 0 ? (
            <div className="empty-state">
              <div className="empty-title">No sessions yet</div>
              <div>When you are ready, start with one short practice. There is no perfect first score.</div>
            </div>
          ) : (
            <div className="trend-chart-wrap trend-chart-tall">
              <TrendChart points={scoreTrend.slice(-5)} />
            </div>
          )}
          <div className="page-sub dash-foot">
            Higher is better. Progress is rarely a straight line — keep going.
          </div>
        </div>
        <div className="stat-card dash-tile dash-topics">
          <h3>What you've practiced</h3>
          <p className="page-sub dash-desc">The topics you've explored so far. The number in the middle is your total sessions.</p>
          {domainBreakdown.length === 0 ? (
            <div className="empty-state">
              <div className="empty-title">No topic data</div>
              <div>Your topics will appear here after a few sessions.</div>
            </div>
          ) : <DomainPie items={domainBreakdown} />}
          <div className="page-sub dash-foot">Trying different topics helps you grow faster.</div>
        </div>
        <div className="stat-card dash-tile dash-skills">
          <h3>Your skills snapshot</h3>
          <p className="page-sub dash-desc">What came up most in your sessions. Counts show how often, not grades.</p>
          <div className="skills-cols">
            <div>
              <h4 className="skills-sub">Let's grow these</h4>
              <p className="page-sub skills-note">Gentle nudges. One at a time is plenty.</p>
              <SkillRankList items={topMissingSkills.slice(0, 5)} emptyText="Nothing flagged yet. That is a good sign." tone="focus" />
            </div>
            <div>
              <h4 className="skills-sub">You're doing great</h4>
              <p className="page-sub skills-note">Keep shining with these strengths.</p>
              <SkillRankList items={topStrengths.slice(0, 5)} emptyText="Your strengths will show up here as you practice." tone="good" />
            </div>
          </div>
          <div className="page-sub dash-foot">Everyone has both lists. That is how learning works.</div>
        </div>
      </div>
    </div>
  );
}
