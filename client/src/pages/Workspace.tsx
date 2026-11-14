import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { BarChart3, BookOpen, Database, ExternalLink, LineChart, ShieldCheck, Sparkles, Target } from "lucide-react";
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
        <a className="workspace-home-link" href="/"> Home</a>
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
  const history = trpc.yieldCurve.historical.useQuery(undefined, { refetchInterval: 300_000 });
  const [selectedHistoryDate, setSelectedHistoryDate] = useState("");
  const data = useMemo(() => curve.data?.map((point: any) => ({ tenor: point.tenor, yield: Number(point.yield) })) ?? [], [curve.data]);
  const historicalCurves = history.data?.curves ?? [];
  const selectedHistory = historicalCurves.find((item: any) => item.date === selectedHistoryDate) ?? historicalCurves[historicalCurves.length - 1];
  const historicalPoints = selectedHistory?.points ?? [];
  return <div className="workspace-stack">
    <section className="workspace-panel">
      <div className="section-heading"><div><p className="eyebrow">CBK OBSERVED POINTS · IN-RANGE INTERPOLATION</p><h2>Kenyan Treasury Bill curve</h2><p>Short-term yields from the latest validated CBK bill observations. Longer maturities appear only when FINTEL has observed bond yields for them.</p></div><Status value={data.length ? "CURRENT" : curve.isLoading ? "LOADING" : "DATA REQUIRED"} /></div>
      {data.length ? <div className="curve-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 12, right: 16, left: -16, bottom: 0 }}><defs><linearGradient id="workspaceCurveFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c89d4a" stopOpacity={0.3}/><stop offset="100%" stopColor="#c89d4a" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#ffffff12" vertical={false}/><XAxis dataKey="tenor" tick={{ fill: "#b5c4bb", fontSize: 11 }} axisLine={false} tickLine={false}/><YAxis tick={{ fill: "#b5c4bb", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`}/><Tooltip contentStyle={{ background: "#102523", border: "1px solid #8bae9c44", borderRadius: 12, color: "#f4eee1" }} formatter={(value: any) => [`${Number(value).toFixed(2)}%`, "Yield"]}/><Area type="monotone" dataKey="yield" stroke="#d2aa58" strokeWidth={2.5} fill="url(#workspaceCurveFill)" dot={{ r: 3, fill: "#102523", stroke: "#d2aa58", strokeWidth: 2 }}/></AreaChart></ResponsiveContainer></div> : <div className="empty-state"><LineChart size={22}/><strong>{curve.isLoading ? "Loading the curve" : "More observations are needed"}</strong><p>At least two validated maturities are required. FINTEL does not extrapolate unsupported long-term yields.</p></div>}
      <p className="data-note">The curve is limited to observed maturities. No 2Y–30Y values are generated from short-term bill rates.</p>
    </section>
    <section className="workspace-panel">
      <div className="section-heading"><div><p className="eyebrow">HISTORICAL AUCTION OBSERVATIONS</p><h2>Replay the short end</h2><p>Choose an observation date to compare the 91-, 182- and 364-day Treasury Bill rates recorded by CBK.</p></div><Status value={history.data?.status ?? (history.isLoading ? "LOADING" : "DATA REQUIRED")}/></div>
      {historicalCurves.length ? <><label className="history-date-control">Observation date<select value={selectedHistory?.date ?? ""} onChange={(event) => setSelectedHistoryDate(event.target.value)}>{historicalCurves.slice().reverse().map((item: any) => <option key={item.date} value={item.date}>{item.date}</option>)}</select></label><div className="curve-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={historicalPoints} margin={{ top: 12, right: 16, left: -16, bottom: 0 }}><CartesianGrid stroke="#ffffff12" vertical={false}/><XAxis dataKey="tenor" tick={{ fill: "#b5c4bb", fontSize: 11 }} axisLine={false} tickLine={false}/><YAxis tick={{ fill: "#b5c4bb", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`}/><Tooltip contentStyle={{ background: "#102523", border: "1px solid #8bae9c44", borderRadius: 12, color: "#f4eee1" }} formatter={(value: any) => [`${Number(value).toFixed(3)}%`, "Observed rate"]}/><Area type="monotone" dataKey="yield" stroke="#8fb9a2" strokeWidth={2.5} fill="#8fb9a2" fillOpacity={0.15} dot={{ r: 3 }}/></AreaChart></ResponsiveContainer></div><DataTable rows={historicalPoints} columns={[[ "tenor", "Tenor" ], [ "maturityYears", "Maturity (years)" ], [ "yield", "Observed rate (%)" ]]}/></> : <div className="empty-state"><LineChart size={22}/><strong>{history.isLoading ? "Loading historical observations" : "Historical bill-rate coverage is not available yet"}</strong><p>Once the CBK historical Treasury Bill series is populated, each available date will appear here. Long-term bond history is not implied.</p></div>}
      <p className="data-note">Source: validated CBK historical Treasury Bill average-rate observations. Dates with fewer than two tenors are not drawn as a curve.</p>
    </section>
  </div>;
}

function FixedIncomeWorkspace() {
  const bills = trpc.treasuryBills.list.useQuery(undefined, { refetchInterval: 60_000 });
  const bonds = trpc.bonds.list.useQuery(undefined, { refetchInterval: 60_000 });
  const [faceValue, setFaceValue] = useState("100000");
  const [couponRate, setCouponRate] = useState("14.5");
  const [ytm, setYtm] = useState("15.2");
  const [years, setYears] = useState("5");
  const [frequency, setFrequency] = useState("2");
  const [submitted, setSubmitted] = useState<{ faceValue:number; couponRate:number; ytm:number; years:number; frequency:number } | null>(null);
  const bondResult = trpc.analytics.bond.useQuery(submitted ?? { faceValue:100000, couponRate:0.145, ytm:0.152, years:5, frequency:2 }, { enabled: Boolean(submitted) });

  function calculateBond(event: FormEvent) {
    event.preventDefault();
    const face = Number(faceValue);
    const coupon = Number(couponRate);
    const yieldToMaturity = Number(ytm);
    const maturity = Number(years);
    const paymentsPerYear = Number(frequency);
    if (![face,coupon,yieldToMaturity,maturity,paymentsPerYear].every(Number.isFinite)
      || face <= 0 || face > 1_000_000_000_000
      || coupon < 0 || coupon > 100 || yieldToMaturity <= -99 || yieldToMaturity >= 100
      || maturity <= 0 || maturity > 100 || ![1,2,4].includes(paymentsPerYear)) {
      toast.error("Check the bond inputs. Use a positive face value, a coupon from 0% to 100%, a yield above -99%, and a maturity up to 100 years.");
      return;
    }
    setSubmitted({ faceValue:face, couponRate:coupon/100, ytm:yieldToMaturity/100, years:maturity, frequency:paymentsPerYear });
  }

  const scenarioRows = bondResult.data?.scenarios ? Object.entries(bondResult.data.scenarios).map(([scenario, values]: [string, any]) => ({ scenario, ...values })) : [];
  return <div className="workspace-stack">
    <div className="workspace-two-col">
      <section className="workspace-panel"><div className="section-heading"><div><p className="eyebrow">CBK AUCTION TABLE</p><h2>Treasury Bills</h2><p>Short-term government securities, shown with their published issue dates.</p></div><Status value={bills.data?.status}/></div><DataTable rows={bills.data?.observations ?? []} columns={[["tenorDays","Tenor"],["weightedAverageRate","Average rate (%)"],["issueDate","Issue date"]]}/></section>
      <section className="workspace-panel"><div className="section-heading"><div><p className="eyebrow">CBK AUCTION RESULTS</p><h2>Treasury Bonds</h2><p>Validated bond fields from official auction-result documents.</p></div><Status value={bonds.data?.status}/></div><DataTable rows={bonds.data?.observations ?? []} columns={[["securityCode","Security"],["couponRate","Coupon (%)"],["yieldToMaturity","YTM (%)"],["maturityDate","Maturity"]]}/></section>
    </div>
    <div className="workspace-two-col">
      <form className="workspace-panel input-panel" onSubmit={calculateBond}>
        <div className="section-heading"><div><p className="eyebrow">FIXED-INCOME ANALYTICS</p><h2>Price a bond from its terms</h2><p>Enter a face value, coupon, market yield and remaining maturity. Rates are entered as percentages.</p></div></div>
        <div className="input-grid">
          <label>Face value (KES)<input value={faceValue} onChange={event => setFaceValue(event.target.value)} inputMode="decimal"/></label>
          <label>Annual coupon rate (%)<input value={couponRate} onChange={event => setCouponRate(event.target.value)} inputMode="decimal"/></label>
          <label>Yield to maturity (%)<input value={ytm} onChange={event => setYtm(event.target.value)} inputMode="decimal"/></label>
          <label>Years to maturity<input value={years} onChange={event => setYears(event.target.value)} inputMode="decimal"/></label>
          <label>Coupon frequency<select value={frequency} onChange={event => setFrequency(event.target.value)}><option value="1">Annual</option><option value="2">Semi-annual</option><option value="4">Quarterly</option></select></label>
        </div>
        <Button type="submit" className="button button--gold">{bondResult.isFetching ? "Calculating…" : "Calculate bond value"}</Button>
        <p className="data-note">This is a theoretical clean-price calculation. It excludes accrued interest, tax, settlement costs and dealer spreads; it is not a live CBK quote.</p>
      </form>
      <section className="workspace-panel calculation-panel">
        <p className="eyebrow">BOND MODEL OUTPUT</p><h2>Valuation and rate sensitivity</h2>
        {bondResult.data ? <>
          <div className="result-value">KES {Number(bondResult.data.price).toLocaleString("en-KE",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
          <div className="result-grid">{[
            ["Macaulay duration",bondResult.data.macaulay_duration],
            ["Modified duration",bondResult.data.modified_duration],
            ["Convexity",bondResult.data.convexity],
            ["DV01 (KES)",bondResult.data.dv01],
          ].map(([label,value])=><div key={String(label)}><span>{label}</span><strong>{Number(value).toFixed(4)}</strong></div>)}</div>
          <p className="eyebrow">DURATION–CONVEXITY SCENARIOS</p>
          <DataTable rows={scenarioRows} columns={[["scenario","Yield shift"],["new_ytm","New YTM"],["estimated_price","Estimated clean price"],["pct_change","Price change (%)"]]}/>
        </> : bondResult.isError ? <div className="empty-state"><strong>Calculation could not be completed</strong><p>{bondResult.error.message}</p></div> : <div className="empty-state"><BarChart3 size={22}/><strong>Enter the terms to value the bond</strong><p>Price, Macaulay duration, modified duration, convexity and DV01 will be calculated by the FINTEL Python engine.</p></div>}
      </section>
    </div>
    <p className="data-note">For prospectus terms and official auction yields, refer to the original CBK publication linked in each record's source details.</p>
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
  const canRead = ["admin", "analyst", "client", "viewer"].includes(role);
  const risk = trpc.analytics.risk.useQuery(undefined, { enabled: Boolean(user && canRead) });
  return <section className="workspace-panel">
    <div className="section-heading"><div><p className="eyebrow">OWNER-SCOPED RISK</p><h2>Risk should start with real holdings</h2><p>Measures are calculated from the signed-in user's saved portfolio and the observations available for those instruments.</p></div><Status value={risk.isError ? "ERROR" : risk.data ? risk.data.historical_status : risk.isLoading ? "LOADING" : "DATA REQUIRED"}/></div>
    {risk.data ? <>
      <div className="workspace-metric-grid">{[
        ["Portfolio VaR", `KES ${(risk.data.parametric_var_kes/1_000_000).toFixed(2)}M`],
        ["Parametric expected shortfall", `KES ${(risk.data.cvar_expected_shortfall_kes/1_000_000).toFixed(2)}M`],
        ["DV01", `KES ${risk.data.portfolio_dv01.toFixed(2)}`],
        ["Observed maximum drawdown", risk.data.max_drawdown_pct == null ? "DATA REQUIRED" : `${risk.data.max_drawdown_pct.toFixed(2)}%`],
      ].map(([label,value]) => <SpotlightCard key={label} className="workspace-metric"><span className="eyebrow">{label}</span><strong>{value}</strong></SpotlightCard>)}</div>
      <div className="workspace-two-col">
        <section className="workspace-panel"><p className="eyebrow">HISTORICAL RISK</p><h3>Observed portfolio history</h3>
          {risk.data.historical_status === "CURRENT" ? <div className="result-grid"><div><span>Historical VaR</span><strong>KES {Number(risk.data.historical_var_kes).toLocaleString("en-KE",{maximumFractionDigits:0})}</strong></div><div><span>Historical expected shortfall</span><strong>KES {Number(risk.data.historical_expected_shortfall_kes).toLocaleString("en-KE",{maximumFractionDigits:0})}</strong></div><div><span>Aligned observations</span><strong>{risk.data.historical_observations_used ?? "—"}</strong></div></div> : <p className="data-note">Historical VaR, expected shortfall and drawdown are withheld until each holding has enough aligned, validated observations{risk.data.historical_missing_instruments?.length ? `: ${risk.data.historical_missing_instruments.join(", ")}` : "."}</p>}
        </section>
        <section className="workspace-panel"><p className="eyebrow">MODEL CONVENTIONS</p><h3>Read the assumptions</h3><p>Parametric VaR uses the position volatility inputs and a 35% pairwise correlation assumption. It is a model estimate, not a loss guarantee. Stress scenarios are deterministic shocks, not forecasts.</p><p className="data-note">A missing historical series is never replaced with simulated market history.</p></section>
      </div>
      <section className="workspace-panel"><div className="section-heading"><div><p className="eyebrow">SCENARIO ANALYSIS</p><h3>Selected market shocks</h3><p>Indicative portfolio impact under the engine's fixed shock assumptions.</p></div></div>
        <DataTable rows={(risk.data.stress_scenarios ?? []).map((scenario:any)=>({scenario:scenario.name,shock:scenario.factor,impact:scenario.impact_kes}))} columns={[["scenario","Scenario"],["shock","Portfolio shock"],["impact","Estimated impact (KES)"]]}/>
      </section>
    </> : <div className="empty-state"><ShieldCheck size={24}/><strong>{risk.isError ? "Risk calculation failed" : canRead ? "Your risk workspace is ready for your holdings" : "Sign in with portfolio access to view risk"}</strong><p>{risk.isError ? risk.error.message : "FINTEL needs a saved portfolio and the right historical observations before it can show portfolio risk. No synthetic history is used."}</p><a className="button button--outline" href="/portfolio"><Target size={15}/> Open portfolio</a></div>}
  </section>;
}

function ModelsWorkspace() {
  const models = trpc.models.registry.useQuery(undefined, { refetchInterval: 60_000 });
  return <section className="workspace-panel"><div className="section-heading"><div><p className="eyebrow">CALCULATION REGISTRY</p><h2>Models available in FINTEL</h2><p>Each entry shows its inputs and the module where you can run it. A ready engine does not mean the required market or portfolio data is present.</p></div><Status value={models.isError ? "ERROR" : models.data?.length ? "READY" : "LOADING"}/></div>
    <div className="model-list">{(models.data ?? []).map((item: any) => {
      const destination = item.category === "Fixed Income" ? "/fixed-income" : item.category === "Pricing" ? "/derivatives" : "/risk";
      const destinationLabel = item.category === "Fixed Income" ? "Open fixed income" : item.category === "Pricing" ? "Open derivatives lab" : "Open risk";
      return <div className="model-row" key={item.model}><div><strong>{item.model}</strong><p>{item.input}</p><small>{item.output}</small><a className="feature-link" href={destination}>{destinationLabel}</a></div><Status value={item.status}/></div>;
    })}</div>
  </section>;
}

function DataWorkspace() {
  const health = trpc.data.sources.useQuery(undefined, { refetchInterval: 60_000 });
  const coverage = trpc.data.coverage.useQuery(undefined, { refetchInterval: 120_000 });
  const runs = trpc.data.runs.useQuery(undefined, { refetchInterval: 60_000 });
  const sources = health.data?.sources ?? [];
  const overallStatus = health.isLoading ? "LOADING"
    : health.isError ? "ERROR"
      : !sources.length ? "DATA REQUIRED"
        : sources.some((source: any) => source.status === "ERROR") ? "ERROR"
          : sources.some((source: any) => source.status === "STALE") ? "STALE"
            : sources.every((source: any) => source.status === "CURRENT") ? "CURRENT"
              : "DATA REQUIRED";
  return <div className="workspace-stack">
    <section className="workspace-panel"><div className="section-heading"><div><p className="eyebrow">SOURCE HEALTH</p><h2>Where the data stands</h2><p>Freshness is measured against each source's expected publication cycle. A connected endpoint is not automatically a current observation.</p></div><Status value={overallStatus}/></div>
      <div className="source-list">{sources.map((source: any) => <div key={source.name} className="source-row"><div><strong>{source.name}</strong><p>{source.sourceUrl ?? source.endpoint ?? source.sourceType ?? "Source details not recorded"}</p><small>Latest observation: {source.latestObservation ? new Date(source.latestObservation).toLocaleDateString("en-GB", { timeZone: "Africa/Nairobi" }) : "Not recorded"} · Last successful refresh: {source.lastSuccessfulUpdate ? new Date(source.lastSuccessfulUpdate).toLocaleString("en-GB", { timeZone: "Africa/Nairobi" }) : "Not recorded"}</small>{source.error && <small className="data-note">{source.error}</small>}</div><Status value={source.status}/></div>)}</div>
      {health.isError && <p className="data-note">Source health could not be loaded. The page will not label the data as connected until the check succeeds.</p>}
    </section>
    <section className="workspace-panel"><div className="section-heading"><div><p className="eyebrow">INGESTION HISTORY</p><h2>Recent data refreshes</h2><p>Each run records what was saved, what was rejected and whether the source was current.</p></div><Status value={runs.isError ? "ERROR" : runs.isLoading ? "LOADING" : runs.data?.length ? "CURRENT" : "DATA REQUIRED"}/></div>
      <DataTable rows={runs.data ?? []} columns={[[ "sourceName", "Source" ], [ "status", "Result" ], [ "attemptedAt", "Attempted" ], [ "recordsImported", "Saved" ], [ "recordsRejected", "Rejected" ], [ "duplicates", "Duplicates" ], [ "error", "Notes" ]]}/>
    </section>
    <section className="workspace-panel"><div className="section-heading"><div><p className="eyebrow">HISTORICAL COVERAGE</p><h2>What history is available?</h2></div><Status value={coverage.data?.status ?? (coverage.isLoading ? "LOADING" : "ERROR")}/></div><div className="coverage-summary"><strong>{coverage.data?.totalRecords?.toLocaleString?.() ?? "—"}</strong><span>validated historical observations</span></div><div className="source-list">{(coverage.data?.instruments ?? []).map((item: any) => <div className="source-row" key={item.instrument}><div><strong>{item.instrument}</strong><small>{item.start ? new Date(item.start).toLocaleDateString("en-GB") : "—"} to {item.end ? new Date(item.end).toLocaleDateString("en-GB") : "—"}</small></div><strong>{Number(item.count).toLocaleString()} rows</strong></div>)}</div><p className="data-note">Coverage varies by instrument. A portfolio risk calculation will say when an instrument is missing enough aligned history.</p></section>
  </div>;
}

function SettingsWorkspace() {
  const { user, logout } = useAuth();
  const preferences = trpc.settings.preferences.useQuery();
  return <div className="workspace-two-col">
    <section className="workspace-panel"><p className="eyebrow">YOUR ACCOUNT</p><h2>Good to have you here.</h2><p>These are the account and regional defaults currently used by this workspace.</p><div className="settings-detail"><span>Signed-in account</span><strong>{user?.name ?? user?.email ?? "Guest"}</strong></div><div className="settings-detail"><span>Access role</span><strong>{user?.role ?? "Viewer"}</strong></div><div className="settings-detail"><span>Base currency</span><strong>{preferences.data?.baseCurrency ?? "KES"}</strong></div><div className="settings-detail"><span>Time zone</span><strong>{preferences.data?.timezone ?? "Africa/Nairobi"}</strong></div><Button type="button" className="button button--outline" onClick={() => void logout()}>Sign out</Button></section>
    <section className="workspace-panel"><p className="eyebrow">PRIVACY & SECURITY</p><h2>Your choices are easy to find</h2><div className="settings-links"><a href="/privacy">Privacy policy </a><a href="/cookies">Cookie policy </a><a href="/terms">Terms of use </a><a href="/disclaimer">Financial disclaimer </a><a href="/security">Security overview </a></div><p className="data-note">Use the small Cookie settings control at the bottom of the page to change your saved preferences.</p></section>
  </div>;
}

function AboutWorkspace() {
  return <div className="workspace-two-col about-grid">
    <PhotoPanel photo={fintelPhotos.localBusiness} className="about-photo"/>
    <section className="workspace-panel"><p className="eyebrow">WHY WE'RE BUILDING THIS</p><h2>Financial information should feel less distant.</h2><p>FINTEL is an independent project focused on Kenya. The goal is simple: make public market information easier to follow, give people a place to explore quantitative ideas, and be honest about what the data can and cannot tell us.</p><p>Some parts are already connected to public CBK observations. Others are still being built. We would rather show you a clear gap than pretend a feature is finished.</p><div className="settings-links"><a href="/markets">Explore market data </a><a href="/research">Visit the research workspace </a><a href="/academy">Browse learning resources </a></div></section>
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
  const canRead = ["admin", "analyst", "client", "viewer"].includes(role);
  return canRead ? <PortfolioWorkspace canWrite={canWrite}/> : <section className="workspace-panel empty-state"><ShieldCheck size={24}/><strong>Sign in to use your portfolio</strong><p>Your saved holdings are private to your account.</p></section>;
}
