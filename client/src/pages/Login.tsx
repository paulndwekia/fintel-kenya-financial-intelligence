import { useState, type FormEvent } from "react";

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
        body: JSON.stringify({ email, password }),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body?.error ?? "Login failed");
      }

      window.location.assign("/");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#07090d] text-slate-100 flex items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-white/[.08] bg-[#0b0e13] p-8">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-400/10 text-xl font-semibold text-emerald-300">FI</div>
          <div className="mt-4 text-xs tracking-[.28em] text-emerald-300">FINTEL</div>
          <h1 className="mt-2 text-2xl font-semibold">Kenya Financial Intelligence</h1>
          <p className="mt-2 text-sm text-slate-500">Administrator sign in</p>
        </div>

        <label className="mt-7 block text-xs uppercase tracking-[.14em] text-slate-500">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-2 w-full rounded-lg border border-white/[.08] bg-white/[.02] px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/50"
          />
        </label>

        <label className="mt-5 block text-xs uppercase tracking-[.14em] text-slate-500">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-2 w-full rounded-lg border border-white/[.08] bg-white/[.02] px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/50"
          />
        </label>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-400/20 bg-rose-400/[.05] px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-emerald-400 px-4 py-3 text-sm font-semibold text-black hover:bg-emerald-300 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in to FINTEL"}
        </button>
      </form>
    </main>
  );
}
