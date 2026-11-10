import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, ArrowUpRight, BookOpen, Database, GraduationCap, Gauge, Layers3, LineChart, Menu, RefreshCw, ShieldCheck, ExternalLink, Sparkles, Target, X } from "lucide-react";
import { useLocation } from "wouter";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DataDetails, type DataLineage } from "@/components/fintel/DataDetails";
import { PortfolioWorkspace } from "@/components/fintel/PortfolioWorkspace";
import { useAuth } from "@/_core/hooks/useAuth";
import { BlurText } from "@/components/fintel/BlurText";
import { SpotlightCard } from "@/components/fintel/SpotlightCard";
import { PhotoPanel, fintelPhotos } from "@/components/fintel/PhotoPanel";

const navGroups = [
  { label: "YOUR WORKSPACE", items: [
    { id: "overview", label: "Overview", path: "/", icon: Gauge },
    { id: "market", label: "Markets", path: "/markets", icon: Activity },
    { id: "curve", label: "Yield curve", path: "/yield-curve", icon: LineChart },
    { id: "fixed", label: "Treasury Bills & Bonds", path: "/fixed-income", icon: Layers3 },
    { id: "derivatives", label: "Derivatives lab", path: "/derivatives", icon: Sparkles },
    { id: "risk", label: "Risk", path: "/risk", icon: ShieldCheck },
    { id: "portfolio", label: "Portfolio", path: "/portfolio", icon: Target },
    { id: "models", label: "Quant models", path: "/models", icon: Gauge },
  ]},
  { label: "LEARN & EXPLORE", items: [
    { id: "research", label: "Research desk", path: "/research", icon: BookOpen },
    { id: "academy", label: "Academy", path: "/academy", icon: GraduationCap },
    { id: "data", label: "Data sources", path: "/data", icon: Database },
    { id: "settings", label: "Settings", path: "/settings", icon: ShieldCheck },
  ]},
];

function StatusBadge({ status }: { status?: string | null }) {
  const normalized = (status ?? "DATA REQUIRED").toUpperCase();
  const tone = ["READY", "LIVE", "CURRENT"].includes(normalized) ? "status-pill--good" : ["RUNNING", "BACKFILLING", "STALE", "LOADING"].includes(normalized) ? "status-pill--warn" : "status-pill--quiet";
  return <span className={`status-pill ${tone}`}><i />{status ?? "DATA REQUIRED"}</span>;
}

function MetricCard({ label, value, unit, note, lineage }: { label: string; value: string; unit?: string; note: string; lineage?: DataLineage }) {
  const unavailable = value.includes("DATA") || value.includes("REQUIRED") || value.includes("STALE");
  return (
    <SpotlightCard className="terminal-card metric-tile">
      <div className="metric-tile__top"><span className="eyebrow">{label}</span><span className="metric-tile__spark" aria-hidden="true">✳</span></div>
      <div className={`metric-value ${unavailable ? "metric-value--missing" : ""}`}>{value}{unit && !unavailable ? <small>{unit}</small> : null}</div>
      <p>{unavailable ? "We don't have a validated reading to show yet." : note}</p>
      {lineage && <DataDetails lineage={lineage} />}
    </SpotlightCard>
  );
}

function updateLabel(value?: string | Date | null) {
  if (!value) return "Update time not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Update time not recorded";
  return `Last saved ${new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" }).format(date)} EAT`;
}

