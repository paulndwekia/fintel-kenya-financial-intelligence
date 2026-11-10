import { BookOpen, ExternalLink, FileText, GraduationCap, Search, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PhotoPanel, fintelPhotos } from "@/components/fintel/PhotoPanel";
import { SpotlightCard } from "@/components/fintel/SpotlightCard";

const resources = [
  { title: "CBK Monetary Policy Statements", type: "Official publication", topic: "Money & Banking", level: "Start here", source: "Central Bank of Kenya", url: "https://www.centralbank.go.ke/monetary-policy/" , note: "Understand the decisions and language behind Kenya's monetary policy." },
  { title: "CBK Statistical Bulletin", type: "Data & publication", topic: "Kenyan Markets", level: "Start here", source: "Central Bank of Kenya", url: "https://www.centralbank.go.ke/statistical-bulletin/", note: "Find the economic and financial series behind many market conversations." },
  { title: "Treasury Bills & Bonds", type: "Official market resource", topic: "Fixed Income", level: "Start here", source: "Central Bank of Kenya", url: "https://www.centralbank.go.ke/treasury-bonds/", note: "Read the official information on government securities and auctions." },
  { title: "Financial Stability Report", type: "Official report", topic: "Risk & Macro", level: "Next step", source: "Central Bank of Kenya", url: "https://www.centralbank.go.ke/financial-stability/", note: "See how the wider financial system is assessed and monitored." },
  { title: "IMF Online Learning", type: "Courses", topic: "Macroeconomics", level: "Next step", source: "International Monetary Fund", url: "https://www.imf.org/en/Capacity-Development/online-learning", note: "Structured lessons on macroeconomics, public finance and related topics." },
  { title: "Ask FINTEL about a concept", type: "Interactive research", topic: "Quant Finance", level: "Practice", source: "FINTEL", url: "/research", note: "Turn a concept into a question and explore the evidence available in FINTEL." },
];
const topics = ["All", "Kenyan Markets", "Money & Banking", "Fixed Income", "Quant Finance", "Risk & Macro", "Macroeconomics"];

export default function Academy() {
  const [, navigate] = useLocation();
  const [topic, setTopic] = useState("All");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => resources.filter(resource => (topic === "All" || resource.topic === topic) && `${resource.title} ${resource.source} ${resource.note}`.toLowerCase().includes(query.toLowerCase())), [topic, query]);

  return (
    <main className="academy-page">
      <header className="academy-topbar">
        <a href="/" className="workspace-brand"><span className="brand-mark">FI</span><span><b>FINTEL</b><small>KENYA FINANCIAL INTELLIGENCE</small></span></a>
        <nav><a href="/markets">Markets</a><a href="/research">Research desk</a><a href="/about">About</a></nav>
        <Button className="button button--gold" onClick={() => navigate("/research")}><Sparkles size={14}/> Ask FINTEL</Button>
      </header>
      <section className="academy-hero">
        <div><p className="eyebrow">FINTEL ACADEMY · LEARN AT YOUR OWN PACE</p><h1>Start curious.<br/><em>Get confident.</em></h1><p>You don't need to know every financial term before you begin. We bring together trusted Kenyan resources and a few good places to learn the ideas behind the numbers.</p><div className="academy-hero__points"><span><BookOpen size={15}/> Clear starting points</span><span><ShieldCheck size={15}/> Official sources first</span><span><Sparkles size={15}/> Learn, then ask</span></div><a className="button button--gold" href="#learning-resources">Browse learning resources <ArrowRight size={15}/></a></div>
        <PhotoPanel photo={fintelPhotos.cbdDay} className="academy-hero__photo"/>
      </section>
      <main className="academy-main" id="learning-resources">
        <div className="academy-paths">
          {[["01","Build the foundation","Start with how Kenya's markets and institutions work."],["02","Explore the numbers","Connect what you learn to Treasury auctions, FX and yields."],["03","Ask better questions","Use FINTEL Research to explore a concept or a dataset."]].map(([number,title,description]) => <SpotlightCard key={number} className="academy-path"><span>{number}</span><h2>{title}</h2><p>{description}</p></SpotlightCard>)}
        </div>
        <section className="academy-library">
          <div className="section-heading"><div><p className="eyebrow">A SMALL, USEFUL LIBRARY</p><h2>Where would you like to begin?</h2><p>These links open the original publisher's resource. FINTEL doesn't host or claim ownership of those materials.</p></div><Badge variant="outline" className="academy-count">{filtered.length} resources</Badge></div>
          <div className="academy-filters"><div className="academy-topics">{topics.map(item => <button key={item} onClick={() => setTopic(item)} className={topic === item ? "is-active" : ""}>{item}</button>)}</div><label className="academy-search"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search topics or publishers" aria-label="Search learning resources"/></label></div>
          <section className="academy-resource-grid">
            {filtered.map(resource => <SpotlightCard key={resource.title} className="academy-resource">
              <div className="academy-resource__meta"><span><BookOpen size={15}/>{resource.type}</span><Badge variant="outline">{resource.level}</Badge></div>
              <h3>{resource.title}</h3><p className="academy-resource__publisher">{resource.source} · {resource.topic}</p><p>{resource.note}</p>
              {resource.url.startsWith("/") ? <a className="academy-resource__link" href={resource.url}>Open in FINTEL <ArrowRight size={14}/></a> : <a className="academy-resource__link" href={resource.url} target="_blank" rel="noreferrer noopener">Open original resource <ExternalLink size={13}/></a>}
            </SpotlightCard>)}
          </section>
          {!filtered.length && <div className="empty-state"><GraduationCap size={23}/><strong>No matches this time</strong><p>Try a different keyword or choose another topic.</p></div>}
        </section>
        <section className="academy-note"><div className="academy-note__icon"><FileText size={19}/></div><div><p className="eyebrow">A NOTE ON LEARNING</p><h2>Understand the idea before relying on the output.</h2><p>Financial models are useful, but they are not magic. Start with the source, understand the assumptions, then use the tools to explore what the numbers may mean.</p></div><a href="/disclaimer">Read the FINTEL disclaimer <ArrowRight size={14}/></a></section>
      </main>
      <footer className="fintel-footer"><span>FINTEL · A little more understanding, one topic at a time.</span><nav><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/cookies">Cookies</a><a href="/security">Security</a></nav></footer>
    </main>
  );
}
