"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { ScenePosition } from "@/lib/nova/narrative/types";

interface CharacterSpriteProps {
  src: string;
  alt: string;
  position: ScenePosition;
  /** Fade-in duration in ms. Spec default is 0.8s. */
  fadeMs?: number;
  /** Delay before the fade-in starts, so a character can enter after the
   * background has already settled. */
  delayMs?: number;
}

const POSITION_CLASSES: Record<ScenePosition, string> = {
  left: "left-[2%] sm:left-[6%]",
  center: "left-1/2 -translate-x-1/2",
  right: "right-[2%] sm:right-[6%]",
};

/**
 * Positioned character portrait with an entrance fade and a subtle idle
 * loop (gentle breathing sway + occasional blink) so a static portrait
 * doesn't read as a frozen image. Reusable for any future character —
 * position, art, and even the idle timing are all just props/derived from
 * them, nothing here is Mike-Smith- or reception-scene-specific.
 *
 * Blinking has no real closed-eye art to swap in (every portrait so far is
 * a single static image), so it's approximated with a brief, subtle
 * brightness dip across the whole portrait rather than a literal eyelid —
 * enough to read as a lifelike flicker without looking like a glitch. Once
 * a character has an eyes-closed variant, this is the one spot that would
 * swap to it.
 */
export default function CharacterSprite({
  src,
  alt,
  position,
  fadeMs = 800,
  delayMs = 0,
}: CharacterSpriteProps) {
  const [entered, setEntered] = useState(false);
  const [blinking, setBlinking] = useState(false);
  const blinkTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const enterTimer = window.setTimeout(() => setEntered(true), delayMs + 20);
    return () => window.clearTimeout(enterTimer);
  }, [delayMs]);

  useEffect(() => {
    function scheduleNextBlink() {
      const nextIn = 2600 + Math.random() * 3200; // 2.6s - 5.8s, irregular
      blinkTimeoutRef.current = window.setTimeout(() => {
        setBlinking(true);
        window.setTimeout(() => setBlinking(false), 120);
        scheduleNextBlink();
      }, nextIn);
    }
    scheduleNextBlink();
    return () => {
      if (blinkTimeoutRef.current !== null) window.clearTimeout(blinkTimeoutRef.current);
    };
  }, []);

  return (
    <div
      className={`pointer-events-none absolute bottom-0 z-10 flex h-[78%] w-[38%] max-w-[420px] items-end justify-center sm:h-[85%] ${POSITION_CLASSES[position]}`}
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? "translateY(0)" : "translateY(24px)",
        transitionProperty: "opacity, transform",
        transitionDuration: `${fadeMs}ms`,
        transitionDelay: `${delayMs}ms`,
        transitionTimingFunction: "ease-out",
      }}
    >
      <div className="animate-nova-breathe relative h-full w-full">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="420px"
          className="object-contain object-bottom drop-shadow-[0_16px_18px_rgba(0,0,0,0.45)]"
          style={{
            filter: blinking ? "brightness(0.93)" : "brightness(1)",
            transition: "filter 90ms ease-in-out",
          }}
          priority
        />
      </div>
    </div>
  );
}
