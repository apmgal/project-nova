"use client";

import { useMemo, useState } from "react";
import type { GameState, DialogueLine } from "@/lib/nova/types";
import { getCharacter, getDialogue } from "@/lib/nova/data";
import { effectiveDialogueFlags, isLineVisible } from "@/lib/nova/state";
import { endingConditionFlags } from "@/lib/nova/endings";
import { recoveryConditionFlags } from "@/lib/nova/act5Recovery";
import ProjectReflectionEnding from "@/components/nova/ProjectReflectionEnding";

/**
 * After the formal determination (FinalDetermination) — the integration point for the epilogue (PROTOTYPE).
 * The ending cinematic itself isn't built yet, so this plays the EXISTING Act 6 ending content
 * (DIALOGUE_ACT6_SCENE01–03) for the outcome evaluateEnding resolves from the post-inspection state,
 * filtered with the same condition flags GameRoot uses (dialogueFlagsFor). The outcome is revealed here,
 * never during the inspection. Then the existing Decision Analysis (ProjectReflectionEnding).
 *
 * In the game this whole component is replaced by `goToScene(final, "ACT5_SCENE04")` (The Waiting →
 * ACT6), which already ends in ProjectReflectionEnding.
 */
const SCENES = ["DIALOGUE_ACT6_SCENE01", "DIALOGUE_ACT6_SCENE02", "DIALOGUE_ACT6_SCENE03"];

function endingLines(state: GameState): DialogueLine[] {
  const flags = { ...effectiveDialogueFlags(state), ...endingConditionFlags(state), ...recoveryConditionFlags(state) };
  const out: DialogueLine[] = [];
  for (const id of SCENES) {
    const lines = getDialogue(id)?.lines ?? [];
    for (const line of lines) {
      // ACT6_SCENE03's closing memories/benefits recap needs GameRoot's template values — the outcome
      // itself is everything before it.
      if (id === "DIALOGUE_ACT6_SCENE03" && line.text.startsWith("Here's what the building remembers")) break;
      if (!isLineVisible(line.condition, flags)) continue;
      if (line.text.startsWith("[") || line.text.includes("{")) continue;
      // The finale already had its one time card and the determination has been read — drop the duplicate
      // card and the "about to find out" set-up.
      if (line.text === "THREE WEEKS LATER." || line.text.startsWith("You're about to find out")) continue;
      // …and the "building looks finished" line — the finale has already shown the time that's passed.
      if (line.text.startsWith("The building looks finished now")) continue;
      out.push(line);
    }
  }
  return out;
}

export default function EndingHandoff({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  const lines = useMemo(() => endingLines(state), [state]);
  const [index, setIndex] = useState(0);
  const [analysis, setAnalysis] = useState(false);

  if (analysis) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-zinc-950">
        <ProjectReflectionEnding gameState={state} onRestart={onRestart} />
      </div>
    );
  }
  const line = lines[index];
  const speaker = line && line.speaker !== "narrator" ? getCharacter(line.speaker)?.name ?? line.speaker : null;
  return (
    <div
      className="fixed inset-0 z-[60] grid cursor-pointer place-items-center bg-black px-6 text-center"
      onClick={() => (index < lines.length - 1 ? setIndex(index + 1) : setAnalysis(true))}
    >
      <p className="absolute left-4 top-4 max-w-sm text-left text-[11px] leading-snug text-white/30">
        Prototype: epilogue not built yet — the existing Act 6 ending lines for this outcome.
      </p>
      {line && (
        <div key={index} className="max-w-2xl animate-[endFade_700ms_ease-out]">
          {speaker && <p className="mb-3 text-xs uppercase tracking-[0.25em] text-white/45">{speaker}</p>}
          <p className={`leading-relaxed text-white/90 ${speaker ? "text-lg" : "text-xl font-light"}`}>{line.text}</p>
        </div>
      )}
      <p className="absolute bottom-6 text-xs text-white/35">Click to continue</p>
      <style>{`@keyframes endFade { from { opacity: 0 } to { opacity: 1 } }`}</style>
    </div>
  );
}
