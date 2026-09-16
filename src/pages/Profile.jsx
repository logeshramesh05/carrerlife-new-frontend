import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  upsertSkill,
  updateSkill,
  deleteSkill,
  getSkillGaps,
  LEVEL_LABEL,
  SKILL_LEVELS,
  STAGE_LABEL,
  getResumeProfile,
  saveResumeProfile,
  importResumeToProfile,
} from "../api/skills";
import { listResumes } from "../api/resume";
import { setCareerStage } from "../api/dashboard";
import { friendlyApiError } from "../api/client";
import { timed } from "../utils/timing";
import { SkeletonPage } from "../components/Loader";

const STAGE_OPTIONS = ["STUDENT", "EARLY_CAREER", "SENIOR"];

const BLANK_EXP = () => ({ title: "", company: "", start: "", end: "", bullets: "" });
const BLANK_EDU = () => ({ school: "", degree: "", year: "" });
const BLANK_PROJ = () => ({ title: "", tech: "", githubUrl: "", bullets: "" });
const BLANK_CERT = () => ({ title: "", url: "" });
const BLANK_LINK = () => ({ label: "", url: "" });

function toPayload(form) {
  const clean = (v) => (v?.trim() ? v.trim() : null);
  const cleanList = (arr) => (arr || []).map((s) => s.trim()).filter(Boolean);
  return {
    fullName: clean(form.fullName),
    location: clean(form.location),
    headline: clean(form.headline),
    summary: clean(form.summary),
    skills: cleanList(form.skills).slice(0, 60),
    skillGroups: {
      languages: cleanList(form.skillGroups.languages),
      backend: cleanList(form.skillGroups.backend),
      databases: cleanList(form.skillGroups.databases),
      devops: cleanList(form.skillGroups.devops),
      tools: cleanList(form.skillGroups.tools),
      concepts: cleanList(form.skillGroups.concepts),
    },
    experience: form.experience.filter((e) => e.title.trim() || e.company.trim()).map((e) => ({
      title: e.title.trim(), company: e.company.trim(),
      start: e.start.trim() || null, end: e.end.trim() || null,
      bullets: e.bullets.split("\n").map((b) => b.trim()).filter(Boolean),
    })),
    projects: form.projects.filter((p) => p.title.trim()).map((p) => ({
      title: p.title.trim(), tech: p.tech.trim() || null, githubUrl: p.githubUrl.trim() || null,
      bullets: p.bullets.split("\n").map((b) => b.trim()).filter(Boolean),
    })),
    achievements: form.achievements.split("\n").map((s) => s.trim()).filter(Boolean),
    certifications: form.certifications.filter((c) => c.title.trim()).map((c) => ({
      title: c.title.trim(), url: c.url.trim() || null,
    })),
    education: form.education.filter((e) => e.school.trim() || e.degree.trim()).map((e) => ({
      school: e.school.trim(), degree: e.degree.trim(), year: e.year.trim() || null,
    })),
    links: form.links.filter((l) => l.url.trim()).map((l) => ({
      label: l.label.trim() || null, url: l.url.trim(),
    })),
    templateId: "latex",
  };
}

