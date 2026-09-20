import { useState } from "react";
import { startLogin } from "@/const";

export default function Login() {
  const [loading, setLoading] = useState(false);

  const login = () => {
    setLoading(true);
    startLogin();
  };

  return (
    <div className="min-h-screen bg-[#07090d] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/[.08] bg-[#0b0e13] p-8 shadow-2xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-xl font-semibold text-emerald-300">
          FI
        </div>

        <div className="text-center">
          <div className="text-xs tracking-[.28em] text-emerald-300">
            FINTEL
          </div>

          <h1 className="mt-3 text-2xl font-semibold">
            Kenya Financial Intelligence
          </h1>

          <p className="mt-3 text-sm text-slate-500">
            Secure access to your FINTEL workspace
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={login}
          className="mt-8 w-full rounded-lg bg-emerald-400 px-4 py-3 text-sm font-semibold text-black hover:bg-emerald-300 disabled:opacity-50"
        >
          {loading ? "Opening secure sign-in..." : "Sign in to FINTEL"}
        </button>

        <p className="mt-5 text-center text-[11px] text-slate-600">
          Authentication is handled through FINTEL's configured secure
          authentication provider.
        </p>
      </div>
    </div>
  );
}
