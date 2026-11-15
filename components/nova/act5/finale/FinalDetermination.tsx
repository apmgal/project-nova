"use client";

import { useEffect, useRef, useState } from "react";
import type { GameState } from "@/lib/nova/types";
import { FINALE_ASSETS, buildDetermination, type DeterminationKind } from "@/lib/nova/finale";

/**
 * The formal determination (PROTOTYPE). A portrait inspection report on the dark cinematic background.
 * Stage 1: the report is drawn up into view (paper, near-silence, the score enters very quietly).
 * Stage 2: header, metadata, 01 Evidence reviewed and 02 Findings — read at the player's own pace.
 * Stage 3: only when the player chooses "View Determination": the music falls away, a held beat, then
 * 03 Final Determination appears in place. Nothing advances on its own; Continue sits outside the report.
 * Content comes from buildDetermination (lib/nova/finale.ts) — the saved state, never invented.
 */
const PAPER = "#f7f4ee";
const INK = "#18212c";
const INK_2 = "#3a4450";
const MUTED = "#6b7480";
const RULE = "#d9d3c7";
const NAVY = "#1b2433";
const OUTCOME_ACCENT: Record<DeterminationKind, string> = { satisfactory: "#2f5d46", conditional: "#8a6a1f", unsatisfactory: "#7a2e2a" };

