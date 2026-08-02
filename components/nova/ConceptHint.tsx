"use client";

import { useState } from "react";
import { Lightbulb } from "lucide-react";
import { GLOSSARY } from "@/lib/nova/glossary";

interface ConceptHintProps {
  /** The current scene's pmConcept, straight from scenes.json — a plain
   * string, not an id, since that's the only thing scenes already carry.
   * Looked up directly against GLOSSARY's keys. */
  concept?: string;
}

/**
 * Contextual "APM concept reminder" — a small lightbulb next to a tool
 * screen's instructions. Off (ghost outline) by default; clicking it
 * lights it up (amber fill + glow ring, the literal "bulb is on" read)
 * and opens a popover with just the concept's name and a plain-English
 * definition — no "why it matters here" — so it explains the underlying
 * PM idea without hinting at the puzzle's actual solution. The popover's
 * own chrome (border, eyebrow, button) stays blue/info-colored rather
 * than amber, since blue is otherwise unclaimed here — emerald already
 * means "correct/success" throughout every tool screen, amber and red
 * already mean caution/danger, so reusing either for "just some info"
 * would blur meanings that matter elsewhere on the same screen.
 *
 * Renders nothing if `concept` has no GLOSSARY entry (including if it's
 * undefined) — safe to drop into any tool screen unconditionally; only
 * the ones with a matching entry actually show a bulb.
 */
export default function ConceptHint({ concept }: ConceptHintProps) {
  const [open, setOpen] = useState(false);
  const entry = concept ? GLOSSARY[concept] : undefined;

  if (!entry) return null;

  return (
    <div className="flex flex-shrink-0 flex-col items-end gap-2">
      <button
        onClick={() => setOpen((current) => !current)}
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

      {open && (
        <div className="w-full max-w-[320px] rounded-lg border border-blue-800/50 bg-zinc-900 p-3 text-left">
          <div className="flex items-center gap-1.5">
            <Lightbulb className="h-2.5 w-2.5 text-blue-500" aria-hidden="true" />
            <span className="text-[10px] uppercase tracking-wide text-blue-400">
              APM concept reminder
            </span>
          </div>
          <div className="mt-1 text-sm font-semibold text-zinc-100">{entry.term}</div>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{entry.definition}</p>
          <div className="mt-2.5 flex justify-end">
            <button
              onClick={() => setOpen(false)}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
