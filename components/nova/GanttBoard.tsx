"use client";

import { useState, type MouseEvent } from "react";
import type { ToolScreenBlock } from "@/lib/nova/types";
import { computeCriticalPath, isCriticalPathGuessCorrect } from "@/lib/nova/state";
import { WBS_ZONE_STYLE, FALLBACK_WBS_ZONE_STYLE } from "./wbsZoneStyle";
import { useConceptHint, ConceptHintButton, ConceptHintPanel } from "./ConceptHint";

interface GanttBoardProps {
  toolScreen: ToolScreenBlock;
  placements: Record<string, string>;
  onPlace: (milestoneId: string, startWeek: number) => string | null;
  criticalPathGuesses: string[];
  onToggleCriticalPathGuess: (milestoneId: string) => void;
  onConfirmCriticalPath: () => void;
  pmConcept?: string;
}

const WEEK_PX = 20;
const NAME_W = 150;
const ROW_H = 44;
const ROW_BOX_H = 36;
const BAR_H = 22;
const HEADER_H = 20;

/**
 * "gantt_placement" (Milestone Timeline) — two phases in one board, both
 * laid out on one absolutely-positioned grid (rather than flex rows) so
 * an SVG overlay can draw exact connector arrows between bars once the
 * critical path is revealed.
 *
 * Phase 1 (placing): tap a milestone name, then tap a point along its
 * continuous track; its bar renders for its fixed duration at the
 * nearest week, colored and dotted to match the same zone language
 * WBS/CBS use (via wbsCategory). A placement that violates a dependency
 * rule bounces back with an inline error — no penalty.
 *
 * Phase 2 (critical path): once every milestone is placed, positions
 * freeze and tapping a track/bar toggles a guess — tap the ones you
 * think form the critical path (the zero-slack chain that decides the
 * finish date), then tap Check. A wrong guess rings the mismatches in
 * red with no penalty; a fully correct guess rings the true chain in
 * green, connects it with arrows (earlier milestone's bar end -> later
 * milestone's bar start, in the order computeCriticalPath actually
 * found — never a hardcoded milestone sequence), names it, and reveals
 * a Continue action.
 */
