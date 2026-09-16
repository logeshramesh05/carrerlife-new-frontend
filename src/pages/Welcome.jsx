import { useEffect } from "react";
import { Link } from "react-router-dom";
import { warmBackend } from "../api/client";

const notes = [
  ["01", "Keep your work together", "Save resumes, interview sessions and useful feedback in one quiet workspace."],
  ["02", "Practice with purpose", "Run focused interview sessions and review the parts that need another pass."],
  ["03", "Make the next move", "Turn your results into a small, practical plan instead of another pile of advice."],
];

export default function Welcome() {
  useEffect(() => {
    warmBackend();
  }, []);
  return (
    <main className="welcome">
      <section className="welcome-hero">
        <div className="welcome-copy">
          <p className="eyebrow"><span className="eyebrow-mark" /> CAREERLIFE / WORKSPACE</p>
          <h1>A calmer place to<br /><em>build your career.</em></h1>
          <p className="welcome-lede">
            CareerLife brings your resume work, interview practice and progress into one
            straightforward workspace — made for doing, not scrolling.
          </p>
          <div className="welcome-actions">
            <Link className="button button-primary" to="/register">Create your workspace <span>→</span></Link>
            <Link className="text-link" to="/login">I already have an account</Link>
          </div>
        </div>

        <div className="welcome-note">
          <div className="note-top"><span>CAREER NOTEBOOK</span><span>01 / 03</span></div>
          <div className="note-rule" />
          <p className="note-kicker">TODAY'S FOCUS</p>
          <h2>Prepare one thing<br />properly.</h2>
          <p>Choose a resume, start an interview, or look back at your recent work.</p>
          <div className="note-lines">
            <div><span>Resume</span><b>Review</b></div>
            <div><span>Interview</span><b>Practice</b></div>
            <div><span>Progress</span><b>Reflect</b></div>
          </div>
          <div className="note-footer">A little progress, consistently.</div>
        </div>
      </section>

      <section className="welcome-strip">
        <p>BUILT AROUND YOUR ACTUAL WORK</p>
        <div className="welcome-line" />
        <span>No noise. No magic promises. Just useful tools.</span>
      </section>

      <section className="welcome-notes">
        {notes.map(([number, title, body]) => (
          <article className="welcome-note-card" key={number}>
            <span className="note-number">{number}</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <footer className="welcome-footer">
        <span>CareerLife</span>
        <span>Make the next step a little clearer.</span>
      </footer>
    </main>
  );
}
