import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowUpRight, BrainCircuit, Database, FileSearch, Plus, Send, ShieldCheck, Sparkles, Trash2, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/_core/hooks/useAuth";
import { PhotoPanel, fintelPhotos } from "@/components/fintel/PhotoPanel";
import { SpotlightCard } from "@/components/fintel/SpotlightCard";

const modes = ["MARKET", "QUANT", "RISK", "FIXED INCOME", "MACRO", "PORTFOLIO", "ACADEMIC", "GENERAL FINANCE"] as const;
type Mode = (typeof modes)[number];
type Evidence = { type: string; title: string; detail: string; observationDate?: string | null; sourceUrl?: string | null; status?: string };

const examples: { mode: Mode; question: string }[] = [
  { mode: "MARKET", question: "What are the latest CBK FX observations, and when were they recorded?" },
  { mode: "FIXED INCOME", question: "Explain the latest Treasury Bill auction observations in plain language." },
  { mode: "QUANT", question: "Explain how duration and DV01 help me understand bond price sensitivity." },
  { mode: "RISK", question: "What information is needed before a portfolio VaR calculation can run?" },
];

function humanError(message: string) {
  if (/unauthorized|forbidden|login|auth/i.test(message)) return "Please sign in with an account that has permission to use the research desk.";
  if (/provider|api key|configuration|not configured/i.test(message)) return "The research assistant is not fully configured on the server yet. You can still explore the market and model workspaces while that is being set up.";
  return message || "We couldn't complete that research request. Please try again.";
}

