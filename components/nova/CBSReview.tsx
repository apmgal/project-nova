"use client";

import type { ToolScreenBlock, CbsClassification } from "@/lib/nova/types";
import { getToolScreen } from "@/lib/nova/data";
import { STARTING_BUDGET } from "@/lib/nova/state";
import { WBS_ZONE_STYLE, FALLBACK_WBS_ZONE_STYLE } from "./wbsZoneStyle";
import { useConceptHint, ConceptHintButton, ConceptHintPanel } from "./ConceptHint";
import { ResetToolButton } from "./ResetTool";
import { SubmitToolButton } from "./SubmitTool";

interface CBSReviewProps {
  toolScreen: ToolScreenBlock;
  classifications: Record<string, CbsClassification | undefined>;
  onClassify: (taskId: string, classification: CbsClassification) => void;
  pmConcept?: string;
  onReset: () => void;
  canSubmit: boolean;
  onSubmit: () => void;
  /** Project Artefacts gallery snapshot mode — same contract as ToolScreen/
   * PriorityBoard's own `readOnly`: hides instructions/hint/reset/submit
   * and the Protect/Potential lever buttons become static labels reading
   * back whatever classification is already in GameState.decisions,
   * rather than live controls. */
  readOnly?: boolean;
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
 * root node shows the fixed £8.0M cost baseline plus the £4.0M contingency
 * it leaves within the £12.0M approved budget — both derived from
 * STARTING_BUDGET and totalIfAllIncluded, never hardcoded — and every
 * task leaf shows its own cost. Nothing here is ever cut: the total never
 * moves. Instead, each classifiable task gets an explicit Protect /
 * Potential lever judgement — a contingency-planning read, not a scope
 * decision — via two per-task buttons rather than a single tap, so
 * "explicitly protected" stays distinguishable from "not yet considered"
 * (see isCbsClassificationComplete's doc comment in state.ts for why that
 * distinction matters). Foundations and Filling Equipment still show as
 * cost lines but render with no buttons at all — classifiableTaskIds
 * excludes them because no downstream consequence exists for either yet,
 * and an interactive-looking control with nothing behind it would be
 * worse than no control.
 */
export default function CBSReview({
  toolScreen,
  classifications,
  onClassify,
  pmConcept,
  onReset,
  canSubmit,
  onSubmit,
  readOnly = false,
}: CBSReviewProps) {
  const hint = useConceptHint(pmConcept);
  const costs = toolScreen.costsByTask ?? {};
  const classifiableIds = new Set(toolScreen.classifiableTaskIds ?? []);
  const wbs = getToolScreen("TOOL_ACT3_SCENE01_WBS");
  const wbsCards = wbs?.cards ?? [];
  const zones = wbs?.buckets ?? [];

  const taskLabel = (taskId: string) => wbsCards.find((c) => c.id === taskId)?.text ?? taskId;
  const taskZone = (taskId: string) => wbsCards.find((c) => c.id === taskId)?.correctBucket;

  const baseline = toolScreen.totalIfAllIncluded ?? Object.values(costs).reduce((a, b) => a + b, 0);
  const approved = STARTING_BUDGET;
  const contingency = approved - baseline;

  const classifiedCount = [...classifiableIds].filter((id) => classifications[id]).length;

  return (
    <div
      className={`flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900/90 p-4 ${readOnly ? "pointer-events-none" : ""}`}
    >
      {!readOnly && (toolScreen.instructions || pmConcept) && (
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
      {!readOnly && <ConceptHintPanel entry={hint.entry} open={hint.open} onClose={hint.close} />}

      <div className="flex flex-col items-center">
        <div className="grid w-full max-w-md grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[11px] text-zinc-500">Cost baseline</div>
            <div className="mt-0.5 text-lg font-semibold text-zinc-100">{formatMillions(baseline)}</div>
          </div>
          <div>
            <div className="text-[11px] text-zinc-500">Contingency</div>
            <div className="mt-0.5 text-lg font-semibold text-emerald-300">{formatMillions(contingency)}</div>
          </div>
          <div>
            <div className="text-[11px] text-zinc-500">Approved budget</div>
            <div className="mt-0.5 text-lg font-semibold text-zinc-100">{formatMillions(approved)}</div>
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
            <div key={zone} className="flex w-[170px] flex-none flex-col items-center gap-1.5">
              <div className="h-4 w-px bg-zinc-700" />
              <div
                className={`flex w-full flex-col items-center gap-1 rounded-md border-2 px-2 py-2 text-center ${style.ring} ${style.fill}`}
              >
                <style.Icon className={`h-4 w-4 ${style.iconColor}`} aria-hidden="true" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-200">
                  {zone}
                </span>
              </div>
              <div className="flex w-full flex-col gap-1.5">
                {zoneTaskIds.map((taskId) => {
                  const isClassifiable = classifiableIds.has(taskId);
                  const classification = classifications[taskId];
                  return (
                    <div
                      key={taskId}
                      className="rounded-md border border-zinc-700 bg-zinc-800/80 px-2 py-1.5 text-left text-[11px] text-zinc-300"
                    >
                      <div>{taskLabel(taskId)}</div>
                      <div className="mt-0.5 text-zinc-500">{currencyFormatter.format(costs[taskId])}</div>
                      {isClassifiable && readOnly && (
                        <div
                          className={`mt-1.5 rounded border px-1.5 py-1 text-center text-[10px] font-medium ${
                            classification === "protected"
                              ? "border-emerald-700/60 bg-emerald-950/40 text-emerald-300"
                              : classification === "potentialLever"
                                ? "border-amber-700/60 bg-amber-950/40 text-amber-300"
                                : "border-zinc-700 bg-zinc-900/60 text-zinc-500"
                          }`}
                        >
                          {classification === "protected"
                            ? "Protected"
                            : classification === "potentialLever"
                              ? "Potential lever"
                              : "Not classified"}
                        </div>
                      )}
                      {isClassifiable && !readOnly && (
                        <div className="mt-1.5 flex gap-1">
                          <button
                            type="button"
                            onClick={() => onClassify(taskId, "protected")}
                            className={`flex-1 rounded border px-1.5 py-1 text-[10px] font-medium transition-colors ${
                              classification === "protected"
                                ? "border-emerald-700/60 bg-emerald-950/40 text-emerald-300"
                                : "border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-500"
                            }`}
                          >
                            Protect
                          </button>
                          <button
                            type="button"
                            onClick={() => onClassify(taskId, "potentialLever")}
                            className={`flex-1 rounded border px-1.5 py-1 text-[10px] font-medium transition-colors ${
                              classification === "potentialLever"
                                ? "border-amber-700/60 bg-amber-950/40 text-amber-300"
                                : "border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-500"
                            }`}
                          >
                            Potential lever
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {!readOnly && classifiableIds.size > 0 && classifiedCount < classifiableIds.size && (
        <p className="text-xs text-zinc-400">
          Classify every package above — {classifiedCount}/{classifiableIds.size} done — before continuing.
        </p>
      )}

      {!readOnly && <SubmitToolButton canSubmit={canSubmit} onSubmit={onSubmit} />}
    </div>
  );
}