export default function Home() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(() => new Date());
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const role = user?.role ?? "viewer";
  const canIngest = role === "admin";
  const canPortfolio = ["admin", "analyst", "client"].includes(role);
  const utils = trpc.useUtils();
  const marketQuery = trpc.market.snapshot.useQuery(undefined, { refetchInterval: 60_000, refetchOnWindowFocus: true });
  const curveQuery = trpc.market.yieldCurve.useQuery(undefined, { refetchInterval: 60_000, refetchOnWindowFocus: true });
  const healthQuery = trpc.data.sources.useQuery(undefined, { refetchInterval: 60_000, refetchOnWindowFocus: true });
  const riskQuery = trpc.analytics.risk.useQuery(undefined, { enabled: Boolean(user && canPortfolio), refetchInterval: 90_000 });
  const modelsQuery = trpc.models.registry.useQuery(undefined, { refetchInterval: 120_000 });
  const systemQuery = trpc.systemStatus.health.useQuery(undefined, { refetchInterval: 60_000 });
  const historyQuery = trpc.analytics.historical.useQuery({ instrument: "USD/KES" }, { refetchInterval: 120_000 });
  const market = marketQuery.data;
  const curve = curveQuery.data;
  const healthRows = healthQuery.data?.sources ?? [];
  const rows = market?.instruments ?? [];
  const chartData = useMemo(() => curve?.map((point: any) => ({ tenor: point.tenor, yield: Number(point.yield) })) ?? [], [curve]);
  const nairobiTime = useMemo(() => new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi", hour12: false }).format(clockNow), [clockNow]);
  const healthStatus = (name: string) => healthRows.find((row: any) => row.name === name)?.status ?? "DATA REQUIRED";
  const healthLineage = (name: string): DataLineage => {
    const source: any = healthRows.find((row: any) => row.name === name);
    return { source: source?.sourceUrl ?? source?.endpoint ?? "Central Bank of Kenya", observationDate: source?.latestObservation, retrievedDate: source?.lastSuccessfulUpdate, frequency: source?.expectedFrequency, status: source?.status ?? "DATA REQUIRED" };
  };
  const curveLineage = healthLineage("CBK yield curve observations");
  const latestRetrieval = market?.lastUpdated ?? healthLineage("CBK key rates and FX").retrievedDate;

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  async function handleRefresh() {
    if (!canIngest) {
      toast.warning("Only an administrator can start a manual CBK refresh. The page still checks for new saved data automatically.");
      return;
    }
    setRefreshing(true);
    setRefreshStatus(null);
    try {
      const response = await fetch("/api/market/refresh", { method: "POST", credentials: "include" });
      const data = await response.json();
      setRefreshStatus(data.status ?? "UNKNOWN");
      await Promise.all([utils.market.snapshot.invalidate(), utils.market.yieldCurve.invalidate(), utils.analytics.risk.invalidate(), utils.models.registry.invalidate(), utils.systemStatus.health.invalidate(), utils.data.sources.invalidate(), utils.analytics.historical.invalidate()]);
      if (data.status === "ERROR") toast.error("The CBK refresh needs attention. Check the data source page for details.");
      else if (data.status === "UNAUTHORIZED" || data.status === "FORBIDDEN") toast.error("Your account does not have permission to refresh the source.");
      else if (data.status === "DATA REQUIRED") toast.warning("The refresh ran, but a validated observation is still missing.");
      else toast.success("CBK refresh finished. The latest saved observations have been reloaded.");
    } catch {
      setRefreshStatus("ERROR");
      toast.error("We couldn't reach the refresh service. The last saved data is still shown with its date.");
    } finally {
      setRefreshing(false);
    }
  }

  function selectNav(id: string, path: string) {
    setMobileOpen(false);
    navigate(path);
  }

  const marketCards = rows.slice(0, 6);
  const newsImage = fintelPhotos.nationalPark;

  return (
    <div className="fintel-app">
      <aside className={`fintel-sidebar ${mobileOpen ? "fintel-sidebar--open" : ""}`}>
        <div className="fintel-brand">
          <a href="/" className="fintel-brand__link"><span className="brand-mark">FI</span><span><b>FINTEL</b><small>KENYA FINANCIAL INTELLIGENCE</small></span></a>
          <button className="mobile-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={18}/></button>
        </div>
        <div className="sidebar-scroll">
          {navGroups.map(group => <div className="sidebar-group" key={group.label}>
            <p className="eyebrow">{group.label}</p>
            {group.items.map(item => <button key={item.id} onClick={() => selectNav(item.id, item.path)} className={`nav-item ${item.id === "overview" ? "nav-item-active" : ""}`}><item.icon size={17}/><span>{item.label}</span><ArrowUpRight className="nav-item__arrow" size={14}/></button>)}
          </div>)}
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-status"><span className="status-led"/><span>Connected to your workspace</span></div>
          <div className="sidebar-user"><span className="avatar">{user?.name?.slice(0, 2).toUpperCase() ?? "FI"}</span><div><b>{user?.name ?? "Guest workspace"}</b><small>{role} access</small></div><a href="/settings" aria-label="Account settings"><ArrowUpRight size={15}/></a></div>
        </div>
      </aside>
      {mobileOpen && <button className="sidebar-scrim" onClick={() => setMobileOpen(false)} aria-label="Close menu"/>}
      <main className="fintel-main">
        <header className="fintel-topbar">
          <div className="fintel-topbar__left">
            <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={19}/></button>
            <div><p className="eyebrow">INDEPENDENT KENYAN MARKET INTELLIGENCE</p><h1>Good to see you{user?.name ? `, ${user.name.split(" ")[0]}` : ""}.</h1></div>
          </div>
          <div className="fintel-topbar__right"><span className="nairobi-clock"><span>NAIROBI / EAT</span><b>{nairobiTime}</b></span><button className="icon-button" onClick={handleRefresh} disabled={refreshing || !canIngest} title={canIngest ? "Refresh CBK data" : "Automatic refresh is checked every minute; manual refresh is for administrators"}><RefreshCw size={16} className={refreshing ? "animate-spin" : ""}/></button></div>
        </header>
        <div className="fintel-content">
          <section className="welcome-strip">
            <div><span className="welcome-strip__mark">✳</span><span>FINTEL is here to make the numbers easier to follow.</span></div>
            <a href="/about">A little about this project <ArrowRight size={14}/></a>
          </section>

          <section className="home-hero">
            <div className="home-hero__copy">
              <p className="eyebrow"><span className="status-led"/> KENYAN MARKETS, BROUGHT CLOSER</p>
              <h2><BlurText>Make sense of the market.</BlurText><br/><em>One decision at a time.</em></h2>
              <p className="home-hero__intro">From the shilling and Treasury auctions to yield curves and portfolio risk, FINTEL brings the information together — and shows you where it came from.</p>
              <div className="home-hero__actions"><a className="button button--gold" href="/markets">Explore the markets <ArrowRight size={16}/></a><a className="button button--soft" href="/research"><Sparkles size={15}/> Ask FINTEL AI</a></div>
              <div className="home-hero__trust"><span><ShieldCheck size={17}/> Your own private workspace</span><span><Database size={17}/> Source-aware data</span><span><Activity size={17}/> Updated regularly</span></div>
            </div>
            <PhotoPanel photo={fintelPhotos.nairobiDusk} className="home-hero__photo" eager/>
            <div className="home-hero__floating">
              <div className="floating-head"><span><i className="status-led"/> Market data</span><span>CBK · {market?.status ?? "LOADING"}</span></div>
              {rows.slice(0, 4).map((item: any) => <div className="floating-row" key={item.label}><span>{item.label}</span><b>{item.value ?? "DATA REQUIRED"} <small>{item.unit}</small></b></div>)}
              {!rows.length && <div className="floating-empty">Waiting for the latest saved observations…</div>}
              <div className="floating-foot">{updateLabel(latestRetrieval)} <a href="/data">Data details <ArrowUpRight size={12}/></a></div>
            </div>
          </section>

          <section className="market-section">
            <div className="section-heading"><div><p className="eyebrow">THE LATEST WE HAVE</p><h2>Kenya's market at a glance</h2><p>We check for refreshed observations regularly. These are saved source readings, not a second-by-second trading feed.</p></div><div className="section-heading__meta"><StatusBadge status={refreshStatus ?? market?.status ?? (marketQuery.isLoading ? "LOADING" : "DATA REQUIRED")}/><span>{marketQuery.isFetching ? "Checking for updates…" : updateLabel(latestRetrieval)}</span></div></div>
            <div className="market-ticker" aria-label="Latest market observations">
              {marketCards.map((item: any) => <div className="market-ticker__item" key={item.label}><span>{item.label}</span><strong>{item.value ?? "DATA REQUIRED"} <small>{item.unit}</small></strong><StatusBadge status={item.status}/></div>)}
              {!marketCards.length && <div className="market-ticker__empty">Market observations will appear here once the data source responds.</div>}
            </div>
            <div className="market-section__actions"><a href="/markets">See all market observations <ArrowRight size={15}/></a><a href="/data">How fresh is this data? <ArrowUpRight size={14}/></a></div>
          </section>

          <section className="home-grid">
            <div className="home-grid__main">
              <div className="section-heading"><div><p className="eyebrow">TOOLS THAT WORK TOGETHER</p><h2>Start where you need to</h2><p>You don't need to know every model to make use of the information. Pick a workspace and explore at your own pace.</p></div></div>
              <div className="feature-grid">
                <a href="/markets"><SpotlightCard tone="jade" className="feature-card"><span className="feature-icon feature-icon--jade"><Activity size={20}/></span><div><h3>Market intelligence</h3><p>Keep an eye on FX, CBK rates and Treasury auctions — with the source close by.</p><span className="feature-link">Explore markets <ArrowUpRight size={14}/></span></div></SpotlightCard></a>
                <a href="/yield-curve"><SpotlightCard tone="brass" className="feature-card"><span className="feature-icon feature-icon--brass"><LineChart size={20}/></span><div><h3>Yield curve</h3><p>See how government security yields compare across maturities.</p><span className="feature-link">View the curve <ArrowUpRight size={14}/></span></div></SpotlightCard></a>
                <a href="/risk"><SpotlightCard tone="clay" className="feature-card"><span className="feature-icon feature-icon--clay"><ShieldCheck size={20}/></span><div><h3>Risk workspace</h3><p>Explore portfolio exposure once your real holdings and history are in place.</p><span className="feature-link">Understand the risk <ArrowUpRight size={14}/></span></div></SpotlightCard></a>
                <a href="/research"><SpotlightCard tone="orchid" className="feature-card"><span className="feature-icon feature-icon--orchid"><Sparkles size={20}/></span><div><h3>Research desk</h3><p>Ask a question and get an explanation grounded in the data FINTEL can access.</p><span className="feature-link">Start researching <ArrowUpRight size={14}/></span></div></SpotlightCard></a>
              </div>
            </div>
            <aside className="home-grid__side">
              <SpotlightCard tone="brass" className="risk-card">
                <div className="risk-card__top"><span className="eyebrow">YOUR PORTFOLIO</span><StatusBadge status={riskQuery.data ? "READY" : canPortfolio ? "DATA REQUIRED" : "SIGN IN REQUIRED"}/></div>
                <h3>Know what you hold before you measure what you risk.</h3>
                {riskQuery.data ? <div className="risk-card__value">KES {(riskQuery.data.parametric_var_kes/1_000_000).toFixed(2)}M <small>parametric VaR</small></div> : <p>Start by adding your holdings. Historical risk will only appear when FINTEL has enough aligned observations for those instruments.</p>}
                <a className="feature-link" href="/portfolio">Open your portfolio <ArrowRight size={14}/></a>
                <DataDetails lineage={{ source: "FINTEL portfolio records + Python Quant Engine", status: riskQuery.data ? "READY" : "DATA REQUIRED", frequency: "Calculated when requested" }}/>
              </SpotlightCard>
            </aside>
          </section>

          <section className="curve-and-health">
            <SpotlightCard className="curve-card">
              <div className="section-heading"><div><p className="eyebrow">FIXED INCOME · CBK OBSERVATIONS</p><h2>The shape of Kenya's yield curve</h2><p>Built from the Treasury Bill and Bond observations currently available to FINTEL.</p></div><StatusBadge status={chartData.length ? "CURRENT" : curveQuery.isLoading ? "LOADING" : "DATA REQUIRED"}/></div>
              <div className="curve-card__chart">{chartData.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{top:10,right:8,left:-18,bottom:0}}><defs><linearGradient id="homeCurveFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c99f4f" stopOpacity={.28}/><stop offset="100%" stopColor="#c99f4f" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#ffffff12" vertical={false}/><XAxis dataKey="tenor" tick={{fill:"#bdc9c0",fontSize:11}} axisLine={false} tickLine={false}/><YAxis tick={{fill:"#bdc9c0",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`}/><Tooltip contentStyle={{background:"#102523",border:"1px solid #d2aa5844",borderRadius:12,color:"#f2ebdc"}} formatter={(value:any)=>[`${Number(value).toFixed(2)}%`,"Yield"]}/><Area dataKey="yield" type="monotone" stroke="#d2aa58" strokeWidth={2.5} fill="url(#homeCurveFill)"/></AreaChart></ResponsiveContainer> : <div className="empty-state"><LineChart size={22}/><strong>{curveQuery.isLoading ? "Loading your yield curve…" : "A few more observations are needed"}</strong><p>FINTEL only draws the curve when it has enough validated points. No sample curve is shown here.</p></div>}</div>
              <div className="curve-card__foot"><span>{chartData.length ? "Interpolated from saved CBK observations" : "Waiting for validated observations"}</span><a href="/yield-curve">Explore yield curve <ArrowRight size={14}/></a></div>
              <DataDetails lineage={curveLineage}/>
            </SpotlightCard>
            <SpotlightCard className="health-card">
              <div className="section-heading"><div><p className="eyebrow">DATA HEALTH</p><h2>Can we trust today's reading?</h2><p>Freshness and source status, in plain sight.</p></div><Database size={18}/></div>
              <div className="health-list">{[["CBK rates & FX",healthStatus("CBK key rates and FX")],["Treasury Bills",healthStatus("CBK Treasury Bills")],["Treasury Bonds",healthStatus("CBK Treasury Bonds")],["Historical data",historyQuery.data?.status ?? healthStatus("Historical market database")]].map(([name,status])=><div key={name}><span>{name}</span><StatusBadge status={status}/></div>)}</div>
              <div className="health-counts"><span>Records added <b>{healthRows.reduce((n:number,row:any)=>n+Number(row.recordsInserted??0),0).toLocaleString()}</b></span><span>Needs review <b>{healthRows.reduce((n:number,row:any)=>n+Number(row.recordsRejected??0),0).toLocaleString()}</b></span></div>
              <a href="/data" className="feature-link">See source details <ArrowRight size={14}/></a>
            </SpotlightCard>
          </section>

          <section className="story-section">
            <div className="section-heading"><div><p className="eyebrow">THE CONTEXT BEHIND THE DATA</p><h2>It's not just numbers on a screen.</h2><p>Kenya's economy is built by people, businesses and communities. FINTEL starts with that reality.</p></div><a href="/about">Why we built FINTEL <ArrowRight size={15}/></a></div>
            <div className="story-grid">
              <PhotoPanel photo={fintelPhotos.localBusiness} className="story-photo"/>
              <PhotoPanel photo={fintelPhotos.cbdDay} className="story-photo"/>
              <PhotoPanel photo={newsImage} className="story-photo"/>
            </div>
          </section>
          <section className="home-last-call"><div><p className="eyebrow">LEARN AS YOU GO</p><h2>New to one of these topics?</h2><p>The Academy brings together official Kenyan resources and practical starting points. No pressure to know it all before you begin.</p></div><a className="button button--gold" href="/academy">Explore the Academy <ArrowRight size={15}/></a></section>
        </div>
        <footer className="fintel-footer"><span>FINTEL · Independent Kenyan financial intelligence</span><nav><a href="/about">About</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/cookies">Cookies</a><a href="/disclaimer">Disclaimer</a><a href="/security">Security</a><a href="https://github.com/paulndwekia/fintel-kenya-financial-intelligence" target="_blank" rel="noreferrer noopener">GitHub <ExternalLink size={12}/></a></nav></footer>
      </main>
    </div>
  );
}
