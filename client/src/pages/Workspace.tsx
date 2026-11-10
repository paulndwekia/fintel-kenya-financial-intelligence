import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, BarChart3, BookOpen, Database, ExternalLink, LineChart, ShieldCheck, Sparkles, Target } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PortfolioWorkspace } from "@/components/fintel/PortfolioWorkspace";
import { DataDetails } from "@/components/fintel/DataDetails";
import { PhotoPanel, fintelPhotos } from "@/components/fintel/PhotoPanel";
import { SpotlightCard } from "@/components/fintel/SpotlightCard";

type WorkspaceKey = "markets" | "yield-curve" | "fixed-income" | "derivatives" | "risk" | "portfolio" | "models" | "data" | "settings" | "about";

const config: Record<WorkspaceKey, { title: string; intro: string; image: keyof typeof fintelPhotos; eyebrow: string }> = {
  markets: { title: "The markets, without the guesswork", intro: "A clear view of the latest Kenyan market observations we have on file. Check the source and date on every number.", image: "nairobiGoldenHour", eyebrow: "MARKET INTELLIGENCE" },
  "yield-curve": { title: "See how yields change with time", intro: "Explore the Kenyan sovereign curve built from validated Treasury Bill and Bond observations.", image: "cbdDay", eyebrow: "YIELD CURVE" },
  "fixed-income": { title: "Treasury Bills and Bonds", intro: "Review auction observations and bond results in one place, with dates and source details alongside them.", image: "nairobiDusk", eyebrow: "FIXED INCOME" },
  derivatives: { title: "Explore an option's value", intro: "Try the pricing models with your own assumptions. Example inputs are not live market quotes.", image: "cbdDay", eyebrow: "DERIVATIVES LAB" },
  risk: { title: "Understand what your portfolio could be exposed to", intro: "Risk analysis only becomes meaningful when real holdings and the required market history are available.", image: "nairobiGoldenHour", eyebrow: "RISK WORKSPACE" },
  portfolio: { title: "Your portfolio, kept in your hands", intro: "Create a workspace for holdings you are authorised to manage. FINTEL will not fill in missing prices or history.", image: "localBusiness", eyebrow: "PORTFOLIO" },
  models: { title: "The calculations behind the results", intro: "See which quantitative models are available and what information each one needs before it can run.", image: "cbdDay", eyebrow: "QUANT MODELS" },
  data: { title: "Know where each number comes from", intro: "Follow source health, recent ingestion activity and historical coverage. A missing value is shown as missing.", image: "localBusiness", eyebrow: "DATA & SOURCES" },
  settings: { title: "Your FINTEL workspace", intro: "Review your account access and find the privacy, cookie and security choices that matter.", image: "nairobiDusk", eyebrow: "SETTINGS" },
  about: { title: "Built around the Kenyan market", intro: "FINTEL brings public market information and quantitative tools closer to the people who use them.", image: "marketPeople", eyebrow: "ABOUT FINTEL" },
};

function Status({ value }: { value?: string | null }) {
  const status = value || "DATA REQUIRED";
  const kind = ["CURRENT", "LIVE", "READY"].includes(status.toUpperCase()) ? "status-pill--good" : ["STALE", "LOADING", "RUNNING"].includes(status.toUpperCase()) ? "status-pill--warn" : "status-pill--quiet";
  return <span className={`status-pill ${kind}`}><i />{status}</span>;
}

