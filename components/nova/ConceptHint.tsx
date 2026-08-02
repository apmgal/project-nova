"use client";

import { useState } from "react";
import { Lightbulb } from "lucide-react";
import { GLOSSARY, type GlossaryEntry } from "@/lib/nova/glossary";

/**
 * Shared open/closed state + glossary lookup for a tool screen's "APM
 * concept reminder". Split from the trigger and the panel (below) so a
 * host component can place the button inline next to its instructions
 * while the panel renders as its own full-width block further down —
 * they need to live in two different spots in the host's JSX, not stacked
 * on top of each other, which a single all-in-one component can't do
 * without resorting to absolute positioning (tried that: it either
 * overlaid the tool screen below it, or got squeezed into whatever narrow
 * column the button itself occupied — neither reads as "part of the
 * page" the way a normal in-flow block does).
 */
export function useConceptHint(concept?: string) {
  const [open, setOpen] = useState(false);
  const entry: GlossaryEntry | undefined = concept ? GLOSSARY[concept] : undefined;
  return {
    entry,
    open,
    toggle: () => setOpen((current) => !current),
    close: () => setOpen(false),
  };
}

interface ConceptHintButtonProps {
  entry: GlossaryEntry | undefined;
  open: boolean;
  onToggle: () => void;
}

/** The lightbulb itself — small, sits inline wherever the host puts it
 * (next to instructions, top-right of the row). Off by default (muted
 * outline); lit amber while its panel is open. Renders nothing if there's
 * no glossary entry for the current concept. */
export function ConceptHintButton({ entry, open, onToggle }: ConceptHintButtonProps) {
  if (!entry) return null;

  return (
    <button
      onClick={onToggle}
      aria-label={`APM concept reminder: ${entry.term}`}
      aria-expanded={open}
      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border transition-colors ${
        open
          ? "border-amber-500 bg-amber-950/40 text-amber-400 ring-2 ring-amber-500/25"
          : "border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
      }`}
    >
      <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}

interface ConceptHintPanelProps {
  entry: GlossaryEntry | undefined;
  open: boolean;
  onClose: () => void;
}

/** The definition itself — a full-width block the host renders between
 * its instructions and its actual activity (buckets/tree/etc.), so it
 * reads as a real content panel sandwiched in the page rather than a
 * tooltip hugging a corner. Just the concept's name and a plain-English
 * definition, no "why it matters here", so it can't give away the
 * puzzle. Blue chrome rather than amber or emerald: emerald already
 * means correct/success and amber/red already mean caution/danger
 * throughout these tool screens, so reusing either here would blur a
 * meaning that matters elsewhere on the same screen. */
export function ConceptHintPanel({ entry, open, onClose }: ConceptHintPanelProps) {
  if (!entry || !open) return null;

  return (
    <div className="w-full rounded-lg border border-blue-800/50 bg-zinc-900 p-4 text-left">
      <div className="flex items-center gap-1.5">
        <Lightbulb className="h-2.5 w-2.5 text-blue-500" aria-hidden="true" />
        <span className="text-[10px] uppercase tracking-wide text-blue-400">
          APM concept reminder
        </span>
      </div>
      <div className="mt-1 text-sm font-semibold text-zinc-100">{entry.term}</div>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{entry.definition}</p>
      <div className="mt-3 flex justify-end">
        <button
          onClick={onClose}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
