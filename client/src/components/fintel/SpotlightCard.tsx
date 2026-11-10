import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";

type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
  tone?: "jade" | "brass" | "clay" | "orchid";
};

const tones = {
  jade: "rgba(125, 184, 158, .17)",
  brass: "rgba(213, 166, 76, .16)",
  clay: "rgba(217, 139, 114, .15)",
  orchid: "rgba(170, 156, 203, .17)",
};

export function SpotlightCard({ children, className = "", tone = "jade" }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  function moveLight(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") return;
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    node.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
    node.style.setProperty("--spot-color", tones[tone]);
    node.style.setProperty("--spot-opacity", "1");
  }

  function clearLight() {
    ref.current?.style.setProperty("--spot-opacity", "0");
  }

  return (
    <div
      ref={ref}
      onPointerMove={moveLight}
      onPointerLeave={clearLight}
      className={`fintel-spotlight ${className}`}
    >
      <span className="fintel-spotlight__glow" aria-hidden="true" />
      {children}
    </div>
  );
}

export function SpotlightStyle({ className = "", style = {} }: { className?: string; style?: CSSProperties }) {
  return <span className={className} style={style} aria-hidden="true" />;
}
