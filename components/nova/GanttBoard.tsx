"use client";

import { useState } from "react";
import type { ToolScreenBlock } from "@/lib/nova/types";

interface GanttBoardProps {
  toolScreen: ToolScreenBlock;
  placements: Record<string, string>;
  onPlace: (milestoneId: string, startWeek: number) => string | null;
}

/**
 * "gantt_placement" (Milestone Timeline) — tap a milestone, then tap a
 * starting week on the 0-24 axis; its bar renders for its fixed duration.
 * A placement that violates a dependency rule bounces back with an inline
 * "Error: Dependency" note instead of committing — validation happens in
 * the caller (onPlace returns an error string or null), same no-penalty
 * pattern as every other tool's wrong placement.
 */
export default function GanttBoard({ toolScreen, placements, onPlace }: GanttBoardProps) {
  const milestones = toolScreen.milestones ?? [];
  const weeks = toolScreen.timelineWeeks ?? 24;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSelectMilestone(id: string) {
    setSelectedId((current) => (current === id ? null : id));
    setError(null);
  }

  function handlePlaceWeek(week: number) {
    if (!selectedId) return;
    const result = onPlace(selectedId, week);
    if (result) {
      setError(result);
      return;
    }
    setError(null);
    setSelectedId(null);
  }

  const weekAxis = Array.from({ length: weeks }, (_, i) => i);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/90 p-4">
      {toolScreen.instructions && (
        <p className="text-sm text-zinc-300">{toolScreen.instructions}</p>
      )}
      {error && (
        <div className="rounded-md border border-red-700/50 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="flex min-w-[560px] flex-col gap-1">
          <div className="flex gap-[2px] pl-32 text-[9px] text-zinc-600">
            {weekAxis.map((w) => (
              <div key={w} className="w-4 flex-shrink-0 text-center">
                {w % 4 === 0 ? w : ""}
              </div>
            ))}
          </div>
          {milestones.map((milestone) => {
            const start = placements[milestone.id];
            const startWeek = start === undefined ? null : Number(start);
            const isSelected = selectedId === milestone.id;
            return (
              <div key={milestone.id} className="flex items-center gap-1">
                <button
                  onClick={() => handleSelectMilestone(milestone.id)}
                  className={`w-32 flex-shrink-0 truncate rounded px-2 py-1 text-left text-[11px] transition-colors ${
                    isSelected
                      ? "bg-emerald-700/70 text-white ring-1 ring-emerald-400"
                      : startWeek !== null
                        ? "bg-emerald-950/40 text-emerald-300"
                        : "bg-zinc-800 text-zinc-300 hover:border-zinc-500"
                  }`}
                  title={milestone.text}
                >
                  {milestone.text}
                </button>
                <div className="flex gap-[2px]">
                  {weekAxis.map((w) => {
                    const isBar = startWeek !== null && w >= startWeek && w < startWeek + milestone.durationWeeks;
                    return (
                      <button
                        key={w}
                        onClick={() => handlePlaceWeek(w)}
                        className={`h-4 w-4 flex-shrink-0 rounded-sm transition-colors ${
                          isBar
                            ? "bg-emerald-500"
                            : isSelected
                              ? "bg-zinc-700 hover:bg-emerald-800/60"
                              : "bg-zinc-800/60"
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
