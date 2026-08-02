"use client";

import { useEffect, useRef, useState } from "react";
import type { ScenePosition } from "@/lib/nova/narrative/types";

interface SpeechBubbleProps {
  /** Display name, or null for unattributed narrator text. */
  speakerName: string | null;
  text: string;
  /** Optional voice-over clip for this line — plays once, best-effort,
   * whenever `text` changes. A missing clip (or an autoplay block) is a
   * silent no-op — the text still types out and the scene still advances
   * normally either way. Also doubles as this line's auto-advance pacing:
   * once the clip finishes playing, the bubble moves on by itself. */
  voiceSrc?: string;
  /** Called to move to the next line — by a manual click (any time after
   * the typewriter finishes) or automatically once the reveal completes,
   * so the scene keeps flowing without requiring a click every line. The
   * very last line (lineNumber === lineCount) never auto-advances — its
   * "Begin" click is the deliberate handoff out of the scene. */
  onAdvance: () => void;
  lineNumber: number;
  lineCount: number;
  /** Which side of the stage the speaking character stands on. The
   * bubble docks near that side and its tail points down toward them —
   * a future character on the left, right, or center gets the mirrored/
   * centered layout for free, no per-character bubble code needed. */
  anchor: ScenePosition;
  /** ms per revealed character for the typewriter effect. */
  typeSpeedMs?: number;
}

const DOCK_CLASSES: Record<ScenePosition, string> = {
  right: "right-[4%] sm:right-[10%] items-end",
  left: "left-[4%] sm:left-[10%] items-start",
  center: "left-1/2 -translate-x-1/2 items-center",
};

const TAIL_OFFSET_CLASSES: Record<ScenePosition, string> = {
  right: "right-10 sm:right-14",
  left: "left-10 sm:left-14",
  center: "left-1/2 -translate-x-1/2",
};

// However long a line is, its typewriter reveal never takes longer than
// this — keeps the longest dialogue lines from crawling.
const MAX_TYPE_MS = 2600;

// Auto-advance fallback pacing for lines with NO voiceSrc — read at a
// generous pace rather than the typewriter's own per-character speed,
// since the text is already fully visible by this point and the player
// just needs a moment to finish reading it. Clamped so a one-word line
// doesn't linger and a very long one doesn't stall for an unreasonable
// amount of time.
const AUTO_ADVANCE_MS_PER_CHAR = 55;
const AUTO_ADVANCE_MIN_MS = 1400;
const AUTO_ADVANCE_MAX_MS = 9000;

function autoAdvanceFallbackDelay(text: string): number {
  return Math.min(AUTO_ADVANCE_MAX_MS, Math.max(AUTO_ADVANCE_MIN_MS, text.length * AUTO_ADVANCE_MS_PER_CHAR));
}

// Safety-net timing for lines that DO have a voiceSrc — only used if the
// clip's own `ended` event never fires (autoplay blocked, load error,
// missing file). Sized off the clip's real duration once its metadata
// loads, plus a small buffer — never a flat cap. A flat cap shorter than
// some line's actual voiceover length is exactly what cut one line's
// audio off under the next when this first shipped (a ~16.5s clip
// racing a 9s fallback). Only falls back to a flat, generous ceiling if
// duration truly never becomes available.
const VOICE_FALLBACK_BUFFER_MS = 600;
const VOICE_FALLBACK_UNKNOWN_DURATION_MS = 20000;

/**
 * Speech bubble anchored near whichever character is currently speaking,
 * with rounded corners, a tail pointing toward them, a typewriter reveal,
 * and a Continue interaction — the presentation layer NarrativeScene uses
 * in place of a fixed bottom dialogue box. Knows nothing about story
 * content or which scene it's in beyond the current line and which side
 * of the stage to dock against, so a future character (any position) is
 * just a different `anchor`, not new bubble code.
 */
