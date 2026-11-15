"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import type { GameState } from "@/lib/nova/types";
import type { ReflectionRating } from "@/lib/nova/projectArtefacts";
import {
  buildDecisionAnalysis,
  type Alternative,
  type CategoryReview,
  type DecisionAnalysis as Analysis,
  type Effect,
  type JourneyDecision,
  type ModuleView,
  type Takeaway,
} from "@/lib/nova/decisionAnalysis";

/**
 * LAYOUT PREVIEW — Decision Analysis as a guided, five-page review (/prototype/decision-analysis).
 * Same analysis as the scrolling version (buildDecisionAnalysis — nothing new is computed or scored). This
 * file only decides what the player reads: raw metric changes become plain sentences (plainEffects), the
 * internal classifications stay internal, and each page has its own composition. Selections live here, so
 * moving between pages keeps them. The scrolling DecisionAnalysis.tsx is untouched.
 */

const OLIVE = "#B5C474";
const SERIF = "ui-serif, 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const PAGES = [
  { id: "overview", title: "Project Overview" },
  { id: "performance", title: "Performance Breakdown" },
  { id: "journey", title: "Your Decision Journey" },
  { id: "apm", title: "APM Knowledge Mapping" },
  { id: "takeaways", title: "What You Take Forward" },
] as const;

const RATING: Record<ReflectionRating, { label: string; text: string }> = {
  strong: { label: "Strong", text: "text-emerald-300/90" },
  mixed: { label: "Mixed", text: "text-amber-200/90" },
  at_risk: { label: "At risk", text: "text-rose-300/90" },
};
const OUTCOME_TONE = { satisfactory: "text-emerald-100", conditional: "text-amber-100", unsatisfactory: "text-rose-100" } as const;
const two = (n: number) => String(n).padStart(2, "0");

// --- Plain English ------------------------------------------------------------------------------------------

