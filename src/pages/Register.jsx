import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Spinner } from "../components/Loader";
import { warmBackend, friendlyApiError } from "../api/client";
import { getDashboard } from "../api/dashboard";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const MIN_PASSWORD_LENGTH = 8; // must match backend's AuthService rule

  useEffect(() => {
    warmBackend();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Trim before validating/sending so "  " doesn't pass as a real name
    // and so we don't round-trip to the server for something we can
    // catch instantly on the client.
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setError("Name is required");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    setLoading(true);
    try {
      await register(trimmedName, trimmedEmail, password);
      // Start the dashboard request during navigation (see Login.jsx).
      getDashboard().catch(() => {});
      navigate("/dashboard");
    } catch (err) {
      setError(friendlyApiError(err, "Registration failed"));
    } finally {
      setLoading(false);
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
          <p className="auth-kicker">CAREERLIFE / GET STARTED</p>
        <h2>Create account</h2>
        <p>Start tracking your interviews and resumes</p>
        {error && <p className="error">{error}</p>}
        <div className="field">
          <label>Name</label>
          <input type="text" placeholder="Jane Doe" value={name}
            onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" placeholder="you@example.com" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" placeholder="Enter your password" value={password}
            onChange={(e) => setPassword(e.target.value)} required minLength={MIN_PASSWORD_LENGTH} />
        </div>
        <button type="submit" disabled={loading} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {loading && <Spinner />} {loading ? "Creating" : "Register"}
        </button>
        <p>Already have an account? <Link to="/login">Login</Link></p>
        </form>
      </div>
    </div>
  );
}