export default function Profile() {
  const { user } = useAuth();
  const [gaps, setGaps] = useState(null);
  const [profile, setProfile] = useState(null);
  const [newSkill, setNewSkill] = useState("");
  const [newLevel, setNewLevel] = useState("LEARNING");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [editLevel, setEditLevel] = useState("LEARNING");
  const [form, setForm] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [resumes, setResumes] = useState([]);
  const [selectedResume, setSelectedResume] = useState("");
  const [importing, setImporting] = useState(false);
  const [savingSkill, setSavingSkill] = useState(false);

  const load = () => {
    setLoading(true);
    timed("profile-load", Promise.allSettled([getSkillGaps(), getResumeProfile(), listResumes().catch(()=>[])]))
      .then(([g, p, r]) => {
        if (g.status === "fulfilled") setGaps(g.value);
        else setError(friendlyApiError(g.reason, "Failed to load skills"));
        if (p.status === "fulfilled") {
          setProfile(p.value);
          setForm({
            fullName: p.value.fullName ?? "",
            location: p.value.location ?? "",
            headline: p.value.headline ?? "",
            summary: p.value.summary ?? "",
            skills: p.value.skills ?? [],
            skillGroups: p.value.skillGroups
              ? { ...p.value.skillGroups }
              : { languages: [], backend: [], databases: [], devops: [], tools: [], concepts: [] },
            experience: (p.value.experience?.length ? p.value.experience : [BLANK_EXP()]).map((e) => ({
              title: e.title ?? "", company: e.company ?? "", start: e.start ?? "", end: e.end ?? "",
              bullets: Array.isArray(e.bullets) ? e.bullets.join("\n") : "",
            })),
            projects: (p.value.projects?.length ? p.value.projects : [BLANK_PROJ()]).map((pr) => ({
              title: pr.title ?? "", tech: pr.tech ?? "", githubUrl: pr.githubUrl ?? "",
              bullets: Array.isArray(pr.bullets) ? pr.bullets.join("\n") : "",
            })),
            achievements: Array.isArray(p.value.achievements) ? p.value.achievements.join("\n") : "",
            certifications: (p.value.certifications?.length ? p.value.certifications : [BLANK_CERT()]).map((c) => ({
              title: c.title ?? "", url: c.url ?? "",
            })),
            education: (p.value.education?.length ? p.value.education : [BLANK_EDU()]).map((e) => ({
              school: e.school ?? "", degree: e.degree ?? "", year: e.year ?? "",
            })),
            links: (p.value.links?.length ? p.value.links : [BLANK_LINK()]).map((l) => ({
              label: l.label ?? "", url: l.url ?? "",
            })),
          });
        }
        if (r.status === "fulfilled" && Array.isArray(r.value)) setResumes(r.value);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const refreshGaps = async () => setGaps(await getSkillGaps());

  const save = async () => {
    if (!form) return;
    setError(""); setNotice("");
    try {
      await timed("profile-save", saveResumeProfile(toPayload(form)));
      setDirty(false);
      setNotice("Profile saved — it will flow into Resume Builder.");
      await load();
    } catch (err) {
      setError(friendlyApiError(err, "Could not save profile"));
    }
  };

  const handleImport = async () => {
    if (!selectedResume) { setError("Select a resume to import from"); return; }
    setImporting(true); setError(""); setNotice("");
    try {
      const data = await timed("profile-import", importResumeToProfile(selectedResume));
      setNotice(`Imported from resume — ${data.skills?.length ?? 0} skills, ${data.experience?.length ?? 0} roles, ${data.education?.length ?? 0} education. Review then Save.`);
      await load();
    } catch (err) { setError(friendlyApiError(err, "Import failed")); }
    finally { setImporting(false); }
  };

  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setDirty(true); };
  const setExp = (i, patch) => setForm((f) => ({ ...f, experience: f.experience.map((e, j) => j === i ? { ...e, ...patch } : e) }));
  const setProj = (i, patch) => setForm((f) => ({ ...f, projects: f.projects.map((p, j) => j === i ? { ...p, ...patch } : p) }));
  const setEdu = (i, patch) => setForm((f) => ({ ...f, education: f.education.map((e, j) => j === i ? { ...e, ...patch } : e) }));
  const setCert = (i, patch) => setForm((f) => ({ ...f, certifications: f.certifications.map((c, j) => j === i ? { ...c, ...patch } : c) }));
  const setLink = (i, patch) => setForm((f) => ({ ...f, links: f.links.map((l, j) => j === i ? { ...l, ...patch } : l) }));

  const addSkill = (raw) => {
    const v = (raw ?? "").trim().replace(/\s+/g, " ");
    if (!v) return;
    set((f) => f.skills.some((s) => s.toLowerCase() === v.toLowerCase()) ? f : { ...f, skills: [...f.skills, v].slice(0, 60) });
  };

  // Tracked skills CRUD (level-aware)
  const handleAddTracked = async (e) => {
    e.preventDefault();
    if (!newSkill.trim()) return;
    setSavingSkill(true); setError(""); setNotice("");
    try { await upsertSkill({ skill: newSkill.trim(), level: newLevel }); setNewSkill(""); setNotice("Skill saved."); await refreshGaps(); }
    catch (err) { setError(friendlyApiError(err, "Could not save skill")); }
    finally { setSavingSkill(false); }
  };
  const handleLevelChange = async (id, level) => {
    try { await updateSkill(id, { level }); await refreshGaps(); } catch (err) { setError(friendlyApiError(err, "Could not update level")); }
  };
  const startEdit = (s) => { setEditingId(s.id); setEditValue(s.skill); setEditLevel(s.level); };
  const handleEditSave = async (id) => {
    try { await updateSkill(id, { skill: editValue, level: editLevel }); setEditingId(null); await refreshGaps(); } catch (err) { setError(friendlyApiError(err, "Could not update skill")); }
  };
  const handleDelete = async (id) => {
    try { await deleteSkill(id); await refreshGaps(); } catch (err) { setError(friendlyApiError(err, "Could not remove skill")); }
  };
  const handleTrackAdd = async (skill) => {
    try { await upsertSkill({ skill, level: "LEARNING", source: "TRACK" }); await refreshGaps(); setNotice(`"${skill}" added — mark Proficient when ready.`); }
    catch (err) { setError(friendlyApiError(err, "Could not add")); }
  };

  const handleStage = async (stage) => {
    try { await setCareerStage(stage); await refreshGaps(); setNotice(`Stage set to ${STAGE_LABEL[stage]}.`); }
    catch (err) { setError(friendlyApiError(err, "Could not update stage")); }
  };

  if (loading) return <SkeletonPage />;
  const stage = gaps?.stage ?? "UNSPECIFIED";
  const profileSkills = gaps?.profileSkills ?? [];
  const trackSkills = gaps?.trackSkills ?? [];
  const netGaps = gaps?.netGaps ?? [];

  return (
    <div className="page profile-page">
      <div className="page-header">
        <div>
          <h2>Profile</h2>
          <p className="page-sub">Single place for experience, education, skills, projects & links. Imports from your uploaded resume — no email/phone stored.</p>
        </div>
        <div className="dash-actions" style={{ flexWrap: "wrap" }}>
          {dirty && <span style={{ color: "var(--good)", fontWeight: 700, fontSize: 13, alignSelf: "center" }}>● unsaved</span>}
          <button type="button" className="secondary" onClick={save} disabled={!dirty}>{dirty ? "Save all" : "Saved"}</button>
          <Link className="button button-primary" to="/resume-builder">Resume Builder<span aria-hidden="true">→</span></Link>
        </div>
      </div>
      {error && <p className="error" style={{ marginBottom: 12 }}>{error}</p>}
      {notice && <p className="notice" style={{ marginBottom: 12 }}>{notice}</p>}

      <div className="stat-card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Import from resume</h3>
        <p className="page-sub" style={{ marginBottom: 10 }}>Pull experience, education & skills from a previously uploaded resume into the sections below. You can edit before saving.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={selectedResume} onChange={(e)=>setSelectedResume(e.target.value)} style={{ flex: "1 1 220px", minWidth: 200 }}>
            <option value="">Select resume…</option>
            {resumes.map((r)=><option key={r.id} value={r.id}>{r.fileName} — {r.uploadedAt ? new Date(r.uploadedAt).toLocaleDateString() : ""}</option>)}
          </select>
          <button type="button" className="secondary" onClick={handleImport} disabled={importing || !selectedResume}>{importing ? "Importing…" : "Import to profile"}</button>
          <Link className="text-link" to="/resumes">Upload new</Link>
        </div>
        {resumes.length===0 && <p className="page-sub" style={{ marginTop: 8 }}>No resumes yet — upload one first.</p>}
      </div>

      <div className="profile-grid">
        <div className="stat-card">
          <h3>Account</h3>
          <div className="stat-card-row"><span>Name</span><b>{user?.name ?? "—"}</b></div>
          <div className="stat-card-row"><span>Stage</span><b>{STAGE_LABEL[stage] ?? stage}</b></div>
          <div className="field" style={{ marginTop: 12 }}><label>Career stage</label>
            <select value={STAGE_OPTIONS.includes(stage) ? stage : ""} onChange={(e) => e.target.value && handleStage(e.target.value)}>
              <option value="" disabled>Choose your level…</option>
              {STAGE_OPTIONS.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
            </select>
          </div>
        </div>

        <div className="stat-card">
          <h3>Resume snapshot</h3>
          <div className="stat-card-row"><span>Name</span><b>{form?.fullName || "—"}</b></div>
          <div className="stat-card-row"><span>Headline</span><b style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block", textAlign: "right" }}>{form?.headline || "—"}</b></div>
          <div className="stat-card-row"><span>Location</span><b>{form?.location || "—"}</b></div>
          <div className="stat-card-row"><span>Experience</span><b>{form?.experience?.filter((e) => e.title.trim()).length ?? 0}</b></div>
          <div className="stat-card-row"><span>Projects</span><b>{form?.projects?.filter((p) => p.title.trim()).length ?? 0}</b></div>
          <div className="stat-card-row"><span>Education</span><b>{form?.education?.filter((e) => e.school.trim()).length ?? 0}</b></div>
          <div className="stat-card-row"><span>Tracked skills</span><b>{profileSkills.length}</b></div>
          {form?.summary && <p className="page-sub" style={{ marginTop: 10, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>{form.summary}</p>}
        </div>
      </div>

      <div className="profile-sections">
        <div className="stat-card">
          <div className="section-title" style={{ marginTop: 0 }}>
            <h3 style={{ margin: 0 }}>Experience · {form?.experience?.filter((e) => e.title.trim()).length ?? 0}</h3>
            <button type="button" className="secondary" onClick={() => set({ experience: [...(form?.experience ?? [BLANK_EXP()]), BLANK_EXP()] })}>+ Add role</button>
          </div>
          {(form?.experience ?? [BLANK_EXP()]).map((e, i) => (
            <div key={i} className="builder-block">
              <div className="builder-2col">
                <div className="field"><label>Title</label><input value={e.title} onChange={(e2) => setExp(i, { title: e2.target.value })} placeholder="Software Engineer" /></div>
                <div className="field"><label>Company</label><input value={e.company} onChange={(e2) => setExp(i, { company: e2.target.value })} placeholder="Acme Corp" /></div>
              </div>
              <div className="builder-2col">
                <div className="field"><label>Start</label><input value={e.start} onChange={(e2) => setExp(i, { start: e2.target.value })} placeholder="Jan 2023" /></div>
                <div className="field"><label>End</label><input value={e.end} onChange={(e2) => setExp(i, { end: e2.target.value })} placeholder="Present" /></div>
              </div>
              <div className="field"><label>Highlights — one per line</label><textarea value={e.bullets} rows={3} onChange={(e2) => setExp(i, { bullets: e2.target.value })} placeholder={"Shipped X, improving Y by 20%\nLed a team of …"} /></div>
              {(form?.experience?.length ?? 0) > 1 && <button type="button" className="ghost danger-text" onClick={() => set({ experience: (form?.experience ?? []).filter((_, j) => j !== i) })}>Remove role</button>}
            </div>
          ))}
        </div>

        <div className="stat-card">
          <div className="section-title" style={{ marginTop: 0 }}>
            <h3 style={{ margin: 0 }}>Education</h3>
            <button type="button" className="secondary" onClick={() => set({ education: [...(form?.education ?? [BLANK_EDU()]), BLANK_EDU()] })}>+ Add</button>
          </div>
          {(form?.education ?? [BLANK_EDU()]).map((e, i) => (
            <div key={i} className="builder-block">
              <div className="field"><label>School</label><input value={e.school} onChange={(e2) => setEdu(i, { school: e2.target.value })} placeholder="ABC University" /></div>
              <div className="builder-2col">
                <div className="field"><label>Degree</label><input value={e.degree} onChange={(e2) => setEdu(i, { degree: e2.target.value })} placeholder="B.Tech, Computer Science" /></div>
                <div className="field"><label>Year</label><input value={e.year} onChange={(e2) => setEdu(i, { year: e2.target.value })} placeholder="2025" /></div>
              </div>
              {(form?.education?.length ?? 0) > 1 && <button type="button" className="ghost danger-text" onClick={() => set({ education: (form?.education ?? []).filter((_, j) => j !== i) })}>Remove</button>}
            </div>
          ))}
        </div>

        <div className="stat-card">
          <h3>Skills — unified (level-aware)</h3>
          <p className="page-sub" style={{ marginBottom: 10 }}>Level-aware skills feed dashboard & tracks. Flat chips below also feed builder.</p>
          <form onSubmit={handleAddTracked} className="skill-add-row">
            <input value={newSkill} onChange={(e)=>setNewSkill(e.target.value)} placeholder="Add a skill, e.g. React" maxLength={120} aria-label="New skill name" />
            <select value={newLevel} onChange={(e)=>setNewLevel(e.target.value)} aria-label="Skill level">
              {SKILL_LEVELS.map((l)=><option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
            </select>
            <button type="submit" disabled={savingSkill || !newSkill.trim()}>{savingSkill ? "Saving…" : "Add"}</button>
          </form>
          {profileSkills.length===0 ? <p className="page-sub">Nothing here yet — add your first skill above.</p> : (
            <ul className="skill-profile-list">
              {profileSkills.map((s)=>(
                <li key={s.id} className="skill-profile-row">
                  {editingId===s.id ? (
                    <>
                      <input value={editValue} onChange={(e)=>setEditValue(e.target.value)} maxLength={120} />
                      <select value={editLevel} onChange={(e)=>setEditLevel(e.target.value)}>
                        {SKILL_LEVELS.map((l)=><option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
                      </select>
                      <button type="button" className="secondary" onClick={()=>handleEditSave(s.id)}>Save</button>
                      <button type="button" className="ghost" onClick={()=>setEditingId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <span className="skill-profile-name" title={s.skill}>{s.skill}</span>
                      <select value={s.level} onChange={(e)=>handleLevelChange(s.id,e.target.value)} className="level-select" aria-label={`Level for ${s.skill}`}>
                        {SKILL_LEVELS.map((l)=><option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
                      </select>
                      <button type="button" className="ghost" onClick={()=>startEdit(s)} aria-label={`Rename ${s.skill}`}>✎</button>
                      <button type="button" className="ghost danger-text" onClick={()=>handleDelete(s.id)} aria-label={`Remove ${s.skill}`}>✕</button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div style={{ marginTop: 16 }}><h4 style={{ margin: "0 0 8px", fontSize: 12, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Flat chips for builder</h4>
            <div className="skill-add-row">
              <input value={newSkill} onChange={(e)=>{ const v=e.target.value; if(v.includes(",")){ addSkill(v.replace(",","")); setNewSkill(""); } else setNewSkill(v); }} onKeyDown={(e)=>{ if(e.key==="Enter"){ e.preventDefault(); addSkill(newSkill); setNewSkill(""); }}} placeholder="Type a skill, press Enter (builder)" maxLength={120} />
              <button type="button" onClick={()=>{ addSkill(newSkill); setNewSkill(""); }}>Add chip</button>
            </div>
            <div className="tag-list" style={{ marginBottom: 10 }}>
              {(form?.skills ?? []).map((s)=><span key={s} className="tag good">{s} <button type="button" className="tag-x" aria-label={`Remove ${s}`} onClick={()=>set({ skills: (form?.skills ?? []).filter((x)=>x!==s) })}>✕</button></span>)}
              {(form?.skills?.length??0)===0 && <span className="page-sub">Add chips above — or they auto-fill from import.</span>}
            </div>
            {[
              ["Languages", "languages", "Java, Python, JavaScript"],
              ["Backend and Architecture", "backend", "Spring Boot, RESTful APIs"],
              ["Databases", "databases", "MySQL, MongoDB"],
              ["DevOps / Testing", "devops", "Docker, JUnit"],
              ["Tools and CI/CD", "tools", "Git, GitHub, Postman"],
              ["Core Concepts", "concepts", "OOP, Data Structures"],
            ].map(([label, key, ph])=>(
              <div key={key} className="field"><label>{label}</label>
                <input value={(form?.skillGroups?.[key] ?? []).join(", ")} onChange={(e)=>set({ skillGroups: { ...form.skillGroups, [key]: e.target.value.split(",").map((s)=>s.trim()).filter(Boolean) } })} placeholder={ph} />
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16, display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div>
              <h4 style={{ margin:"0 0 8px", fontSize:12, letterSpacing:".06em", textTransform:"uppercase", color:"var(--muted)"}}>Recommended for {STAGE_LABEL[stage] ?? stage}</h4>
              {trackSkills.length===0 ? <p className="page-sub">All caught up.</p> : (
                <ul className="track-list">
                  {trackSkills.slice(0,8).map((t)=><li key={t.skill} className="track-row" title={t.reason}><div><strong>{t.skill}</strong><div className="page-sub">{t.reason}</div></div><button type="button" className="secondary" onClick={()=>handleTrackAdd(t.skill)}>+ Add</button></li>)}
                </ul>
              )}
            </div>
            <div>
              <h4 style={{ margin:"0 0 8px", fontSize:12, letterSpacing:".06em", textTransform:"uppercase", color:"var(--muted)"}}>Gaps from analyses · {netGaps.length}</h4>
              {netGaps.length===0 ? <p className="page-sub">No recurring gaps.</p> : (
                <div className="tag-list">
                  {netGaps.slice(0,12).map((g)=><button key={g.skill} type="button" className="tag bad tag-button" title={`${g.occurrences}×`} onClick={()=>handleTrackAdd(g.skill)}>{g.skill} · {g.occurrences}× +</button>)}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="section-title" style={{ marginTop: 0 }}>
            <h3 style={{ margin: 0 }}>Projects</h3>
            <button type="button" className="secondary" onClick={() => set({ projects: [...(form?.projects ?? [BLANK_PROJ()]), BLANK_PROJ()] })}>+ Add project</button>
          </div>
          {(form?.projects ?? [BLANK_PROJ()]).map((p, i) => (
            <div key={i} className="builder-block">
              <div className="field"><label>Title</label><input value={p.title} onChange={(e) => setProj(i, { title: e.target.value })} placeholder="Agent-Based System Hardening Tool" /></div>
              <div className="builder-2col">
                <div className="field"><label>Tech stack</label><input value={p.tech} onChange={(e) => setProj(i, { tech: e.target.value })} placeholder="Spring Boot, MySQL, Python" /></div>
                <div className="field"><label>GitHub URL</label><input value={p.githubUrl} onChange={(e) => setProj(i, { githubUrl: e.target.value })} placeholder="https://github.com/you/repo" /></div>
              </div>
              <div className="field"><label>Bullets — one per line</label><textarea value={p.bullets} rows={3} onChange={(e) => setProj(i, { bullets: e.target.value })} placeholder={"Automated security config across Windows/Linux, reducing effort ~60%\nBuilt agents executing 30+ checks…"} /></div>
              {(form?.projects?.length ?? 0) > 1 && <button type="button" className="ghost danger-text" onClick={() => set({ projects: (form?.projects ?? []).filter((_, j) => j !== i) })}>Remove project</button>}
            </div>
          ))}
        </div>

        <div className="stat-card">
          <h3>Achievements</h3>
          <div className="field"><label>One per line</label>
            <textarea value={form?.achievements ?? ""} rows={3} onChange={(e) => set({ achievements: e.target.value })} placeholder="SIH 2025 Finalist — Team Lead: top 5% nationwide&#10;Hackathon winner — Best Backend" />
          </div>
        </div>

        <div className="stat-card">
          <div className="section-title" style={{ marginTop: 0 }}>
            <h3 style={{ margin: 0 }}>Certifications</h3>
            <button type="button" className="secondary" onClick={() => set({ certifications: [...(form?.certifications ?? [BLANK_CERT()]), BLANK_CERT()] })}>+ Add</button>
          </div>
          {(form?.certifications ?? [BLANK_CERT()]).map((c, i) => (
            <div key={i} className="builder-2col">
              <div className="field"><label>Title</label><input value={c.title} onChange={(e) => setCert(i, { title: e.target.value })} placeholder="OOP in Java — Coursera" /></div>
              <div className="field"><label>Verify URL</label><input value={c.url} onChange={(e) => setCert(i, { url: e.target.value })} placeholder="https://coursera.org/verify/…" /></div>
            </div>
          ))}
        </div>

        <div className="stat-card">
          <div className="section-title" style={{ marginTop: 0 }}>
            <h3 style={{ margin: 0 }}>Links</h3>
            <button type="button" className="secondary" onClick={() => set({ links: [...(form?.links ?? [BLANK_LINK()]), BLANK_LINK()] })}>+ Add</button>
          </div>
          {(form?.links ?? [BLANK_LINK()]).map((l, i) => (
            <div key={i} className="builder-2col">
              <div className="field"><label>Label</label><input value={l.label} onChange={(e) => setLink(i, { label: e.target.value })} placeholder="GitHub" /></div>
              <div className="field"><label>URL</label><input value={l.url} onChange={(e) => setLink(i, { url: e.target.value })} placeholder="https://github.com/you" /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
