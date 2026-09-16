import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { analyzeResume } from "../api/resume";
import { Spinner } from "../components/Loader";

export default function ResumeAnalyze() {
  const { resumeId } = useParams();
  const [jobDescription, setJobDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const MIN_JD_LENGTH = 50;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = jobDescription.trim();
    if (!resumeId) {
      setError("Missing resume id");
      return;
    }
    if (trimmed.length < MIN_JD_LENGTH) {
      setError(`Job description must be at least ${MIN_JD_LENGTH} characters (currently ${trimmed.length})`);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await analyzeResume(resumeId, trimmed);
      if (!result?.analysisId) {
        throw new Error("Invalid server response — missing analysisId");
      }
      navigate(`/resumes/${resumeId}/analyses/${result.analysisId}`);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Analysis failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <div className="page-header">
        <div>
          <h2>Analyze Resume</h2>
          <p className="page-sub">Paste a job description to get a match score</p>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit} className="card-form">
        <textarea rows="12" placeholder="Paste job description (min 50 characters)..."
          value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} required />
        <small className="page-sub">{jobDescription.trim().length} / {MIN_JD_LENGTH} min characters</small>
        <button type="submit" disabled={loading} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {loading && <Spinner />} {loading ? "Analyzing" : "Analyze"}
        </button>
      </form>
    </div>
  );
}
