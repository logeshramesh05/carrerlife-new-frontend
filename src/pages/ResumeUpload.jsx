import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { listResumes, uploadResume, getCachedResumes } from "../api/resume";
import { friendlyApiError } from "../api/client";
import { timed } from "../utils/timing";
import { Spinner, SkeletonCards } from "../components/Loader";

export default function ResumeUpload() {
  const [resumes, setResumes] = useState(() => getCachedResumes());
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB (must match backend ResumeService)
  const ALLOWED_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  const validateFile = (f) => {
    if (!f) return "No file selected";
    const ext = f.name?.toLowerCase().split(".").pop();
    const validExt = ["pdf", "docx"];
    if (!validExt.includes(ext) && !ALLOWED_TYPES.includes(f.type)) {
      return "Only PDF or DOCX files are allowed";
    }
    if (f.size > MAX_FILE_SIZE) {
      return "File must be smaller than 5MB";
    }
    return "";
  };

  const pickFile = (f) => {
    if (!f) return;
    const validationError = validateFile(f);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setFile(f);
  };

  const load = () => {
    setListError("");
    timed("resumes", listResumes()).then((data) => setResumes(Array.isArray(data) ? data : [])).catch((err) => {
      // Keep stale cache visible; only error when nothing to show.
      if (!getCachedResumes() && resumes === null) {
        setResumes([]);
        setListError(friendlyApiError(err, "Failed to load resumes"));
      }
    });
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setUploading(true);
    try {
      await timed("upload", uploadResume(file));
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      load();
    } catch (err) {
      setError(friendlyApiError(err, "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) pickFile(dropped);
  };

  return (
    <div className="page resume-page">
      <div className="page-header">
        <div>
          <h2>Resumes</h2>
          <p className="page-sub">Upload and analyze your resumes against job descriptions — or build one fresh</p>
        </div>
        <div className="dash-actions">
          <Link className="button button-primary" to="/resume-builder">Build resume<span aria-hidden="true">→</span></Link>
        </div>
      </div>

      <div className="quick-actions">
        <Link to="/resume-builder" className="quick-card">
          <div className="quick-icon">✎</div>
          <div>
            <strong>Build a resume</strong>
            <div className="page-sub">LaTeX-style PDF from your skills — no contact details needed</div>
          </div>
          <span aria-hidden="true">→</span>
        </Link>
        <Link to="/profile" className="quick-card">
          <div className="quick-icon">◍</div>
          <div>
            <strong>Update my profile</strong>
            <div className="page-sub">Experience, education, skills — all in one place</div>
          </div>
          <span aria-hidden="true">→</span>
        </Link>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="section-title">
        <h3 style={{ margin: 0 }}>Upload a file</h3>
        <span className="page-sub" style={{ margin: 0 }}>PDF or DOCX · up to 5MB</span>
      </div>
      <form onSubmit={handleUpload} className="card-form upload-card">
        <div
          className={`dropzone${dragActive ? " active" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
        >
          <div className="icon">📄</div>
          <div><strong>{file ? file.name : "Click or drag a resume file here"}</strong></div>
          <small>{file ? `${(file.size / 1024).toFixed(0)} KB · PDF or DOCX` : "PDF or DOCX · your file stays yours"}</small>
          <input ref={inputRef} type="file" accept=".pdf,.docx" style={{ display: "none" }}
            onChange={(e) => pickFile(e.target.files?.[0])} />
        </div>
        <button type="submit" disabled={uploading || !file} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {uploading && <Spinner />} {uploading ? "Uploading" : "Upload Resume"}
        </button>
      </form>

      <div className="section-title">
        <h3 style={{ margin: 0 }}>Your Resumes · {(resumes ?? []).length}</h3>
        <Link className="text-link" to="/resume-builder">or start from the builder</Link>
      </div>
      {listError && (
        <div>
          <p className="error">{listError}</p>
          <button type="button" className="secondary" onClick={load} style={{ marginBottom: 12 }}>Retry</button>
        </div>
      )}
      {resumes === null ? (
        <SkeletonCards count={2} />
      ) : resumes.length === 0 && !listError ? (
        <div className="empty-state"><div className="icon">🗂️</div>No resumes uploaded yet</div>
      ) : resumes.length === 0 ? null : (
        <div className="turns-list">
          {resumes.map((r) => {
            const ext = (r.fileName?.split(".").pop() || "").toUpperCase();
            const kb = r.fileSize ? `${Math.max(1, Math.round(r.fileSize / 1024))} KB` : "";
            return (
            <div key={r.id} className="turn-card resume-row">
              <div className="turn-card-row">
                <span className="file-badge">{ext || "FILE"}</span>
                <strong className="resume-name">{r.fileName || "Untitled resume"}</strong>
                <span className="page-sub resume-meta" style={{ margin: 0 }}>
                  {[kb, r.uploadedAt ? new Date(r.uploadedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : ""].filter(Boolean).join(" · ")}
                </span>
              </div>
              <div className="resume-links">
                <Link className="button button-primary" to={`/resumes/${r.id}/analyze`}>Analyze</Link>
                <Link className="text-link" to={`/resumes/${r.id}/analyses`}>View analyses</Link>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
