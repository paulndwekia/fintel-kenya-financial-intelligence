import { AnimatePresence, motion } from "framer-motion";
import { Info } from "lucide-react";
import { useState } from "react";

export type DataLineage = {
  source?: string | null;
  observationDate?: string | Date | null;
  retrievedDate?: string | Date | null;
  frequency?: string | null;
  status?: string | null;
};

const displayDate = (value?: string | Date | null) => value ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }) : "DATA REQUIRED";

export function DataDetails({ lineage }: { lineage: DataLineage }) {
  const [open, setOpen] = useState(false);
  return <div className="relative mt-3">
    <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[.12em] text-slate-500 transition-colors hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60" aria-expanded={open}>
      <Info size={12} /> Data details
    </button>
    <AnimatePresence initial={false}>
      {open && <motion.div initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }} transition={{ duration: 0.16 }} className="mt-2 grid gap-2 rounded-lg border border-white/[.08] bg-[#11161d] p-3 text-[10px] text-slate-400 shadow-2xl sm:grid-cols-2">
        <div><span className="text-slate-600">SOURCE</span><div className="mt-0.5 truncate text-slate-300">{lineage.source ?? "DATA REQUIRED"}</div></div>
        <div><span className="text-slate-600">STATUS</span><div className="mt-0.5 text-emerald-300">{lineage.status ?? "DATA REQUIRED"}</div></div>
        <div><span className="text-slate-600">OBSERVATION DATE</span><div className="mt-0.5 text-slate-300">{displayDate(lineage.observationDate)}</div></div>
        <div><span className="text-slate-600">RETRIEVED DATE</span><div className="mt-0.5 text-slate-300">{displayDate(lineage.retrievedDate)}</div></div>
        <div className="sm:col-span-2"><span className="text-slate-600">FREQUENCY</span><div className="mt-0.5 text-slate-300">{lineage.frequency ?? "DATA REQUIRED"}</div></div>
      </motion.div>}
    </AnimatePresence>
  </div>;
}
