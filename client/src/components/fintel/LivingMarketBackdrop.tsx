import { motion } from "framer-motion";

export function LivingMarketBackdrop() {
  return <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden opacity-60">
    <motion.div className="absolute -right-20 top-10 h-72 w-72 rounded-full bg-emerald-400/[.045] blur-3xl" animate={{ x: [0, -30, 10, 0], y: [0, 25, -10, 0], scale: [1, 1.08, .96, 1] }} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }} />
    <motion.div className="absolute left-1/3 top-1/4 h-40 w-40 rounded-full bg-sky-400/[.025] blur-3xl" animate={{ x: [0, 35, -15, 0], y: [0, -20, 15, 0] }} transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }} />
    <svg className="absolute inset-x-0 top-0 h-56 w-full" preserveAspectRatio="none" viewBox="0 0 1000 220" fill="none">
      <motion.path d="M0 170 C120 140 160 185 270 150 S430 95 520 135 S690 190 780 120 S900 80 1000 110" stroke="currentColor" className="text-emerald-300/[.07]" strokeWidth="1.2" animate={{ pathLength: [0.65, 1, .72] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }} />
      <path d="M0 195 C150 160 240 190 350 165 S540 130 650 155 S820 185 1000 145" stroke="currentColor" className="text-slate-300/[.04]" strokeWidth="1" />
    </svg>
  </div>;
}
