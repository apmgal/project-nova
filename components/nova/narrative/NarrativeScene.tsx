"use client";

import { useState } from "react";
import SceneBackground from "./SceneBackground";
import CharacterSprite from "./CharacterSprite";
import DialogueBox from "./DialogueBox";
import SceneAudio from "./SceneAudio";
import type { NarrativeSceneScript } from "@/lib/nova/narrative/types";

interface NarrativeSceneProps {
  script: NarrativeSceneScript;
  /** Called once the player clicks past the final line and the exit fade
   * finishes. The caller decides what plays next — this component only
   * knows how to play its own script front to back. */
  onComplete: () => void;
}

const CHARACTER_ENTER_DELAY_MS = 500;
const EXIT_FADE_MS = 550;

/**
 * Reusable narrative-scene player: full-screen background, positioned
 * character portraits, background music, and a bottom dialogue box that
 * advances through `script.lines` one click at a time. This is the one
 * piece future scenes (stakeholder meetings, boardroom discussions,
 * office conversations, decision moments) are meant to reuse directly —
 * they only need a new NarrativeSceneScript, not new scene logic.
 *
 * Flow: background + music start immediately on mount; characters fade in
 * shortly after; dialogue plays line by line; clicking past the last line
 * fades to black and then calls `onComplete`.
 */
export default function NarrativeScene({ script, onComplete }: NarrativeSceneProps) {
  const [lineIndex, setLineIndex] = useState(0);
  const [exiting, setExiting] = useState(false);

  const line = script.lines[lineIndex] ?? null;
  const speaker =
    line && line.speaker !== "narrator"
      ? script.characters.find((character) => character.id === line.speaker) ?? null
      : null;

  function handleAdvance() {
    if (exiting || !line) return;
    if (lineIndex + 1 < script.lines.length) {
      setLineIndex((i) => i + 1);
      return;
    }
    setExiting(true);
    window.setTimeout(onComplete, EXIT_FADE_MS);
  }

  return (
    <div className="relative flex flex-1 overflow-hidden bg-zinc-950">
      <SceneBackground key={script.background.src} src={script.background.src} alt={script.background.alt} />

      <SceneAudio
        src={exiting ? null : script.music?.src ?? null}
        volume={script.music?.volume}
        fadeInMs={script.music?.fadeInMs}
        fadeOutMs={script.music?.fadeOutMs}
      />

      {script.characters.map((character) => (
        <CharacterSprite
          key={character.id}
          src={character.portraitSrc}
          alt={character.name}
          position={character.position}
          delayMs={CHARACTER_ENTER_DELAY_MS}
        />
      ))}

      {line && (
        <DialogueBox
          speakerName={speaker?.name ?? null}
          text={line.text}
          voiceSrc={line.voiceSrc}
          onAdvance={handleAdvance}
          lineNumber={lineIndex + 1}
          lineCount={script.lines.length}
        />
      )}

      <div
        className="pointer-events-none absolute inset-0 z-30 bg-black transition-opacity"
        style={{ opacity: exiting ? 1 : 0, transitionDuration: `${EXIT_FADE_MS}ms` }}
        aria-hidden
      />
    </div>
  );
}