export default function GanttBoard({
  toolScreen,
  placements,
  onPlace,
  criticalPathGuesses,
  onToggleCriticalPathGuess,
  onConfirmCriticalPath,
  pmConcept,
}: GanttBoardProps) {
  const milestones = toolScreen.milestones ?? [];
  const weeks = toolScreen.timelineWeeks ?? 24;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const hint = useConceptHint(pmConcept);

  const allPlaced = milestones.length > 0 && milestones.every((m) => placements[m.id] !== undefined);
  const trackWidth = weeks * WEEK_PX;
  const totalWidth = NAME_W + trackWidth;
  const totalHeight = HEADER_H + milestones.length * ROW_H;
  const labelWeeks = Array.from({ length: Math.ceil(weeks / 4) }, (_, i) => i * 4).filter((w) => w < weeks);
  const tickWeeks = labelWeeks.filter((w) => w > 0);

  function handleSelectMilestone(id: string) {
    setSelectedId((current) => (current === id ? null : id));
    setError(null);
  }

  function handlePlaceWeek(milestoneId: string, week: number) {
    const result = onPlace(milestoneId, week);
    if (result) {
      setError(result);
      return;
    }
    setError(null);
    setSelectedId(null);
  }

  function handleToggleGuess(milestoneId: string) {
    setChecked(false);
    onToggleCriticalPathGuess(milestoneId);
  }

  function handleTrackClick(milestoneId: string, event: MouseEvent<HTMLDivElement>) {
    if (allPlaced) {
      handleToggleGuess(milestoneId);
      return;
    }
    if (selectedId !== milestoneId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const week = Math.max(0, Math.min(weeks - 1, Math.round((event.clientX - rect.left) / WEEK_PX)));
    handlePlaceWeek(milestoneId, week);
  }

  // TEMP DEBUG — diagnosing a critical-path mismatch report, remove once resolved.
  function handleCheckClicked() {
    const endTimes = milestones.map((m) => {
      const start = placements[m.id];
      const startWeek = start === undefined ? null : Number(start);
      return {
        id: m.id,
        text: m.text,
        startWeek,
        endWeek: startWeek === null ? null : startWeek + m.durationWeeks,
      };
    });
    console.log("[Gantt debug] placements (start/end week per milestone):", endTimes);
    console.log(
      "[Gantt debug] computed critical path (end-to-start order):",
      computeCriticalPath(toolScreen, placements)
    );
    console.log("[Gantt debug] your current guesses:", criticalPathGuesses);
    setChecked(true);
  }

  const criticalPath = allPlaced ? computeCriticalPath(toolScreen, placements) : [];
  const criticalSet = new Set(criticalPath);
  const guessedSet = new Set(criticalPathGuesses);
  const isCorrect = allPlaced && isCriticalPathGuessCorrect(criticalPathGuesses, criticalPath);
  // computeCriticalPath returns end-to-start (finish milestone first);
  // reverse it to walk arrows start-to-finish.
  const orderedPath = criticalPath.slice().reverse();

  function rowIndex(milestoneId: string): number {
    return milestones.findIndex((m) => m.id === milestoneId);
  }
  function barCenterY(milestoneId: string): number {
    return HEADER_H + rowIndex(milestoneId) * ROW_H + ROW_BOX_H / 2;
  }
  function barTopY(milestoneId: string): number {
    return HEADER_H + rowIndex(milestoneId) * ROW_H + (ROW_BOX_H - BAR_H) / 2;
  }
  function barEndX(milestoneId: string): number {
    const m = milestones.find((mm) => mm.id === milestoneId);
    const start = placements[milestoneId];
    if (!m || start === undefined) return NAME_W;
    return NAME_W + (Number(start) + m.durationWeeks) * WEEK_PX;
  }
  function barStartX(milestoneId: string): number {
    const start = placements[milestoneId];
    return NAME_W + (start === undefined ? 0 : Number(start)) * WEEK_PX;
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/90 p-4">
      {(toolScreen.instructions || pmConcept) && (
        <div className="flex items-start justify-between gap-3">
          {toolScreen.instructions && (
            <p className="text-sm text-zinc-300">{toolScreen.instructions}</p>
          )}
          <ConceptHintButton entry={hint.entry} open={hint.open} onToggle={hint.toggle} />
        </div>
      )}
      <ConceptHintPanel entry={hint.entry} open={hint.open} onClose={hint.close} />
      {error && (
        <div className="rounded-md border border-red-700/50 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
      {allPlaced && (
        <p className="text-xs text-zinc-400">
          Tap the milestones you think form the critical path — the chain with zero slack that
          decides the finish date — then check your answer.
        </p>
      )}

      <div className="overflow-x-auto">
        <div className="relative" style={{ width: totalWidth, height: totalHeight }}>
          {labelWeeks.map((w) => (
            <span
              key={w}
              className="absolute text-[10px] text-zinc-600"
              style={{ top: 4, left: NAME_W + w * WEEK_PX }}
            >
              {w}
            </span>
          ))}

          {checked && isCorrect && (
            <svg
              width={totalWidth}
              height={totalHeight}
              className="pointer-events-none absolute left-0 top-0"
            >
              <defs>
                <marker id="gantt-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" className="fill-emerald-500" />
                </marker>
              </defs>
              {orderedPath.slice(0, -1).map((fromId, i) => {
                const toId = orderedPath[i + 1];
                const x1 = barEndX(fromId);
                const y1 = barCenterY(fromId);
                // Land just above the next milestone's bar (not beside it)
                // so the arrowhead is visibly pointing down into it, rather
                // than sideways — critical-path milestones are usually
                // back-to-back in time, so a sideways approach often had
                // almost no horizontal run to actually show the head.
                const targetX = barStartX(toId) + 10;
                const targetY = barTopY(toId) - 4;
                const path = `M${x1},${y1} L${targetX},${y1} L${targetX},${targetY}`;
                return (
                  <path
                    key={fromId}
                    d={path}
                    fill="none"
                    className="stroke-emerald-500"
                    strokeWidth={2}
                    strokeLinejoin="miter"
                    strokeLinecap="butt"
                    markerEnd="url(#gantt-arrow)"
                  />
                );
              })}
            </svg>
          )}

          {milestones.map((milestone) => {
            const start = placements[milestone.id];
            const startWeek = start === undefined ? null : Number(start);
            const isSelected = selectedId === milestone.id;
            const style = WBS_ZONE_STYLE[milestone.wbsCategory ?? ""] ?? FALLBACK_WBS_ZONE_STYLE;
            const isGuessed = guessedSet.has(milestone.id);
            const isActuallyCritical = criticalSet.has(milestone.id);
            const y = HEADER_H + rowIndex(milestone.id) * ROW_H;

            let barExtra = "";
            if (allPlaced && checked) {
              barExtra =
                isGuessed === isActuallyCritical ? " ring-2 ring-emerald-500" : " ring-2 ring-red-500";
            } else if (allPlaced && isGuessed) {
              barExtra = " ring-2 ring-zinc-300";
            }

            return (
              <div key={milestone.id}>
                <button
                  onClick={() =>
                    allPlaced ? handleToggleGuess(milestone.id) : handleSelectMilestone(milestone.id)
                  }
                  className={`absolute flex items-center gap-1.5 truncate rounded-md px-2.5 py-2 text-left text-[11px] transition-colors ${
                    isSelected
                      ? "bg-emerald-900/50 text-white ring-1 ring-emerald-500"
                      : "bg-zinc-800/70 text-zinc-300 hover:bg-zinc-800"
                  }`}
                  style={{ top: y, left: 0, width: NAME_W - 8, height: ROW_BOX_H }}
                  title={milestone.text}
                >
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${style.dotColor}`} />
                  <span className="truncate">{milestone.text}</span>
                </button>

                <div
                  onClick={(event) => handleTrackClick(milestone.id, event)}
                  className={`absolute cursor-pointer rounded-md transition-colors ${
                    isSelected ? "bg-emerald-950/30" : "bg-zinc-800/50"
                  }`}
                  style={{ top: y, left: NAME_W, width: trackWidth, height: ROW_BOX_H }}
                >
                  {tickWeeks.map((w) => (
                    <div
                      key={w}
                      className="pointer-events-none absolute inset-y-0 w-px bg-zinc-700/60"
                      style={{ left: w * WEEK_PX }}
                    />
                  ))}
                  {startWeek !== null && (
                    <div
                      className={`pointer-events-none absolute flex items-center rounded-md border px-2 text-[11px] text-zinc-100 transition-colors ${style.fill} ${style.ring}${barExtra}`}
                      style={{
                        top: (ROW_BOX_H - BAR_H) / 2,
                        left: startWeek * WEEK_PX,
                        width: milestone.durationWeeks * WEEK_PX - 2,
                        height: BAR_H,
                      }}
                    >
                      {milestone.durationWeeks}w
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {allPlaced && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleCheckClicked}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs text-zinc-200 hover:border-zinc-500"
          >
            Check critical path
          </button>
          {checked && (
            <span className={`text-xs ${isCorrect ? "text-emerald-400" : "text-red-300"}`}>
              {isCorrect ? "That's it." : "Not quite — the ones ringed in red are wrong. Try again."}
            </span>
          )}
        </div>
      )}

      {checked && isCorrect && (
        <div className="flex flex-col gap-2 rounded-md border border-emerald-700/50 bg-emerald-950/30 px-3 py-2">
          <p className="text-xs text-emerald-300">
            Critical path:{" "}
            {orderedPath.map((id) => milestones.find((m) => m.id === id)?.text).join(" → ")}. A
            delay in any one of these delays the finish date — everything else has slack.
          </p>
          <button
            onClick={onConfirmCriticalPath}
            className="w-fit rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Continue ▸
          </button>
        </div>
      )}
    </div>
  );
}
