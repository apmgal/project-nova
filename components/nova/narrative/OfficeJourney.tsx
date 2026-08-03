"use client";

import { useEffect, useRef, useState } from "react";
import SceneBackground from "./SceneBackground";
import SceneAudio from "./SceneAudio";
import CharacterPortrait from "./CharacterPortrait";
import SpeechBubble from "./SpeechBubble";
import type {
  NarrativeLine,
  OfficeJourneyScript,
  OfficeJourneyWalkLeg,
} from "@/lib/nova/narrative/types";
import { WALK_PUSH_SCALE_MULTIPLIER, type KenBurnsConfig } from "@/lib/nova/narrative/kenBurns";

interface OfficeJourneyProps {
  script: OfficeJourneyScript;
  /** Called once the journey's final leg finishes and the exit fade
   * completes — same contract as NarrativeScene's onComplete. */
  onComplete: () => void;
}

const DEFAULT_WALK_MS = 3500;
// How long a walk leg keeps showing its OLD background (camera/footsteps
// already resumed) before crossfading to its own — only applied right
// after a conversation leg, so "Priya exits, footsteps resume, camera
// resumes" gets a beat to read before Hallway B appears. A leg following
// another walk leg (no pause in between) doesn't need this — there was
// nothing to visibly "resume" — so it's skipped in that case.
const RESUME_BUFFER_MS = 700;
const CROSSFADE_MS = 1400;
const CHARACTER_ENTER_DELAY_MS = 300;
const CHARACTER_EXIT_MS = 800;
const EXIT_FADE_MS = 700;

const BASE_SCALE = 1.1; // matches SceneBackground's own fixed blur-edge safety margin

function walkKenBurns(leg: OfficeJourneyWalkLeg | undefined, paused: boolean): KenBurnsConfig {
  return {
    scaleFrom: BASE_SCALE,
    scaleTo: leg?.kenBurns?.scaleTo ?? BASE_SCALE * WALK_PUSH_SCALE_MULTIPLIER,
    durationMs: leg?.kenBurns?.durationMs ?? leg?.durationMs ?? DEFAULT_WALK_MS,
    xToPercent: 0.7,
    yToPercent: -0.5,
    paused,
  };
}

/** Single-character equivalent of NarrativeScene's currentExpressionFor —
 * a journey's conversation legs only ever have one character on stage, so
 * there's no need to scan by speaker id, just by "the most recent line
 * with an explicit expression." */
function currentExpression(lines: NarrativeLine[], uptoIndex: number): string {
  for (let i = Math.min(uptoIndex, lines.length - 1); i >= 0; i--) {
    if (lines[i]?.expression) return lines[i].expression!;
  }
  return "neutral";
}

function firstWalkLeg(script: OfficeJourneyScript): OfficeJourneyWalkLeg | undefined {
  return script.legs.find((leg): leg is OfficeJourneyWalkLeg => leg.type === "walk");
}

/**
 * Reusable "walk between two points" system: a sequence of legs, each
 * either a WALK (background + timed camera push + footsteps, no player
 * input) or a CONVERSATION (a single character steps in, camera/footsteps
 * pause, dialogue plays line by line exactly like NarrativeScene). Every
 * leg-to-leg background change crossfades — including the very first leg,
 * if `script.fromBackgroundSrc` is set — rather than fading through
 * black, so a whole journey (and whatever scene it's sandwiched between)
 * reads as one continuous shot. Music and ambience persist across the
 * entire journey; only footsteps toggle per leg. This is the one piece
 * future office-to-office transitions are meant to reuse directly — they
 * only need a new OfficeJourneyScript, not new movement logic.
 */
