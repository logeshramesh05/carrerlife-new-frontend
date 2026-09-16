import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Spinner } from "../components/Loader";
import { warmBackend, friendlyApiError } from "../api/client";
import { getDashboard } from "../api/dashboard";
import { timed } from "../utils/timing";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const abortRef = useRef(null);

  useEffect(() => {
    warmBackend();
    return () => abortRef.current?.abort();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Email is required");
      return;
    }
    setError("");
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await timed("login", login(trimmedEmail, password));
      if (controller.signal.aborted) return;
      // Fire the dashboard request NOW so it runs during navigation —
      // Dashboard mounts onto the same in-flight request instead of
      // starting cold after the route renders.
      getDashboard().catch(() => {});
      navigate("/dashboard");
    } catch (err) {
      if (err?.code === "ERR_CANCELED" || controller.signal.aborted) return;
      setError(friendlyApiError(err, "Login failed"));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <section className="auth-welcome">
          <div className="auth-welcome-top"><span>CareerLife</span></div>
          <div className="auth-welcome-copy">
            <p className="eyebrow"><span className="eyebrow-mark" /> YOUR CAREER WORKSPACE</p>
            <h1>Build your career,<br /><em>one step at a time.</em></h1>
            <p>Keep your resume work, interview practice and progress together in a focused space designed for real work.</p>
            <div className="auth-mini-list">
              <div className="auth-mini"><b>01 · Resume</b>Keep your work ready.</div>
              <div className="auth-mini"><b>02 · Practice</b>Prepare with purpose.</div>
              <div className="auth-mini"><b>03 · Progress</b>See what comes next.</div>
            </div>
          </div>
          <div className="auth-welcome-footer">A little progress, consistently.</div>
        </section>
        <form onSubmit={handleSubmit} className="auth-form">
          <p className="auth-kicker">CAREERLIFE / SIGN IN</p>
        <h2>Welcome back</h2>
        <p>Sign in to continue your career journey</p>
        {error && <p className="error">{error}</p>}
        <div className="field">
          <label>Email</label>
          <input type="email" placeholder="you@example.com" value={email}
            onChange={(e) => setEmail(e.target.value)} required autoFocus disabled={loading} autoComplete="email" />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" placeholder="••••••••" value={password}
            onChange={(e) => setPassword(e.target.value)} required disabled={loading} autoComplete="current-password" />
        </div>
        <button type="submit" disabled={loading} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {loading && <Spinner />} {loading ? "Signing in" : "Login"}
        </button>
        <p>No account? <Link to="/register">Register</Link></p>
        </form>
      </div>
    </div>
  );
}
