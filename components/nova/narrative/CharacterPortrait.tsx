"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { CharacterExpressionArt, ScenePosition } from "@/lib/nova/narrative/types";

interface CharacterPortraitProps {
  expressions: Record<string, CharacterExpressionArt>;
  /** Requested expression key. Unknown/missing keys fall back to
   * "neutral", then to whatever expression happens to be first in the
   * map — a character always renders something rather than nothing. */
  expression: string;
  alt: string;
  position: ScenePosition;
  /** Presence on stage. True (default) slides+fades the character in;
   * flipping to false slides+fades them out. NOTE for callers: the exit
   * animation plays while this is false but the component is still
   * mounted — unmount it (or drop it from a list) only after
   * `transitionMs` has elapsed, the same way you'd handle any CSS exit
   * transition in React. Reception Intro never toggles this today (its
   * characters just join and stay), but the primitive is here so a
   * future scene can. */
  visible?: boolean;
  /** Entrance/exit slide+fade duration, ms. Spec default: 0.8s in. */
  transitionMs?: number;
  /** Delay before the entrance transition starts. */
  delayMs?: number;
}

const POSITION_CLASSES: Record<ScenePosition, string> = {
  left: "left-[2%] sm:left-[6%]",
  center: "left-1/2 -translate-x-1/2",
  right: "right-[2%] sm:right-[6%]",
};

// How far a character slides during their entrance/exit, and which way —
// in from their own offstage side, out back the same way.
const SLIDE_PX: Record<ScenePosition, number> = {
  left: -36,
  right: 36,
  center: 24,
};

const EXPRESSION_CROSSFADE_MS = 350;
const BLINK_MIN_INTERVAL_MS = 3000;
const BLINK_MAX_INTERVAL_MS = 6000;
const BLINK_MIN_DURATION_MS = 100;
const BLINK_MAX_DURATION_MS = 200;

function resolveExpression(
  expressions: Record<string, CharacterExpressionArt>,
  key: string
): CharacterExpressionArt | null {
  return (
    expressions[key] ??
    expressions["neutral"] ??
    Object.values(expressions)[0] ??
    null
  );
}

/**
 * Reusable character portrait controller: entrance/exit slide+fade,
 * subtle idle breathing, automatic blinking (using each expression's own
 * blink art, only where one exists, never while anything is fading), and
 * smooth crossfades between expressions. Every future character is just
 * a new `expressions` map handed to this same component — nothing here
 * is Mike- or Ben-specific.
 */
