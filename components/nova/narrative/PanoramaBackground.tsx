"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface PanoramaBackgroundProps {
  src: string;
  /** Horizontal object-position, 0-100 — which slice of the wide image is
   * framed right now. Changing this on an already-mounted instance is the
   * whole trick: object-position is a transitionable CSS property, so the
   * crop glides sideways across the (much wider) source image instead of
   * cutting, without the image itself ever moving or reloading. Callers
   * get this "for free" just by rendering the same component instance
   * (same `key`) with a new value — see GameRoot's PANORAMA_GROUPS check. */
  focusPercent: number;
  alt?: string;
  panMs?: number;
  blurPx?: number;
  dim?: number;
}

/**
 * Background for a wide panoramic photo that two or more "locations" (e.g.
 * reception and the hallway leading off it) both live inside — used
 * instead of SceneBackground when a scene transitions between backdrops
 * that happen to be crops of the same underlying image. Where
 * SceneBackground remounts (fresh fade-in + Ken Burns) every time its
 * `src` changes, this component is meant to stay mounted across a
 * transition and just receive a new `focusPercent`, so the change reads
 * as the camera sliding sideways through one continuous space rather than
 * a cut between two separate shots.
 */
export default function PanoramaBackground({
  src,
  focusPercent,
  alt = "",
  panMs = 2400,
  blurPx = 4,
  dim = 0.35,
}: PanoramaBackgroundProps) {
  const [visible, setVisible] = useState(false);
  const backdropFilter = blurPx > 0 ? `blur(${blurPx}px) brightness(1.12)` : undefined;

  useEffect(() => {
    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id2);
    });
    return () => cancelAnimationFrame(id1);
    // Mount-only ([] deps, nothing external referenced) — same reasoning
    // as SceneBackground's own fade-in effect. This never re-runs when
    // focusPercent changes, which is exactly what keeps the pan from
    // re-triggering a fade every time it slides.
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-zinc-950">
      <Image
        src={src}
        alt={alt}
        fill
        priority
        sizes="100vw"
        className="object-cover ease-in-out"
        style={{
          objectPosition: `${focusPercent}% 50%`,
          opacity: visible ? 1 : 0,
          filter: backdropFilter,
          transitionProperty: "opacity, object-position",
          // Opacity only needs its own (quicker) fade-in on first mount;
          // object-position gets the slower pan duration so the slide
          // itself reads as a deliberate camera move, not a snap.
          transitionDuration: `900ms, ${panMs}ms`,
          transitionTimingFunction: "ease-out, ease-in-out",
        }}
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"
        style={{ opacity: dim }}
      />
    </div>
  );
}