export default function FinalDetermination({
  state,
  muted,
  resumed,
  viewed,
  onView,
  onContinue,
}: {
  state: GameState;
  muted: boolean;
  /** Re-entering after it was already opened: no opening animation. */
  resumed: boolean;
  /** The player already chose to view the determination (resume). */
  viewed: boolean;
  onView: () => void;
  onContinue: () => void;
}) {
  const d = buildDetermination(state);
  const [shown, setShown] = useState(resumed); // stage 1 done
  const [canView, setCanView] = useState(resumed);
  const [revealing, setRevealing] = useState(false); // stage 3 — the held beat
  const [revealed, setRevealed] = useState(viewed);
  const [canContinue, setCanContinue] = useState(viewed);
  const [leaving, setLeaving] = useState(false);
  const outcomeRef = useRef<HTMLDivElement | null>(null);

  // --- sound ------------------------------------------------------------------------------------------
  const mutedRef = useRef(muted);
  const music = useRef<HTMLAudioElement | null>(null);
  const extras = useRef<HTMLAudioElement[]>([]);
  useEffect(() => {
    mutedRef.current = muted;
    [music.current, ...extras.current].forEach((a) => { if (a) a.muted = muted; });
  }, [muted]);
  const ramp = (a: HTMLAudioElement | null, to: number, ms: number) => {
    if (!a) return;
    const from = a.volume, t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      try { a.volume = from + (to - from) * k * k * (3 - 2 * k); } catch { return; }
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const timers = useRef<number[]>([]);
  const after = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); };

  useEffect(() => {
    const play = (src: string, volume: number, loop = false) => {
      try {
        const a = new Audio(src);
        a.volume = volume; a.loop = loop; a.muted = mutedRef.current;
        a.play().catch(() => {});
        return a;
      } catch { return null; }
    };
    music.current = play(FINALE_ASSETS.sounds.music, 0, true);
    ramp(music.current, viewed ? 0.26 : 0.12, viewed ? 1500 : 7000);
    if (!resumed) {
      after(500, () => { const p = play(FINALE_ASSETS.sounds.paper, 0.45); if (p) extras.current.push(p); });
      after(120, () => setShown(true));
      after(2800, () => setCanView(true));
    }
    const all = extras.current;
    const ids = timers.current;
    return () => {
      ids.forEach((id) => window.clearTimeout(id));
      music.current?.pause();
      music.current = null;
      all.forEach((a) => a.pause());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const view = () => {
    if (revealing || revealed) return;
    setRevealing(true);
    onView();
    ramp(music.current, 0.02, 900); // near-silence
    after(150, () => outcomeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
    after(1900, () => { setRevealed(true); ramp(music.current, 0.26, 4500); });
    after(4200, () => setCanContinue(true));
  };

  // Continue: the report fades away and the music falls to silence before the next scene (no hard cut).
  const leave = () => {
    if (leaving) return;
    setLeaving(true);
    ramp(music.current, 0, 1100);
    after(1250, () => { music.current?.pause(); onContinue(); });
  };

  const label = "text-[9.5px] font-semibold uppercase tracking-[0.18em]";

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#07090c]">
      <div
        className="mx-auto flex min-h-full w-full max-w-[760px] flex-col items-center px-3 py-8 transition-opacity duration-[1100ms] ease-in-out sm:px-6 sm:py-12"
        style={{ opacity: leaving ? 0 : 1 }}
      >
        <article
          className="w-full shadow-[0_24px_70px_rgba(0,0,0,0.55)] transition-all duration-[1600ms] ease-out"
          style={{
            background: PAPER,
            color: INK,
            minHeight: "min(1000px, 138vw)",
            opacity: shown ? 1 : 0,
            transform: shown ? "none" : "translateY(26px) scale(0.985)",
            fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          }}
          aria-label="Commissioning Inspection — Final Determination"
        >
          <div className="h-[3px]" style={{ background: NAVY }} />
          <div className="px-6 pb-7 pt-6 sm:px-12 sm:pb-9 sm:pt-8">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-7 w-7 place-items-center font-serif text-[11px] tracking-wide text-white" style={{ background: NAVY }} aria-hidden="true">
                  IC
                </span>
                <p className={label} style={{ color: INK_2 }}>Inspection Coordination</p>
              </div>
              <div className="text-right">
                <p className={label} style={{ color: INK_2 }}>Formal Inspection Report</p>
                <p className="mt-1 text-[10.5px] tabular-nums" style={{ color: MUTED }}>Ref. NOVA-CI-FD-01</p>
              </div>
            </div>

            <div className="mt-8 sm:mt-10">
              <p className={label} style={{ color: MUTED }}>Project Nova</p>
              <h1 className="mt-2 font-serif text-[23px] leading-[1.2] sm:text-[27px]" style={{ color: INK }}>
                Commissioning Inspection
                <span className="block" style={{ color: INK_2 }}>Final Determination</span>
              </h1>
            </div>

            {/* Metadata */}
            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-y py-4 sm:grid-cols-3" style={{ borderColor: RULE }}>
              {[
                ["Project", "Project Nova"],
                ["Lead inspector", "Whitfield"],
                ["Report type", "Final Determination"],
                ["Document status", "Final"],
                ["Reference", "NOVA-CI-FD-01"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[9.5px] uppercase tracking-[0.14em]" style={{ color: MUTED }}>{k}</dt>
                  <dd className="mt-0.5 text-[12.5px]" style={{ color: INK }}>{v}</dd>
                </div>
              ))}
            </dl>

            {/* 01 Evidence reviewed */}
            <section className="mt-8">
              <SectionHeading n="01" title="Evidence Reviewed" />
              {d.evidence.length === 0 ? (
                <p className="mt-3 text-[12.5px]" style={{ color: INK_2 }}>No documents were presented during the inspection.</p>
              ) : (
                <div className="mt-3 divide-y" style={{ borderColor: RULE }}>
                  {d.evidence.map((e) => (
                    <div key={e.title} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4" style={{ borderColor: RULE }}>
                      <div>
                        <p className="text-[13px] font-semibold" style={{ color: INK }}>{e.title}</p>
                        <p className="mt-0.5 text-[12px] leading-relaxed" style={{ color: INK_2 }}>{e.description}</p>
                        <p className="mt-1 text-[10.5px]" style={{ color: MUTED }}>Presented: {e.presented}</p>
                      </div>
                      <p className="self-start text-[10px] font-semibold uppercase tracking-[0.12em] sm:pt-0.5" style={{ color: e.status === "Not available" ? "#7a2e2a" : e.status === "Reviewed" ? INK_2 : MUTED }}>
                        {e.status}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 02 Findings */}
            <section className="mt-8">
              <SectionHeading n="02" title="Inspection Findings" />
              <div className="mt-3 divide-y" style={{ borderColor: RULE }}>
                {d.findings.length === 0 ? (
                  <p className="py-3 text-[12.5px]" style={{ color: INK_2 }}>No significant observations were recorded.</p>
                ) : (
                  d.findings.map((f, i) => (
                    <div key={f.title} className="grid grid-cols-[2.2rem_minmax(0,1fr)] py-3" style={{ borderColor: RULE }}>
                      <p className="pt-0.5 text-[10.5px] font-semibold tabular-nums" style={{ color: MUTED }}>F{i + 1}</p>
                      <div>
                        <p className="text-[13px] font-semibold leading-snug" style={{ color: INK }}>{f.title}</p>
                        <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: INK_2 }}>{f.explanation}</p>
                        <p className="mt-1.5 text-[10.5px]" style={{ color: MUTED }}>Evidence: {f.evidence}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* 03 Final determination — present in the document only once the player has chosen to view it. */}
            <section className="mt-8" ref={outcomeRef}>
              <SectionHeading n="03" title="Final Determination" />
              {(revealing || revealed) && (
                <div
                  className="mt-4 px-5 py-5 transition-all duration-[1400ms] ease-out sm:px-6"
                  style={{ background: "#eef0f2", borderLeft: `3px solid ${OUTCOME_ACCENT[d.kind]}`, opacity: revealed ? 1 : 0, transform: revealed ? "none" : "translateY(4px)" }}
                  aria-live="polite"
                >
                  {revealed && (
                    <>
                      <p className="text-[9.5px] font-semibold uppercase tracking-[0.2em]" style={{ color: MUTED }}>Inspection Outcome</p>
                      <p className="mt-2 font-serif text-[22px] leading-tight sm:text-[24px]" style={{ color: INK }}>{d.heading}</p>
                      <p className="mt-2 text-[13px] leading-relaxed" style={{ color: INK_2 }}>{d.statement}</p>
                      {d.nextSteps.length > 0 && (
                        <>
                          <p className="mt-4 text-[9.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: MUTED }}>Required next steps</p>
                          <ul className="mt-1.5 list-disc pl-4 text-[12.5px] leading-relaxed" style={{ color: INK_2 }}>
                            {d.nextSteps.map((s) => <li key={s}>{s}</li>)}
                          </ul>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* Footer */}
          <div className="mx-6 flex flex-wrap items-center justify-between gap-2 border-t py-3 text-[9.5px] uppercase tracking-[0.14em] sm:mx-12" style={{ borderColor: RULE, color: MUTED }}>
            <span>NOVA-CI-FD-01 · Final</span>
            <span>Confidential — Project Nova</span>
            <span>Page 1 of 1</span>
          </div>
        </article>

        {/* Controls live outside the document. */}
        <div className="mt-6 flex h-11 items-center justify-center">
          {!revealing && !revealed ? (
            <button
              type="button"
              onClick={view}
              disabled={!canView}
              className="rounded-full border border-white/25 px-6 py-2.5 text-[13px] tracking-wide text-white/85 transition-opacity duration-700 hover:bg-white/10 disabled:cursor-default"
              style={{ opacity: canView ? 1 : 0 }}
            >
              View Determination
            </button>
          ) : (
            <button
              type="button"
              onClick={leave}
              disabled={!canContinue || leaving}
              className="rounded-full bg-[#e6ecf3] px-6 py-2.5 text-[13px] font-medium text-[#1b2433] transition-opacity duration-700 disabled:cursor-default"
              style={{ opacity: canContinue ? 1 : 0 }}
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ n, title }: { n: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b pb-2" style={{ borderColor: RULE }}>
      <span className="font-serif text-[13px] tabular-nums" style={{ color: MUTED }}>{n}</span>
      <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.2em]" style={{ color: NAVY }}>{title}</h2>
    </div>
  );
}
