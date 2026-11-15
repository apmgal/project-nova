"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { GameState } from "@/lib/nova/types";
import type { ReflectionRating } from "@/lib/nova/projectArtefacts";
import {
  buildDecisionAnalysis,
  type CategoryReview,
  type Effect,
  type Indicator,
  type JourneyDecision,
  type ModuleView,
  type Takeaway,
} from "@/lib/nova/decisionAnalysis";

/**
 * Decision Analysis — the end-of-game performance review. Everything shown comes from
 * buildDecisionAnalysis (lib/nova/decisionAnalysis.ts): a read-out of the saved game, never a new score.
 * Five sections: at a glance · performance breakdown · decision journey · APM knowledge · takeaways.
 * The default view stays compact; detail opens on demand.
 */

const OLIVE = "#B5C474";
const SECTIONS = [
  { id: "glance", label: "At a Glance" },
  { id: "performance", label: "Performance" },
  { id: "journey", label: "Decision Journey" },
  { id: "apm", label: "APM Knowledge" },
  { id: "takeaways", label: "Takeaways" },
] as const;

const RATING: Record<ReflectionRating, { label: string; text: string; chip: string }> = {
  strong: { label: "Strong", text: "text-emerald-300", chip: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20" },
  mixed: { label: "Mixed", text: "text-amber-300", chip: "bg-amber-400/10 text-amber-300 ring-amber-400/20" },
  at_risk: { label: "At Risk", text: "text-rose-300", chip: "bg-rose-400/10 text-rose-300 ring-rose-400/20" },
};
const INDICATOR: Record<Indicator, { label: string; dot: string; chip: string }> = {
  positive: { label: "Positive practice", dot: "bg-emerald-400", chip: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20" },
  tradeoff: { label: "Trade-off", dot: "bg-amber-300", chip: "bg-amber-300/10 text-amber-200 ring-amber-300/20" },
  improve: { label: "Opportunity to improve", dot: "bg-orange-400", chip: "bg-orange-400/10 text-orange-300 ring-orange-400/20" },
  not_assessed: { label: "Not assessed", dot: "bg-zinc-500", chip: "bg-white/5 text-zinc-400 ring-white/10" },
};
const TALLY_LABEL: Record<Indicator, [string, string]> = {
  positive: ["positive practice", "positive practices"],
  tradeoff: ["trade-off", "trade-offs"],
  improve: ["opportunity to improve", "opportunities to improve"],
  not_assessed: ["not assessed", "not assessed"],
};
const OUTCOME_TONE = {
  satisfactory: "text-emerald-200",
  conditional: "text-amber-200",
  unsatisfactory: "text-rose-200",
} as const;

function Chip({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${className}`}>{children}</span>;
}

function Effects({ effects }: { effects: Effect[] }) {
  if (!effects.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {effects.map((e) => (
        <span
          key={e.label + e.value}
          className={`rounded-md px-2 py-0.5 text-[11.5px] tabular-nums ring-1 ring-inset ${
            e.good === null ? "bg-white/5 text-zinc-300 ring-white/10" : e.good ? "bg-emerald-400/[0.07] text-emerald-200/90 ring-emerald-400/15" : "bg-rose-400/[0.07] text-rose-200/90 ring-rose-400/15"
          }`}
        >
          {e.label} {e.value}
        </span>
      ))}
    </div>
  );
}

/** Smoothly expanding region (grid-rows 0fr → 1fr); no animation when reduced motion is preferred. */
function Collapse({ open, id, children }: { open: boolean; id: string; children: ReactNode }) {
  return (
    <div id={id} className="grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none" style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}>
      <div className="min-h-0 overflow-hidden" inert={!open}>{children}</div>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 text-zinc-500 transition-transform duration-300 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SectionTitle({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: ReactNode }) {
  return (
    <header className="mb-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: OLIVE }}>{eyebrow}</p>
      <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-zinc-50 sm:text-[26px]">{title}</h2>
      {intro && <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-zinc-400">{intro}</p>}
    </header>
  );
}

function renderBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") ? <strong key={i} className="font-semibold text-zinc-100">{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
  );
}

const actShort = (d: JourneyDecision) => `Act ${d.act}${d.phase ? ` · ${d.phase}` : ""}`;

// --------------------------------------------------------------------------------------------------------

export default function DecisionAnalysis({ gameState, onRestart }: { gameState: GameState; onRestart: () => void }) {
  const a = useMemo(() => buildDecisionAnalysis(gameState), [gameState]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState<string>("glance");
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [openDecision, setOpenDecision] = useState<string | null>(null);
  const [openOther, setOpenOther] = useState<number | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [moduleModal, setModuleModal] = useState<ModuleView | null>(null);

  // Scroll-spy over the five sections (inside whichever element scrolls).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = SECTIONS.map((s) => root.querySelector(`#da-${s.id}`)).filter(Boolean) as Element[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((x, y) => x.boundingClientRect.top - y.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id.replace("da-", ""));
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!moduleModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setModuleModal(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moduleModal]);

  const go = (id: string) => rootRef.current?.querySelector(`#da-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const exploreCategory = (id: string) => {
    setOpenCategory(id);
    requestAnimationFrame(() => rootRef.current?.querySelector(`#da-cat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const keyDecisions = a.journey.flatMap((g) => g.key);
  const tally = (i: Indicator) => keyDecisions.filter((d) => d.indicator === i).length;

  return (
    <div ref={rootRef} className="w-full text-zinc-200" style={{ fontFamily: "var(--font-body, ui-sans-serif, system-ui, sans-serif)" }}>
      {/* Header */}
      <div className="mx-auto w-full max-w-[1080px] px-4 pb-2 pt-10 sm:px-8 sm:pt-14 motion-safe:animate-[daIn_600ms_ease-out]">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.42em] text-zinc-400">Project Nova</span>
          <span className="h-px w-10" style={{ background: `${OLIVE}99` }} />
        </div>
        <h1 className="mt-4 text-[30px] font-semibold tracking-tight text-zinc-50 sm:text-[40px]">Your Decision Analysis</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-zinc-400 sm:text-[16px]">
          Explore the decisions you made, how they influenced the project, and what you can take forward.
        </p>
      </div>

      {/* Section navigation */}
      <nav className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0b0f16]/85 backdrop-blur-md" aria-label="Decision Analysis sections">
        <div className="mx-auto flex w-full max-w-[1080px] gap-1 overflow-x-auto px-4 py-2.5 sm:px-8 [scrollbar-width:none]">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(s.id)}
              aria-current={active === s.id ? "true" : undefined}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                active === s.id ? "bg-white/10 text-zinc-50" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              }`}
              style={{ outlineColor: OLIVE }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="mx-auto w-full max-w-[1080px] px-4 sm:px-8">
        {/* 1 — At a glance */}
        <section id="da-glance" className="scroll-mt-16 pb-14 pt-10">
          <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
            <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-[#151c28] to-[#111722] p-6 sm:p-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Project outcome · Commissioning inspection</p>
              <p className={`mt-3 text-[30px] font-light tracking-tight sm:text-[36px] ${OUTCOME_TONE[a.outcome.kind]}`}>{a.outcome.label}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-zinc-300">{a.outcome.statement}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.07] bg-[#10151f] p-6 sm:p-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Outcome and decision quality</p>
              <p className="mt-3 text-[14px] leading-relaxed text-zinc-300">
                <span className="text-zinc-100">Project outcome</span> is what happened at the inspection.{" "}
                <span className="text-zinc-100">Decision quality</span>{" "}is how you managed the project with the information you had at the time.
                They are assessed separately: a sound call can still meet a difficult result, and a good result doesn&apos;t prove every call was sound.
              </p>
              {keyDecisions.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {(["positive", "tradeoff", "improve"] as Indicator[]).map((i) => (
                    <Chip key={i} className={INDICATOR[i].chip}>{tally(i)} {TALLY_LABEL[i][tally(i) === 1 ? 0 : 1]}</Chip>
                  ))}
                </div>
              )}
            </div>
          </div>

          {a.dataNotes.map((n) => (
            <p key={n} className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[13px] leading-relaxed text-zinc-400">{n}</p>
          ))}

          <div className="mt-8 flex items-baseline justify-between gap-4">
            <h3 className="text-[15px] font-semibold text-zinc-100">Performance overview</h3>
            <p className="text-[12px] text-zinc-500">Ratings from the project&apos;s end-state metrics</p>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {a.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => exploreCategory(c.id)}
                className="group rounded-xl border border-white/[0.07] bg-[#121823] p-5 text-left transition-colors hover:border-white/15 hover:bg-[#151c29] focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ outlineColor: OLIVE }}
              >
                <p className="text-[13px] text-zinc-400">{c.label}</p>
                <p className={`mt-1.5 text-[22px] font-medium ${RATING[c.rating].text}`}>{RATING[c.rating].label}</p>
                <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-zinc-500">{c.metric}</p>
                <p className="mt-3 text-[12px] text-zinc-400 transition-colors group-hover:text-zinc-200">Explore analysis →</p>
              </button>
            ))}
          </div>
        </section>

        {/* 2 — Performance breakdown */}
        <section id="da-performance" className="scroll-mt-16 border-t border-white/[0.06] pb-14 pt-12">
          <SectionTitle
            eyebrow="02"
            title="Performance Breakdown"
            intro="Each rating comes from the project's final metrics. Underneath it are the decisions you actually made in that area, assessed on their own merits."
          />
          <div className="flex flex-col gap-2.5">
            {a.categories.map((c) => (
              <CategoryPanel
                key={c.id}
                c={c}
                open={openCategory === c.id}
                onToggle={() => setOpenCategory(openCategory === c.id ? null : c.id)}
                onModule={setModuleModal}
              />
            ))}
          </div>
        </section>

        {/* 3 — Decision journey */}
        <section id="da-journey" className="scroll-mt-16 border-t border-white/[0.06] pb-14 pt-12">
          <SectionTitle
            eyebrow="03"
            title="Your Decision Journey"
            intro="The decisions that shaped the project, in the order you made them. Open one to see the situation, what followed, and what else was on the table."
          />
          <div className="mb-6 flex flex-wrap gap-1.5">
            {(Object.keys(INDICATOR) as Indicator[]).map((i) => <Chip key={i} className={INDICATOR[i].chip}>{INDICATOR[i].label}</Chip>)}
          </div>
          {a.journey.length === 0 ? (
            <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[13.5px] text-zinc-400">
              No decisions are recorded in this save, so there&apos;s no journey to show.
            </p>
          ) : (
            <ol className="flex flex-col gap-9">
              {a.journey.map((g) => (
                <li key={g.act}>
                  <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{g.label}</p>
                  <ol className="relative ml-[7px] border-l border-white/[0.08] pl-6">
                    {g.key.map((d) => (
                      <DecisionItem key={d.id} d={d} open={openDecision === d.id} onToggle={() => setOpenDecision(openDecision === d.id ? null : d.id)} />
                    ))}
                    {g.other.length > 0 && (
                      <li className="relative pt-1">
                        <span className="absolute -left-[29px] top-3 h-[9px] w-[9px] rounded-full border border-white/20 bg-[#0b0f16]" aria-hidden="true" />
                        <button
                          type="button"
                          onClick={() => setOpenOther(openOther === g.act ? null : g.act)}
                          aria-expanded={openOther === g.act}
                          aria-controls={`da-other-${g.act}`}
                          className="flex items-center gap-2 rounded-md py-1 text-[13px] text-zinc-400 hover:text-zinc-200"
                        >
                          {openOther === g.act ? "Hide" : "Show"} {g.other.length} other decision{g.other.length > 1 ? "s" : ""} in this act <Chevron open={openOther === g.act} />
                        </button>
                        <Collapse open={openOther === g.act} id={`da-other-${g.act}`}>
                          <ul className="mt-2 flex flex-col gap-2 pb-1">
                            {g.other.map((d) => (
                              <li key={d.id} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                                <p className="text-[13px] font-medium text-zinc-200">{d.title}</p>
                                <p className="mt-0.5 text-[13px] text-zinc-400">You chose: &ldquo;{d.choice}&rdquo;</p>
                                <Effects effects={d.effects} />
                              </li>
                            ))}
                          </ul>
                        </Collapse>
                      </li>
                    )}
                  </ol>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* 4 — APM knowledge mapping */}
        <section id="da-apm" className="scroll-mt-16 border-t border-white/[0.06] pb-14 pt-12">
          <SectionTitle
            eyebrow="04"
            title="APM Knowledge Mapping"
            intro={
              <>
                Modules are <span className="text-zinc-200">relevant</span> when they tie to this playthrough,{" "}
                <span className="text-zinc-200">encountered</span> when you reached their moment in the story, and{" "}
                <span className="text-zinc-200">applied</span> only when a decision you made can be linked to them. Modules are not scored individually.
              </>
            }
          />
          <div className="flex flex-col gap-2.5">
            {a.apm.map((g) => {
              const open = openGroup === g.id;
              const enc = g.modules.filter((m) => m.encountered).length;
              const applied = g.modules.filter((m) => m.appliedIn.length).length;
              return (
                <div key={g.id} className="rounded-xl border border-white/[0.07] bg-[#121823]">
                  <button
                    type="button"
                    onClick={() => setOpenGroup(open ? null : g.id)}
                    aria-expanded={open}
                    aria-controls={`da-apm-${g.id}`}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ outlineColor: OLIVE }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[14.5px] font-medium text-zinc-100">{g.label}</p>
                      <p className="mt-0.5 text-[12.5px] text-zinc-500">
                        {g.modules.length} module{g.modules.length > 1 ? "s" : ""} · {enc} encountered · {applied} applied in your decisions
                      </p>
                    </div>
                    <Chevron open={open} />
                  </button>
                  <Collapse open={open} id={`da-apm-${g.id}`}>
                    <ul className="flex flex-col divide-y divide-white/[0.05] border-t border-white/[0.06] px-5">
                      {g.modules.map((m) => (
                        <li key={m.id} className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-[13.5px] text-zinc-100"><span className="tabular-nums text-zinc-500">{m.number}.</span> {m.title}</p>
                            {m.appliedIn.length > 0 ? (
                              <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-400">
                                Applied in: {m.appliedIn.map((d) => d.title).join(" · ")}
                              </p>
                            ) : (
                              <p className="mt-1 text-[12.5px] text-zinc-500">No decision in this save is linked to this module.</p>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                            <Chip className="bg-white/5 text-zinc-400 ring-white/10">Relevant</Chip>
                            {m.encountered && <Chip className="bg-teal-400/10 text-teal-300 ring-teal-400/20">Encountered</Chip>}
                            {m.appliedIn.length > 0 && <Chip className="bg-[#B5C474]/10 text-[#d3dea0] ring-[#B5C474]/25">Applied</Chip>}
                            <button type="button" onClick={() => setModuleModal(m)} className="rounded-full px-2.5 py-0.5 text-[12px] text-zinc-400 underline-offset-4 hover:text-zinc-100 hover:underline">
                              Read module
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Collapse>
                </div>
              );
            })}
          </div>
          {a.apmUncovered > 0 && (
            <p className="mt-4 text-[12.5px] text-zinc-500">
              {a.apmUncovered}{" "}further APM modules are in the Knowledge Library but aren&apos;t covered by gameplay in this build.
            </p>
          )}
        </section>

        {/* 5 — Takeaways */}
        <section id="da-takeaways" className="scroll-mt-16 border-t border-white/[0.06] pb-20 pt-12">
          <SectionTitle eyebrow="05" title="Your Project Management Takeaways" />
          <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.07] bg-gradient-to-b from-[#141b27] to-[#10151f]">
            <TakeawayRow heading="A demonstrated strength" t={a.takeaways.strength} />
            <TakeawayRow heading="An area to develop" t={a.takeaways.develop} />
            <TakeawayRow heading="A lesson to carry forward" t={a.takeaways.lesson} />
          </div>
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={onRestart}
              className="rounded-full px-8 py-3 text-[14.5px] font-semibold transition-[filter] hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-4"
              style={{ background: OLIVE, color: "#1b2027", outlineColor: OLIVE }}
            >
              Back to Title
            </button>
          </div>
        </section>
      </div>

      {/* APM module — the Knowledge Library's own text */}
      {moduleModal && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4 backdrop-blur-sm motion-safe:animate-[daIn_200ms_ease-out]" onClick={() => setModuleModal(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="da-module-title" className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#121823] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: OLIVE }}>APM Module {moduleModal.number}</p>
            <h3 id="da-module-title" className="mt-2 text-[19px] font-semibold text-zinc-50">{moduleModal.title}</h3>
            <p className="mt-3 text-[14px] leading-relaxed text-zinc-300">{renderBold(moduleModal.summary)}</p>
            {moduleModal.appliedIn.length > 0 && (
              <p className="mt-4 text-[13px] text-zinc-400">In your project: {moduleModal.appliedIn.map((d) => d.title).join(" · ")}</p>
            )}
            <div className="mt-6 flex justify-end">
              <button type="button" autoFocus onClick={() => setModuleModal(null)} className="rounded-full border border-white/15 px-4 py-1.5 text-[13px] text-zinc-200 hover:bg-white/5">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes daIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }`}</style>
    </div>
  );
}