/** "a, b and c" */
function list(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * A decision's recorded effects (the same ones applyEffects applied) as one natural sentence — e.g.
 * "It recovered time, but added delivery risk and weighed on the team." Nothing is shown when there were no
 * effects. Amounts are kept only for money, where the figure is the point.
 */
function plainEffects(effects: Effect[], subject = "It"): string | null {
  const good: string[] = [];
  const bad: string[] = [];
  const trustUp: string[] = [];
  const trustDown: string[] = [];
  for (const e of effects) {
    const trust = e.label.match(/^(.+)'s trust$/);
    if (trust) { (e.good ? trustUp : trustDown).push(trust[1]); continue; }
    const amount = e.value.replace(/^[+−-]/, "");
    switch (e.label) {
      case "Budget": (e.good ? good : bad).push(e.good ? `returned ${amount} to the budget` : `cost ${amount}`); break;
      case "Schedule health": (e.good ? good : bad).push(e.good ? "recovered time" : "cost time on the schedule"); break;
      case "Risk exposure": (e.good ? good : bad).push(e.good ? "reduced delivery risk" : "added delivery risk"); break;
      case "Regulatory readiness": (e.good ? good : bad).push(e.good ? "strengthened the regulatory position" : "weakened the regulatory position"); break;
      case "Board confidence": (e.good ? good : bad).push(e.good ? "built the Board's confidence" : "cost some of the Board's confidence"); break;
      case "Stakeholder goodwill": (e.good ? good : bad).push(e.good ? "earned goodwill with stakeholders" : "cost goodwill with stakeholders"); break;
      case "Team morale": (e.good ? good : bad).push(e.good ? "lifted the team" : "weighed on the team"); break;
    }
  }
  if (trustUp.length) good.push(`won ${list(trustUp)}'s support`);
  if (trustDown.length) bad.push(`cost ${list(trustDown)}'s support`);
  if (!good.length && !bad.length) return null;
  if (good.length && bad.length) return `${subject} ${list(good)}, but ${list(bad)}.`;
  return `${subject} ${list(good.length ? good : bad)}.`;
}

/** An alternative the game actually offered, and what it would have done, in one sentence. */
function plainAlternative(alt: Alternative): string {
  const text = alt.text.replace(/\.$/, "");
  const effect = plainEffects(alt.effects, "")?.trim().replace(/\.$/, "");
  return effect ? `“${text}” would have ${effect.replace(/^(\w)/, (c) => c.toLowerCase())}.` : `“${text}”`;
}

/** The few authored readings that lean on metric shorthand, told in plain words for this view. */
const PLAIN: Record<string, string> = {
  "Approving late scope pleased Priya and Mike E., but cost £0.5m, 10 points of regulatory readiness and Camille's confidence.":
    "Approving late scope pleased Priya and Mike E., but it cost £0.5m, weakened the regulatory position and lost Camille's confidence.",
  "Delaying dependent work packages protected the budget, but cost 15 points of schedule.":
    "Delaying dependent work packages protected the budget, but cost the schedule heavily.",
  "You funded the rework: £0.4m, but regulatory readiness +15 and Camille's confidence.":
    "You funded the rework. It cost £0.4m, but it strengthened the regulatory position considerably and won Camille's confidence.",
  "Appealing the finding raised risk exposure by 10.": "Appealing the finding added delivery risk without fixing the problem.",
  "Phasing the fix around commissioning protected the schedule, but cost 10 points of regulatory readiness.":
    "Phasing the fix around commissioning protected the schedule, but weakened the regulatory position.",
  "Continuing in parallel with a contamination finding open raised risk exposure by 10.":
    "Continuing in parallel with a contamination finding still open added delivery risk.",
  "You reviewed the design in full now: regulatory readiness +15, at a schedule cost.":
    "You reviewed the design in full straight away: a real gain for the regulatory position, at some cost to the schedule.",
  "You redistributed the work internally, and morale fell by 10.": "You redistributed the work internally, and it weighed on the team.",
};
/** Drops metric shorthand from authored sentences, e.g. "(regulatory readiness +10)". */
function clean(text: string | undefined): string {
  return (PLAIN[text ?? ""] ?? text ?? "")
    .replace(/\s*\([^)]*[+−]\d[^)]*\)/g, "")
    .replace(/regulatory readiness \+\d+/gi, "a stronger regulatory position")
    .replace(/regulatory readiness −\d+/gi, "a weaker regulatory position")
    .replace(/\b\d+ points of /g, "")
    .replace(/risk exposure by \d+/gi, "delivery risk")
    .replace(/\s+by \d+(?=[.,])/g, "")
    .replace(/\s+([.,])/g, "$1");
}
/** The recovery strategy's recorded "assessment" is the option's shorthand trade-off label; its effects say it better. */
const assessmentOf = (d: JourneyDecision) => (d.id === "recovery_strategy" ? "" : clean(d.assessment));

/** How the player handled an area, from the assessed decisions behind it — no new judgement. */
function categorySummary(c: CategoryReview): string {
  const good = c.wellDone.length, poor = c.improve.length, tradeoffs = c.tradeoffs.length;
  if (!good && !poor && !tradeoffs) return "None of your recorded decisions bear directly on this area, so this reflects where the project finished rather than how it was managed.";
  if (good && !poor) return tradeoffs ? "Your key calls here held up. Where there was a price to pay, you chose it knowingly." : "Your decisions here held up consistently.";
  if (poor && !good) return tradeoffs ? "This is where your decisions cost the most. Even the balanced calls carried a price." : "This is where your decisions cost the project most.";
  if (good && poor) return "A mixed record: some of your calls here held up well, others cost the project.";
  return "Most decisions here were genuine trade-offs. No option came free, and the record shows what you chose to give up.";
}

// --- Small pieces --------------------------------------------------------------------------------------------

function Kicker({ children }: { children: ReactNode }) {
  return <p className="text-[13px] font-medium tracking-[0.04em] text-zinc-500">{children}</p>;
}
function renderBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") ? <strong key={i} className="font-semibold text-zinc-100">{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
  );
}

// --------------------------------------------------------------------------------------------------------

