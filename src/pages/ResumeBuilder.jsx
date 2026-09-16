import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from "@react-pdf/renderer";
import { getResumeProfile, saveResumeProfile, getSkillGaps } from "../api/skills";
import { friendlyApiError } from "../api/client";
import { timed } from "../utils/timing";
import { SkeletonPage } from "../components/Loader";
import { buildLatex, STAGE_STARTERS, applyStarter } from "../utils/latex";

/* ---------- LaTeX-faithful PDF (react-pdf mirrors resume.tex visually) ---------- */
const S = StyleSheet.create({
  page: { padding: "36 42", fontFamily: "Times-Roman", fontSize: 10.2, color: "#1a1a1a", lineHeight: 1.42 },
  name: { fontSize: 22, textAlign: "center", fontFamily: "Times-Bold", marginBottom: 3 },
  contacts: { fontSize: 9, textAlign: "center", color: "#444", marginBottom: 6 },
  rule: { borderBottomWidth: 1.2, borderBottomColor: "#222", marginBottom: 8 },
  sec: { fontSize: 11, fontFamily: "Times-Bold", textTransform: "uppercase", letterSpacing: 0.7, marginTop: 9, marginBottom: 3 },
  secRule: { borderBottomWidth: 1.8, borderBottomColor: "#d2d2d2", marginBottom: 6 },
  summary: { fontSize: 10, marginBottom: 4 },
  skillRow: { fontSize: 9.6, marginBottom: 2 },
  skillCat: { fontFamily: "Times-Bold" },
  projTitleRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 5, marginBottom: 1 },
  projTitle: { fontFamily: "Times-Bold", fontSize: 10.2 },
  projTech: { fontSize: 9.2, color: "#555", fontFamily: "Times-Italic" },
  gh: { fontSize: 8.5, color: "#2f5d50" },
  bullet: { flexDirection: "row", marginBottom: 1.2, paddingLeft: 10 },
  bulletMark: { width: 8, fontSize: 9 },
  bulletText: { flex: 1, fontSize: 9.5 },
  smallBullet: { flexDirection: "row", marginBottom: 1, paddingLeft: 8 },
  cert: { fontSize: 9.5, marginBottom: 1.5 },
  eduHead: { flexDirection: "row", justifyContent: "space-between" },
  eduSchool: { fontFamily: "Times-Bold", fontSize: 10 },
  eduMeta: { fontSize: 9.2, color: "#555" },
});