export default function SpeechBubble({
  speakerName,
  text,
  voiceSrc,
  onAdvance,
  lineNumber,
  lineCount,
  anchor,
  typeSpeedMs = 22,
}: SpeechBubbleProps) {
  const [revealedCount, setRevealedCount] = useState(0);
  const [entered, setEntered] = useState(false);
  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const typeIntervalRef = useRef<number | null>(null);

  const isTyping = revealedCount < text.length;

  // Entrance: the bubble pops in just after mount, rather than snapping,
  // so a new line reads as "appearing" beside the character instead of
  // the box just showing up instantly. NarrativeScene keys this
  // component by line index, so a fresh instance (and fresh initial
  // state) is exactly what happens on every new line — no manual reset
  // needed here.
  useEffect(() => {
    const id = window.setTimeout(() => setEntered(true), 20);
    return () => window.clearTimeout(id);
  }, []);

  // Typewriter reveal, speed-adapted so very long lines still finish
  // within MAX_TYPE_MS rather than crawling. Same per-line-remount logic
  // means revealedCount already starts at 0 for a new line.
  useEffect(() => {
    if (text.length === 0) return;
    const perCharMs = Math.min(typeSpeedMs, MAX_TYPE_MS / text.length);
    typeIntervalRef.current = window.setInterval(() => {
      setRevealedCount((count) => {
        const next = count + 1;
        if (next >= text.length && typeIntervalRef.current !== null) {
          window.clearInterval(typeIntervalRef.current);
        }
        return next;
      });
    }, perCharMs);
    return () => {
      if (typeIntervalRef.current !== null) window.clearInterval(typeIntervalRef.current);
    };
  }, [text, typeSpeedMs]);

  // Voiceover placeholder — same "no-op if absent" contract as before,
  // just living here now instead of the old bottom dialogue box.
  useEffect(() => {
    voiceRef.current?.pause();
    if (!voiceSrc) {
      voiceRef.current = null;
      return;
    }
    const audio = new Audio(voiceSrc);
    voiceRef.current = audio;
    audio.play().catch(() => {});
    return () => {
      audio.pause();
    };
  }, [voiceSrc, text]);

  // Auto-advance: once the typewriter finishes revealing this line, move
  // on by itself rather than waiting for a click — the player only has
  // to click on the very last line ("Begin"), everything before that
  // just flows. Primarily driven by the voice clip finishing (feels
  // natural — the line moves on exactly when Mike/Ben stops talking);
  // falls back to a generous reading-pace timer for lines with no voice,
  // or if the clip fails/is blocked and never fires `ended`. A manual
  // click still works as a fast-forward at any point.
  useEffect(() => {
    if (isTyping) return;
    if (lineNumber >= lineCount) return; // last line: only "Begin" advances

    let advanced = false;
    function advanceOnce() {
      if (advanced) return;
      advanced = true;
      onAdvance();
    }

    const voice = voiceRef.current;
    let fallbackId: number | null = null;

    if (voice) {
      const v = voice; // narrowed alias — TS doesn't retain the `if (voice)`
      // narrowing inside a nested function declaration below.
      v.addEventListener("ended", advanceOnce);

      function armFallback() {
        const durationMs =
          Number.isFinite(v.duration) && v.duration > 0 ? v.duration * 1000 : VOICE_FALLBACK_UNKNOWN_DURATION_MS;
        fallbackId = window.setTimeout(advanceOnce, durationMs + VOICE_FALLBACK_BUFFER_MS);
      }
      // readyState >= 1 (HAVE_METADATA) means `duration` is already
      // known; otherwise wait for it rather than guessing low.
      if (v.readyState >= 1) {
        armFallback();
      } else {
        v.addEventListener("loadedmetadata", armFallback, { once: true });
      }

      return () => {
        advanced = true;
        v.removeEventListener("ended", advanceOnce);
        v.removeEventListener("loadedmetadata", armFallback);
        if (fallbackId !== null) window.clearTimeout(fallbackId);
      };
    }

    // No voiceSrc at all — plain reading-pace timer.
    fallbackId = window.setTimeout(advanceOnce, autoAdvanceFallbackDelay(text));
    return () => {
      advanced = true;
      if (fallbackId !== null) window.clearTimeout(fallbackId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTyping, lineNumber, lineCount]);

  function handleClick() {
    if (isTyping) {
      // First click on a still-typing line just finishes revealing it —
      // standard VN convention, so an eager click never skips a whole
      // line of dialogue unread.
      setRevealedCount(text.length);
      return;
    }
    onAdvance();
  }

  return (
    <div
      // Docked near the top of the stage, above the character. Made wider
      // (see the button's max-w below) rather than left tall, so a given
      // line wraps across fewer lines and the box stays short enough to
      // clear the character's head instead of growing down into it.
      className={`pointer-events-none absolute top-[2%] z-20 flex w-full flex-col px-4 sm:px-0 ${DOCK_CLASSES[anchor]}`}
    >
      <button
        onClick={handleClick}
        className="pointer-events-auto relative w-full max-w-[480px] rounded-2xl border border-zinc-700/80 bg-zinc-900/95 p-4 text-left shadow-[0_12px_28px_rgba(0,0,0,0.5)] backdrop-blur-sm sm:max-w-[680px] sm:p-5"
        style={{
          opacity: entered ? 1 : 0,
          transform: entered ? "translateY(0) scale(1)" : "translateY(10px) scale(0.97)",
          transitionProperty: "opacity, transform",
          transitionDuration: "350ms",
          transitionTimingFunction: "ease-out",
        }}
      >
        {speakerName ? (
          <div className="mb-1.5 flex items-center gap-2">
            <span className="h-3.5 w-1 rounded-full bg-sky-500" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wide text-sky-300">
              {speakerName}
            </span>
          </div>
        ) : (
          <span className="mb-1.5 block text-[11px] italic uppercase tracking-wide text-zinc-500">
            Narrator
          </span>
        )}

        <p className="min-h-[2.5em] text-sm leading-relaxed text-zinc-100 sm:text-[15px]">
          {text.slice(0, revealedCount)}
          {isTyping && <span className="ml-0.5 animate-pulse text-sky-400">▌</span>}
        </p>

        <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
          <span>
            {lineNumber} / {lineCount}
          </span>
          <span className="flex items-center gap-1 font-medium text-zinc-400">
            {isTyping ? "Skip" : lineNumber < lineCount ? "Continue" : "Begin"}
            <span aria-hidden>▸</span>
          </span>
        </div>

        {/* Tail, pointing down toward the speaking character. */}
        <span
          className={`absolute -bottom-[9px] h-0 w-0 border-x-[9px] border-t-[9px] border-x-transparent border-t-zinc-900/95 ${TAIL_OFFSET_CLASSES[anchor]}`}
          aria-hidden
        />
      </button>
    </div>
  );
}
