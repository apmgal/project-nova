"use client";

import { useState } from "react";
import type { GameState, ToolScreenBlock } from "@/lib/nova/types";
import {
  computeWeeksRemaining,
  computeCurrentObjective,
  metricBand,
  computeBudgetReconciliation,
} from "@/lib/nova/state";

interface HUDProps {
  gameState: GameState;
  ganttToolScreen: ToolScreenBlock | null;
  onDismissTutorial: () => void;
}

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 1,
  notation: "compact",
});

const BAND_DOT: Record<string, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
};

/** Generic (not personalised) explainer copy for each HUD metric, in the
 * same order the chips render — index doubles as the tutorial step. What
 * each measures and broadly what kind of choices move it, not why THIS
 * player's number is what it is (that would need a running decision-
 * attribution log, a bigger feature than a tutorial). British English. */
const METRIC_HELP: { label: string; description: string }[] = [
  {
    label: "Budget",
    description:
      "How much of the £4.0M contingency you set aside in Act 3 is still unspent — not a raw percentage of the full £12M, since spending exactly the contingency should read as fully exposed, not '66% remaining'. Tap the chip for the full breakdown.",
  },
  {
    label: "Delivery Pace",
    description:
      "How fast the project is moving against its 24-week plan. Rises when choices speed delivery up, drops when they slow it down — the Est. finish week is projected straight from this.",
  },
  {
    label: "Risk",
    description: "How exposed the project is to something going wrong. Lower is safer.",
  },
  {
    label: "Quality",
    description:
      "How ready you are for regulatory inspection. Builds through validation work, documentation, and QA hires. The dot colour is a quick read across all four: green means healthy, amber means watch it, red means it needs attention.",
  },
];

type ChipState = "normal" | "active" | "dim";