export default function Research() {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("MARKET");
  const [question, setQuestion] = useState("");
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [answer, setAnswer] = useState("");
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [status, setStatus] = useState("READY");
  const [showHistory, setShowHistory] = useState(true);

  const sessions = trpc.research.sessions.useQuery(undefined, { enabled: Boolean(user) });
  const session = trpc.research.session.useQuery({ sessionId: sessionId! }, { enabled: Boolean(user && sessionId) });
  const ask = trpc.research.ask.useMutation({
    onSuccess: result => { setSessionId(result.sessionId); setAnswer(result.answer); setEvidence(result.evidence); setStatus(result.status); sessions.refetch(); },
    onError: error => { setStatus("NEEDS ATTENTION"); setAnswer(humanError(error.message)); setEvidence([]); },
  });
  const create = trpc.research.create.useMutation({
    onSuccess: result => { setSessionId(result.id); setAnswer(""); setEvidence([]); setStatus("READY"); sessions.refetch(); },
    onError: error => { setStatus("NEEDS ATTENTION"); setAnswer(humanError(error.message)); },
  });
  const remove = trpc.research.delete.useMutation({
    onSuccess: () => { setSessionId(undefined); setAnswer(""); setEvidence([]); setStatus("READY"); sessions.refetch(); },
    onError: error => setAnswer(humanError(error.message)),
  });

  useEffect(() => {
    if (!session.data?.messages?.length) return;
    const last = [...session.data.messages].reverse().find(message => message.role === "assistant");
    if (last) { setAnswer(last.content); setEvidence((last.evidenceJson as Evidence[] | null) ?? []); setStatus(last.status); }
  }, [session.data]);

  const statusClass = useMemo(() => status === "CURRENT" ? "research-status research-status--good" : status === "NEEDS ATTENTION" || status === "ERROR" ? "research-status research-status--warn" : "research-status", [status]);

  function startNew() {
    setAnswer("");
    setEvidence([]);
    create.mutate({ title: "FINTEL research session", mode });
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!question.trim()) return;
    ask.mutate({ sessionId, question: question.trim(), mode });
  }

  function useExample(example: { mode: Mode; question: string }) {
    setMode(example.mode);
    setQuestion(example.question);
  }

  if (loading) return <main className="research-page"><div className="research-loading">Opening your research workspace…</div></main>;
  if (!user) return <main className="research-page"><div className="research-auth"><span className="brand-mark">FI</span><p className="eyebrow">FINTEL RESEARCH DESK</p><h1>Your research stays with your account.</h1><p>Sign in to save questions, revisit your sessions and use the research assistant.</p><a href="/login" className="button button--gold">Sign in to continue</a><Link href="/" className="research-back"><ArrowLeft size={14}/> Back to FINTEL</Link></div></main>;

  return (
    <main className="research-page">
      <header className="research-topbar">
        <a href="/" className="workspace-brand"><span className="brand-mark">FI</span><span><b>FINTEL</b><small>KENYA FINANCIAL INTELLIGENCE</small></span></a>
        <div className="research-topbar__right"><Badge variant="outline" className="research-auth-badge"><ShieldCheck size={12}/> Private research space</Badge><a href="/markets"><ArrowLeft size={14}/> Markets</a></div>
      </header>
      <section className="research-hero">
        <div><p className="eyebrow">YOUR QUESTIONS, WITH CONTEXT</p><h1>Research that starts with the facts.</h1><p>Ask about Kenyan markets, fixed income or quantitative ideas. FINTEL will show you which saved observations it used — and tell you when something is missing.</p><div className="research-hero__links"><a href="/data">See source health <ExternalLink size={13}/></a><a href="/disclaimer">How to use research outputs <ExternalLink size={13}/></a></div></div>
        <PhotoPanel photo={fintelPhotos.marketPeople} className="research-hero__photo"/>
      </section>
      <div className="research-layout">
        <aside className={`research-history ${showHistory ? "research-history--open" : ""}`}>
          <div className="research-panel-heading"><div><p className="eyebrow">YOUR WORK</p><h2>Recent sessions</h2></div><button className="research-toggle" onClick={() => setShowHistory(value => !value)}>{showHistory ? "Hide" : "Show"}</button></div>
          {showHistory && <>
            <Button className="research-new-button" onClick={startNew} disabled={create.isPending}><Plus size={14}/> {create.isPending ? "Opening…" : "Start a new session"}</Button>
            <div className="research-session-list">{sessions.data?.map(item => <button key={item.id} onClick={() => { setSessionId(item.id); setMode(item.mode as Mode); setAnswer(""); setEvidence([]); }} className={`research-session ${sessionId === item.id ? "is-selected" : ""}`}><span>{item.title}</span><small>{item.mode} · {item.status}</small></button>)}
              {!sessions.data?.length && <div className="research-muted">Your saved questions will appear here. Start with a new session whenever you're ready.</div>}
            </div>
            {sessionId && <Button variant="ghost" size="sm" className="research-delete" onClick={() => remove.mutate({ sessionId })}><Trash2 size={13}/> Delete this session</Button>}
          </>}
        </aside>

        <section className="research-conversation">
          <div className="research-mode-bar"><div><p className="eyebrow">CHOOSE A LENS</p><h2>What would you like to understand?</h2></div><span className={statusClass}>{status}</span></div>
          <div className="research-mode-list">{modes.map(item => <button key={item} onClick={() => setMode(item)} className={`research-mode ${mode === item ? "is-active" : ""}`}>{item}</button>)}</div>
          <div className="research-message-area">
            {!answer && <div className="research-welcome"><span className="research-ai-icon"><BrainCircuit size={20}/></span><h3>Let's work through it together.</h3><p>Ask a specific question, or choose one of these starting points. You'll see what information FINTEL could access for the answer.</p><div className="research-examples">{examples.map((example, index) => <button key={index} onClick={() => useExample(example)}><span>{example.mode}</span>{example.question}<ArrowUpRight size={13}/></button>)}</div></div>}
            {answer && <article className="research-answer"><div className="research-answer__head"><span><Sparkles size={15}/> FINTEL's response</span><span className={statusClass}>{status}</span></div><div className="research-answer__body">{answer}</div><p className="research-answer__foot">Read this as research support, not a personal investment recommendation. Check the original source before acting.</p></article>}
          </div>
          <form className="research-composer" onSubmit={submit}>
            <Textarea value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) submit(); }} placeholder={`Ask about ${mode.toLowerCase()}… e.g. "What does this yield change mean for a Kenyan investor?"`} className="research-textarea"/>
            <div className="research-composer__foot"><span>Ctrl / Cmd + Enter to send · Your saved sessions stay private to your account.</span><Button className="button button--gold" type="submit" disabled={ask.isPending || !question.trim()}>{ask.isPending ? <Sparkles className="animate-pulse" size={14}/> : <Send size={14}/>} {ask.isPending ? "Working through it…" : "Ask FINTEL"}</Button></div>
          </form>
        </section>

        <aside className="research-evidence">
          <SpotlightCard className="research-evidence__panel">
            <div className="research-panel-heading"><div><p className="eyebrow">WHAT BACKED THIS ANSWER</p><h2>Sources & context</h2></div><Database size={17}/></div>
            {evidence.length ? <div className="research-evidence-list">{evidence.map((item, index) => <article key={index}><span className="research-evidence-type">{item.type.replaceAll("_", " ")}</span><h3>{item.title}</h3><p>{item.detail}</p>{item.observationDate && <small>Observed: {new Date(item.observationDate).toLocaleString("en-GB", { timeZone: "Africa/Nairobi" })} EAT</small>}{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer noopener">Open original source <ExternalLink size={12}/></a>}</article>)}</div> : <div className="research-muted"><FileSearch size={20}/><p>When a question uses FINTEL data, the evidence will be listed here. If nothing is connected to a question, we'll say so.</p></div>}
          </SpotlightCard>
          <section className="research-guidance"><p className="eyebrow">A FEW THINGS TO KNOW</p><h3>Useful, but not unquestionable.</h3><ul><li>Market observations and AI interpretation are kept separate.</li><li>Calculations are handled by the FINTEL quantitative engine.</li><li>Missing information is reported, not filled with invented figures.</li><li>Private portfolio records are not selected automatically.</li></ul><a href="/disclaimer">Read the research disclaimer <ArrowUpRight size={13}/></a></section>
        </aside>
      </div>
      <footer className="fintel-footer"><span>FINTEL · Research should help you ask better questions.</span><nav><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/cookies">Cookies</a><a href="/security">Security</a></nav></footer>
    </main>
  );
}
