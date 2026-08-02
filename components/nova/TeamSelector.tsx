"use client";

import { useState } from "react";
import type { ToolScreenBlock } from "@/lib/nova/types";
import ConceptHint from "./ConceptHint";

interface TeamSelectorProps {
  toolScreen: ToolScreenBlock;
  hiredIds: string[];
  onToggleHire: (candidateId: string) => void;
  pmConcept?: string;
}

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

/**
 * "pick_n_of_m_swipeable" (Team Selection) — browse candidates one at a
 * time (prev/next, purely navigational, never selects anything), with an
 * independent Hire/Un-hire toggle per card. Selection persists regardless
 * of browse direction; once maxHires are hired, Hire buttons on every
 * remaining un-hired card grey out — no silent auto-replacement.
 */
export default function TeamSelector({
  toolScreen,
  hiredIds,
  onToggleHire,
  pmConcept,
}: TeamSelectorProps) {
  const candidates = toolScreen.candidates ?? [];
  const maxHires = toolScreen.maxHires ?? candidates.length;
  const [index, setIndex] = useState(0);

  if (candidates.length === 0) return null;
  const candidate = candidates[index];
  const isHired = hiredIds.includes(candidate.id);
  const atCap = hiredIds.length >= maxHires;

  function goTo(delta: number) {
    setIndex((current) => {
      const next = current + delta;
      if (next < 0) return candidates.length - 1;
      if (next >= candidates.length) return 0;
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/90 p-4">
      {(toolScreen.instructions || pmConcept) && (
        <div className="flex items-start justify-between gap-3">
          {toolScreen.instructions && (
            <p className="text-sm text-zinc-300">{toolScreen.instructions}</p>
          )}
          <ConceptHint concept={pmConcept} />
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-zinc-500">
        <span>
          Candidate {index + 1} / {candidates.length}
        </span>
        <span className={hiredIds.length === maxHires ? "text-emerald-400" : "text-zinc-400"}>
          Hired: {hiredIds.length}/{maxHires}
        </span>
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-zinc-700 bg-zinc-950/40 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-zinc-100">{candidate.name}</div>
            {candidate.role && <div className="text-xs text-zinc-400">{candidate.role}</div>}
          </div>
          {isHired && (
            <span className="rounded bg-emerald-800/60 px-2 py-1 text-[10px] uppercase tracking-wide text-emerald-200">
              Hired
            </span>
          )}
        </div>
        {candidate.description && (
          <p className="text-xs text-zinc-300">{candidate.description}</p>
        )}
        {typeof candidate.budgetEffect === "number" && (
          <p className="text-[11px] text-zinc-500">
            Budget impact: {currencyFormatter.format(candidate.budgetEffect)}
          </p>
        )}

        <button
          onClick={() => onToggleHire(candidate.id)}
          disabled={!isHired && atCap}
          className={`mt-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
            isHired
              ? "border border-red-700/60 bg-red-950/30 text-red-300 hover:bg-red-900/40"
              : atCap
                ? "cursor-not-allowed border border-zinc-800 bg-zinc-900 text-zinc-600"
                : "bg-emerald-600 text-white hover:bg-emerald-500"
          }`}
        >
          {isHired ? "Un-hire" : atCap ? "Hired: 6/6" : "Hire"}
        </button>
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => goTo(-1)}
          className="rounded-md border border-zinc-700 px-4 py-2 text-xs text-zinc-300 hover:border-zinc-500"
        >
          ◂ Previous
        </button>
        <button
          onClick={() => goTo(1)}
          className="rounded-md border border-zinc-700 px-4 py-2 text-xs text-zinc-300 hover:border-zinc-500"
        >
          Next ▸
        </button>
      </div>
    </div>
  );
}
