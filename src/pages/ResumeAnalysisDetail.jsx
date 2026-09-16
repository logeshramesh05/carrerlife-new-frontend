import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getAnalysis } from "../api/resume";
import { SkeletonPage } from "../components/Loader";
import ProgressBar from "../components/ProgressBar";

function ScoreCard({ label, value, hintLow, hintMid, hintHigh }) {
  const v = Number(value) || 0;
  const tone = v >= 70 ? "good" : v >= 45 ? "warn" : "bad";
  const hint = v >= 70 ? hintHigh : v >= 45 ? hintMid : hintLow;
  return (
    <div className="stat-card analysis-score">
      <h3>{label}</h3>
      <div className="score-big">
        <span className={`score-pill s-${v >= 70 ? "high" : v >= 45 ? "mid" : "low"}`}>{v}%</span>
        <span className="page-sub" style={{ marginLeft: 8 }}>{hint}</span>
      </div>
      <ProgressBar label="" value={v} max={100} />
      <p className="page-sub" style={{ marginTop: 8 }}>{tone === "good" ? "Strong — keep this bar." : tone === "warn" ? "Getting there — one or two fixes lift it." : "Needs attention — see checklist below."}</p>
    </div>
  );
}

function SkillTags({ title, items, variant, emptyHint }) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  return (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ margin: "0 0 8px", fontSize: 13, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--muted)" }}>{title} · {list.length}</h4>
      {list.length === 0 ? <p className="page-sub">{emptyHint}</p> : (
        <div className="tag-list">
          {list.map((s) => <span key={typeof s === "string" ? s : JSON.stringify(s)} className={`tag ${variant}`}>{typeof s === "string" ? s : JSON.stringify(s)}</span>)}
        </div>
      )}
    </div>
  );
}

function InsightList({ title, items }) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ margin: "0 0 8px", fontSize: 13, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--muted)" }}>{title}</h4>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {list.map((s, i) => <li key={i} style={{ margin: "6px 0", fontSize: 13, color: "var(--ink)", lineHeight: 1.55 }}>{typeof s === "string" ? s : JSON.stringify(s)}</li>)}
      </ul>
    </div>
  );
}

export default function ResumeAnalysisDetail() {
  const { resumeId, analysisId } = useParams();
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!resumeId || !analysisId) { setError("Missing resume or analysis id"); return; }
    getAnalysis(resumeId, analysisId).then(setAnalysis).catch((err) => setError(err.response?.data?.message || "Failed to load analysis"));
  }, [resumeId, analysisId]);

  if (error) return <div className="page"><p className="error">{error}</p><button type="button" className="secondary" onClick={() => window.location.reload()} style={{ marginTop: 12 }}>Retry</button></div>;
  if (!analysis) return <SkeletonPage />;

  const hasKeywords = Array.isArray(analysis.keywordGaps) && analysis.keywordGaps.length > 0;
  const topGaps = (analysis.missingSkills || []).slice(0, 5);
  const isAtsOnly = !analysis.jobDescription || analysis.jobDescription.trim() === "";

  return (
    <div className="page analysis-page">
      <div className="page-header">
        <div>
          <p className="eyebrow"><span className="eyebrow-mark" />CAREERLIFE / RESUME / ANALYSIS</p>
          <h2>Analysis — best-practice review</h2>
          <p className="page-sub">ATS = parse & format health · Match = keyword fit to the job description. Both 0–100.</p>
        </div>
        <div className="dash-actions">
          <Link className="button button-primary" to="/resume-builder">Use in builder<span aria-hidden="true">→</span></Link>
          <Link className="secondary" to={`/resumes/${resumeId}/analyses`} style={{ padding: "10px 14px", borderRadius: 6, border: "1px solid var(--line-dark)", background: "#fff", fontWeight: 700, fontSize: 13 }}>All analyses</Link>
        </div>
      </div>

      {isAtsOnly && <div className="stat-card" style={{ marginBottom: 12, background:"#edf5f0", borderColor:"#cfe0d6" }}><strong style={{ color:"var(--good)" }}>ATS-only check</strong> — no job description used. Match score not applicable.</div>}
      <div className="analysis-kpis" style={{ gridTemplateColumns: isAtsOnly ? "1fr" : undefined }}>
        {!isAtsOnly && <ScoreCard label="Match score — fit to JD" value={analysis.matchScore} hintLow="Low keyword overlap" hintMid="Decent — tune a few terms" hintHigh="Well-aligned to this JD" />}
        <ScoreCard label="ATS score — parse health" value={analysis.atsScore} hintLow="Formatting may block parsing" hintMid="Minor tweaks needed" hintHigh="Clean, ATS-friendly" />
      </div>

      <div className="stat-card" style={{ marginBottom: 14, borderLeft: "3px solid var(--accent)" }}>
        <h3 style={{ marginTop: 0 }}>What to do next — priority order</h3>
        <ol style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--ink)", lineHeight: 1.65, fontSize: 13 }}>
          <li>Inject top missing keywords naturally into <strong>Skills</strong> and 1–2 project bullets — don’t keyword-stuff.</li>
          <li>Keep headings exactly: <code>EXECUTIVE SUMMARY</code>, <code>SKILLS</code>, <code>PROJECTS</code>, <code>EDUCATION</code> — ATS expects them.</li>
          <li>Use bullets with metrics (<code>~60%</code>, <code>sub-150ms</code>) like the template — then re-analyze to confirm lift.</li>
        </ol>
        {topGaps.length > 0 && <p className="page-sub" style={{ marginTop: 10 }}>Start with: <strong style={{ color: "var(--ink)" }}>{topGaps.join(", ")}</strong> — then <Link to="/resume-builder" className="text-link">add them in the builder</Link>.</p>}
      </div>

      <div className="analysis-grid">
        <div className="stat-card">
          <h3 style={{ marginTop: 0 }}>Skills & keywords</h3>
          <SkillTags title="Matched — keep these" items={analysis.matchedSkills} variant="good" emptyHint="No strong matches detected — check if JD terms appear verbatim." />
          <SkillTags title="Missing — add where honest" items={analysis.missingSkills} variant="bad" emptyHint="No missing flags — good coverage for this JD." />
          <SkillTags title="Keyword gaps — sprinkle into bullets" items={analysis.keywordGaps} variant="warn" emptyHint="No gap keywords — JD terms are present." />
          {hasKeywords && <p className="page-sub">Tip: add gaps to project bullets verbatim (e.g. “Spring Data JPA”) rather than a keyword dump.</p>}
        </div>

        <div className="stat-card">
          <h3 style={{ marginTop: 0 }}>ATS checklist</h3>
          <ul className="checklist">
            <li className={analysis.atsScore >= 70 ? "ok" : ""}><span className="check-dot" />Single-column layout & standard fonts (template does this)</li>
            <li className={analysis.atsScore >= 60 ? "ok" : ""}><span className="check-dot" />Section titles exactly as above — no creative headings</li>
            <li className={hasKeywords ? "" : "ok"}><span className="check-dot" />No tables/images in skills — plain bullets only</li>
            <li><span className="check-dot" />One page for student/early-career; two max for senior</li>
          </ul>
          <div className="divider" />
          <h4 style={{ margin: "0 0 8px", fontSize: 12, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Coach insights</h4>
          <InsightList title="Strengths" items={analysis.strengths} />
          <InsightList title="Weaknesses" items={analysis.weaknesses} />
          <InsightList title="Recommendations" items={analysis.recommendations} />
          <Link to="/resume-builder" className="button button-primary" style={{ marginTop: 10, display: "inline-flex" }}>Fix in builder<span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </div>
  );
}
