"use client";

import type { ToolScreenBlock } from "@/lib/nova/types";

interface CBSReviewProps {
  toolScreen: ToolScreenBlock;
  cutTaskId: string | undefined;
  onDescope: (taskId: string) => void;
}

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

/**
 * "cost_review_with_descope" (CBS) — auto-sums every WBS task's cost and,
 * if the total exceeds descopeThreshold, requires cutting exactly one
 * task before continuing. Cutting is a live, changeable pick (tap a
 * different task to switch) rather than a one-way commitment, mirroring
 * Team Selection's reversible-until-you-move-on interaction.
 */
export default function CBSReview({ toolScreen, cutTaskId, onDescope }: CBSReviewProps) {
  const costs = toolScreen.costsByTask ?? {};
  const cards = toolScreen.cards ?? [];
  const taskLabel = (taskId: string) => cards.find((c) => c.id === taskId)?.text ?? taskId;

  const total = Object.entries(costs).reduce(
    (sum, [taskId, cost]) => (taskId === cutTaskId ? sum : sum + cost),
    0
  );
  const threshold = toolScreen.descopeThreshold ?? Infinity;
  const overThreshold = total > threshold;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/90 p-4">
      {toolScreen.instructions && (
        <p className="text-sm text-zinc-300">{toolScreen.instructions}</p>
      )}

      <div className="flex flex-col gap-1">
        {Object.entries(costs).map(([taskId, cost]) => {
          const isCut = taskId === cutTaskId;
          return (
            <button
              key={taskId}
              onClick={() => onDescope(taskId)}
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                isCut
                  ? "border-red-700/60 bg-red-950/30 text-red-300 line-through"
                  : "border-zinc-700 bg-zinc-800/80 text-zinc-200 hover:border-zinc-500"
              }`}
            >
              <span>{taskLabel(taskId)}</span>
              <span className="tabular-nums">{currencyFormatter.format(cost)}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-zinc-800 pt-2 text-sm">
        <span className="text-zinc-400">Total</span>
        <span className={overThreshold ? "font-semibold text-red-400" : "font-semibold text-emerald-400"}>
          {currencyFormatter.format(total)}
          <span className="ml-1 text-[11px] font-normal text-zinc-500">
            / {currencyFormatter.format(threshold)}
          </span>
        </span>
      </div>

      {overThreshold && (
        <p className="text-xs text-red-300">
          Over threshold — tap one task above to cut it before continuing.
        </p>
      )}
    </div>
  );
}
