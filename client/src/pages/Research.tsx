import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, Database, FileSearch, Plus, Send, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const modes = ["MARKET", "QUANT", "RISK", "FIXED INCOME", "MACRO", "PORTFOLIO", "ACADEMIC", "GENERAL FINANCE"] as const;

type Evidence = { type: string; title: string; detail: string; observationDate?: string | null; sourceUrl?: string | null; status?: string };

export default function Research() {
  const [mode, setMode] = useState<(typeof modes)[number]>("MARKET");
  const [question, setQuestion] = useState("");
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [answer, setAnswer] = useState("");
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [status, setStatus] = useState("READY");

  const sessions = trpc.research.sessions.useQuery();
  const session = trpc.research.session.useQuery({ sessionId: sessionId! }, { enabled: Boolean(sessionId) });
  const ask = trpc.research.ask.useMutation({
    onSuccess: result => { setSessionId(result.sessionId); setAnswer(result.answer); setEvidence(result.evidence); setStatus(result.status); sessions.refetch(); session.refetch(); },
    onError: error => { setStatus("ERROR"); setAnswer(error.message); },
  });
  const create = trpc.research.create.useMutation({ onSuccess: result => { setSessionId(result.id); setAnswer(""); setEvidence([]); sessions.refetch(); } });
  const remove = trpc.research.delete.useMutation({ onSuccess: () => { setSessionId(undefined); setAnswer(""); setEvidence([]); sessions.refetch(); } });

  useEffect(() => {
    if (!session.data?.messages?.length) return;
    const last = [...session.data.messages].reverse().find(m => m.role === "assistant");
    if (last) { setAnswer(last.content); setEvidence((last.evidenceJson as Evidence[] | null) ?? []); setStatus(last.status); }
  }, [session.data]);

  const statusClass = useMemo(() => status === "CURRENT" ? "text-emerald-300" : status === "ERROR" ? "text-rose-300" : "text-amber-300", [status]);

  function startNew() { create.mutate({ title: "New FINTEL Research", mode }); }
  function submit() { if (!question.trim()) return; ask.mutate({ sessionId, question, mode }); setQuestion(""); }

  return <div className="min-h-screen bg-[#07090d] text-slate-200">
    <header className="sticky top-0 z-20 border-b border-white/[.07] bg-[#07090d]/95 px-5 py-4 backdrop-blur sm:px-8">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
        <div><div className="eyebrow text-emerald-300">FINTEL AI · RESEARCH INTELLIGENCE</div><h1 className="mt-1 text-xl font-semibold text-white">Kenya Financial Research Workspace</h1></div>
        <div className="flex items-center gap-2"><Badge variant="outline" className="border-emerald-400/20 text-emerald-300"><ShieldCheck size={12} className="mr-1"/> Authorized research</Badge><Button size="sm" onClick={startNew}><Plus size={15}/> New Research</Button></div>
      </div>
    </header>
    <main className="mx-auto grid max-w-[1500px] gap-4 p-5 sm:p-8 lg:grid-cols-[250px_minmax(0,1fr)_330px]">
      <aside className="terminal-card p-4"><div className="eyebrow">RESEARCH HISTORY</div><div className="mt-3 space-y-2">{sessions.data?.map(s => <button key={s.id} onClick={() => { setSessionId(s.id); setMode(s.mode as any); }} className={`w-full rounded-lg border p-3 text-left ${sessionId === s.id ? "border-emerald-400/30 bg-emerald-400/[.06]" : "border-white/[.06] bg-white/[.02]"}`}><div className="truncate text-xs font-medium text-slate-200">{s.title}</div><div className="mt-1 text-[10px] text-slate-500">{s.mode} · {s.status}</div></button>)}{!sessions.data?.length && <div className="py-8 text-center text-xs text-slate-600">No saved research yet.</div>}</div>{sessionId && <Button variant="ghost" size="sm" className="mt-3 w-full text-rose-300" onClick={() => remove.mutate({ sessionId })}><Trash2 size={14}/> Delete research</Button>}</aside>
      <section className="terminal-card flex min-h-[680px] flex-col overflow-hidden">
        <div className="border-b border-white/[.07] p-5"><div className="flex flex-wrap gap-2">{modes.map(m => <button key={m} onClick={() => setMode(m)} className={`rounded-md border px-3 py-1.5 text-[10px] tracking-wide ${mode === m ? "border-emerald-400/30 bg-emerald-400/[.08] text-emerald-300" : "border-white/[.06] text-slate-500"}`}>{m}</button>)}</div></div>
        <div className="flex-1 space-y-5 overflow-y-auto p-5"><div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[.025] p-5"><div className="flex items-center gap-2 text-xs font-medium text-emerald-300"><BrainCircuit size={16}/> FINTEL AI</div><p className="mt-2 text-sm leading-6 text-slate-400">Ask questions using FINTEL's Kenyan market data, quantitative engine and research evidence. Missing data is reported rather than invented.</p></div>{answer && <article className="rounded-xl border border-white/[.07] bg-white/[.02] p-5"><div className="flex items-center justify-between"><div className="eyebrow">RESEARCH ANSWER</div><span className={`text-[10px] ${statusClass}`}>{status}</span></div><div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-200">{answer}</div></article>}</div>
        <div className="border-t border-white/[.07] p-4"><Textarea value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit(); }} placeholder={`Ask FINTEL about ${mode.toLowerCase()}...`} className="min-h-[110px] border-white/[.08] bg-white/[.02]"/><div className="mt-3 flex items-center justify-between"><span className="text-[10px] text-slate-600">Ctrl/Cmd + Enter to research</span><Button onClick={submit} disabled={ask.isPending || !question.trim()}>{ask.isPending ? <Sparkles className="animate-pulse" size={15}/> : <Send size={15}/>} {ask.isPending ? "Researching…" : "Research"}</Button></div></div>
      </section>
      <aside className="space-y-4"><section className="terminal-card p-4"><div className="flex items-center gap-2"><Database size={15} className="text-emerald-300"/><div className="eyebrow">FINTEL EVIDENCE</div></div><div className="mt-4 space-y-3">{evidence.map((e,i) => <div key={i} className="rounded-lg border border-white/[.06] bg-white/[.02] p-3"><div className="text-[10px] uppercase tracking-wider text-emerald-300">{e.type}</div><div className="mt-1 text-xs font-medium text-slate-200">{e.title}</div><div className="mt-1 text-[11px] leading-5 text-slate-500">{e.detail}</div>{e.observationDate && <div className="mt-2 text-[10px] text-slate-600">Observed: {new Date(e.observationDate).toLocaleString()}</div>}</div>)}{!evidence.length && <div className="py-8 text-center text-xs text-slate-600">Evidence will appear here after a research query.</div>}</div></section><section className="terminal-card p-4"><div className="flex items-center gap-2"><FileSearch size={15} className="text-sky-300"/><div className="eyebrow">RESEARCH POLICY</div></div><ul className="mt-3 space-y-2 text-[11px] leading-5 text-slate-500"><li>• FINTEL data is separated from AI interpretation.</li><li>• Quantitative results remain under the quant engine.</li><li>• No private portfolio data crosses authorization boundaries.</li><li>• Missing data is surfaced as DATA REQUIRED.</li><li>• External sources are not fabricated.</li></ul></section></aside>
    </main>
  </div>;
}
