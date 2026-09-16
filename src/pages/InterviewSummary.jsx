import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getSummary } from "../api/interview";
import { SkeletonPage } from "../components/Loader";
import ScorePill from "../components/ScorePill";
import ProgressBar from "../components/ProgressBar";

export default function InterviewSummary() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setError("Missing session id");
      setLoading(false);
      return;
    }
    setLoading(true);
    getSummary(sessionId)
      .then(setSummary)
      .catch((err) =>
        setError(err.response?.data?.message || "Failed to load summary")
      )
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return <SkeletonPage />;
  if (error)
    return (
      <div className="page">
        <p className="error">{error}</p>
        <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
          <button type="button" onClick={() => window.location.reload()}>Retry</button>
          <button type="button" className="secondary" onClick={() => navigate("/dashboard")}>Back to Dashboard</button>
        </div>
      </div>
    );
  if (!summary) return <SkeletonPage />;

  const turns = Array.isArray(summary.turns) ? summary.turns : [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Interview Summary</h2>
          <p className="page-sub">{summary.role || "Mock interview"}</p>
        </div>
        <span className={`badge ${summary.status === "COMPLETED" ? "completed" : "active"}`}>{summary.status || "UNKNOWN"}</span>
      </div>

      <div className="stat-card" style={{ marginBottom: 24 }}>
        <ProgressBar label="Average score" value={summary.averageScore ?? 0} max={100} />
        <p style={{ marginTop: 12 }}>{summary.overallSummary || "No overall summary available yet."}</p>
      </div>

      <h3>Question Breakdown</h3>
      {turns.length === 0 ? (
        <div className="empty-state"><div className="icon">📝</div>No questions answered yet</div>
      ) : (
      <div className="turns-list">
        {turns.map((t) => (
          <div key={t.questionIndex ?? t.question} className="turn-card">
            <div className="turn-card-row">
              <p className="question-text" style={{ margin: 0, fontSize: 15.5 }}><strong>Q{(t.questionIndex ?? 0) + 1}:</strong> {t.question || "—"}</p>
              <ScorePill score={t.score} />
            </div>
            <p style={{ marginTop: 10 }}><strong style={{ color: "var(--text)" }}>Answer:</strong> {t.answer || "—"}</p>
            <p><strong style={{ color: "var(--text)" }}>Feedback:</strong> {t.feedback || "—"}</p>
          </div>
        ))}
      </div>
      )}

      <div style={{ marginTop: 28, display: "flex", gap: 12 }}>
        <Link to="/interview" style={{ textDecoration: "none" }}><button type="button">Start New Interview</button></Link>
        <Link to="/dashboard" style={{ textDecoration: "none" }}><button type="button" className="secondary">Back to Dashboard</button></Link>
      </div>
    </div>
  );
}
