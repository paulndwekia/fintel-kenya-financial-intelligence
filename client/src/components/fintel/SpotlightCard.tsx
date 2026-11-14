import type { CSSProperties, ReactNode } from "react";

type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
  tone?: "jade" | "brass" | "clay" | "orchid";
};

/** A plain surface wrapper for the FINTEL card layout. */
export function SpotlightCard({ children, className = "" }: SpotlightCardProps) {
  return <div className={`fintel-spotlight ${className}`}>{children}</div>;
}

export function SpotlightStyle({ className = "", style = {} }: { className?: string; style?: CSSProperties }) {
  return <span className={className} style={style} aria-hidden="true" />;
}