export default function DecisionAnalysisPaged({ gameState, onRestart }: { gameState: GameState; onRestart: () => void }) {
  const a = useMemo(() => buildDecisionAnalysis(gameState), [gameState]);
  const keyDecisions = useMemo(() => a.journey.flatMap((g) => g.key), [a]);

  const [page, setPage] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  // Selections that survive moving between pages.
  const [category, setCategory] = useState<string>(a.categories[0]?.id ?? "budget");
  const [decision, setDecision] = useState<string | null>(keyDecisions[0]?.id ?? null);
  const [openOthers, setOpenOthers] = useState<Set<number>>(new Set());
  const [group, setGroup] = useState<string>(a.apm[0]?.id ?? "");
  const [moduleId, setModuleId] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const last = PAGES.length - 1;

  const goTo = useCallback((next: number) => {
    if (next < 0 || next > last || next === page) return;
    setDir(next > page ? 1 : -1);
    setPage(next);
  }, [page, last]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [page]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (moduleId) { if (e.key === "Escape") setModuleId(null); return; }
      if (e.key === "ArrowRight") goTo(page + 1);
      if (e.key === "ArrowLeft") goTo(page - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, page, moduleId]);

  const allModules = useMemo(() => a.apm.flatMap((g) => g.modules), [a]);
  const modal = moduleId ? allModules.find((m) => m.id === moduleId) ?? null : null;
  const P = PAGES[page];
  const heading = (text: string, sub?: string) => (
    <header className="mb-10 sm:mb-14">
      <h1 ref={headingRef} tabIndex={-1} className="text-[30px] font-semibold leading-tight tracking-tight text-zinc-50 outline-none sm:text-[40px]">{text}</h1>
      {sub && <p className="mt-3 max-w-[60ch] text-[16px] leading-relaxed text-zinc-400 sm:text-[17px]">{sub}</p>}
    </header>
  );

  return (
    <div className="relative isolate flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#0a0e16] text-zinc-200" style={{ fontFamily: "var(--font-body, ui-sans-serif, system-ui, sans-serif)" }}>
      {/* Backdrop: the facility at night, top right, sinking into deep navy. Fixed behind every page. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 90% 70% at 70% 0%, #172234 0%, #0f1622 45%, #0a0e16 100%)" }} />
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative backdrop */}
        <img
          src="/assets/cinematics/epilogue/facility_dusk.jpg"
          alt=""
          className="absolute right-0 top-0 h-[62vh] w-[78vw] max-w-[1400px] object-cover sm:w-[64vw]"
          style={{
            objectPosition: "60% 55%",
            filter: "brightness(0.68) saturate(0.75) contrast(1.08)",
            opacity: 0.95,
            maskImage: "linear-gradient(to left, black 30%, transparent 92%), linear-gradient(to bottom, black 35%, transparent 96%)",
            WebkitMaskImage: "linear-gradient(to left, black 30%, transparent 92%), linear-gradient(to bottom, black 35%, transparent 96%)",
            maskComposite: "intersect",
            WebkitMaskComposite: "source-in",
          }}
        />
        {/* A cool night wash over the picture, and a soft vignette so text always sits on dark. */}
        <div className="absolute inset-0 mix-blend-multiply" style={{ background: "linear-gradient(180deg, rgba(60,82,120,0.45) 0%, rgba(20,28,44,0.15) 60%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 120% 90% at 60% 20%, transparent 45%, rgba(5,8,13,0.65) 100%)" }} />
      </div>
      {/* Top: branding, progress, page number */}
      <header className="shrink-0 px-5 pt-6 sm:px-12 sm:pt-8">
        <div className="mx-auto flex w-full max-w-[1200px] items-center gap-6">
          <p className="hidden min-w-0 shrink truncate text-[12px] tracking-[0.18em] text-zinc-500 sm:block">
            PROJECT NOVA <span className="text-zinc-700">/</span> DECISION ANALYSIS
          </p>
          <div className="flex flex-1 gap-1.5 sm:ml-auto sm:w-[240px] sm:flex-none" aria-hidden="true">
            {PAGES.map((p, i) => (
              <span key={p.id} className="h-[3px] flex-1 rounded-full transition-colors duration-500" style={{ background: i === page ? OLIVE : i < page ? `${OLIVE}55` : "rgba(255,255,255,0.08)" }} />
            ))}
          </div>
          <p className="shrink-0 whitespace-nowrap text-[13px] tabular-nums tracking-[0.08em] text-zinc-400" aria-live="polite">
            <span className="sr-only">Page </span>{two(page + 1)} <span className="text-zinc-600">/</span> {two(PAGES.length)}
          </p>
        </div>
      </header>

      {/* The page */}
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-5 sm:px-12">
        <div key={P.id} className={`mx-auto w-full max-w-[1200px] pb-14 pt-10 sm:pt-16 ${dir === 1 ? "motion-safe:animate-[pageInR_450ms_ease-out]" : "motion-safe:animate-[pageInL_450ms_ease-out]"}`}>
          {P.id === "overview" && <Overview a={a} heading={heading} onCategory={(id) => { setCategory(id); goTo(1); }} />}
          {P.id === "performance" && <Performance a={a} heading={heading} selected={category} onSelect={setCategory} />}
          {P.id === "journey" && (
            <Journey
              a={a}
              heading={heading}
              selected={decision}
              onSelect={setDecision}
              onModule={setModuleId}
              openOthers={openOthers}
              onToggleOthers={(act) => setOpenOthers((s) => { const n = new Set(s); if (n.has(act)) n.delete(act); else n.add(act); return n; })}
            />
          )}
          {P.id === "apm" && <Apm a={a} heading={heading} selected={group} onSelect={setGroup} onModule={setModuleId} />}
          {P.id === "takeaways" && <Takeaways a={a} headingRef={headingRef} />}
        </div>
      </div>

      {/* Bottom: arrows, always in the same place */}
      <footer className="shrink-0 px-5 pb-6 pt-3 sm:px-12 sm:pb-8">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between">
          <button
            type="button"
            onClick={() => goTo(page - 1)}
            disabled={page === 0}
            aria-label="Previous page"
            className="grid h-12 w-12 place-items-center rounded-full border border-white/15 text-[18px] text-zinc-200 transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-25"
            style={{ outlineColor: OLIVE }}
          >
            ←
          </button>
          {page < last ? (
            <button
              type="button"
              onClick={() => goTo(page + 1)}
              aria-label="Next page"
              className="grid h-12 w-12 place-items-center rounded-full bg-zinc-100 text-[18px] text-zinc-900 transition-[filter] hover:brightness-90 focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ outlineColor: OLIVE }}
            >
              →
            </button>
          ) : (
            <button
              type="button"
              onClick={onRestart}
              className="h-12 rounded-full px-7 text-[15px] font-semibold transition-[filter] hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ background: OLIVE, color: "#1b2027", outlineColor: OLIVE }}
            >
              Back to Title
            </button>
          )}
        </div>
      </footer>

      {modal && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/65 p-5 backdrop-blur-sm motion-safe:animate-[pageFade_200ms_ease-out]" onClick={() => setModuleId(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="dap-module-title" className="max-h-[82vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-[#131924] p-8 shadow-2xl ring-1 ring-white/10" onClick={(e) => e.stopPropagation()}>
            <Kicker>APM module {modal.number}</Kicker>
            <h3 id="dap-module-title" className="mt-2 text-[24px] font-semibold leading-snug text-zinc-50">{modal.title}</h3>
            <p className="mt-4 text-[15.5px] leading-[1.7] text-zinc-300">{renderBold(modal.summary)}</p>
            <div className="mt-8 flex justify-end">
              <button type="button" autoFocus onClick={() => setModuleId(null)} className="rounded-full border border-white/15 px-5 py-2 text-[14px] text-zinc-200 hover:bg-white/5">Close</button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes pageInR { from { opacity: 0; transform: translateX(12px) } to { opacity: 1; transform: none } }
        @keyframes pageInL { from { opacity: 0; transform: translateX(-12px) } to { opacity: 1; transform: none } }
        @keyframes pageFade { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </div>
  );
}

type Heading = (text: string, sub?: string) => ReactNode;

// --- 01 Overview: the executive summary -----------------------------------------------------------------------

function Overview({ a, heading, onCategory }: { a: Analysis; heading: Heading; onCategory: (id: string) => void }) {
  return (
    <div>
      {heading("Project Overview")}
      <div className="grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-20">
        <div>
          <div className="relative isolate -mx-5 px-5 py-6 sm:-mx-8 sm:px-8 sm:py-8">
            {/* The product itself, quiet behind the determination: vials on the line, fading into the page. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative */}
            <img
              src="/assets/cinematics/epilogue/vials.jpg"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-[6%] -z-10 hidden h-[88%] w-[50%] object-cover sm:block"
              style={{
                objectPosition: "38% 50%",
                filter: "brightness(0.55) sepia(0.35) hue-rotate(178deg) saturate(0.9) contrast(1.12)",
                opacity: 0.95,
                maskImage: "linear-gradient(to right, transparent 0%, transparent 18%, black 55%, black 90%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 18%, black 80%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to right, transparent 0%, transparent 18%, black 55%, black 90%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 18%, black 80%, transparent 100%)",
                maskComposite: "intersect",
                WebkitMaskComposite: "source-in",
              }}
            />
            {/* Text on the left, the vials on the right: they never sit under the words. */}
            <div className="sm:pr-[38%]">
              <Kicker>The inspection&apos;s determination</Kicker>
              <p className={`mt-4 text-[48px] leading-[1.05] tracking-tight sm:text-[58px] lg:text-[48px] xl:text-[58px] ${OUTCOME_TONE[a.outcome.kind]}`} style={{ fontFamily: SERIF }}>
                {a.outcome.label}
              </p>
              <p className="mt-6 text-[18px] leading-relaxed text-zinc-300 sm:text-[19px]">{a.outcome.statement}</p>
            </div>
          </div>
          <p className="mt-10 max-w-[52ch] border-l border-white/15 pl-5 text-[15.5px] leading-relaxed text-zinc-400">
            That is how the project ended. How well you managed it is a separate question, and it is what the rest of this review is about.
          </p>
          {a.dataNotes.map((n) => <p key={n} className="mt-6 max-w-[56ch] text-[14px] leading-relaxed text-zinc-500">{n}</p>)}
        </div>
        <div>
          <Kicker>Where the project finished</Kicker>
          <ul className="mt-4 divide-y divide-white/[0.07] border-y border-white/[0.07]">
            {a.categories.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onCategory(c.id)}
                  className="group grid w-full grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-1 py-5 text-left focus-visible:outline-2 focus-visible:outline-offset-4"
                  style={{ outlineColor: OLIVE }}
                >
                  <span className="text-[16.5px] text-zinc-100 group-hover:text-white">{c.label}</span>
                  <span className={`text-[15px] ${RATING[c.rating].text}`}>{RATING[c.rating].label}</span>
                  <span className="col-span-2 text-[14px] leading-relaxed text-zinc-500 group-hover:text-zinc-400">{c.metric}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// --- 02 Performance: a professional assessment ------------------------------------------------------------------

function Performance({ a, heading, selected, onSelect }: { a: Analysis; heading: Heading; selected: string; onSelect: (id: string) => void }) {
  const c = a.categories.find((x) => x.id === selected) ?? a.categories[0];
  const improve = [...c.improve, ...c.tradeoffs];
  const item = (d: JourneyDecision) => (
    <li key={d.id} className="py-4 first:pt-0">
      <p className="text-[16px] font-medium text-zinc-100">{d.title}</p>
      {(assessmentOf(d) || plainEffects(d.effects)) && <p className="mt-1.5 text-[15px] leading-relaxed text-zinc-400">{assessmentOf(d) || plainEffects(d.effects)}</p>}
    </li>
  );
  return (
    <div>
      {heading("Performance Breakdown")}
      <div className="grid gap-10 lg:grid-cols-[280px_1fr] lg:gap-16">
        <nav aria-label="Areas" className="-mx-1 flex gap-1 overflow-x-auto pb-1 lg:mx-0 lg:flex-col lg:overflow-visible">
          {a.categories.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-current={x.id === c.id ? "true" : undefined}
              onClick={() => onSelect(x.id)}
              className={`shrink-0 rounded-lg px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 lg:border-l-2 lg:rounded-none lg:px-5 ${
                x.id === c.id ? "bg-white/[0.06] text-zinc-50 lg:border-[#B5C474] lg:bg-transparent" : "text-zinc-400 hover:text-zinc-200 lg:border-white/[0.06]"
              }`}
              style={{ outlineColor: OLIVE }}
            >
              <span className="block text-[15px]">{x.label}</span>
              <span className={`mt-0.5 block text-[13px] ${RATING[x.rating].text}`}>{RATING[x.rating].label}</span>
            </button>
          ))}
        </nav>
        <article key={c.id} className="max-w-[760px] motion-safe:animate-[pageFade_300ms_ease-out]">
          <h2 className="text-[24px] font-semibold text-zinc-50 sm:text-[28px]">{c.label}</h2>
          <p className="mt-4 text-[18px] leading-relaxed text-zinc-200 sm:text-[19px]" style={{ fontFamily: SERIF }}>
            {c.metric} {categorySummary(c)}
          </p>
          {c.hasDecisionEvidence && (
            <div className="mt-10 grid gap-10 md:grid-cols-2">
              <section>
                <h3 className="mb-4 text-[14px] font-semibold text-emerald-200/90">What went well</h3>
                {c.wellDone.length ? <ul className="divide-y divide-white/[0.06]">{c.wellDone.map(item)}</ul> : <p className="text-[15px] text-zinc-500">Nothing in this area stands out as a clear strength.</p>}
              </section>
              <section>
                <h3 className="mb-4 text-[14px] font-semibold text-amber-200/90">What could improve</h3>
                {improve.length ? <ul className="divide-y divide-white/[0.06]">{improve.map(item)}</ul> : <p className="text-[15px] text-zinc-500">No clear missed opportunity in this area.</p>}
              </section>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}

// --- 03 Journey: short case studies -------------------------------------------------------------------------------

function Journey({ a, heading, selected, onSelect, onModule, openOthers, onToggleOthers }: {
  a: Analysis; heading: Heading; selected: string | null; onSelect: (id: string) => void; onModule: (id: string) => void; openOthers: Set<number>; onToggleOthers: (act: number) => void;
}) {
  const detailRef = useRef<HTMLDivElement | null>(null);
  const all = a.journey.flatMap((g) => [...g.key, ...g.other]);
  const d = all.find((x) => x.id === selected) ?? a.journey[0]?.key[0] ?? null;
  const modules = useMemo(() => new Map(a.apm.flatMap((g) => g.modules).map((m) => [m.id, m])), [a]);
  if (!a.journey.length || !d) {
    return <div>{heading("Your Decision Journey")}<p className="text-[16px] text-zinc-400">No decisions are recorded in this save, so there&apos;s no journey to show.</p></div>;
  }
  const pick = (id: string) => {
    onSelect(id);
    if (window.matchMedia("(max-width: 1023px)").matches) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const happened = [plainEffects(d.effects), ...d.consequences].filter(Boolean) as string[];
  const alternatives = d.alternatives.slice(0, 2);
  return (
    <div>
      {heading("Your Decision Journey")}
      <div className="grid gap-10 lg:grid-cols-[320px_1fr] lg:gap-16">
        <nav aria-label="Decisions" className="lg:max-h-[min(60vh,640px)] lg:overflow-y-auto lg:pr-2">
          {a.journey.map((g) => (
            <div key={g.act} className="mb-7 last:mb-0">
              <Kicker>{g.label.replace(" — ", " · ")}</Kicker>
              <ul className="mt-2">
                {g.key.map((x) => (
                  <li key={x.id}>
                    <button
                      type="button"
                      onClick={() => pick(x.id)}
                      aria-current={x.id === d.id ? "true" : undefined}
                      className={`w-full border-l-2 py-2 pl-4 pr-2 text-left text-[15px] leading-snug transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                        x.id === d.id ? "border-[#B5C474] text-zinc-50" : "border-white/[0.06] text-zinc-400 hover:text-zinc-200"
                      }`}
                      style={{ outlineColor: OLIVE }}
                    >
                      {x.title}
                    </button>
                  </li>
                ))}
                {g.other.length > 0 && (
                  <li className="border-l-2 border-white/[0.06] pl-4 pt-1">
                    <button type="button" onClick={() => onToggleOthers(g.act)} aria-expanded={openOthers.has(g.act)} className="py-1 text-[13.5px] text-zinc-500 hover:text-zinc-300">
                      {openOthers.has(g.act) ? "Fewer" : `${g.other.length} more`}
                    </button>
                    {openOthers.has(g.act) && (
                      <ul>
                        {g.other.map((x) => (
                          <li key={x.id}>
                            <button type="button" onClick={() => pick(x.id)} className={`w-full py-1.5 text-left text-[14px] ${x.id === d.id ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}>{x.title}</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )}
              </ul>
            </div>
          ))}
        </nav>

        <article ref={detailRef} key={d.id} className="max-w-[720px] scroll-mt-6 motion-safe:animate-[pageFade_300ms_ease-out]">
          <h2 className="text-[26px] font-semibold leading-snug text-zinc-50 sm:text-[30px]">{d.title}</h2>
          <div className="mt-8 space-y-8 text-[16px] leading-[1.7] text-zinc-300">
            {d.situation && (
              <section>
                <h3 className="mb-2 text-[14px] font-semibold text-zinc-500">The situation</h3>
                <p>{d.situation}</p>
              </section>
            )}
            <section>
              <h3 className="mb-2 text-[14px] font-semibold text-zinc-500">Your decision</h3>
              <p className="text-[19px] leading-relaxed text-zinc-50" style={{ fontFamily: SERIF }}>{d.choice}</p>
              {d.choiceDetail && <ul className="mt-3 space-y-1 text-[15px] text-zinc-400">{d.choiceDetail.map((x) => <li key={x}>{x}</li>)}</ul>}
            </section>
            {happened.length > 0 && (
              <section>
                <h3 className="mb-2 text-[14px] font-semibold text-zinc-500">What happened</h3>
                {happened.map((t) => <p key={t} className="mt-1 first:mt-0">{t}</p>)}
              </section>
            )}
            {(assessmentOf(d) || alternatives.length > 0) && (
              <section className="border-t border-white/[0.07] pt-8">
                <h3 className="mb-2 text-[14px] font-semibold text-zinc-500">What you can learn</h3>
                {assessmentOf(d) && <p className="text-zinc-200">{assessmentOf(d)}</p>}
                {alternatives.length > 0 && (
                  <p className="mt-3 text-[15px] text-zinc-400">
                    {alternatives.length === 1 ? "The other option: " : "The other options: "}
                    {alternatives.map(plainAlternative).join(" ")}
                  </p>
                )}
              </section>
            )}
            {d.modules.length > 0 && (
              <p className="text-[14px] text-zinc-500">
                Related APM learning:{" "}
                {d.modules.map((id, i) => {
                  const m = modules.get(id);
                  return m ? (
                    <span key={id}>
                      {i > 0 && ", "}
                      <button type="button" onClick={() => onModule(id)} className="text-zinc-300 underline decoration-white/20 underline-offset-4 hover:decoration-white/60">{m.title}</button>
                    </span>
                  ) : null;
                })}
              </p>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}

// --- 04 APM: a reference library ----------------------------------------------------------------------------------

function connection(m: ModuleView): string {
  if (m.appliedIn.length) return `Your decisions drew on this in ${list(m.appliedIn.map((d) => d.title.charAt(0).toLowerCase() + d.title.slice(1)))}.`;
  if (m.encountered) return "You met this topic in the story, though none of your recorded decisions draws on it directly.";
  return "Relevant to this project, though you didn't reach the part of the story that covers it.";
}

function Apm({ a, heading, selected, onSelect, onModule }: { a: Analysis; heading: Heading; selected: string; onSelect: (id: string) => void; onModule: (id: string) => void }) {
  const g = a.apm.find((x) => x.id === selected) ?? a.apm[0];
  if (!g) return null;
  return (
    <div>
      {heading("APM Knowledge Mapping", "The parts of the APM body of knowledge this project touched, and where your own decisions drew on them.")}
      <div className="grid gap-10 lg:grid-cols-[280px_1fr] lg:gap-16">
        <nav aria-label="Topic areas" className="-mx-1 flex gap-1 overflow-x-auto pb-1 lg:mx-0 lg:flex-col lg:overflow-visible">
          {a.apm.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-current={x.id === g.id ? "true" : undefined}
              onClick={() => onSelect(x.id)}
              className={`shrink-0 rounded-lg px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 lg:rounded-none lg:border-l-2 lg:px-5 ${
                x.id === g.id ? "bg-white/[0.06] text-zinc-50 lg:border-[#B5C474] lg:bg-transparent" : "text-zinc-400 hover:text-zinc-200 lg:border-white/[0.06]"
              }`}
              style={{ outlineColor: OLIVE }}
            >
              <span className="block text-[15px]">{x.label}</span>
              <span className="mt-0.5 block text-[13px] text-zinc-500">{x.modules.length} module{x.modules.length > 1 ? "s" : ""}</span>
            </button>
          ))}
        </nav>
        <div key={g.id} className="max-w-[760px] motion-safe:animate-[pageFade_300ms_ease-out]">
          <ul className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
            {g.modules.map((m) => (
              <li key={m.id} className="grid grid-cols-[2.5rem_1fr] gap-x-4 py-6">
                <span className="pt-0.5 text-[15px] tabular-nums text-zinc-600">{two(m.number)}</span>
                <div>
                  <p className="text-[17px] font-medium text-zinc-100">{m.title}</p>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-zinc-400">{connection(m)}</p>
                  <button type="button" onClick={() => onModule(m.id)} className="mt-2 text-[14px] text-zinc-500 underline decoration-white/15 underline-offset-4 hover:text-zinc-200 hover:decoration-white/50">
                    Revisit this module
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {a.apmUncovered > 0 && (
            <p className="mt-6 text-[14px] text-zinc-500">The Knowledge Library holds {a.apmUncovered}{" "}further modules that this version of the game doesn&apos;t cover.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// --- 05 Takeaways: the conclusion -----------------------------------------------------------------------------------

function Takeaways({ a, headingRef }: { a: Analysis; headingRef: RefObject<HTMLHeadingElement | null> }) {
  const { lesson, strength, develop } = a.takeaways;
  // A trade-off chosen as the development point carries a generic "worth revisiting" line from the analysis;
  // here it is told through the actual alternative instead.
  const d = a.journey.flatMap((g) => g.key).find((x) => x.title === develop.title);
  const developed: Takeaway = d && d.indicator === "tradeoff" && d.alternatives[0]
    ? { ...develop, text: `${assessmentOf(d)} It is worth weighing against the route you didn't take: ${plainAlternative(d.alternatives[0])}` }
    : develop;
  const reflection = (title: string, t: Takeaway) => (
    <section>
      <h3 className="text-[14px] font-semibold text-zinc-500">{title}</h3>
      {!t.general && t.title && <p className="mt-3 text-[19px] font-medium text-zinc-50">{t.title}</p>}
      <p className="mt-2 max-w-[52ch] text-[16px] leading-[1.7] text-zinc-300">{clean(t.text)}</p>
    </section>
  );
  return (
    <div className="mx-auto max-w-[1000px]">
      <Kicker>What you take forward</Kicker>
      <h1 ref={headingRef} tabIndex={-1} className="mt-6 max-w-[30ch] text-[30px] leading-[1.25] text-zinc-50 outline-none sm:text-[42px]" style={{ fontFamily: SERIF }}>
        {clean(lesson.text)}
      </h1>
      {lesson.general && <p className="mt-4 text-[14px] text-zinc-500">A general learning point, rather than an assessment of your play.</p>}
      <div className="mt-16 grid gap-12 border-t border-white/[0.08] pt-12 md:grid-cols-2 md:gap-16">
        {reflection("Your strength", strength)}
        {reflection("Your development opportunity", developed)}
      </div>
    </div>
  );
}
