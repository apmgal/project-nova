"use client";

import { useState } from "react";
import type { GameState, ToolScreenBlock } from "@/lib/nova/types";
import { computeWeeksRemaining, computeCurrentObjective, metricBand } from "@/lib/nova/state";

interface HUDProps {
  gameState: GameState;
  ganttToolScreen: ToolScreenBlock | null;
  onDismissTutorial: () => void;
}

/** Baseline budgetRemaining from game_state.json's starting template —
 * used only to turn an absolute currency figure into a percentage for
 * banding; not re-derived from data since it's a fixed starting value. */
const STARTING_BUDGET = 12_000_000;

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
      "How much of your £12M starting budget is left. Spent through your MoSCoW choices, any Cost Breakdown cut, and who you hired.",
  },
  {
    label: "Schedule",
    description:
      "How your timeline is tracking. Rises when choices speed delivery up, drops when they slow it down — this is what the Week counter is built from.",
  },
  {
    label: "Risk",
    description: "How exposed the project is to something going wrong. Lower is safer.",
  },
  {
    label: "Quality",
    description:
      "How ready you are for regulatory inspection. Builds through validation work, documentation, and QA hires.",
  },
  {
    label: "Benefits",
    description:
      "Whether the project's actual outcomes have been realised yet. Stays at 0 until go-live, because you can't realise a benefit before the facility exists. The dot colour is a quick read across all five: green means healthy, amber means watch it, red means it needs attention.",
  },
];

type ChipState = "normal" | "active" | "dim";

function Chip({
  label,
  value,
  band,
  state,
}: {
  label: string;
  value: string;
  band: "green" | "yellow" | "red";
  state: ChipState;
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
      <span className="font-semibold text-zinc-100">{value}</span>
    </div>
  );
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
 * — this is informational, never a gate. Quality reuses regulatoryReadiness
 * and Benefits reuses benefitsRealisationScore, the closest existing
 * metrics to what the design calls for.
 *
 * A "?" toggle (re)starts a sequential coach-mark tour: one chip
 * highlighted at a time (the rest dimmed), a callout underneath naming it
 * and explaining what it measures, "Got it" advancing Budget -> Schedule
 * -> Risk -> Quality -> Benefits, "Skip tutorial" ending it immediately.
 * It auto-starts the first time the HUD ever mounts (gated by
 * flags.hud_tutorial_seen, set via onDismissTutorial once the tour ends
 * or is skipped for the first time) and can be replayed from the start
 * afterwards via the "?" toggle.
 */
export default function HUD({ gameState, ganttToolScreen, onDismissTutorial }: HUDProps) {
  const [tutorialStep, setTutorialStep] = useState<number | null>(
    gameState.flags.hud_tutorial_seen ? null : 0
  );

  const metrics = gameState.projectMetrics;
  const weeksRemaining = computeWeeksRemaining(metrics.scheduleHealth);
  const currentWeek = Math.max(0, Math.min(24, weeksRemaining));
  const isOverdue = weeksRemaining > 24 || weeksRemaining < 0;

  const budgetPct = (metrics.budgetRemaining / STARTING_BUDGET) * 100;
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
    <div className="relative z-10 border-b border-zinc-800 bg-zinc-950/80">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <div className={`text-xs font-semibold ${isOverdue ? "text-red-400" : "text-emerald-400"}`}>
          Week {weeksRemaining} / 24{isOverdue ? " — OVERDUE" : ""}
        </div>
        <div className="relative">
          <Chip
            label="Budget"
            value={`${Math.round(budgetPct)}%`}
            band={metricBand(budgetPct, true)}
            state={chipState(0)}
          />
          {renderPopoverIfActive(0)}
        </div>
        <div className="relative">
          <Chip
            label="Schedule"
            value={`${metrics.scheduleHealth}`}
            band={metricBand(metrics.scheduleHealth, true)}
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
            band={metricBand(metrics.regulatoryReadiness, true)}
            state={chipState(3)}
          />
          {renderPopoverIfActive(3)}
        </div>
        <div className="relative">
          <Chip
            label="Benefits"
            value={`${metrics.benefitsRealisationScore}`}
            band={metricBand(metrics.benefitsRealisationScore, true)}
            state={chipState(4)}
          />
          {renderPopoverIfActive(4)}
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