function ResumeDoc({ p }) {
  const sg = p.skillGroups;
  const hasGrouped = sg && Object.values(sg).some((v) => v?.length);
  return (
    <Document>
      <Page size="A4" style={S.page}>
        <Text style={S.name}>{p.fullName || "Your Name"}</Text>
        <Text style={S.contacts}>
          {[p.location, p.headline, ...(p.links || []).map((l) => `${l.label || "Link"}: ${l.url}`)].filter(Boolean).join("  |  ")}
        </Text>
        <View style={S.rule} />
        {!!p.summary && (
          <View>
            <Text style={S.sec}>Executive Summary</Text><View style={S.secRule} />
            <Text style={S.summary}>{p.summary}</Text>
          </View>
        )}
        {(hasGrouped || (p.skills || []).length) && (
          <View>
            <Text style={S.sec}>Skills</Text><View style={S.secRule} />
            {hasGrouped ? (
              <>
                {sg.languages?.length > 0 && <Text style={S.skillRow}><Text style={S.skillCat}>Languages: </Text>{sg.languages.join(", ")}</Text>}
                {sg.backend?.length > 0 && <Text style={S.skillRow}><Text style={S.skillCat}>Backend and Architecture: </Text>{sg.backend.join(", ")}</Text>}
                {sg.databases?.length > 0 && <Text style={S.skillRow}><Text style={S.skillCat}>Databases: </Text>{sg.databases.join(", ")}</Text>}
                {sg.devops?.length > 0 && <Text style={S.skillRow}><Text style={S.skillCat}>DevOps / Testing: </Text>{sg.devops.join(", ")}</Text>}
                {sg.tools?.length > 0 && <Text style={S.skillRow}><Text style={S.skillCat}>Tools and CI/CD Pipelines: </Text>{sg.tools.join(", ")}</Text>}
                {sg.concepts?.length > 0 && <Text style={S.skillRow}><Text style={S.skillCat}>Core Concepts: </Text>{sg.concepts.join(", ")}</Text>}
              </>
            ) : (
              <Text style={S.skillRow}>{(p.skills || []).join("  •  ")}</Text>
            )}
          </View>
        )}
        {(p.experience || []).length > 0 && (
          <View>
            <Text style={S.sec}>Experience</Text><View style={S.secRule} />
            {(p.experience || []).map((e, i) => (
              <View key={i} style={{ marginBottom: 4 }}>
                <View style={S.eduHead}>
                  <Text style={S.eduSchool}>{e.title}{e.company ? ` — ${e.company}` : ""}</Text>
                  <Text style={S.eduMeta}>{[e.start, e.end].filter(Boolean).join(" – ")}</Text>
                </View>
                {(e.bullets || []).map((b, j) => (
                  <View key={j} style={S.bullet}><Text style={S.bulletMark}>•</Text><Text style={S.bulletText}>{b}</Text></View>
                ))}
              </View>
            ))}
          </View>
        )}
        {(p.projects || []).length > 0 && (
          <View>
            <Text style={S.sec}>Projects</Text><View style={S.secRule} />
            {(p.projects || []).map((pr, i) => (
              <View key={i} style={{ marginBottom: 5 }}>
                <View style={S.projTitleRow}>
                  <Text style={S.projTitle}>{pr.title}{pr.tech ? ` | ${pr.tech}` : ""}</Text>
                  {!!pr.githubUrl && <Text style={S.gh}>GitHub</Text>}
                </View>
                {(pr.bullets || []).map((b, j) => (
                  <View key={j} style={S.bullet}><Text style={S.bulletMark}>•</Text><Text style={S.bulletText}>{b}</Text></View>
                ))}
              </View>
            ))}
          </View>
        )}
        {(p.achievements || []).length > 0 && (
          <View>
            <Text style={S.sec}>Achievements</Text><View style={S.secRule} />
            {(p.achievements || []).map((a, i) => (
              <View key={i} style={S.smallBullet}><Text style={S.bulletMark}>•</Text><Text style={S.bulletText}>{a}</Text></View>
            ))}
          </View>
        )}
        {(p.certifications || []).length > 0 && (
          <View>
            <Text style={S.sec}>Certifications</Text><View style={S.secRule} />
            {(p.certifications || []).map((c, i) => (
              <Text key={i} style={S.cert}>{c.title}{c.url ? " — Verify" : ""}</Text>
            ))}
          </View>
        )}
        {(p.education || []).length > 0 && (
          <View>
            <Text style={S.sec}>Education</Text><View style={S.secRule} />
            {(p.education || []).map((e, i) => (
              <View key={i} style={{ marginBottom: 3 }}>
                <View style={S.eduHead}>
                  <Text style={S.eduSchool}>{e.school}</Text><Text style={S.eduMeta}>{e.year}</Text>
                </View>
                {!!e.degree && <Text style={S.eduMeta}>{e.degree}</Text>}
              </View>
            ))}
          </View>
        )}
        {(p.links || []).length > 0 && (
          <View>
            <Text style={S.sec}>Links</Text><View style={S.secRule} />
            {(p.links || []).map((l, i) => (
              <Text key={i} style={{ fontSize: 9, color: "#333", marginBottom: 1 }}>{l.label ? `${l.label}: ` : ""}{l.url}</Text>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}

/* ---------- form helpers ---------- */
const blankExp = () => ({ title: "", company: "", start: "", end: "", bullets: "" });
const blankProject = () => ({ title: "", tech: "", githubUrl: "", bullets: "" });
const blankEdu = () => ({ school: "", degree: "", year: "" });
const blankLink = () => ({ label: "", url: "" });

function toForm(api) {
  const sg = api?.skillGroups || { languages: [], backend: [], databases: [], devops: [], tools: [], concepts: [] };
  return {
    fullName: api?.fullName ?? "",
    location: api?.location ?? "",
    headline: api?.headline ?? "",
    summary: api?.summary ?? "",
    skills: api?.skills ?? [],
    skillGroups: {
      languages: sg.languages || [], backend: sg.backend || [], databases: sg.databases || [],
      devops: sg.devops || [], tools: sg.tools || [], concepts: sg.concepts || [],
    },
    experience: (api?.experience?.length ? api.experience : []).map((e) => ({
      title: e.title ?? "", company: e.company ?? "", start: e.start ?? "", end: e.end ?? "",
      bullets: Array.isArray(e.bullets) ? e.bullets.join("\n") : "",
    })),
     projects: (Array.isArray(api?.projects) && api.projects.length ? api.projects : [blankProject()]).map((p) => ({
       title: p.title ?? "", tech: p.tech ?? "", githubUrl: p.githubUrl ?? "",
       bullets: Array.isArray(p.bullets) ? p.bullets.join("\n") : "",
     })),
     achievements: Array.isArray(api?.achievements) ? api.achievements.join("\n") : "",
     certifications: (Array.isArray(api?.certifications) && api.certifications.length ? api.certifications : [{ title: "", url: "" }]).map((c) => ({
       title: c.title ?? "", url: c.url ?? "",
     })),
     education: (Array.isArray(api?.education) && api.education.length ? api.education : [blankEdu()]).map((e) => ({
       school: e.school ?? "", degree: e.degree ?? "", year: e.year ?? "",
     })),
     links: (Array.isArray(api?.links) && api.links.length ? api.links : [blankLink()]).map((l) => ({
      label: l.label ?? "", url: l.url ?? "",
    })),
  };
}

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
     education: (form.education || []).filter((e) => e.school.trim() || e.degree.trim()).map((e) => ({
       school: e.school.trim(), degree: e.degree.trim(), year: e.year.trim() || null,
     })),
    links: form.links.filter((l) => l.url.trim()).map((l) => ({
      label: l.label.trim() || null, url: l.url.trim(),
    })),
    templateId: "latex",
  };
}

function toDocProps(form) {
  const p = toPayload({ ...form, fullName: form.fullName || "Your Name" });
  return {
    ...p,
    fullName: p.fullName ?? "Your Name",
    projects: p.projects.map((pr) => ({ ...pr, bullets: pr.bullets })),
  };
}

const CATEGORIES = [
  { id: "STUDENT", label: "Student", hint: "Education + projects first. Great for internships." },
  { id: "EARLY_CAREER", label: "Early career", hint: "Balance projects & first roles. ATS-friendly." },
  { id: "SENIOR", label: "Senior", hint: "Lead with impact, scale & leadership." },
];

export default function ResumeBuilder() {
  const [category, setCategory] = useState("EARLY_CAREER");
  const [mode, setMode] = useState("existing"); // existing | scratch
  const [form, setForm] = useState(null);
  const [skillInput, setSkillInput] = useState("");
  const [gapSkills, setGapSkills] = useState([]);
  const [existingSkills, setExistingSkills] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    setLoading(true);
    timed("builder-load", Promise.allSettled([getResumeProfile(), getSkillGaps()]))
      .then(([prof, gaps]) => {
        if (prof.status === "fulfilled") setForm(toForm(prof.value));
        else { setError(friendlyApiError(prof.reason, "Failed to load profile")); setForm(toForm(null)); }
        if (gaps.status === "fulfilled") {
          const g = gaps.value;
          setExistingSkills((g?.profileSkills || []).map((x) => x.skill));
          setGapSkills([...(g?.netGaps || []).map((x) => x.skill), ...(g?.trackSkills || []).map((x) => x.skill)].filter(Boolean));
          // default category from stage
          const st = g?.stage;
          if (st === "STUDENT" || st === "SENIOR" || st === "EARLY_CAREER") setCategory(st);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setSG = (key, val) => setForm((f) => ({ ...f, skillGroups: { ...f.skillGroups, [key]: val.split(",").map((s) => s.trim()).filter(Boolean) } }));
  const sgString = (arr) => (arr || []).join(", ");
  const setExp = (i, patch) => setForm((f) => ({ ...f, experience: f.experience.map((e, j) => j === i ? { ...e, ...patch } : e) }));
  const setProj = (i, patch) => setForm((f) => ({ ...f, projects: f.projects.map((p, j) => j === i ? { ...p, ...patch } : p) }));
  const setEdu = (i, patch) => setForm((f) => ({ ...f, education: f.education.map((e, j) => j === i ? { ...e, ...patch } : e) }));
  const setLink = (i, patch) => setForm((f) => ({ ...f, links: f.links.map((l, j) => j === i ? { ...l, ...patch } : l) }));
  const setCert = (i, patch) => setForm((f) => ({ ...f, certifications: f.certifications.map((c, j) => j === i ? { ...c, ...patch } : c) }));

  const handleApplyCategory = () => {
    const payload = toPayload(form);
    const withStarter = applyStarter(category, payload);
    // keep user's filled projects/experience if already present; otherwise starter only fills empty headline/summary/skillGroups
    setForm(toForm(withStarter));
    setApplied(true);
    setNotice(`${CATEGORIES.find((c) => c.id === category)?.label} starter applied — edit freely, then save.`);
    setTimeout(() => setNotice(""), 3500);
  };

  const handleUseExisting = () => {
    const toAdd = existingSkills.filter((s) => !form.skills.some((mine) => mine.toLowerCase() === s.toLowerCase()));
    if (!toAdd.length) { setNotice("All your tracked skills are already in the resume."); return; }
    set({ skills: [...form.skills, ...toAdd].slice(0, 60) });
    // also spread into skillGroups.languages as fallback if groups empty
    const hasGroups = Object.values(form.skillGroups).some((v) => v.length);
    if (!hasGroups && toAdd.length) {
      setForm((f) => ({ ...f, skillGroups: { ...f.skillGroups, languages: [...f.skillGroups.languages, ...toAdd].slice(0, 20) } }));
    }
    setNotice(`${toAdd.length} skill(s) from your profile added.`);
  };

  const handleClearScratch = () => {
    setForm(toForm({ fullName: form.fullName, location: "", headline: "", summary: "", skills: [], skillGroups: { languages: [], backend: [], databases: [], devops: [], tools: [], concepts: [] }, experience: [], projects: [blankProject()], achievements: [], certifications: [{ title: "", url: "" }], education: [blankEdu()], links: [blankLink()] }));
    setNotice("Started from scratch — your name is kept, everything else reset.");
  };

  const addFlatSkill = (raw) => {
    const v = (raw ?? "").trim().replace(/\s+/g, " ");
    if (!v) return;
    setForm((f) => f.skills.some((s) => s.toLowerCase() === v.toLowerCase()) ? f : { ...f, skills: [...f.skills, v].slice(0, 60) });
    setSkillInput("");
  };

  const handleSave = async () => {
    setSaving(true); setError(""); setNotice("");
    try { await timed("builder-save", saveResumeProfile(toPayload(form))); setNotice("Resume saved. Download .tex or PDF whenever you're ready."); }
    catch (err) { setError(friendlyApiError(err, "Could not save resume")); }
    finally { setSaving(false); }
  };

  const docProps = useMemo(() => (form ? toDocProps(form) : null), [form]);
  const latex = useMemo(() => (form ? buildLatex(toPayload(form)) : ""), [form]);
  const fileBase = `resume-${category.toLowerCase()}`;

  if (loading || !form) return <SkeletonPage />;
  const suggestions = gapSkills.filter((s) => !form.skills.some((mine) => mine.toLowerCase() === s.toLowerCase())).slice(0, 8);

  const downloadTex = () => {
    const blob = new Blob([latex], { type: "application/x-tex" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${fileBase}.tex`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page builder-page">
      <div className="page-header" style={{ flexWrap: "wrap" }}>
        <div>
          <h2>Resume Builder — LaTeX</h2>
          <p className="page-sub">Same template as <code>resume.tex</code> · choose your stage, start scratch or from your skills · no email/phone stored</p>
        </div>
        <div className="dash-actions" style={{ flexWrap: "wrap" }}>
          <button type="button" className="secondary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          <button type="button" className="secondary" onClick={downloadTex}>Download .tex</button>
          <PDFDownloadLink document={<ResumeDoc p={docProps} />} fileName={`${fileBase}.pdf`} className="button button-primary" style={{ textDecoration: "none" }}>
            {({ loading: pdfBusy }) => (pdfBusy ? "Preparing PDF…" : "Download PDF")}
          </PDFDownloadLink>
        </div>
      </div>
      {error && <p className="error" style={{ marginBottom: 12 }}>{error}</p>}
      {notice && <p className="notice" style={{ marginBottom: 12 }}>{notice}</p>}

      <div className="stat-card" style={{ marginBottom: 12 }}>
        <div className="builder-2col" style={{ gap: 12 }}>
          <div>
            <h4 style={{ margin: "0 0 6px", fontSize: 12, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Category</h4>
            <div className="segmented">
              {CATEGORIES.map((c) => (
                <button key={c.id} type="button" className={`seg-btn ${category === c.id ? "active" : ""}`} onClick={() => setCategory(c.id)} title={c.hint}>
                  {c.label}
                </button>
              ))}
            </div>
            <div className="page-sub" style={{ marginTop: 6 }}>{CATEGORIES.find((c) => c.id === category)?.hint}</div>
          </div>
          <div>
            <h4 style={{ margin: "0 0 6px", fontSize: 12, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Start from</h4>
            <div className="segmented">
              <button type="button" className={`seg-btn ${mode === "existing" ? "active" : ""}`} onClick={() => setMode("existing")}>Use existing skills</button>
              <button type="button" className={`seg-btn ${mode === "scratch" ? "active" : ""}`} onClick={() => setMode("scratch")}>Build from scratch</button>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button type="button" className="secondary" onClick={handleApplyCategory}>Apply {CATEGORIES.find((c) => c.id === category)?.label} starter</button>
              {mode === "existing" ? (
                <button type="button" className="secondary" onClick={handleUseExisting}>Pull {existingSkills.length} tracked skill(s)</button>
              ) : (
                <button type="button" className="ghost" onClick={handleClearScratch}>Clear to blank</button>
              )}
              {applied && <span className="page-sub" style={{ alignSelf: "center", color: "var(--good)", fontWeight: 700 }}>✓ starter applied</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="builder-grid">
        <div className="builder-form">
          <div className="stat-card">
            <h3>Heading</h3>
            <div className="field"><label>Name</label>
              <input value={form.fullName} maxLength={120} onChange={(e) => set({ fullName: e.target.value })} placeholder="Logesh Ramesh" />
            </div>
            <div className="builder-2col">
              <div className="field"><label>Location</label>
                <input value={form.location} maxLength={160} onChange={(e) => set({ location: e.target.value })} placeholder="Mayiladuthurai, Tamil Nadu" />
              </div>
              <div className="field"><label>Headline (under name)</label>
                <input value={form.headline} maxLength={120} onChange={(e) => set({ headline: e.target.value })} placeholder={STAGE_STARTERS[category].headline} />
              </div>
            </div>
            <div className="field"><label>Executive Summary</label>
              <textarea value={form.summary} rows={3} maxLength={4000} onChange={(e) => set({ summary: e.target.value })} placeholder={STAGE_STARTERS[category].summary} />
            </div>
            <div className="page-sub">Heading in PDF shows name, headline, location and links only — email/phone omitted for confidentiality.</div>
          </div>

          <div className="stat-card">
            <h3>Skills — grouped like resume.tex</h3>
            <div className="page-sub" style={{ marginBottom: 10 }}>Fills the SKILLS bullets verbatim. Also synced as flat chips for search.</div>
            {[
              ["Languages", "languages", "Java, Python, JavaScript"],
              ["Backend and Architecture", "backend", "Spring Boot, RESTful APIs"],
              ["Databases", "databases", "MySQL, MongoDB"],
              ["DevOps / Testing", "devops", "Docker, JUnit"],
              ["Tools and CI/CD", "tools", "Git, GitHub, Postman"],
              ["Core Concepts", "concepts", "OOP, Data Structures"],
            ].map(([label, key, ph]) => (
              <div key={key} className="field"><label>{label}</label>
                <input value={sgString(form.skillGroups[key])} onChange={(e) => setSG(key, e.target.value)} placeholder={ph} />
              </div>
            ))}
            <div className="field"><label>Additional flat skills (chips)</label>
              <div className="skill-add-row">
                <input value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFlatSkill(skillInput); } }} placeholder="Type a skill, press Enter" maxLength={120} />
                <button type="button" onClick={() => addFlatSkill(skillInput)}>Add</button>
              </div>
              {suggestions.length > 0 && (
                <div className="tag-list" style={{ marginBottom: 8 }}>
                  {suggestions.map((s) => (
                    <button key={s} type="button" className="tag warn tag-button" onClick={() => addFlatSkill(s)}>{s} +</button>
                  ))}
                </div>
              )}
              <div className="tag-list">
                {form.skills.map((s) => (
                  <span key={s} className="tag good">{s} <button type="button" className="tag-x" aria-label={`Remove ${s}`} onClick={() => set({ skills: form.skills.filter((x) => x !== s) })}>✕</button></span>
                ))}
                {form.skills.length === 0 && <span className="page-sub">Add above or use existing skills.</span>}
              </div>
            </div>
          </div>

          {category === "SENIOR" && (
            <div className="stat-card">
              <div className="section-title" style={{ marginTop: 0 }}>
                <h3 style={{ margin: 0 }}>Experience — senior focus</h3>
                <button type="button" className="secondary" onClick={() => set({ experience: [...form.experience, blankExp()] })}>+ Add role</button>
              </div>
              <p className="page-sub" style={{ marginBottom: 10 }}>Lead with impact, ownership and scale. Shown before Projects for senior.</p>
              {form.experience.length === 0 && <p className="page-sub">No roles yet — add your most recent first.</p>}
              {form.experience.map((e, i) => (
                <div key={i} className="builder-block">
                  <div className="builder-2col">
                    <div className="field"><label>Title</label><input value={e.title} onChange={(e2) => setExp(i, { title: e2.target.value })} placeholder="Senior Backend Engineer" /></div>
                    <div className="field"><label>Company</label><input value={e.company} onChange={(e2) => setExp(i, { company: e2.target.value })} placeholder="Acme" /></div>
                  </div>
                  <div className="builder-2col">
                    <div className="field"><label>Start</label><input value={e.start} onChange={(e2) => setExp(i, { start: e2.target.value })} placeholder="Jan 2022" /></div>
                    <div className="field"><label>End</label><input value={e.end} onChange={(e2) => setExp(i, { end: e2.target.value })} placeholder="Present" /></div>
                  </div>
                  <div className="field"><label>Highlights — one per line</label><textarea value={e.bullets} rows={3} onChange={(e2) => setExp(i, { bullets: e2.target.value })} placeholder={"Led X, improving latency 40%\nMentored …"} /></div>
                  {form.experience.length > 1 && <button type="button" className="ghost danger-text" onClick={() => set({ experience: form.experience.filter((_, j) => j !== i) })}>Remove role</button>}
                </div>
              ))}
            </div>
          )}

          <div className="stat-card">
            <div className="section-title" style={{ marginTop: 0 }}>
              <h3 style={{ margin: 0 }}>Projects</h3>
              <button type="button" className="secondary" onClick={() => set({ projects: [...form.projects, blankProject()] })}>+ Add project</button>
            </div>
            {form.projects.map((p, i) => (
              <div key={i} className="builder-block">
                <div className="field"><label>Title</label><input value={p.title} onChange={(e) => setProj(i, { title: e.target.value })} placeholder="Agent-Based System Hardening Tool" /></div>
                <div className="builder-2col">
                  <div className="field"><label>Tech stack</label><input value={p.tech} onChange={(e) => setProj(i, { tech: e.target.value })} placeholder="Spring Boot, MySQL, Python" /></div>
                  <div className="field"><label>GitHub URL</label><input value={p.githubUrl} onChange={(e) => setProj(i, { githubUrl: e.target.value })} placeholder="https://github.com/you/repo" /></div>
                </div>
                <div className="field"><label>Bullets — one per line (use % and numbers like resume.tex)</label><textarea value={p.bullets} rows={3} onChange={(e) => setProj(i, { bullets: e.target.value })} placeholder={"Automated security config across Windows/Linux, reducing effort ~60%\nBuilt agents executing 30+ checks…"} /></div>
                {form.projects.length > 1 && <button type="button" className="ghost danger-text" onClick={() => set({ projects: form.projects.filter((_, j) => j !== i) })}>Remove project</button>}
              </div>
            ))}
          </div>

          {category !== "SENIOR" && form.experience.length > 0 && (
            <div className="stat-card">
              <div className="section-title" style={{ marginTop: 0 }}>
                <h3 style={{ margin: 0 }}>Experience</h3>
                <button type="button" className="secondary" onClick={() => set({ experience: [...form.experience, blankExp()] })}>+ Add role</button>
              </div>
              {form.experience.map((e, i) => (
                <div key={i} className="builder-block">
                  <div className="builder-2col">
                    <div className="field"><label>Title</label><input value={e.title} onChange={(e2) => setExp(i, { title: e2.target.value })} placeholder="Software Engineer" /></div>
                    <div className="field"><label>Company</label><input value={e.company} onChange={(e2) => setExp(i, { company: e2.target.value })} placeholder="Acme Corp" /></div>
                  </div>
                  <div className="builder-2col">
                    <div className="field"><label>Start</label><input value={e.start} onChange={(e2) => setExp(i, { start: e2.target.value })} placeholder="Jan 2023" /></div>
                    <div className="field"><label>End</label><input value={e.end} onChange={(e2) => setExp(i, { end: e2.target.value })} placeholder="Present" /></div>
                  </div>
                  <div className="field"><label>Highlights</label><textarea value={e.bullets} rows={3} onChange={(e2) => setExp(i, { bullets: e2.target.value })} /></div>
                  <button type="button" className="ghost danger-text" onClick={() => set({ experience: form.experience.filter((_, j) => j !== i) })}>Remove</button>
                </div>
              ))}
            </div>
          )}
          {category !== "SENIOR" && form.experience.length === 0 && (
            <button type="button" className="ghost" onClick={() => set({ experience: [blankExp()] })} style={{ alignSelf: "flex-start" }}>+ Add experience (optional for {category.toLowerCase()})</button>
          )}

          <div className="stat-card">
            <h3>Achievements</h3>
            <div className="field"><label>One per line</label>
              <textarea value={form.achievements} rows={2} onChange={(e) => set({ achievements: e.target.value })} placeholder="SIH 2025 Finalist — Team Lead: top 5% nationwide" />
            </div>
          </div>

          <div className="stat-card">
            <div className="section-title" style={{ marginTop: 0 }}>
              <h3 style={{ margin: 0 }}>Certifications</h3>
              <button type="button" className="secondary" onClick={() => set({ certifications: [...form.certifications, { title: "", url: "" }] })}>+ Add</button>
            </div>
            {form.certifications.map((c, i) => (
              <div key={i} className="builder-2col">
                <div className="field"><label>Title</label><input value={c.title} onChange={(e) => setCert(i, { title: e.target.value })} placeholder="OOP in Java — Coursera" /></div>
                <div className="field"><label>Verify URL</label><input value={c.url} onChange={(e) => setCert(i, { url: e.target.value })} placeholder="https://coursera.org/verify/…" /></div>
              </div>
            ))}
          </div>

          <div className="stat-card">
            <div className="section-title" style={{ marginTop: 0 }}>
              <h3 style={{ margin: 0 }}>Education</h3>
              <button type="button" className="secondary" onClick={() => set({ education: [...form.education, blankEdu()] })}>+ Add</button>
            </div>
            {form.education.map((e, i) => (
              <div key={i} className="builder-block">
<div className="field"><label>School</label><input value={e.school} onChange={(e2) => setEdu(i, { school: e2.target.value })} placeholder="A.V.C College of Engineering" /></div>
                   <div className="builder-2col">
                     <div className="field"><label>Degree</label><input value={e.degree} onChange={(e2) => setEdu(i, { degree: e2.target.value })} placeholder="B.Tech in IT" /></div>
                     <div className="field"><label>Year</label><input value={e.year} onChange={(e2) => setEdu(i, { year: e2.target.value })} placeholder="Sept 2023 -- Present" /></div>
                </div>
                {form.education.length > 1 && <button type="button" className="ghost danger-text" onClick={() => set({ education: form.education.filter((_, j) => j !== i) })}>Remove</button>}
              </div>
            ))}
          </div>

          <div className="stat-card">
            <div className="section-title" style={{ marginTop: 0 }}>
              <h3 style={{ margin: 0 }}>Links</h3>
              <button type="button" className="secondary" onClick={() => set({ links: [...form.links, blankLink()] })}>+ Add</button>
            </div>
            {form.links.map((l, i) => (
              <div key={i} className="builder-2col">
                <div className="field"><label>Label</label><input value={l.label} onChange={(e) => setLink(i, { label: e.target.value })} placeholder="GitHub" /></div>
                <div className="field"><label>URL</label><input value={l.url} onChange={(e) => setLink(i, { url: e.target.value })} placeholder="https://github.com/you" /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="builder-preview">
          <div className="resume-paper">
            <div className="rp-name">{form.fullName || "Your Name"}</div>
            <div className="rp-contacts">{[form.location, form.headline, ...form.links.filter((l) => l.url.trim()).map((l) => `${l.label || "Link"}: ${l.url}`)].filter(Boolean).join("  |  ") || "Links and headline appear here"}</div>
            <div className="rp-rule" />
            {!!form.summary && (<><div className="rp-sec">Executive Summary</div><p>{form.summary}</p></>)}
            {(Object.values(form.skillGroups).some((v) => v.length) || form.skills.length) && (
              <><div className="rp-sec">Skills</div>
                {Object.entries({ Languages: form.skillGroups.languages, "Backend and Architecture": form.skillGroups.backend, Databases: form.skillGroups.databases, "DevOps / Testing": form.skillGroups.devops, "Tools and CI/CD Pipelines": form.skillGroups.tools, "Core Concepts": form.skillGroups.concepts }).filter(([, v]) => v.length).map(([k, v]) => (
                  <div key={k} className="rp-skill-row"><strong>{k}:</strong> {v.join(", ")}</div>
                ))}
                {form.skills.length > 0 && !Object.values(form.skillGroups).some((v) => v.length) && <p>{form.skills.join("  •  ")}</p>}
              </>
            )}
            {form.experience.some((e) => e.title.trim() || e.company.trim()) && (
              <><div className="rp-sec">Experience</div>
                {form.experience.filter((e) => e.title.trim() || e.company.trim()).map((e, i) => (
                  <div key={i} className="rp-block">
                    <div className="rp-row"><strong>{e.title}{e.company ? ` — ${e.company}` : ""}</strong><span>{[e.start, e.end].filter(Boolean).join(" – ")}</span></div>
                    <ul>{e.bullets.split("\n").map((b) => b.trim()).filter(Boolean).map((b, j) => <li key={j}>{b}</li>)}</ul>
                  </div>
                ))}
              </>
            )}
            {form.projects.some((p) => p.title.trim()) && (
              <><div className="rp-sec">Projects</div>
                {form.projects.filter((p) => p.title.trim()).map((p, i) => (
                  <div key={i} className="rp-block">
                    <div className="rp-row"><strong>{p.title}{p.tech ? ` | ${p.tech}` : ""}</strong>{p.githubUrl ? <span>GitHub</span> : null}</div>
                    <ul>{p.bullets.split("\n").map((b) => b.trim()).filter(Boolean).map((b, j) => <li key={j}>{b}</li>)}</ul>
                  </div>
                ))}
              </>
            )}
            {form.achievements.split("\n").some((s) => s.trim()) && (
              <><div className="rp-sec">Achievements</div>
                <ul>{form.achievements.split("\n").map((s) => s.trim()).filter(Boolean).map((a, i) => <li key={i}>{a}</li>)}</ul>
              </>
            )}
            {form.certifications.some((c) => c.title.trim()) && (
              <><div className="rp-sec">Certifications</div>
                <ul>{form.certifications.filter((c) => c.title.trim()).map((c, i) => <li key={i}>{c.title}{c.url ? " — Verify" : ""}</li>)}</ul>
              </>
            )}
            {form.education.some((e) => e.school.trim() || e.degree.trim()) && (
              <><div className="rp-sec">Education</div>
                {form.education.filter((e) => e.school.trim() || e.degree.trim()).map((e, i) => (
                  <div key={i} className="rp-row"><span><strong>{e.school}</strong>{e.degree ? ` — ${e.degree}` : ""}</span><span>{e.year}</span></div>
                ))}
              </>
            )}
          </div>
          <p className="page-sub" style={{ textAlign: "center" }}>
            Live preview — PDF mirrors this exactly. <Link to="/profile">Profile</Link>
          </p>
          <details style={{ marginTop: 10 }}>
            <summary className="page-sub" style={{ cursor: "pointer", fontWeight: 700 }}>Show LaTeX source (resume.tex)</summary>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 11, maxHeight: 320, overflow: "auto" }}>{latex}</pre>
          </details>
        </div>
      </div>
    </div>
  );
}
