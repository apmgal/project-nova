"use client";

import type { ChoiceOption } from "@/lib/nova/types";

interface ChoiceButtonsProps {
  options: ChoiceOption[];
  onSelect: (option: ChoiceOption) => void;
  reactionText: string | null;
  disabledIndexes?: number[];
}

export default function ChoiceButtons({
  options,
  onSelect,
  reactionText,
}: ChoiceButtonsProps) {
  return (
    <div className="flex flex-col gap-3">
      {reactionText && (
        <div
          data-testid="choice-reaction"
          className="rounded-md border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm italic text-amber-200"
        >
          {reactionText}
        </div>
      )}
      <div className="flex flex-col gap-2">
        {options.map((option, i) => (
          <button
            key={`${option.text}-${i}`}
            onClick={() => onSelect(option)}
            className="rounded-md border border-zinc-700 bg-zinc-800/80 px-4 py-3 text-left text-sm text-zinc-100 transition-colors hover:border-emerald-500 hover:bg-zinc-700 active:bg-zinc-600"
          >
            {option.text}
          </button>
        ))}
      </div>
    </div>
  );
}