function PageShell({ page, children }: { page: WorkspaceKey; children: ReactNode }) {
  const item = config[page];
  const nav: [string, string][] = [["/markets", "Markets"], ["/yield-curve", "Yield curve"], ["/fixed-income", "Fixed income"], ["/derivatives", "Derivatives"], ["/risk", "Risk"], ["/portfolio", "Portfolio"], ["/models", "Models"], ["/data", "Data"]];
  return (
    <div className="workspace-page">
      <header className="workspace-topbar">
        <a className="workspace-brand" href="/"><span className="brand-mark">FI</span><span><b>FINTEL</b><small>KENYA FINANCIAL INTELLIGENCE</small></span></a>
        <nav className="workspace-nav" aria-label="Main navigation">{nav.map(([href, label]) => <a key={href} href={href} className={href === `/${page}` ? "is-active" : ""}>{label}</a>)}</nav>
        <a className="workspace-home-link" href="/"><ArrowLeft size={15} /> Home</a>
      </header>
      <main className="workspace-main">
        <section className="workspace-hero">
          <div className="workspace-hero__copy">
            <p className="eyebrow">{item.eyebrow} · NAIROBI / EAT</p>
            <h1>{item.title}</h1>
            <p>{item.intro}</p>
            <div className="workspace-hero__links"><a href="/research"><Sparkles size={15} /> Ask FINTEL AI</a><a href="/academy"><BookOpen size={15} /> Learn the basics</a></div>
          </div>
          <PhotoPanel photo={fintelPhotos[item.image]} className="workspace-hero__photo" eager />
        </section>
        <div className="workspace-content">{children}</div>
      </main>
      <footer className="fintel-footer">
        <span>FINTEL · Made for clearer decisions.</span>
        <nav><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/cookies">Cookies</a><a href="/disclaimer">Disclaimer</a><a href="/security">Security</a></nav>
      </footer>
    </div>
  );
}

function MarketWorkspace() {
  const market = trpc.market.snapshot.useQuery(undefined, { refetchInterval: 60_000, refetchOnWindowFocus: true });
  const fx = trpc.fx.current.useQuery(undefined, { refetchInterval: 60_000 });
  const bills = trpc.treasuryBills.list.useQuery(undefined, { refetchInterval: 60_000 });
  const bonds = trpc.bonds.list.useQuery(undefined, { refetchInterval: 60_000 });
  const rows = market.data?.instruments ?? [];
  return (
    <div className="workspace-stack">
      <div className="section-heading"><div><p className="eyebrow">LATEST OBSERVATIONS</p><h2>What's on the board</h2><p>These are the latest saved observations, not second-by-second exchange quotes.</p></div><Status value={market.data?.status} /></div>
      <div className="workspace-metric-grid">
        {rows.slice(0, 9).map((item: any, index: number) => <SpotlightCard key={item.label} tone={index % 3 === 0 ? "brass" : "jade"} className="workspace-metric"><span className="eyebrow">{item.label}</span><strong>{item.value ?? "DATA REQUIRED"} {item.unit ?? ""}</strong><Status value={item.status} /><DataDetails lineage={{ source: item.source, observationDate: item.observationDate, retrievedDate: item.retrievedDate, frequency: item.frequency, status: item.status }} /></SpotlightCard>)}
      </div>
      <div className="workspace-two-col">
        <section className="workspace-panel"><div className="section-heading"><div><p className="eyebrow">FOREIGN EXCHANGE</p><h2>CBK FX observations</h2></div><Status value={fx.data?.status} /></div><DataTable rows={fx.data?.observations ?? []} columns={[["pair", "Pair"], ["rate", "KES rate"], ["observationDate", "Observed"]]}/></section>
        <section className="workspace-panel"><div className="section-heading"><div><p className="eyebrow">TREASURY BILLS</p><h2>Recent auction rates</h2></div><Status value={bills.data?.status} /></div><DataTable rows={bills.data?.observations ?? []} columns={[["tenorDays", "Tenor (days)"], ["weightedAverageRate", "Average rate"], ["issueDate", "Issue date"]]}/></section>
      </div>
      <section className="workspace-panel"><div className="section-heading"><div><p className="eyebrow">TREASURY BONDS</p><h2>Published bond results</h2><p>Where the CBK document parser has validated an observation, it appears here.</p></div><Status value={bonds.data?.status} /></div><DataTable rows={bonds.data?.observations ?? []} columns={[["securityCode", "Security"], ["couponRate", "Coupon"], ["yieldToMaturity", "Yield to maturity"], ["maturityDate", "Maturity"]]}/></section>
    </div>
  );
}

