import { useState, type FormEvent } from "react";
import { LockKeyhole, ShieldCheck, UserPlus } from "lucide-react";
import { PhotoPanel, fintelPhotos } from "@/components/fintel/PhotoPanel";

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "register" && password !== confirmPassword) {
        throw new Error("Those passwords don't match. Please check them and try again.");
      }
      const response = await fetch(mode === "register" ? "/api/auth/local/register" : "/api/auth/local/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
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
          <a href="/" className="login-back">Back to FINTEL</a>
          <div className="login-brand"><span className="brand-mark">FI</span><span><b>FINTEL</b><small>KENYA FINANCIAL INTELLIGENCE</small></span></div>
          <p className="eyebrow">{mode === "register" ? "A GOOD PLACE TO START" : "WELCOME BACK"}</p>
          <h1>{mode === "register" ? "Make room for better questions." : "Good to have you back."}</h1>
          <p className="login-intro">{mode === "register" ? "Create a free FINTEL account and start exploring Kenya's markets, research and learning resources." : "Sign in to pick up where you left off and continue exploring Kenya's markets."}</p>
          <form onSubmit={submit} className="login-form">
            {mode === "register" && <label>Your name<input type="text" autoComplete="name" value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={80} placeholder="How should we address you?"/></label>}
            <label>Email address<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} placeholder="you@example.com"/></label>
            <label>Password<input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} required minLength={mode === "register" ? 12 : 1} maxLength={128} placeholder={mode === "register" ? "At least 12 characters" : "Enter your password"}/></label>
            {mode === "register" && <label>Confirm password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required minLength={12} maxLength={128} placeholder="Enter your password again"/></label>}
            {error && <div className="login-error" role="alert">{error}</div>}
            <button type="submit" disabled={loading}>{loading ? (mode === "register" ? "Creating your account…" : "Signing you in…") : mode === "register" ? <><UserPlus size={15}/> Create account</> : <><LockKeyhole size={15}/> Sign in</>}</button>
          </form>
          <p className="login-mode-switch">
            {mode === "register" ? "Already have an account?" : "New to FINTEL?"}
            {" "}
            <button type="button" onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(null); }}>
              {mode === "register" ? "Sign in" : "Create an account"}
            </button>
          </p>
          <div className="login-reassurance"><ShieldCheck size={16}/><span>Your password is protected with a one-way password hash. FINTEL will never ask you to share it.</span></div>
          <div className="login-legal"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/security">Security</a></div>
        </section>
        <aside className="login-story"><PhotoPanel photo={fintelPhotos.nairobiGoldenHour} className="login-photo"/><div><p className="eyebrow">A CLEARER VIEW OF KENYA'S MARKETS</p><h2>Bring the information together. Make your next question a better one.</h2><p>FINTEL helps you explore public market observations, quantitative tools and research in one place.</p></div></aside>
      </div>
    </main>
  );
}
