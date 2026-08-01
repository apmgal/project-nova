"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface SceneBackgroundProps {
  src: string;
  alt?: string;
  fadeMs?: number;
  /** Soft-focus amount in px. Defaults to a gentle blur that keeps the
   * backdrop legible as a place while pushing focus onto the character
   * in front of it — a scene that needs a sharp background (e.g. a
   * document review screen) can pass 0. */
  blurPx?: number;
  /** How dark the bottom-anchored gradient reads, 0-1. Defaults low so
   * the background stays bright; raised only where a specific scene
   * needs more contrast for the dialogue box. */
  dim?: number;
}

/**
 * Full-screen scene backdrop with a smooth fade-in on load. Knows nothing
 * about which scene it's in — swap `src` for a different location and
 * mount a fresh instance (render it with `key={src}`) to replay the fade,
 * so future scenes/backgrounds are a pure data change.
 */
export default function SceneBackground({
  src,
  alt = "",
  fadeMs = 1000,
  blurPx = 7,
  dim = 0.35,
}: SceneBackgroundProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Two rAFs: the first lets the browser commit the initial opacity-0
    // render, the second flips it to opacity-100 on the next paint so the
    // transition actually has a starting frame to animate from (a single
    // rAF can land in the same paint as the initial render and skip
    // straight to the end state).
    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id2);
    });
    return () => cancelAnimationFrame(id1);
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-zinc-950">
      <Image
        src={src}
        alt={alt}
        fill
        priority
        sizes="100vw"
        // Scaled up slightly so the blur's soft edge samples stay inside
        // the frame instead of pulling in the (clipped) transparent
        // border, which would otherwise show up as a faint rim.
        className="scale-110 object-cover ease-out"
        style={{
          opacity: visible ? 1 : 0,
          filter: blurPx > 0 ? `blur(${blurPx}px) brightness(1.12)` : undefined,
          transitionProperty: "opacity",
          transitionDuration: `${fadeMs}ms`,
        }}
      />
      {/* Just enough of a bottom-weighted gradient to keep the dialogue
          box legible over whatever's behind it, without muddying the
          rest of the backdrop — the blur above is doing most of the
          work of keeping focus on the character in front of it. */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"
        style={{ opacity: dim }}
      />
    </div>
  );
}
