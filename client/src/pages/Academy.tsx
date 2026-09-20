import { BookOpen, ExternalLink, FileText, GraduationCap, PlayCircle, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const resources = [
  { title: "CBK Monetary Policy Statements", type: "PDF / Publication", topic: "Money & Banking", level: "Core", source: "Central Bank of Kenya", url: "https://www.centralbank.go.ke/monetary-policy/" },
  { title: "CBK Statistical Bulletin", type: "Data / Publication", topic: "Kenyan Markets", level: "Core", source: "Central Bank of Kenya", url: "https://www.centralbank.go.ke/statistical-bulletin/" },
  { title: "Treasury Bills & Bonds", type: "Official Resource", topic: "Fixed Income", level: "Core", source: "CBK", url: "https://www.centralbank.go.ke/treasury-bonds/" },
  { title: "Financial Stability Report", type: "PDF / Report", topic: "Risk & Macro", level: "Intermediate", source: "Central Bank of Kenya", url: "https://www.centralbank.go.ke/financial-stability/" },
  { title: "IMF Online Learning", type: "Course", topic: "Macroeconomics", level: "Intermediate", source: "IMF", url: "https://www.imf.org/en/Capacity-Development/online-learning" },
  { title: "Quantitative Finance Notes", type: "Learning Resource", topic: "Quant Finance", level: "Intermediate", source: "FINTEL", url: "/research?mode=ACADEMIC" },
];
const topics = ["All", "Kenyan Markets", "Money & Banking", "Fixed Income", "Quant Finance", "Risk & Macro"];

export default function Academy() {
  const [, navigate] = useLocation();
  const [topic, setTopic] = useState("All");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => resources.filter(r => (topic === "All" || r.topic === topic) && `${r.title} ${r.source}`.toLowerCase().includes(query.toLowerCase())), [topic, query]);
  return <div className="min-h-screen bg-[#07090d] text-slate-200">
    <header className="sticky top-0 z-20 border-b border-white/[.07] bg-[#07090d]/95 px-5 py-4 backdrop-blur sm:px-8">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
        <div><div className="eyebrow text-emerald-300">FINTEL · ACADEMY</div><h1 className="mt-1 text-xl font-semibold text-white">Kenya Financial Intelligence Academy</h1><p className="mt-1 text-xs text-slate-500">Learn the markets, then interrogate the same data inside FINTEL.</p></div>
        <Button onClick={() => navigate("/research")}><Sparkles size={15}/> Ask FINTEL</Button>
      </div>
    </header>
    <main className="mx-auto max-w-[1500px] space-y-5 p-5 sm:p-8">
      <section className="grid gap-4 md:grid-cols-3">
        {[['01','Learn','Structured finance and quantitative learning paths.'],['02','Practice','Use real FINTEL models after studying the concepts.'],['03','Research','Move from a lesson into evidence-backed FINTEL research.']].map(([n,t,d]) => <div key={n} className="terminal-card relative overflow-hidden p-5"><div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-400/5 blur-2xl"/><div className="text-xs font-mono text-emerald-300">{n}</div><div className="mt-3 text-base font-semibold text-white">{t}</div><p className="mt-2 text-xs leading-5 text-slate-500">{d}</p></div>)}
      </section>
      <section className="terminal-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-wrap gap-2">{topics.map(t => <button key={t} onClick={() => setTopic(t)} className={`rounded-md border px-3 py-1.5 text-[10px] ${topic === t ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-white/[.06] text-slate-500'}`}>{t}</button>)}</div><div className="flex items-center gap-2 rounded-md border border-white/[.07] bg-white/[.02] px-3"><Search size={14} className="text-slate-600"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search resources" className="h-9 w-full bg-transparent text-xs outline-none"/></div></div>
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map(r => <article key={r.title} className="terminal-card group p-5 transition-transform duration-200 hover:-translate-y-1"><div className="flex items-start justify-between"><div className="brand-mark"><BookOpen size={15}/></div><Badge variant="outline" className="border-white/[.08] text-slate-500">{r.level}</Badge></div><h2 className="mt-5 text-sm font-semibold text-white">{r.title}</h2><p className="mt-2 text-[11px] text-slate-500">{r.source} · {r.topic}</p><div className="mt-5 flex items-center gap-2"><Button size="sm" variant="outline" onClick={() => window.open(r.url, '_blank')}><ExternalLink size={13}/> Open resource</Button><span className="flex items-center gap-1 text-[10px] text-slate-600">{r.type.includes('PDF') ? <FileText size={12}/> : <PlayCircle size={12}/>} {r.type}</span></div></article>)}
      </section>
      {!filtered.length && <div className="terminal-card py-16 text-center"><GraduationCap className="mx-auto text-slate-600" size={30}/><p className="mt-3 text-xs text-slate-500">No resources match this search.</p></div>}
      <section className="terminal-card p-5"><div className="eyebrow">LEARNING CONTRACT</div><div className="mt-3 grid gap-4 md:grid-cols-3"><div><div className="text-xs font-medium text-white">Official sources first</div><p className="mt-1 text-[11px] leading-5 text-slate-500">Where Kenyan market material exists, FINTEL prioritizes official institutional sources.</p></div><div><div className="text-xs font-medium text-white">No fabricated lessons</div><p className="mt-1 text-[11px] leading-5 text-slate-500">Resource availability is explicit. FINTEL does not pretend a missing PDF or video exists.</p></div><div><div className="text-xs font-medium text-white">Theory → Quant → Research</div><p className="mt-1 text-[11px] leading-5 text-slate-500">Academy content is designed to connect directly to FINTEL's quantitative and research workspaces.</p></div></div></section>
    </main>
  </div>;
}
