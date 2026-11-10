import { useState, type FormEvent } from "react";
import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import { PhotoPanel, fintelPhotos } from "@/components/fintel/PhotoPanel";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/local/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error ?? "We couldn't sign you in. Check your details and try again.");
      window.location.assign("/");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "We couldn't sign you in just now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-shell">
        <section className="login-panel">
          <a href="/" className="login-back"><ArrowLeft size={14}/> Back to FINTEL</a>
          <div className="login-brand"><span className="brand-mark">FI</span><span><b>FINTEL</b><small>KENYA FINANCIAL INTELLIGENCE</small></span></div>
          <p className="eyebrow">WELCOME BACK</p>
          <h1>Your workspace is waiting.</h1>
          <p className="login-intro">Sign in to return to your saved research and the portfolios you are authorised to manage.</p>
          <form onSubmit={submit} className="login-form">
            <label>Email address<input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required placeholder="you@example.com"/></label>
            <label>Password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required placeholder="Enter your password"/></label>
            {error && <div className="login-error" role="alert">{error}</div>}
            <button type="submit" disabled={loading}>{loading ? "Signing you in…" : <><LockKeyhole size={15}/> Sign in securely</>}</button>
          </form>
          <div className="login-reassurance"><ShieldCheck size={16}/><span>Your sign-in is handled over a protected session. Never share your password or one-time codes.</span></div>
          <div className="login-legal"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/security">Security</a></div>
        </section>
        <aside className="login-story"><PhotoPanel photo={fintelPhotos.nairobiGoldenHour} className="login-photo"/><div><p className="eyebrow">A CLEARER VIEW OF KENYA'S MARKETS</p><h2>Bring the information together. Make your next question a better one.</h2><p>FINTEL helps you explore public market observations, quantitative tools and research in one place.</p></div></aside>
      </div>
    </main>
  );
}
