import { useEffect, useState } from "react";
import { getSuggestions, getMissingSkills, getImprovementAreas, getBenchmark } from "../api/dashboard";
import { friendlyApiError } from "../api/client";
import { timed } from "../utils/timing";
import { SkeletonPage } from "../components/Loader";
import ProgressBar from "../components/ProgressBar";

export default function Suggestions() {
  const [suggestions, setSuggestions] = useState(null);
  const [missingSkills, setMissingSkills] = useState(null);
  const [improvement, setImprovement] = useState(null);
  const [benchmark, setBenchmark] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    timed("suggestions", Promise.allSettled([
      getSuggestions(),
      getMissingSkills(),
      getImprovementAreas(),
      getBenchmark(),
    ])).then(([s, m, i, b]) => {
      if (cancelled) return;
      const nextErrors = {};
      if (s.status === "fulfilled") setSuggestions(s.value);
      else nextErrors.suggestions = friendlyApiError(s.reason, "Failed to load suggestions");
      if (m.status === "fulfilled") setMissingSkills(m.value);
      else nextErrors.missingSkills = friendlyApiError(m.reason, "Failed to load missing skills");
      if (i.status === "fulfilled") setImprovement(i.value);
      else nextErrors.improvement = friendlyApiError(i.reason, "Failed to load improvement areas");
      if (b.status === "fulfilled") setBenchmark(b.value);
      else nextErrors.benchmark = friendlyApiError(b.reason, "Failed to load benchmark");
      setErrors(nextErrors);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <SkeletonPage />;

  const suggestionList = Array.isArray(suggestions?.suggestions) ? suggestions.suggestions : [];
  const missingList = Array.isArray(missingSkills?.skills) ? missingSkills.skills : [];
  const weaknesses = Array.isArray(improvement?.recurringResumeWeaknesses) ? improvement.recurringResumeWeaknesses : [];
  const feedbackList = Array.isArray(improvement?.lowestScoringInterviewFeedback) ? improvement.lowestScoringInterviewFeedback : [];
  const allFailed = !suggestions && !missingSkills && !improvement && !benchmark;

  if (allFailed)
    return (
      <div className="page">
        <p className="error">{errors.suggestions || "Failed to load"}</p>
        <button type="button" className="secondary" onClick={() => window.location.reload()} style={{ marginTop: 12 }}>Retry</button>
      </div>
    );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Career Suggestions</h2>
          <p className="page-sub">Career Stage: <strong style={{ color: "var(--text)" }}>{suggestions?.careerStage || "Not set"}</strong></p>
        </div>
      </div>

      {errors.suggestions ? (
        <p className="error">{errors.suggestions}</p>
      ) : suggestionList.length === 0 ? (
        <div className="empty-state"><div className="icon">💡</div>No suggestions yet — complete an interview or resume analysis</div>
      ) : (
      <div className="turns-list">
        {suggestionList.map((s, i) => (
          <div key={i} className="turn-card">{s}</div>
        ))}
      </div>
      )}

      <h3>Missing Skills (All)</h3>
      {errors.missingSkills ? (
        <p className="error">{errors.missingSkills}</p>
      ) : missingList.length === 0 ? (
        <p className="page-sub">Nothing to show yet</p>
      ) : (
      <div className="tag-list">
        {missingList.map((s) => (
          <span key={s.skill} className="tag bad">{s.skill} · {s.occurrences ?? 0}</span>
        ))}
      </div>
      )}

      <h3>Improvement Areas</h3>
      {errors.improvement ? (
        <p className="error">{errors.improvement}</p>
      ) : (
      <>
      <h4>Recurring Resume Weaknesses</h4>
      {weaknesses.length === 0 ? (
        <p className="page-sub">Nothing to show yet</p>
      ) : (
      <div className="tag-list">
        {weaknesses.map((s) => (
          <span key={s.skill} className="tag warn">{s.skill} · {s.occurrences ?? 0}</span>
        ))}
      </div>
      )}
      <h4 style={{ marginTop: 20 }}>Lowest Scoring Interview Feedback</h4>
      {feedbackList.length === 0 ? (
        <p className="page-sub">Nothing to show yet</p>
      ) : (
      <div className="turns-list">
        {feedbackList.map((f, i) => (
          <div key={i} className="turn-card">{f}</div>
        ))}
      </div>
      )}
      </>
      )}

      <h3>Benchmark</h3>
      {errors.benchmark ? (
        <p className="error">{errors.benchmark}</p>
      ) : !benchmark ? (
        <p className="page-sub">Nothing to show yet</p>
      ) : (
      <div className="stat-card">
        <ProgressBar label="Your average score" value={benchmark.yourAverageScore ?? 0} max={100} />
        <ProgressBar label="Typical average score" value={benchmark.typicalAverageScore ?? 0} max={100} />
        <ProgressBar label="Your ATS score" value={benchmark.yourAverageAtsScore ?? 0} max={100} suffix="%" />
        <ProgressBar label="Typical ATS score" value={benchmark.typicalAverageAtsScore ?? 0} max={100} suffix="%" />
      </div>
      )}
    </div>
  );
}