function DataTable({ rows, columns }: { rows: any[]; columns: [string, string][] }) {
  if (!rows.length) return <div className="empty-state"><Database size={22}/><strong>Nothing to show just yet</strong><p>When a validated observation is available, it will appear here with its source date.</p></div>;
  const format = (value: any) => value == null || value === "" ? "—" : value instanceof Date ? value.toLocaleDateString() : typeof value === "string" && value.includes("T") ? new Date(value).toLocaleDateString("en-GB") : String(value);
  return <div className="responsive-table"><table><thead><tr>{columns.map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead><tbody>{rows.slice(0, 30).map((row, index) => <tr key={row.id ?? row.pair ?? row.securityCode ?? index}>{columns.map(([key]) => <td key={key}>{format(row[key])}</td>)}</tr>)}</tbody></table></div>;
}

function YieldCurveWorkspace() {
  const curve = trpc.market.yieldCurve.useQuery(undefined, { refetchInterval: 60_000, refetchOnWindowFocus: true });
  const data = useMemo(() => curve.data?.map((point: any) => ({ tenor: point.tenor, yield: Number(point.yield) })) ?? [], [curve.data]);
  return (
    <section className="workspace-panel">
      <div className="section-heading"><div><p className="eyebrow">CBK OBSERVATIONS · PYTHON INTERPOLATION</p><h2>Kenyan sovereign yield curve</h2><p>Compare yields across maturities using the validated points FINTEL currently has.</p></div><Status value={data.length ? "CURRENT" : curve.isLoading ? "LOADING" : "DATA REQUIRED"} /></div>
      {data.length ? <div className="curve-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 12, right: 16, left: -16, bottom: 0 }}><defs><linearGradient id="workspaceCurveFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c89d4a" stopOpacity={0.3}/><stop offset="100%" stopColor="#c89d4a" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#ffffff12" vertical={false}/><XAxis dataKey="tenor" tick={{ fill: "#b5c4bb", fontSize: 11 }} axisLine={false} tickLine={false}/><YAxis tick={{ fill: "#b5c4bb", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`}/><Tooltip contentStyle={{ background: "#102523", border: "1px solid #8bae9c44", borderRadius: 12, color: "#f4eee1" }} formatter={(value: any) => [`${Number(value).toFixed(2)}%`, "Yield"]}/><Area type="monotone" dataKey="yield" stroke="#d2aa58" strokeWidth={2.5} fill="url(#workspaceCurveFill)" dot={{ r: 3, fill: "#102523", stroke: "#d2aa58", strokeWidth: 2 }}/></AreaChart></ResponsiveContainer></div> : <div className="empty-state"><LineChart size={22}/><strong>{curve.isLoading ? "Loading the curve" : "More observations are needed"}</strong><p>FINTEL needs at least two validated points before it draws a curve. We won't fill the gaps with sample numbers.</p></div>}
      <p className="data-note">Source: saved CBK Treasury Bill and Bond observations · Updated when the market data pipeline runs.</p>
    </section>
  );
}

function FixedIncomeWorkspace() {
  const bills = trpc.treasuryBills.list.useQuery(undefined, { refetchInterval: 60_000 });
  const bonds = trpc.bonds.list.useQuery(undefined, { refetchInterval: 60_000 });
  return <div className="workspace-stack">
    <div className="workspace-two-col">
      <section className="workspace-panel"><div className="section-heading"><div><p className="eyebrow">CBK AUCTION TABLE</p><h2>Treasury Bills</h2><p>Short-term government securities, shown with their published issue dates.</p></div><Status value={bills.data?.status}/></div><DataTable rows={bills.data?.observations ?? []} columns={[["tenorDays","Tenor"],["weightedAverageRate","Average rate (%)"],["issueDate","Issue date"]]}/></section>
      <section className="workspace-panel"><div className="section-heading"><div><p className="eyebrow">CBK AUCTION RESULTS</p><h2>Treasury Bonds</h2><p>Validated bond fields from official auction-result documents.</p></div><Status value={bonds.data?.status}/></div><DataTable rows={bonds.data?.observations ?? []} columns={[["securityCode","Security"],["couponRate","Coupon (%)"],["yieldToMaturity","YTM (%)"],["maturityDate","Maturity"]]}/></section>
    </div>
    <p className="data-note">For the full prospectus and settlement terms, always refer to the original CBK publication linked in each record's source details.</p>
  </div>;
}

function DerivativesWorkspace() {
  const [spot, setSpot] = useState("129.5");
  const [strike, setStrike] = useState("130");
  const [tenor, setTenor] = useState("0.5");
  const [rate, setRate] = useState("0.1275");
  const [volatility, setVolatility] = useState("0.16");
  const [model, setModel] = useState<"black_scholes" | "crr" | "monte_carlo">("black_scholes");
  const [optionType, setOptionType] = useState<"call" | "put">("call");
  const [submitted, setSubmitted] = useState<{ model: "black_scholes" | "crr" | "monte_carlo"; spot: number; strike: number; tenorYears: number; rate: number; volatility: number; optionType: "call" | "put" } | null>(null);
  const input = submitted ?? { model: "black_scholes" as const, spot: 129.5, strike: 130, tenorYears: 0.5, rate: 0.1275, volatility: 0.16, optionType: "call" as const };
  const result = trpc.analytics.derivative.useQuery(input, { enabled: Boolean(submitted) });
  function calculate(event: FormEvent) {
    event.preventDefault();
    const values = [spot, strike, tenor, rate, volatility].map(Number);
    if (values.some(value => !Number.isFinite(value)) || values[0] <= 0 || values[1] <= 0 || values[2] <= 0 || values[4] <= 0) {
      toast.error("Check the inputs: prices, time and volatility must be positive numbers.");
      return;
    }
    setSubmitted({ model, spot: values[0], strike: values[1], tenorYears: values[2], rate: values[3], volatility: values[4], optionType });
  }
  return <div className="workspace-two-col">
    <form className="workspace-panel input-panel" onSubmit={calculate}>
      <div className="section-heading"><div><p className="eyebrow">YOUR ASSUMPTIONS</p><h2>Set up a pricing example</h2><p>Enter the figures you want to test. Rates and volatility are decimals, for example 0.12 means 12%.</p></div></div>
      <label>Model<select value={model} onChange={event => setModel(event.target.value as typeof model)}><option value="black_scholes">Black-Scholes-Merton</option><option value="crr">CRR binomial</option><option value="monte_carlo">Monte Carlo</option></select></label>
      <label>Option type<select value={optionType} onChange={event => setOptionType(event.target.value as typeof optionType)}><option value="call">Call</option><option value="put">Put</option></select></label>
      <div className="input-grid">
        <label>Spot price<input value={spot} onChange={event => setSpot(event.target.value)} inputMode="decimal"/></label>
        <label>Strike price<input value={strike} onChange={event => setStrike(event.target.value)} inputMode="decimal"/></label>
        <label>Time to expiry (years)<input value={tenor} onChange={event => setTenor(event.target.value)} inputMode="decimal"/></label>
        <label>Risk-free rate<input value={rate} onChange={event => setRate(event.target.value)} inputMode="decimal"/></label>
        <label>Volatility<input value={volatility} onChange={event => setVolatility(event.target.value)} inputMode="decimal"/></label>
      </div>
      <Button type="submit" className="button button--gold">{result.isFetching ? "Calculating…" : "Calculate price"}</Button>
      <p className="data-note">The starting values are examples only. They are not current CBK or interbank quotes.</p>
    </form>
    <section className="workspace-panel calculation-panel">
      <p className="eyebrow">MODEL OUTPUT</p><h2>Your pricing result</h2>
      {result.data ? <><div className="result-value">{Number(result.data.price).toFixed(4)}</div><div className="result-grid">{[["Delta", result.data.delta],["Gamma", result.data.gamma],["Vega", result.data.vega],["Theta", result.data.theta],["Rho", result.data.rho]].map(([name, value]) => <div key={name as string}><span>{name}</span><strong>{Number(value).toFixed(4)}</strong></div>)}</div><Status value="QUANT ENGINE RESULT"/></> : <div className="empty-state"><BarChart3 size={22}/><strong>Run a calculation to see the result</strong><p>Nothing runs until you submit your assumptions. Each output is calculated by the FINTEL Python engine.</p></div>}
    </section>
  </div>;
}

function RiskWorkspace() {
  const { user } = useAuth();
  const role = user?.role ?? "viewer";
  const canRead = ["admin", "analyst", "client"].includes(role);
  const risk = trpc.analytics.risk.useQuery(undefined, { enabled: Boolean(user && canRead) });
  return <section className="workspace-panel">
    <div className="section-heading"><div><p className="eyebrow">OWNER-SCOPED RISK</p><h2>Risk should start with real holdings</h2><p>Once your positions and aligned market history are in place, FINTEL can calculate the measures below.</p></div><Status value={risk.data ? risk.data.historical_status : risk.isLoading ? "LOADING" : "DATA REQUIRED"}/></div>
    {risk.data ? <div className="workspace-metric-grid">{[["Portfolio VaR", `KES ${(risk.data.parametric_var_kes/1_000_000).toFixed(2)}M`],["Expected shortfall", `KES ${(risk.data.cvar_expected_shortfall_kes/1_000_000).toFixed(2)}M`],["DV01", `KES ${risk.data.portfolio_dv01.toFixed(2)}`],["Drawdown", risk.data.max_drawdown_pct == null ? "DATA REQUIRED" : `${risk.data.max_drawdown_pct.toFixed(2)}%`]].map(([label,value]) => <SpotlightCard key={label} className="workspace-metric"><span className="eyebrow">{label}</span><strong>{value}</strong></SpotlightCard>)}</div> : <div className="empty-state"><ShieldCheck size={24}/><strong>{canRead ? "Your risk workspace is ready for your holdings" : "Sign in with portfolio access to view risk"}</strong><p>FINTEL needs a saved portfolio and the right historical observations before it can show portfolio risk. No synthetic history is used.</p><a className="button button--outline" href="/portfolio"><Target size={15}/> Open portfolio</a></div>}
  </section>;
}

function ModelsWorkspace() {
  const models = trpc.models.registry.useQuery(undefined, { refetchInterval: 60_000 });
  return <section className="workspace-panel"><div className="section-heading"><div><p className="eyebrow">CALCULATION REGISTRY</p><h2>What the engine can run</h2><p>Each model shows its input requirements so you know what is behind the output.</p></div><Status value={models.data?.length ? "READY" : "LOADING"}/></div>
    <div className="model-list">{(models.data ?? []).map((item: any) => <div className="model-row" key={item.model}><div><strong>{item.model}</strong><p>{item.input}</p><small>{item.output}</small></div><Status value={item.status}/></div>)}</div>
  </section>;
}

function DataWorkspace() {
  const health = trpc.data.sources.useQuery(undefined, { refetchInterval: 60_000 });
  const coverage = trpc.data.coverage.useQuery(undefined, { refetchInterval: 120_000 });
  return <div className="workspace-stack">
    <section className="workspace-panel"><div className="section-heading"><div><p className="eyebrow">SOURCE HEALTH</p><h2>Where the data stands</h2><p>We show when a source last succeeded and whether the latest observation is still within its expected update window.</p></div><Status value={health.isLoading ? "LOADING" : "CONNECTED"}/></div>
      <div className="source-list">{(health.data?.sources ?? []).map((source: any) => <div key={source.name} className="source-row"><div><strong>{source.name}</strong><p>{source.sourceUrl ?? source.endpoint ?? source.sourceType ?? "Source details not recorded"}</p><small>Last successful update: {source.lastSuccessfulUpdate ? new Date(source.lastSuccessfulUpdate).toLocaleString("en-GB", { timeZone: "Africa/Nairobi" }) : "Not recorded"}</small></div><Status value={source.status}/></div>)}</div>
    </section>
    <section className="workspace-panel"><div className="section-heading"><div><p className="eyebrow">HISTORICAL COVERAGE</p><h2>What history is available?</h2></div><Status value={coverage.data?.status ?? "LOADING"}/></div><div className="coverage-summary"><strong>{coverage.data?.totalRecords?.toLocaleString?.() ?? "—"}</strong><span>validated historical observations</span></div><p className="data-note">Coverage varies by instrument. A portfolio risk calculation will say when a particular instrument is missing enough history.</p></section>
  </div>;
}

function SettingsWorkspace() {
  const { user } = useAuth();
  const preferences = trpc.settings.preferences.useQuery();
  return <div className="workspace-two-col">
    <section className="workspace-panel"><p className="eyebrow">YOUR ACCOUNT</p><h2>Good to have you here.</h2><p>These are the account and regional defaults currently used by this workspace.</p><div className="settings-detail"><span>Signed-in account</span><strong>{user?.name ?? user?.email ?? "Guest"}</strong></div><div className="settings-detail"><span>Access role</span><strong>{user?.role ?? "Viewer"}</strong></div><div className="settings-detail"><span>Base currency</span><strong>{preferences.data?.baseCurrency ?? "KES"}</strong></div><div className="settings-detail"><span>Time zone</span><strong>{preferences.data?.timezone ?? "Africa/Nairobi"}</strong></div></section>
    <section className="workspace-panel"><p className="eyebrow">PRIVACY & SECURITY</p><h2>Your choices are easy to find</h2><div className="settings-links"><a href="/privacy">Privacy policy <ArrowUpRight size={15}/></a><a href="/cookies">Cookie policy <ArrowUpRight size={15}/></a><a href="/terms">Terms of use <ArrowUpRight size={15}/></a><a href="/disclaimer">Financial disclaimer <ArrowUpRight size={15}/></a><a href="/security">Security overview <ArrowUpRight size={15}/></a></div><p className="data-note">Use the small Cookie settings control at the bottom of the page to change your saved preferences.</p></section>
  </div>;
}

function AboutWorkspace() {
  return <div className="workspace-two-col about-grid">
    <PhotoPanel photo={fintelPhotos.localBusiness} className="about-photo"/>
    <section className="workspace-panel"><p className="eyebrow">WHY WE'RE BUILDING THIS</p><h2>Financial information should feel less distant.</h2><p>FINTEL is an independent project focused on Kenya. The goal is simple: make public market information easier to follow, give people a place to explore quantitative ideas, and be honest about what the data can and cannot tell us.</p><p>Some parts are already connected to public CBK observations. Others are still being built. We would rather show you a clear gap than pretend a feature is finished.</p><div className="settings-links"><a href="/markets">Explore market data <ArrowUpRight size={15}/></a><a href="/research">Visit the research workspace <ArrowUpRight size={15}/></a><a href="/academy">Browse learning resources <ArrowUpRight size={15}/></a></div></section>
  </div>;
}

export default function Workspace({ path }: { path: string }) {
  const page = (path.replace(/^\//, "") || "markets") as WorkspaceKey;
  const safePage: WorkspaceKey = page in config ? page : "markets";
  const content = safePage === "markets" ? <MarketWorkspace/> : safePage === "yield-curve" ? <YieldCurveWorkspace/> : safePage === "fixed-income" ? <FixedIncomeWorkspace/> : safePage === "derivatives" ? <DerivativesWorkspace/> : safePage === "risk" ? <RiskWorkspace/> : safePage === "portfolio" ? <PortfolioWorkspacePage/> : safePage === "models" ? <ModelsWorkspace/> : safePage === "data" ? <DataWorkspace/> : safePage === "settings" ? <SettingsWorkspace/> : <AboutWorkspace/>;
  return <PageShell page={safePage}>{content}</PageShell>;
}

function PortfolioWorkspacePage() {
  const { user } = useAuth();
  const role = user?.role ?? "viewer";
  const canWrite = role === "admin" || role === "analyst";
  const canRead = ["admin", "analyst", "client"].includes(role);
  return canRead ? <PortfolioWorkspace canWrite={canWrite}/> : <section className="workspace-panel empty-state"><ShieldCheck size={24}/><strong>Sign in to use your portfolio</strong><p>Your saved holdings are private to your account.</p></section>;
}
