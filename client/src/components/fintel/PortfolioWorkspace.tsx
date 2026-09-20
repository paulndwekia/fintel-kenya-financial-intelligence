import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { DataDetails } from "@/components/fintel/DataDetails";
import { toast } from "sonner";

type PortfolioWorkspaceProps = { canWrite: boolean };

type PositionForm = {
  instrument: string;
  assetClass: string;
  quantity: string;
  marketValueKes: string;
  priceKes: string;
  duration: string;
  volatility: string;
};

const emptyPosition: PositionForm = {
  instrument: "",
  assetClass: "Government Security",
  quantity: "",
  marketValueKes: "",
  priceKes: "",
  duration: "",
  volatility: "",
};

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function PortfolioWorkspace({ canWrite }: PortfolioWorkspaceProps) {
  const [portfolioName, setPortfolioName] = useState("");
  const [portfolioDescription, setPortfolioDescription] = useState("");
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);
  const [position, setPosition] = useState<PositionForm>(emptyPosition);
  const utils = trpc.useUtils();
  const portfoliosQuery = trpc.portfolio.list.useQuery(undefined, { enabled: true });
  const portfolios = portfoliosQuery.data?.portfolios ?? [];
  const selectedPortfolio = useMemo(() => portfolios.find((item) => item.id === selectedPortfolioId) ?? portfolios[0], [portfolios, selectedPortfolioId]);
  const positionsQuery = trpc.portfolio.detail.useQuery(
    { portfolioId: selectedPortfolio?.id ?? 0 },
    { enabled: Boolean(selectedPortfolio?.id) },
  );

  useEffect(() => {
    if (!selectedPortfolioId && portfolios[0]) setSelectedPortfolioId(portfolios[0].id);
  }, [portfolios, selectedPortfolioId]);

  const createPortfolio = trpc.portfolio.create.useMutation({
    onSuccess: async (created) => {
      toast.success("Portfolio created");
      setPortfolioName("");
      setPortfolioDescription("");
      await utils.portfolio.list.invalidate();
      if (created?.id) setSelectedPortfolioId(created.id);
    },
    onError: (error) => toast.error(error.message || "Portfolio creation failed"),
  });

  const addPosition = trpc.portfolio.addPosition.useMutation({
    onSuccess: async () => {
      toast.success("Position persisted");
      setPosition(emptyPosition);
      await Promise.all([utils.portfolio.detail.invalidate(), utils.portfolio.positions.invalidate(), utils.analytics.risk.invalidate()]);
    },
    onError: (error) => toast.error(error.message || "Position entry failed"),
  });

  const handleCreate = () => {
    if (!canWrite || portfolioName.trim().length < 2) return;
    createPortfolio.mutate({ name: portfolioName.trim(), description: portfolioDescription.trim() || undefined, baseCurrency: "KES" });
  };

  const handleAddPosition = () => {
    if (!canWrite || !selectedPortfolio?.id || !position.instrument.trim()) return;
    addPosition.mutate({
      portfolioId: selectedPortfolio.id,
      instrument: position.instrument.trim(),
      assetClass: position.assetClass.trim() || "Unclassified",
      quantity: optionalNumber(position.quantity),
      marketValueKes: optionalNumber(position.marketValueKes),
      priceKes: optionalNumber(position.priceKes),
      duration: optionalNumber(position.duration),
      volatility: optionalNumber(position.volatility),
      currency: "KES",
    });
  };

  return (
    <section className="terminal-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow">PORTFOLIO CONTROL · OWNER SCOPED</div>
          <h3 className="mt-2 text-base font-semibold text-white">Persist positions for real risk analytics</h3>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">Enter validated holdings from the authorised portfolio source. FINTEL will not invent prices, history, VaR, or stress results when fields or aligned observations are missing.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-300"><ShieldCheck size={15} /> Server-side permission enforced</div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
        <div className="rounded-lg border border-white/[.07] bg-white/[.02] p-4">
          <div className="eyebrow">PORTFOLIOS</div>
          {portfolios.length ? (
            <div className="mt-3 space-y-2">
              {portfolios.map((item) => (
                <button key={item.id} onClick={() => setSelectedPortfolioId(item.id)} className={`w-full rounded-md border px-3 py-3 text-left transition ${selectedPortfolio?.id === item.id ? "border-emerald-400/40 bg-emerald-400/[.07]" : "border-white/[.07] bg-black/10 hover:border-white/20"}`}>
                  <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-slate-200">{item.name}</span><span className="text-[10px] uppercase tracking-[.14em] text-slate-500">{item.baseCurrency}</span></div>
                  <div className="mt-1 text-[11px] text-slate-500">{item.description || "No description"}</div>
                </button>
              ))}
            </div>
          ) : <div className="mt-3 rounded-md border border-dashed border-amber-400/20 bg-amber-400/[.04] px-3 py-3 text-xs text-amber-200/80">DATA REQUIRED · create an authorised portfolio before risk can run.</div>}
          {canWrite ? (
            <div className="mt-4 space-y-2 border-t border-white/[.07] pt-4">
              <input value={portfolioName} onChange={(event) => setPortfolioName(event.target.value)} placeholder="Portfolio name" className="terminal-input" aria-label="Portfolio name" />
              <input value={portfolioDescription} onChange={(event) => setPortfolioDescription(event.target.value)} placeholder="Description (optional)" className="terminal-input" aria-label="Portfolio description" />
              <Button onClick={handleCreate} disabled={createPortfolio.isPending || portfolioName.trim().length < 2} className="h-9 w-full bg-emerald-400 text-black hover:bg-emerald-300"><Plus size={14} className="mr-2" />{createPortfolio.isPending ? "Creating…" : "Create KES portfolio"}</Button>
            </div>
          ) : <div className="mt-4 rounded-md border border-white/[.07] px-3 py-2 text-[11px] text-slate-500">READ ONLY · portfolio write permission required.</div>}
        </div>

        <div className="rounded-lg border border-white/[.07] bg-white/[.02] p-4">
          <div className="flex items-center justify-between gap-3"><div><div className="eyebrow">POSITION LEDGER</div><div className="mt-2 text-sm font-medium text-slate-200">{selectedPortfolio?.name ?? "No portfolio selected"}</div></div><button className="icon-button" onClick={() => positionsQuery.refetch()} title="Refresh positions"><RefreshCw size={14} className={positionsQuery.isFetching ? "animate-spin" : ""} /></button></div>
          {positionsQuery.data?.status === "CURRENT" && positionsQuery.data.positions.length ? (
            <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs"><thead className="border-b border-white/[.07] text-[10px] uppercase tracking-[.14em] text-slate-500"><tr><th className="py-2">Instrument</th><th className="py-2">Class</th><th className="py-2 text-right">Market value</th><th className="py-2 text-right">Volatility</th></tr></thead><tbody className="divide-y divide-white/[.06]">{positionsQuery.data.positions.map((item) => <tr key={item.id} className="text-slate-300"><td className="py-3 font-medium text-slate-200">{item.instrument}</td><td className="py-3 text-slate-500">{item.assetClass}</td><td className="py-3 text-right">{item.marketValueKes ? `KES ${Number(item.marketValueKes).toLocaleString()}` : "DATA REQUIRED"}</td><td className="py-3 text-right">{item.volatility ? `${(Number(item.volatility) * 100).toFixed(2)}%` : "DATA REQUIRED"}</td></tr>)}</tbody></table></div>
          ) : <div className="mt-3 rounded-md border border-dashed border-white/[.08] px-3 py-8 text-center text-xs text-slate-600">{selectedPortfolio ? "DATA REQUIRED · no persisted positions" : "Create or select a portfolio to begin"}</div>}
          {canWrite && selectedPortfolio ? (
            <div className="mt-4 grid gap-2 border-t border-white/[.07] pt-4 sm:grid-cols-2">
              <input value={position.instrument} onChange={(event) => setPosition((current) => ({ ...current, instrument: event.target.value }))} placeholder="Instrument / security code" className="terminal-input sm:col-span-2" aria-label="Instrument or security code" />
              <input value={position.assetClass} onChange={(event) => setPosition((current) => ({ ...current, assetClass: event.target.value }))} placeholder="Asset class" className="terminal-input" aria-label="Asset class" />
              <input value={position.quantity} onChange={(event) => setPosition((current) => ({ ...current, quantity: event.target.value }))} placeholder="Quantity" inputMode="decimal" className="terminal-input" aria-label="Quantity" />
              <input value={position.marketValueKes} onChange={(event) => setPosition((current) => ({ ...current, marketValueKes: event.target.value }))} placeholder="Market value (KES)" inputMode="decimal" className="terminal-input" aria-label="Market value in KES" />
              <input value={position.priceKes} onChange={(event) => setPosition((current) => ({ ...current, priceKes: event.target.value }))} placeholder="Price (KES)" inputMode="decimal" className="terminal-input" aria-label="Price in KES" />
              <input value={position.duration} onChange={(event) => setPosition((current) => ({ ...current, duration: event.target.value }))} placeholder="Duration (years)" inputMode="decimal" className="terminal-input" aria-label="Duration in years" />
              <input value={position.volatility} onChange={(event) => setPosition((current) => ({ ...current, volatility: event.target.value }))} placeholder="Volatility (decimal)" inputMode="decimal" className="terminal-input" aria-label="Volatility decimal" />
              <Button onClick={handleAddPosition} disabled={addPosition.isPending || !position.instrument.trim()} className="h-9 bg-white/[.08] text-slate-200 hover:bg-white/[.14] sm:col-span-2">{addPosition.isPending ? "Persisting…" : "Persist position"}</Button>
            </div>
          ) : null}
          <DataDetails lineage={{ source: "FINTEL portfolio database", status: positionsQuery.data?.status ?? "DATA REQUIRED", frequency: "ON DEMAND" }} />
        </div>
      </div>
    </section>
  );
}