function Chip({
  label,
  value,
  band,
  state,
  valueClassName = "text-zinc-100",
}: {
  label: string;
  value: string;
  band: "green" | "yellow" | "red";
  state: ChipState;
  /** Overrides the value span's colour — used by Delivery Pace to tint its
   * +/- delta green/red independently of the dot's overall health band. */
  valueClassName?: string;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-all ${
        state === "active"
          ? "scale-105 border-emerald-500 bg-zinc-800 ring-2 ring-emerald-500"
          : state === "dim"
            ? "border-zinc-800 bg-zinc-900/80 opacity-30"
            : "border-zinc-700 bg-zinc-900/80"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${BAND_DOT[band]}`} />
      <span className="text-zinc-400">{label}</span>
      <span className={`font-semibold ${valueClassName}`}>{value}</span>
    </div>
  );
}

/** Delivery Pace shows as a signed delta from its 100 baseline (e.g. "▲ 5%"
 * / "▼ 5%") rather than the raw scheduleHealth score — the arrow answers
 * "ahead or behind" at a glance without the player needing to know 100 is
 * the neutral point. */
function deliveryPaceDisplay(scheduleHealth: number): { value: string; className: string } {
  const delta = Math.round(scheduleHealth - 100);
  if (delta > 0) return { value: `▲ ${delta}%`, className: "text-emerald-400" };
  if (delta < 0) return { value: `▼ ${Math.abs(delta)}%`, className: "text-red-400" };
  return { value: "0%", className: "text-zinc-100" };
}

/**
 * The tutorial's "Got it" step content, anchored directly under whichever
 * chip is currently active rather than claiming a full-width row below the
 * whole chip bar. Floats over the scene background (translucent + blurred,
 * matching DialogueBox's own treatment) instead of pushing it down with an
 * opaque bar — chosen over a full-width translucent bar or reusing the
 * dialogue box's own slot after a design brainstorm with the user.
 */
function TutorialPopover({
  step,
  total,
  label,
  description,
  isLast,
  onSkip,
  onGotIt,
}: {
  step: number;
  total: number;
  label: string;
  description: string;
  isLast: boolean;
  onSkip: () => void;
  onGotIt: () => void;
}) {
  return (
    <div className="absolute left-0 top-full z-30 mt-2 w-64">
      <div className="absolute -top-1 left-4 h-2 w-2 rotate-45 border-l border-t border-emerald-700/50 bg-zinc-950/95" />
      <div className="rounded-lg border border-emerald-700/50 bg-zinc-950/95 p-3 backdrop-blur-sm">
        <div className="text-[10px] uppercase tracking-wide text-zinc-500">
          Step {step + 1} of {total}
        </div>
        <div className="mt-1 text-sm font-semibold text-zinc-100">{label}</div>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">{description}</p>
        <div className="mt-3 flex items-center justify-between">
          <button onClick={onSkip} className="text-[11px] text-zinc-500 underline hover:text-zinc-300">
            Skip tutorial
          </button>
          <button
            onClick={onGotIt}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            {isLast ? "Got it" : "Got it →"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Deployment Countdown HUD — a pure display layer over existing
 * projectMetrics/toolPlacements, introducing no new stored variables of
 * its own beyond the tutorial-seen flag. weeksRemaining is derived fresh
 * every render from scheduleHealth and is never clamped: a badly-behind
 * schedule can show "Week 27 / 24" and the story keeps moving regardless
 * — this is informational, never a gate. Quality reuses regulatoryReadiness,
 * the closest existing metric to what the design calls for.
 *
 * A "?" toggle (re)starts a sequential coach-mark tour: one chip
 * highlighted at a time (the rest dimmed), a callout underneath naming it
 * and explaining what it measures, "Got it" advancing Budget -> Delivery
 * Pace -> Risk -> Quality, "Skip tutorial" ending it immediately.
 * It auto-starts the first time the HUD ever mounts (gated by
 * flags.hud_tutorial_seen, set via onDismissTutorial once the tour ends
 * or is skipped for the first time) and can be replayed from the start
 * afterwards via the "?" toggle.
 */
export default function HUD({ gameState, ganttToolScreen, onDismissTutorial }: HUDProps) {
  const [tutorialStep, setTutorialStep] = useState<number | null>(
    gameState.flags.hud_tutorial_seen ? null : 0
  );
  const [budgetDetailOpen, setBudgetDetailOpen] = useState(false);

  const metrics = gameState.projectMetrics;
  const weeksRemaining = computeWeeksRemaining(metrics.scheduleHealth);
  const currentWeek = Math.max(0, Math.min(24, weeksRemaining));
  const isOverdue = weeksRemaining > 24 || weeksRemaining < 0;

  // Reconciled against the £4.0M contingency Act 3 establishes, not a raw
  // fraction of the full £12M approved figure — see computeBudgetReconciliation's
  // own doc comment in state.ts for why that distinction matters (spending
  // exactly the contingency should read as fully exposed, not "66% left").
  // Deliberately unclamped here (unlike Gate 3's own use of this same
  // function) so a genuine overspend past the contingency visibly reads as
  // negative rather than flattening at 0%, same treatment Delivery Pace's
  // own +/- delta already gets below.
  const reconciliation = computeBudgetReconciliation(gameState);
  const contingencyPct = (reconciliation.headroom / reconciliation.originalContingency) * 100;
  const pace = deliveryPaceDisplay(metrics.scheduleHealth);
  const objective = ganttToolScreen
    ? computeCurrentObjective(
        ganttToolScreen,
        gameState.toolPlacements[ganttToolScreen.toolId] ?? {},
        currentWeek
      )
    : "";

  function chipState(index: number): ChipState {
    if (tutorialStep === null) return "normal";
    return index === tutorialStep ? "active" : "dim";
  }

  function endTutorial() {
    setTutorialStep(null);
    if (!gameState.flags.hud_tutorial_seen) onDismissTutorial();
  }

  function handleGotIt() {
    if (tutorialStep === null) return;
    if (tutorialStep >= METRIC_HELP.length - 1) {
      endTutorial();
      return;
    }
    setTutorialStep(tutorialStep + 1);
  }

  function renderPopoverIfActive(index: number) {
    if (tutorialStep !== index) return null;
    const help = METRIC_HELP[index];
    return (
      <TutorialPopover
        step={tutorialStep}
        total={METRIC_HELP.length}
        label={help.label}
        description={help.description}
        isLast={tutorialStep === METRIC_HELP.length - 1}
        onSkip={endTutorial}
        onGotIt={handleGotIt}
      />
    );
  }

  return (
    <div className="relative z-20 border-b border-zinc-800 bg-zinc-950/80">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <div className="flex items-center gap-1 text-xs">
          <span className="font-semibold text-zinc-500">Est. Completion:</span>
          <span className={`font-semibold ${isOverdue ? "text-red-400" : "text-emerald-400"}`}>
            Week {weeksRemaining} / 24{isOverdue ? " — OVERDUE" : ""}
          </span>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setBudgetDetailOpen((v) => !v)}
            className="rounded-full text-left"
            aria-expanded={budgetDetailOpen}
          >
            <Chip
              label="Budget"
              value={`${Math.round(contingencyPct)}%`}
              band={metricBand(contingencyPct, true)}
              state={chipState(0)}
            />
          </button>
          {renderPopoverIfActive(0)}
          {budgetDetailOpen && tutorialStep === null && (
            <div className="absolute left-0 top-full z-30 mt-2 w-60 rounded-lg border border-zinc-700 bg-zinc-950/95 p-3 text-[11px] text-zinc-300 backdrop-blur-sm">
              <div className="mb-1.5 text-[10px] uppercase tracking-wide text-zinc-500">
                Contingency headroom
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Cost baseline</span>
                <span>{currencyFormatter.format(reconciliation.referenceBaselineCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Additional spend</span>
                <span>{currencyFormatter.format(reconciliation.additionalSpend)}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-800 pt-1 mt-1">
                <span className="text-zinc-500">Forecast cost</span>
                <span>{currencyFormatter.format(reconciliation.forecastCostAgainstBaseline)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Approved budget</span>
                <span>{currencyFormatter.format(reconciliation.approvedBudget)}</span>
              </div>
              <div className="mt-1.5 flex justify-between border-t border-zinc-800 pt-1.5 font-semibold">
                <span className="text-zinc-400">Headroom left</span>
                <span className={reconciliation.headroom < 0 ? "text-red-400" : "text-emerald-400"}>
                  {currencyFormatter.format(reconciliation.headroom)}
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          <Chip
            label="Delivery Pace"
            value={pace.value}
            valueClassName={pace.className}
            // Red line matches Gate 1's real contract-losing floor
            // (gateThresholds.contractGate.scheduleHealthFloor in
            // data/endings.json) instead of metricBand's generic default of
            // 30 — a player at scheduleHealth 35 was previously shown a
            // reassuring amber/yellow dot despite already being in
            // Contract Lost territory. Green line left at the generic
            // default (60) rather than invented from scratch, giving a
            // 20-point amber warning band (40-59) above the real floor.
            // Deliberately does not account for the grace-decision floor
            // override (30, only when big01Response === "phase_b_quietly")
            // — that would need decisions threaded into the HUD just for
            // this, and defaulting to the stricter floor only ever errs
            // toward over-warning, never toward hiding real danger.
            band={metricBand(metrics.scheduleHealth, true, 60, 40)}
            state={chipState(1)}
          />
          {renderPopoverIfActive(1)}
        </div>
        <div className="relative">
          <Chip
            label="Risk"
            value={`${metrics.riskExposure}`}
            band={metricBand(metrics.riskExposure, false)}
            state={chipState(2)}
          />
          {renderPopoverIfActive(2)}
        </div>
        <div className="relative">
          <Chip
            label="Quality"
            value={`${metrics.regulatoryReadiness}`}
            // Matches Gate 2's real floors (gateThresholds.qualityGate in
            // data/endings.json): green only at/above the clean-release
            // floor (70), red below the recoverable floor (50) — the old
            // default (green >=60) let a player at regulatoryReadiness 65
            // read as "healthy" while still 5 points short of a clean
            // release.
            band={metricBand(metrics.regulatoryReadiness, true, 70, 50)}
            state={chipState(3)}
          />
          {renderPopoverIfActive(3)}
        </div>
        <div className="group relative flex-shrink-0">
          <button
            onClick={() => setTutorialStep(0)}
            aria-label="Replay tutorial"
            className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-700 text-[11px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
          >
            ?
          </button>
          <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] text-zinc-100 opacity-0 transition-opacity group-hover:opacity-100">
            Replay tutorial
          </span>
        </div>
        {gameState.flags.second_product_benefits_undefined && (
          <span className="rounded border border-amber-700/50 bg-amber-950/40 px-2 py-1 text-[10px] text-amber-300">
            Second Product Benefits: Undefined
          </span>
        )}
        {objective && (
          <div className="ml-auto text-[11px] text-zinc-400">
            Current Objective: <span className="text-zinc-200">{objective}</span>
          </div>
        )}
      </div>
    </div>
  );
}
