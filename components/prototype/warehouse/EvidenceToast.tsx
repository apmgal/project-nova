"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { Check } from "lucide-react";

/** Brief, unobtrusive confirmation that removes itself. */
export default function EvidenceToast({ text, onDone }: { text: string; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const tl = gsap
      .timeline({ onComplete: onDone })
      .fromTo(ref.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out", delay: 0.25 })
      .to(ref.current, { opacity: 0, y: -6, duration: 0.35, ease: "power2.in" }, "+=1.6");
    return () => { tl.kill(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute bottom-7 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-[var(--nova-gold-600)]/50 bg-[var(--nova-slate-950)]/85 px-3.5 py-2 text-[13px] font-semibold text-[var(--nova-gold-300)] opacity-0 backdrop-blur-md"
      style={{ fontFamily: "var(--font-body)" }}
    >
      <Check size={14} />
      {text}
    </div>
  );
}
