"use client";

import { useState } from "react";
import SceneBackground from "./SceneBackground";
import CharacterPortrait from "./CharacterPortrait";
import SpeechBubble from "./SpeechBubble";
import SceneAudio from "./SceneAudio";
import SceneVisualInset from "./SceneVisualInset";
import type { NarrativeCharacter, NarrativeSceneScript } from "@/lib/nova/narrative/types";

/** The expression a character is showing at a given point in the script:
 * whatever the most recent line THEY spoke set explicitly, scanning back
 * from `uptoIndex`; "neutral" if none of their lines so far set one. */
function currentExpressionFor(
  character: NarrativeCharacter,
  lines: NarrativeSceneScript["lines"],
  uptoIndex: number
): string {
  for (let i = Math.min(uptoIndex, lines.length - 1); i >= 0; i--) {
    const l = lines[i];
    if (l.speaker === character.id && l.expression) return l.expression;
  }
  return "neutral";
}

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
 * character portraits, background music, and a speech bubble (docked
 * beside whichever character is speaking) that advances through
 * `script.lines` one click at a time. This is the one piece future
 * scenes (stakeholder meetings, boardroom discussions, office
 * conversations, decision moments) are meant to reuse directly — they
 * only need a new NarrativeSceneScript, not new scene logic.
 *
 * Flow: background + music start immediately on mount; each character
 * fades in the moment their first line is reached (so a second character
 * can join partway through the scene rather than everyone appearing at
 * once); dialogue plays line by line, each line's bubble docking near its
 * speaker and any line's `visual` (a screenshot, a document) floating
 * center-stage for just that line; clicking past the last line fades to
 * black and then calls `onComplete`.
 */
export default function NarrativeScene({ script, onComplete }: NarrativeSceneProps) {
  const [lineIndex, setLineIndex] = useState(0);
  const [exiting, setExiting] = useState(false);

  const line = script.lines[lineIndex] ?? null;
  const speaker =
    line && line.speaker !== "narrator"
      ? script.characters.find((character) => character.id === line.speaker) ?? null
      : null;

  // A character joins the stage the moment their first line is reached,
  // rather than everyone appearing at scene-start — lets a scene bring
  // a second character in partway through (e.g. someone stepping in to
  // introduce themselves) just by where their first line falls in
  // `script.lines`, no separate "entrance cue" data needed.
  const speakersSoFar = new Set(
    script.lines.slice(0, lineIndex + 1).map((l) => l.speaker)
  );
  const onStageCharacters = script.characters.filter((character) =>
    speakersSoFar.has(character.id)
  );

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
    <div className="isolate relative flex flex-1 overflow-hidden bg-zinc-950">
      <SceneBackground
        key={script.background.src}
        src={script.background.src}
        alt={script.background.alt}
        overlay={script.background.overlay}
      />

      <SceneAudio
        src={exiting ? null : script.music?.src ?? null}
        volume={script.music?.volume}
        fadeInMs={script.music?.fadeInMs}
        fadeOutMs={script.music?.fadeOutMs}
      />

      {onStageCharacters.map((character) => (
        <CharacterPortrait
          key={character.id}
          expressions={character.expressions}
          expression={currentExpressionFor(character, script.lines, lineIndex)}
          alt={character.name}
          position={character.position}
          delayMs={CHARACTER_ENTER_DELAY_MS}
        />
      ))}

      {line?.visual && <SceneVisualInset key={line.visual.src} visual={line.visual} />}

      {line && (
        <SpeechBubble
          key={lineIndex}
          speakerName={speaker?.name ?? null}
          text={line.text}
          voiceSrc={line.voiceSrc}
          onAdvance={handleAdvance}
          lineNumber={lineIndex + 1}
          lineCount={script.lines.length}
          anchor={speaker?.position ?? "center"}
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
