"use client";

import type { GameState, ToolScreenBlock } from "@/lib/nova/types";
import { computeWeeksRemaining, computeCurrentObjective, metricBand } from "@/lib/nova/state";

interface HUDProps {
  gameState: GameState;
  ganttToolScreen: ToolScreenBlock | null;
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

function Chip({
  label,
  value,
  band,
}: {
  label: string;
  value: string;
  band: "green" | "yellow" | "red";
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900/80 px-2.5 py-1 text-[11px]">
      <span className={`h-2 w-2 rounded-full ${BAND_DOT[band]}`} />
      <span className="text-zinc-400">{label}</span>
      <span className="font-semibold text-zinc-100">{value}</span>
    </div>
  );
}

/**
 * Deployment Countdown HUD — a pure display layer over existing
 * projectMetrics/toolPlacements, introducing no new stored variables of
 * its own. weeksRemaining is derived fresh every render from
 * scheduleHealth and is never clamped: a badly-behind schedule can show
 * "Week 27 / 24" and the story keeps moving regardless — this is
 * informational, never a gate. Quality reuses regulatoryReadiness and
 * Benefits reuses benefitsRealisationScore, the closest existing metrics
 * to what the design calls for.
 */
export default function HUD({ gameState, ganttToolScreen }: HUDProps) {
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

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 bg-zinc-950/80 px-4 py-2">
      <div className={`text-xs font-semibold ${isOverdue ? "text-red-400" : "text-emerald-400"}`}>
        Week {weeksRemaining} / 24{isOverdue ? " — OVERDUE" : ""}
      </div>
      <Chip label="Budget" value={`${Math.round(budgetPct)}%`} band={metricBand(budgetPct, true)} />
      <Chip
        label="Schedule"
        value={`${metrics.scheduleHealth}`}
        band={metricBand(metrics.scheduleHealth, true)}
      />
      <Chip label="Risk" value={`${metrics.riskExposure}`} band={metricBand(metrics.riskExposure, false)} />
      <Chip
        label="Quality"
        value={`${metrics.regulatoryReadiness}`}
        band={metricBand(metrics.regulatoryReadiness, true)}
      />
      <Chip
        label="Benefits"
        value={`${metrics.benefitsRealisationScore}`}
        band={metricBand(metrics.benefitsRealisationScore, true)}
      />
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
  );
}