export default function CharacterPortrait({
  expressions,
  expression,
  alt,
  position,
  visible = true,
  transitionMs = 800,
  delayMs = 0,
}: CharacterPortraitProps) {
  const resolvedKey =
    expression in expressions
      ? expression
      : "neutral" in expressions
        ? "neutral"
        : Object.keys(expressions)[0];

  const [entered, setEntered] = useState(false);

  // Expression crossfade: `settled` is what's fully shown; `incoming`
  // (while non-null) is fading in on top of it. Both are expression
  // KEYS, not art directly, so we can always re-look-up the latest
  // `expressions` map (e.g. if it were ever swapped) rather than
  // freezing stale art objects in state.
  const [settledKey, setSettledKey] = useState(resolvedKey);
  const [incomingKey, setIncomingKey] = useState<string | null>(null);
  const [incomingVisible, setIncomingVisible] = useState(false);
  const crossfadeTimeouts = useRef<number[]>([]);

  const [blinking, setBlinking] = useState(false);
  const blinkTimeoutRef = useRef<number | null>(null);

  // Entrance fade/slide.
  useEffect(() => {
    const id = window.setTimeout(() => setEntered(true), delayMs + 20);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expression changes: crossfade from whatever's settled to the newly
  // resolved key, skipping if it's already what's showing (or already
  // what we're mid-crossfade into).
  useEffect(() => {
    if (resolvedKey === settledKey || resolvedKey === incomingKey) return;
    crossfadeTimeouts.current.forEach((t) => window.clearTimeout(t));

    // Deferred (rather than called directly in the effect body) so this
    // never fires a setState synchronously during the render that
    // triggered it — same reasoning as SceneBackground's entrance fade.
    const kickoffId = window.setTimeout(() => {
      setIncomingKey(resolvedKey);
      setIncomingVisible(false);
      const startId = window.setTimeout(() => setIncomingVisible(true), 20);
      const settleId = window.setTimeout(() => {
        setSettledKey(resolvedKey);
        setIncomingKey(null);
        setIncomingVisible(false);
      }, EXPRESSION_CROSSFADE_MS + 20);
      crossfadeTimeouts.current = [startId, settleId];
    }, 0);
    crossfadeTimeouts.current = [kickoffId];

    return () => {
      crossfadeTimeouts.current.forEach((t) => window.clearTimeout(t));
      crossfadeTimeouts.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedKey]);

  const isTransitioning = !entered || !visible || incomingKey !== null;

  // Blinking — reschedules itself indefinitely; each tick just checks
  // "is it safe to blink right now" (nothing fading, and this expression
  // actually has blink art) rather than pausing/resuming a timer, so
  // there's nothing to get out of sync when expressions change mid-cycle.
  useEffect(() => {
    function scheduleNext() {
      const delay =
        BLINK_MIN_INTERVAL_MS + Math.random() * (BLINK_MAX_INTERVAL_MS - BLINK_MIN_INTERVAL_MS);
      blinkTimeoutRef.current = window.setTimeout(() => {
        const art = resolveExpression(expressions, settledKey);
        if (!isTransitioning && art?.blinkSrc) {
          const duration =
            BLINK_MIN_DURATION_MS + Math.random() * (BLINK_MAX_DURATION_MS - BLINK_MIN_DURATION_MS);
          setBlinking(true);
          window.setTimeout(() => setBlinking(false), duration);
        }
        scheduleNext();
      }, delay);
    }
    scheduleNext();
    return () => {
      if (blinkTimeoutRef.current !== null) window.clearTimeout(blinkTimeoutRef.current);
    };
  }, [expressions, settledKey, isTransitioning]);

  const settledArt = resolveExpression(expressions, settledKey);
  const incomingArt = incomingKey ? resolveExpression(expressions, incomingKey) : null;
  const slide = SLIDE_PX[position];

  if (!settledArt) return null;

  return (
    <div
      className={`pointer-events-none absolute bottom-0 z-10 flex h-[78%] w-[38%] max-w-[420px] items-end justify-center sm:h-[85%] ${POSITION_CLASSES[position]}`}
      style={{
        opacity: entered && visible ? 1 : 0,
        transform: entered && visible ? "translateY(0) translateX(0)" : `translateY(24px) translateX(${slide}px)`,
        transitionProperty: "opacity, transform",
        transitionDuration: `${transitionMs}ms`,
        transitionDelay: `${delayMs}ms`,
        transitionTimingFunction: "ease-out",
      }}
    >
      <div className="animate-nova-breathe relative h-full w-full">
        {/* Settled expression. Stays fully opaque the whole time — when
            a new expression crossfades in, the incoming layer fades in
            ON TOP of this one (see below); once it reaches full opacity
            this layer is completely covered, so swapping `settledKey`
            over to match and dropping the incoming layer produces no
            visible pop, just identical pixels changing hands. */}
        <Image
          src={settledArt.src}
          alt={alt}
          fill
          sizes="420px"
          className="object-contain object-bottom drop-shadow-[0_16px_18px_rgba(0,0,0,0.45)]"
          priority
        />

        {/* Incoming expression, crossfading on top when the requested
            expression changes. */}
        {incomingArt && (
          <Image
            src={incomingArt.src}
            alt={alt}
            fill
            sizes="420px"
            className="object-contain object-bottom drop-shadow-[0_16px_18px_rgba(0,0,0,0.45)]"
            style={{
              opacity: incomingVisible ? 1 : 0,
              transitionProperty: "opacity",
              transitionDuration: `${EXPRESSION_CROSSFADE_MS}ms`,
              transitionTimingFunction: "ease-in-out",
            }}
          />
        )}

        {/* Blink overlay — this expression's own blink art (if any),
            flashed briefly on top. Absent blinkSrc just means this node
            never renders (see resolveExpression / the `art?.blinkSrc`
            check above), not a missing-asset gap. */}
        {settledArt.blinkSrc && !incomingKey && (
          <Image
            src={settledArt.blinkSrc}
            alt=""
            fill
            sizes="420px"
            aria-hidden
            className="object-contain object-bottom drop-shadow-[0_16px_18px_rgba(0,0,0,0.45)]"
            style={{
              opacity: blinking ? 1 : 0,
              transitionProperty: "opacity",
              transitionDuration: "40ms",
              transitionTimingFunction: "ease-in-out",
            }}
          />
        )}
      </div>

      {/* Preload every expression (and blink) image for this character up
          front, keyed by src, rather than only ever fetching one on first
          use. Without this, the FIRST time a line asks for an expression
          Mike/Ben hasn't shown yet, the browser starts that download only
          when the crossfade kicks off — but the crossfade promotes the
          incoming image to "settled" on a fixed timer (EXPRESSION_
          CROSSFADE_MS), not on the image's actual load event, so if the
          fetch is still in flight when that timer fires the settled layer
          swaps to a src that hasn't finished loading and renders blank
          until it does. That's the "Mike occasionally glitches" flash —
          a cache miss, not a rendering bug in the crossfade itself. Same
          `sizes="420px"` as the real portraits so Next.js requests (and
          caches) the exact same asset URL, just off-screen and harmless
          to re-request if it's already the one currently shown. */}
      <div aria-hidden className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0">
        {Object.values(expressions).flatMap((art) => [
          <Image key={`preload-${art.src}`} src={art.src} alt="" fill sizes="420px" priority />,
          ...(art.blinkSrc
            ? [<Image key={`preload-${art.blinkSrc}`} src={art.blinkSrc} alt="" fill sizes="420px" priority />]
            : []),
        ])}
      </div>
    </div>
  );
}
