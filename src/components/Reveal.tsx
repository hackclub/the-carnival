import React from "react";
import { useInView } from "../hooks/useInView";

type RevealProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Optional delay in seconds for staggered reveals */
  delaySec?: number;
  /** Whether to slightly lift and scale on hover */
  hoverLift?: boolean;
};

/**
 * Lightweight replacement for framer-motion reveal-on-scroll and hover lift.
 */
export function Reveal({ delaySec = 0, hoverLift = false, className = "", children, ...rest }: RevealProps) {
  const { ref, inView } = useInView<HTMLDivElement>({ once: true, rootMargin: "0px 0px -10% 0px", threshold: 0.15 });
  const base = "transition-all duration-500 will-change-transform will-change-opacity";
  const hidden = "opacity-0 translate-y-4";
  const visible = "opacity-100 translate-y-0";
  const hover = hoverLift ? "hover:scale-[1.02] hover:-translate-y-0.5" : "";
  const styleDelay = { transitionDelay: `${Math.max(0, delaySec)}s` } as React.CSSProperties;

  return (
    <div ref={ref} className={[base, inView ? visible : hidden, hover, className].filter(Boolean).join(" ")} style={styleDelay} {...rest}>
      {children}
    </div>
  );
}

export default Reveal;



