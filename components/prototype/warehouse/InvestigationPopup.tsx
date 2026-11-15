"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { AlertTriangle, Check, X } from "lucide-react";
import type { EvidenceItem } from "./evidenceStore";

interface InvestigationPopupProps {
  item: EvidenceItem;
  collected: boolean;
  onCollect: () => void;
  onClose: () => void;
}

/**
 * Screen-centred 2D investigation panel — a DOM overlay in the web app, not
 * an object inside the Spline scene. GSAP fades + scales it in and out.
 */
export default function InvestigationPopup({ item, collected, onCollect, onClose }: InvestigationPopupProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const closingRef = useRef(false);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const panel = panelRef.current!;
      gsap
        .timeline()
        .fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "power2.out" })
        .fromTo(panel, { opacity: 0, scale: 0.92, y: 12 }, { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: "power3.out" }, 0.08)
        .fromTo(
          panel.querySelectorAll("[data-reveal]"),
          { opacity: 0, y: 6 },
          { opacity: 1, y: 0, duration: 0.3, stagger: 0.05, ease: "power2.out" },
          0.25,
        );
    });
    closeBtnRef.current?.focus({ preventScroll: true });
    return () => ctx.revert();
  }, []);

  const animateOut = (after: () => void) => {
    if (closingRef.current) return;
    closingRef.current = true;
    gsap
      .timeline({ onComplete: after })
      .to(panelRef.current, { opacity: 0, scale: 0.96, duration: 0.22, ease: "power2.in" })
      .to(backdropRef.current, { opacity: 0, duration: 0.25, ease: "power2.in" }, 0.05);
  };

  const handleClose = () => animateOut(onClose);
  const handleCollect = () => {
    onCollect();
    animateOut(onClose);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={backdropRef}
      className="absolute inset-0 z-10 grid place-items-center p-4 backdrop-blur-[2px]"
      style={{ background: "radial-gradient(ellipse at center, rgba(8,12,18,0.45), rgba(8,12,18,0.8))" }}
      onPointerDown={(e) => e.target === e.currentTarget && handleClose()}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wh-ip-title"
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-[520px] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--nova-gold-600)]/40 bg-[var(--nova-slate-900)]/95 px-6 pb-6 pt-7 text-zinc-100 shadow-[var(--shadow-panel-dark)] sm:px-7"
        style={{ fontFamily: "var(--font-body)" }}
      >
        <div className="absolute inset-x-0 top-0 h-[3px] bg-[var(--nova-gold-500)]" />

        <button
          ref={closeBtnRef}
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="absolute right-3.5 top-3.5 grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] text-zinc-400 hover:bg-white/5 hover:text-white focus-visible:bg-white/5 focus-visible:text-white focus-visible:outline-none"
        >
          <X size={16} />
        </button>

        <span data-reveal className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--nova-gold-400)]">
          <AlertTriangle size={15} />
          {item.label}
        </span>

        <h2 id="wh-ip-title" data-reveal className="mt-3 text-[26px] font-extrabold leading-tight">
          {item.title}
        </h2>
        <p data-reveal className="mt-1 text-sm text-zinc-400">{item.location}</p>

        <div data-reveal className="mt-5 rounded-[var(--radius-md)] border border-white/[0.07] bg-white/[0.04] px-4 py-4 shadow-[var(--shadow-inset-well)]">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <span className="text-[13px] text-zinc-400">{item.detailLabel}</span>
            <strong className="whitespace-nowrap text-base tracking-wide text-[var(--nova-gold-300)]" style={{ fontFamily: "var(--font-mono)" }}>
              {item.detailValue}
            </strong>
          </div>
          {item.system && (
            <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-3">
              <span className="text-[13px] text-zinc-400">System</span>
              <span className="text-[13px] font-semibold text-zinc-200">{item.system}</span>
            </div>
          )}
          {item.checklist && item.checklist.length > 0 && (
            <ul className="mt-3.5 divide-y divide-white/[0.06] rounded-[var(--radius-sm)] border border-white/[0.06] bg-black/15">
              {item.checklist.map((row) => (
                <li key={row.label} className="flex items-baseline justify-between gap-3 px-3 py-2 text-[13px]">
                  <span className="text-zinc-300">{row.label}</span>
                  <span
                    className={`whitespace-nowrap text-right font-semibold ${
                      row.tone === "ok" ? "text-[var(--nova-lime-300)]" : row.tone === "bad" ? "text-red-300" : "text-[var(--nova-gold-300)]"
                    }`}
                  >
                    {row.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <blockquote className="mt-3.5 text-[15px] leading-relaxed text-zinc-300">
            “{item.body.replace(/FLT-204B/g, "FLT‑204B")}”
          </blockquote>
        </div>

        <div data-reveal className="mt-6 flex flex-wrap justify-end gap-2.5">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 rounded-[var(--radius-sm)] border border-zinc-600 px-5 py-2.5 text-sm font-bold text-zinc-300 hover:bg-white/5 sm:flex-none"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleCollect}
            disabled={collected}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--nova-gold-500)] bg-[var(--nova-gold-500)] px-5 py-2.5 text-sm font-bold text-[var(--nova-slate-950)] hover:bg-[var(--nova-gold-400)] disabled:cursor-default disabled:border-[var(--nova-gold-700)] disabled:bg-[var(--nova-gold-900)]/60 disabled:text-[var(--nova-gold-300)] sm:flex-none"
          >
            {collected ? (<><Check size={15} /> Evidence Collected</>) : "Collect Evidence"}
          </button>
        </div>
      </section>
    </div>
  );
}