// --------------------------------------------------------------------------------------------------------

function EvidenceList({ items, empty, tone }: { items: JourneyDecision[]; empty: string; tone: Indicator | "mixed" }) {
  if (!items.length) return <p className="text-[13px] text-zinc-500">{empty}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((d) => (
        <li key={d.id} className="flex gap-3">
          <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${tone === "mixed" ? INDICATOR[d.indicator].dot : INDICATOR[tone].dot}`} aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[13.5px] text-zinc-100">
              {d.title} <span className="text-[12px] text-zinc-500">· {actShort(d)}{tone === "mixed" && d.indicator === "tradeoff" ? " · trade-off" : ""}</span>
            </p>
            {d.assessment && <p className="mt-0.5 text-[13px] leading-relaxed text-zinc-400">{d.assessment}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function CategoryPanel({ c, open, onToggle, onModule }: { c: CategoryReview; open: boolean; onToggle: () => void; onModule: (m: ModuleView) => void }) {
  const r = RATING[c.rating];
  const improve = [...c.improve, ...c.tradeoffs];
  const tension =
    (c.rating === "strong" && c.improve.length > 0) || (c.rating === "at_risk" && c.wellDone.length > 0 && c.improve.length === 0);
  return (
    <div id={`da-cat-${c.id}`} className="scroll-mt-20 rounded-xl border border-white/[0.07] bg-[#121823]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`da-catbody-${c.id}`}
        className="flex w-full items-center gap-4 px-5 py-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ outlineColor: OLIVE }}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium text-zinc-100">{c.label}</p>
          <p className="mt-0.5 truncate text-[12.5px] text-zinc-500">{c.metric}</p>
        </div>
        <Chip className={r.chip}>{r.label}</Chip>
        <Chevron open={open} />
      </button>
      <Collapse open={open} id={`da-catbody-${c.id}`}>
        <div className="border-t border-white/[0.06] px-5 pb-6 pt-5">
          <p className="text-[13px] leading-relaxed text-zinc-400">
            <span className="text-zinc-300">Rating:</span> {r.label}, from the project&apos;s end-state metrics. {c.metric}
            {tension && " The decisions below tell a different story from the metric; both are part of the picture."}
          </p>
          {!c.hasDecisionEvidence ? (
            <p className="mt-4 rounded-lg bg-white/[0.03] px-4 py-3 text-[13px] leading-relaxed text-zinc-400">
              No recorded decision in this save bears directly on this area, so there&apos;s not enough evidence to assess how it was managed. The rating reflects the final metrics only.
            </p>
          ) : (
            <div className="mt-5 grid gap-6 md:grid-cols-2">
              <div>
                <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-emerald-300/80">What you did well</p>
                <EvidenceList items={c.wellDone} tone="positive" empty="No positive practice is recorded in this area." />
              </div>
              <div>
                <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-orange-300/80">{c.tradeoffs.length ? "Opportunities & trade-offs" : "Opportunities to improve"}</p>
                <EvidenceList items={improve} tone="mixed" empty="No clear missed opportunity is recorded in this area." />
              </div>
            </div>
          )}
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Why it mattered</p>
              <p className="text-[13px] leading-relaxed text-zinc-400">{c.whyItMatters}</p>
              {c.consequences.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {c.consequences.map((t) => <li key={t} className="text-[13px] leading-relaxed text-zinc-300">— {t}</li>)}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Relevant APM learning</p>
              <div className="flex flex-wrap gap-1.5">
                {c.modules.map((m) => (
                  <button key={m.id} type="button" onClick={() => onModule(m)} className="rounded-full bg-white/5 px-2.5 py-1 text-[12px] text-zinc-300 ring-1 ring-inset ring-white/10 hover:bg-white/10">
                    {m.number}. {m.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Collapse>
    </div>
  );
}

function DecisionItem({ d, open, onToggle }: { d: JourneyDecision; open: boolean; onToggle: () => void }) {
  const ind = INDICATOR[d.indicator];
  return (
    <li className="relative pb-4">
      <span className={`absolute -left-[29.5px] top-[18px] h-[10px] w-[10px] rounded-full ring-4 ring-[#0b0f16] ${ind.dot}`} aria-hidden="true" />
      <div className={`rounded-xl border transition-colors ${open ? "border-white/[0.12] bg-[#141b27]" : "border-white/[0.06] bg-[#111721] hover:border-white/[0.1]"}`}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`da-dec-${d.id}`}
          className="flex w-full items-start gap-4 px-5 py-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ outlineColor: OLIVE }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">{actShort(d)}</p>
            <p className="mt-1 text-[15px] font-medium text-zinc-50">{d.title}</p>
            <p className={`mt-1 text-[13px] leading-relaxed text-zinc-400 ${open ? "" : "line-clamp-1"}`}>{d.choice}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
            <Chip className={ind.chip}>{ind.label}</Chip>
            <Chevron open={open} />
          </div>
        </button>
        <Collapse open={open} id={`da-dec-${d.id}`}>
          <div className="grid gap-5 border-t border-white/[0.06] px-5 pb-5 pt-4 md:grid-cols-2">
            <Block n="1" title="The situation"><p>{d.situation}</p></Block>
            <Block n="2" title="Your decision">
              <p className="text-zinc-200">{d.choice}</p>
              {d.choiceDetail && (
                <ul className="mt-1.5 flex flex-col gap-1">{d.choiceDetail.map((x) => <li key={x} className="text-[12.5px] text-zinc-400">{x}</li>)}</ul>
              )}
            </Block>
            <Block n="3" title="Why it mattered">
              {d.assessment && <p>{d.assessment}</p>}
              <Effects effects={d.effects} />
              {d.consequences.map((c) => <p key={c} className="mt-2 text-zinc-300">{c}</p>)}
              {!d.assessment && !d.effects.length && !d.consequences.length && <p className="text-zinc-500">No recorded consequence to show.</p>}
            </Block>
            <Block n="4" title="What you could consider differently">
              {d.alternatives.length ? (
                <ul className="flex flex-col gap-3">
                  {d.alternatives.map((alt) => (
                    <li key={alt.text}>
                      <p className="text-zinc-300">{alt.text}</p>
                      {alt.note && <p className="mt-0.5 text-[12.5px] text-zinc-500">{alt.note}</p>}
                      <Effects effects={alt.effects} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-zinc-500">No alternative to compare here.</p>
              )}
            </Block>
            {d.modules.length > 0 && (
              <div className="md:col-span-2">
                <p className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-zinc-500">5 · APM connection</p>
                <p className="text-[13px] text-zinc-400">{d.modules.map((m) => `Module ${m.replace("module-", "")}`).join(" · ")} (see APM Knowledge Mapping below)</p>
              </div>
            )}
          </div>
        </Collapse>
      </div>
    </li>
  );
}

function Block({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <div className="text-[13.5px] leading-relaxed text-zinc-400">
      <p className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{n} · {title}</p>
      {children}
    </div>
  );
}

function TakeawayRow({ heading, t }: { heading: string; t: Takeaway }) {
  return (
    <div className="px-6 py-6 sm:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em]" style={{ color: OLIVE }}>{heading}</p>
        {t.general && <Chip className="bg-white/5 text-zinc-400 ring-white/10">General learning point</Chip>}
      </div>
      {!t.general && t.title && t.title !== heading && <p className="mt-2 text-[17px] font-medium text-zinc-50">{t.title}</p>}
      <p className="mt-1.5 max-w-3xl text-[14.5px] leading-relaxed text-zinc-300">{t.text}</p>
      {t.source && <p className="mt-2 text-[12px] text-zinc-500">{t.source}</p>}
    </div>
  );
}