export default function OfficeJourney({ script, onComplete }: OfficeJourneyProps) {
  const initialBg = script.fromBackgroundSrc ?? firstWalkLeg(script)?.background.src ?? "";

  const [legIndex, setLegIndex] = useState(0);
  const [convLineIndex, setConvLineIndex] = useState(0);
  const [characterVisible, setCharacterVisible] = useState(false);
  const [shownBg, setShownBg] = useState(initialBg);
  const [prevBg, setPrevBg] = useState<string | null>(null);
  const [exiting, setExiting] = useState(false);

  const shownBgRef = useRef(shownBg);
  const timeoutsRef = useRef<number[]>([]);

  const leg = script.legs[legIndex] ?? null;
  const isWalking = leg?.type === "walk";
  // For Ken Burns tuning even while paused mid-conversation: whichever
  // walk leg most recently set the background currently on screen.
  const activeWalkLeg = isWalking
    ? leg
    : [...script.legs.slice(0, legIndex + 1)].reverse().find(
        (l): l is OfficeJourneyWalkLeg => l.type === "walk"
      );

  useEffect(() => {
    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutsRef.current = [];
    if (!leg) return;

    if (leg.type === "walk") {
      // No need to set characterVisible false here: it starts false and
      // handleAdvance already flips it false (before scheduling the leg
      // change that lands here) the moment a conversation leg's last
      // line is dismissed — by the time this effect runs for a walk leg,
      // it's already settled.
      const prevLeg = script.legs[legIndex - 1];
      const resumeBuffer = prevLeg?.type === "conversation" ? RESUME_BUFFER_MS : 0;

      if (leg.background.src !== shownBgRef.current) {
        const crossfadeId = window.setTimeout(() => {
          setPrevBg(shownBgRef.current);
          shownBgRef.current = leg.background.src;
          setShownBg(leg.background.src);
          const clearPrevId = window.setTimeout(() => setPrevBg(null), CROSSFADE_MS);
          timeoutsRef.current.push(clearPrevId);
        }, resumeBuffer);
        timeoutsRef.current.push(crossfadeId);
      }

      const isLast = legIndex === script.legs.length - 1;
      const advanceId = window.setTimeout(
        () => {
          if (isLast) {
            setExiting(true);
            const doneId = window.setTimeout(onComplete, EXIT_FADE_MS);
            timeoutsRef.current.push(doneId);
          } else {
            setLegIndex((i) => i + 1);
          }
        },
        resumeBuffer + (leg.durationMs ?? DEFAULT_WALK_MS)
      );
      timeoutsRef.current.push(advanceId);
    } else {
      // Deferred (rather than called directly in the effect body) so
      // this never fires a setState synchronously during the render
      // that triggered it — same pattern CharacterPortrait's own
      // entrance effect uses, for the same reason.
      const enterId = window.setTimeout(() => {
        setConvLineIndex(0);
        setCharacterVisible(true);
      }, 0);
      timeoutsRef.current.push(enterId);
    }

    return () => {
      timeoutsRef.current.forEach((id) => window.clearTimeout(id));
      timeoutsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legIndex]);

  function handleAdvance() {
    if (exiting || !leg || leg.type !== "conversation") return;
    if (convLineIndex + 1 < leg.lines.length) {
      setConvLineIndex((i) => i + 1);
      return;
    }
    // Last line: character exits, then (after their exit transition) the
    // next leg's walk resumes footsteps/camera.
    setCharacterVisible(false);
    const nextId = window.setTimeout(() => setLegIndex((i) => i + 1), CHARACTER_EXIT_MS);
    timeoutsRef.current.push(nextId);
  }

  const footstepsSrc = isWalking && leg?.type === "walk" ? leg.footstepsSrc ?? null : null;
  const footstepsVolume =
    isWalking && leg?.type === "walk" ? leg.footstepsVolume : undefined;

  return (
    <div className="isolate relative flex flex-1 overflow-hidden bg-zinc-950">
      {prevBg && <SceneBackground key={`prev-${prevBg}`} src={prevBg} kenBurns={false} fadeMs={0} />}
      <SceneBackground
        key={`current-${shownBg}`}
        src={shownBg}
        kenBurns={walkKenBurns(activeWalkLeg, !isWalking || exiting)}
      />

      <SceneAudio
        src={exiting ? null : script.music?.src ?? null}
        volume={script.music?.volume}
        fadeInMs={script.music?.fadeInMs}
        fadeOutMs={script.music?.fadeOutMs}
      />
      <SceneAudio
        src={exiting ? null : script.ambience?.src ?? null}
        volume={script.ambience?.volume ?? 0.12}
        loop
        fadeInMs={2000}
        fadeOutMs={1200}
      />
      <SceneAudio
        src={exiting ? null : footstepsSrc}
        volume={footstepsVolume ?? 0.3}
        loop
        fadeInMs={400}
        fadeOutMs={500}
      />

      {leg?.type === "conversation" && (
        <>
          <CharacterPortrait
            expressions={leg.character.expressions}
            expression={currentExpression(leg.lines, convLineIndex)}
            alt={leg.character.name}
            position={leg.character.position}
            visible={characterVisible}
            delayMs={CHARACTER_ENTER_DELAY_MS}
            transitionMs={CHARACTER_EXIT_MS}
          />
          {characterVisible && leg.lines[convLineIndex] && (
            <SpeechBubble
              key={convLineIndex}
              speakerName={leg.character.name}
              text={leg.lines[convLineIndex].text}
              voiceSrc={leg.lines[convLineIndex].voiceSrc}
              onAdvance={handleAdvance}
              lineNumber={convLineIndex + 1}
              lineCount={leg.lines.length}
              anchor={leg.character.position}
            />
          )}
        </>
      )}

      <div
        className="pointer-events-none absolute inset-0 z-30 bg-black transition-opacity"
        style={{ opacity: exiting ? 1 : 0, transitionDuration: `${EXIT_FADE_MS}ms` }}
        aria-hidden
      />
    </div>
  );
}
