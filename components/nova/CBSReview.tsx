"use client";

import type { ToolScreenBlock } from "@/lib/nova/types";
import { getToolScreen } from "@/lib/nova/data";
import { WBS_ZONE_STYLE, FALLBACK_WBS_ZONE_STYLE } from "./wbsZoneStyle";
import { useConceptHint, ConceptHintButton, ConceptHintPanel } from "./ConceptHint";
import { ResetToolButton } from "./ResetTool";
import { SubmitToolButton } from "./SubmitTool";

interface CBSReviewProps {
  toolScreen: ToolScreenBlock;
  cutTaskId: string | undefined;
  onDescope: (taskId: string) => void;
  pmConcept?: string;
  onReset: () => void;
  canSubmit: boolean;
  onSubmit: () => void;
}

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function formatMillions(value: number): string {
  return `£${(value / 1_000_000).toFixed(1)}m`;
}

/**
 * "cost_review_with_descope" (CBS) — reuses the WBS's warehouse tree shape
 * and zone color/icon coding (WBS_ZONE_STYLE) but as a cost review: the
 * root node shows the live running total as a simple headline number plus
 * a budget gauge and an over/within-budget badge (no "threshold" wording,
 * per design direction), each zone box shows only its name (no subtotal),
 * and every task leaf shows its own cost. Tapping a task cuts it — a
 * live, changeable pick (tap a different task to switch, or the same one
 * again to restore) rather than a one-way commitment, mirroring Team
 * Selection's reversible-until-you-move-on interaction. The zone->task
 * grouping is borrowed directly from TOOL_ACT3_SCENE01_WBS's
 * cards[].correctBucket rather than duplicated in this tool's own data,
 * since CBS reviews the exact same task set the player already sorted in
 * the WBS scene.
 */
export default function CBSReview({
  toolScreen,
  cutTaskId,
  onDescope,
  pmConcept,
  onReset,
  canSubmit,
  onSubmit,
}: CBSReviewProps) {
  const hint = useConceptHint(pmConcept);
  const costs = toolScreen.costsByTask ?? {};
  const wbs = getToolScreen("TOOL_ACT3_SCENE01_WBS");
  const wbsCards = wbs?.cards ?? [];
  const zones = wbs?.buckets ?? [];

  const taskLabel = (taskId: string) => wbsCards.find((c) => c.id === taskId)?.text ?? taskId;
  const taskZone = (taskId: string) => wbsCards.find((c) => c.id === taskId)?.correctBucket;

  const total = Object.entries(costs).reduce(
    (sum, [taskId, cost]) => (taskId === cutTaskId ? sum : sum + cost),
    0
  );
  const budget = toolScreen.descopeThreshold ?? Infinity;
  const overBudget = total > budget;
  const barPercent = Number.isFinite(budget) ? Math.min(100, Math.round((total / budget) * 100)) : 0;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900/90 p-4">
      {(toolScreen.instructions || pmConcept) && (
        <div className="flex items-start justify-between gap-3">
          {toolScreen.instructions && (
            <p className="text-sm text-zinc-300">{toolScreen.instructions}</p>
          )}
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <ConceptHintButton entry={hint.entry} open={hint.open} onToggle={hint.toggle} />
            <ResetToolButton onReset={onReset} />
          </div>
        </div>
      )}
      <ConceptHintPanel entry={hint.entry} open={hint.open} onClose={hint.close} />

      <div className="flex flex-col items-center">
        <div className="w-64 max-w-full text-center">
          <div className="text-xs text-zinc-500">Total facility cost</div>
          <div className="mt-0.5 text-2xl font-semibold text-zinc-100">{formatMillions(total)}</div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full transition-all ${overBudget ? "bg-red-500" : "bg-emerald-500"}`}
              style={{ width: `${barPercent}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-zinc-500">
            <span>£0</span>
            <span>Budget {currencyFormatter.format(budget)}</span>
          </div>
          <div
            className={`mt-2 inline-block rounded-full px-3 py-1 text-xs ${
              overBudget ? "bg-red-950/50 text-red-300" : "bg-emerald-950/50 text-emerald-300"
            }`}
          >
            {overBudget
              ? `Over budget by ${currencyFormatter.format(total - budget)}`
              : "Within budget"}
          </div>
        </div>
        <div className="mt-3 h-4 w-px bg-zinc-700" />
        <div className="h-px w-full max-w-xl bg-zinc-700" />
      </div>

      <div className="flex flex-wrap justify-center gap-x-2 gap-y-3">
        {zones.map((zone) => {
          const style = WBS_ZONE_STYLE[zone] ?? FALLBACK_WBS_ZONE_STYLE;
          const zoneTaskIds = Object.keys(costs).filter((taskId) => taskZone(taskId) === zone);
          if (zoneTaskIds.length === 0) return null;

          return (
            <div key={zone} className="flex w-[150px] flex-none flex-col items-center gap-1.5">
              <div className="h-4 w-px bg-zinc-700" />
              <div
                className={`flex w-full flex-col items-center gap-1 rounded-md border-2 px-2 py-2 text-center ${style.ring} ${style.fill}`}
              >
                <style.Icon className={`h-4 w-4 ${style.iconColor}`} aria-hidden="true" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-200">
                  {zone}
                </span>
              </div>
              <div className="flex w-full flex-col gap-1">
                {zoneTaskIds.map((taskId) => {
                  const isCut = taskId === cutTaskId;
                  return (
                    <button
                      key={taskId}
                      onClick={() => onDescope(taskId)}
                      className={`rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors ${
                        isCut
                          ? "border-red-700/60 bg-red-950/30 text-red-300"
                          : "border-zinc-700 bg-zinc-800/80 text-zinc-300 hover:border-zinc-500"
                      }`}
                    >
                      <div className={isCut ? "line-through" : ""}>{taskLabel(taskId)}</div>
                      <div className="mt-0.5 text-zinc-500">
                        {isCut ? "Cut — was " : ""}
                        {currencyFormatter.format(costs[taskId])}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {overBudget && (
        <p className="text-xs text-red-300">
          Over budget — tap one task above to cut it before continuing.
        </p>
      )}

      <SubmitToolButton canSubmit={canSubmit} onSubmit={onSubmit} />
    </div>
  );
}
