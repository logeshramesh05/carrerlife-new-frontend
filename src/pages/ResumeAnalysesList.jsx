import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getAnalyses, analyzeResume, checkAts } from "../api/resume";
import { friendlyApiError } from "../api/client";
import { timed } from "../utils/timing";
import { SkeletonCards } from "../components/Loader";

export default function ResumeAnalysesList() {
  const { resumeId } = useParams();
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState(null); // null | 'jd' | 'ats'
  const [jd, setJd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState("");

  const load = () => {
    if (!resumeId) { setError("Missing resume id"); setAnalyses([]); return; }
    getAnalyses(resumeId).then((data) => setAnalyses(Array.isArray(data) ? data : [])).catch((err) =>
      setError(err.response?.data?.message || "Failed to load analyses")
    );
  };
  useEffect(() => { load(); }, [resumeId]);

  const handleJdAnalyze = async (e) => {
    e.preventDefault();
    const trimmed = jd.trim();
    if (trimmed.length < 50) { setError("Job description must be at least 50 characters"); return; }
    setSubmitting(true); setError(""); setNotice("");
    try {
      const res = await timed("analyze", analyzeResume(resumeId, trimmed));
      setNotice("Analysis complete — Match " + (res.matchScore ?? 0) + "% · ATS " + (res.atsScore ?? 0) + "%");
      setJd(""); setMode(null);
      load();
      if (res?.analysisId) navigate(`/resumes/${resumeId}/analyses/${res.analysisId}`);
    } catch (err) { setError(friendlyApiError(err, "Analysis failed")); }
    finally { setSubmitting(false); }
  };

  const handleAtsCheck = async () => {
    setSubmitting(true); setError(""); setNotice("");
    try {
      const res = await timed("ats-check", checkAts(resumeId));
      setNotice("ATS check complete — ATS " + (res.atsScore ?? 0) + "%");
      load();
      if (res?.analysisId) navigate(`/resumes/${resumeId}/analyses/${res.analysisId}`);
    } catch (err) { setError(friendlyApiError(err, "ATS check failed")); }
    finally { setSubmitting(false); }
  };

  const filtered = (analyses ?? []).filter((a)=>{
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return (a.missingSkills||[]).join(" ").toLowerCase().includes(q) ||
           (a.matchedSkills||[]).join(" ").toLowerCase().includes(q) ||
           (a.recommendations||[]).join(" ").toLowerCase().includes(q);
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Analyses</h2>
          <p className="page-sub">Direct ATS check (no JD) or JD match — results below are your history</p>
        </div>
        <div className="dash-actions" style={{ flexWrap:"wrap" }}>
          <button type="button" className={mode==='ats' ? "button button-primary" : "secondary"} onClick={()=> setMode(mode==='ats'?null:'ats')} disabled={submitting}>ATS Check</button>
          <button type="button" className={mode==='jd' ? "button button-primary" : "secondary"} onClick={()=> setMode(mode==='jd'?null:'jd')} disabled={submitting}>Analyze with JD</button>
          <Link className="secondary" to={`/resumes/${resumeId}/analyze`} style={{ padding:"10px 14px", borderRadius:6, border:"1px solid var(--line-dark)", background:"#fff", fontWeight:700, fontSize:13 }}>Full page</Link>
        </div>
      </div>

      {error && <p className="error" style={{ marginBottom: 12 }}>{error}</p>}
      {notice && <p className="notice" style={{ marginBottom: 12 }}>{notice}</p>}

      {mode==='jd' && (
        <form onSubmit={handleJdAnalyze} className="stat-card analysis-inline" style={{ marginBottom: 14 }}>
          <h3 style={{ marginTop:0 }}>Analyze with Job Description</h3>
          <textarea rows={6} placeholder="Paste job description (min 50 characters)..." value={jd} onChange={(e)=>setJd(e.target.value)} required />
          <small className="page-sub">{jd.trim().length} / 50 min characters</small>
          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            <button type="submit" disabled={submitting}>{submitting ? "Analyzing…" : "Analyze"}</button>
            <button type="button" className="ghost" onClick={()=>{setJd(""); setMode(null);}}>Cancel</button>
          </div>
        </form>
      )}
      {mode==='ats' && (
        <div className="stat-card analysis-inline" style={{ marginBottom: 14, borderLeft:"3px solid var(--accent)" }}>
          <h3 style={{ marginTop:0 }}>ATS Check — no description needed</h3>
          <p className="page-sub">Checks single-column layout, standard headings (EXECUTIVE SUMMARY, SKILLS, PROJECTS, EDUCATION), plain bullets & metrics. No JD required.</p>
          <div style={{ display:"flex", gap:8, marginTop:10 }}>
            <button type="button" onClick={handleAtsCheck} disabled={submitting}>{submitting ? "Checking…" : "Run ATS Check"}</button>
            <button type="button" className="ghost" onClick={()=>setMode(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="stat-card" style={{ marginBottom:14 }}>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <input style={{ flex:"1 1 200px", minWidth:180 }} placeholder="Filter by missing skill, keyword…" value={filter} onChange={(e)=>setFilter(e.target.value)} />
          <span className="page-sub">{filtered.length} result{filtered.length!==1?"s":""} · {analyses?.length ?? 0} total</span>
          <button type="button" className="secondary" onClick={load}>Refresh</button>
        </div>
      </div>

      {analyses === null ? (
        <SkeletonCards count={3} />
      ) : analyses.length === 0 && !error ? (
        <div className="empty-state">
          <div className="icon">📊</div>
          <div className="empty-title">No analyses yet</div>
          <div>Run an ATS check (instant, no JD) or paste a JD above to get Match + ATS scores.</div>
          <div style={{ display:"flex", gap:8, justifyContent:"center", marginTop:12 }}>
            <button type="button" className="secondary" onClick={()=>setMode('ats')}>ATS Check</button>
            <button type="button" className="secondary" onClick={()=>setMode('jd')}>Analyze with JD</button>
          </div>
        </div>
      ) : filtered.length===0 ? (
        <div className="empty-state">No matches for "{filter}"</div>
      ) : (
        <div className="turns-list">
          {filtered.map((a) => {
            const isAtsOnly = !a.jobDescription || a.jobDescription.trim()==="";
            const matchTone = (a.matchScore ?? 0) >=70 ? "high" : (a.matchScore ?? 0) >=45 ? "mid" : "low";
            const atsTone = (a.atsScore ?? 0) >=70 ? "high" : (a.atsScore ?? 0) >=45 ? "mid" : "low";
            const topMissing = (a.missingSkills||[]).slice(0,3).join(", ");
            const topRec = (a.recommendations||[])[0];
            const created = a.createdAt ? new Date(a.createdAt).toLocaleString([], { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }) : "";
            return (
              <div key={a.analysisId} className="turn-card analysis-row">
                <div className="row-top">
                  <span className={`score-pill s-${atsTone}`}>ATS {a.atsScore ?? 0}%</span>
                  {isAtsOnly ? <span className="pill ghost">ATS-only</span> : <span className={`score-pill s-${matchTone}`}>Match {a.matchScore ?? 0}%</span>}
                  {created && <span className="page-sub" style={{ marginLeft:6 }}>{created}</span>}
                  <Link to={`/resumes/${resumeId}/analyses/${a.analysisId}`} style={{ marginLeft:"auto", fontWeight:700, fontSize:13 }}>View Details →</Link>
                </div>
                {(topMissing || topRec) && (
                  <div className="page-sub" style={{ marginTop:6, lineHeight:1.5 }}>
                    {topMissing && <><strong style={{ color:"var(--ink)" }}>Missing:</strong> {topMissing}</>}
                    {topMissing && topRec && " · "}
                    {topRec && <span>{topRec.slice(0,120)}{topRec.length>120?"…":""}</span>}
                  </div>
                )}
                <div style={{ display:"flex", gap:6, marginTop:10, flexWrap:"wrap" }}>
                  <button type="button" className="ghost" style={{ fontSize:12, padding:"6px 10px" }} onClick={()=>{
                    if(a.jobDescription){ setJd(a.jobDescription); setMode('jd'); window.scrollTo({top:0, behavior:"smooth"}); }
                    else { setMode('ats'); }
                  }}>Re-analyze</button>
                  {!isAtsOnly && <button type="button" className="ghost" style={{ fontSize:12, padding:"6px 10px" }} onClick={()=>{
                    navigator.clipboard?.writeText(a.jobDescription||""); setNotice("Job description copied — paste in Analyse form");
                  }}>Copy JD</button>}
                  <Link to="/resume-builder" className="text-link" style={{ fontSize:12, marginLeft:6 }}>Fix in Resume Builder →</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
