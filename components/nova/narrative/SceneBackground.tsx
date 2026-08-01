"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface SceneBackgroundProps {
  src: string;
  alt?: string;
  fadeMs?: number;
}

/**
 * Full-screen scene backdrop with a smooth fade-in on load. Knows nothing
 * about which scene it's in — swap `src` for a different location and
 * mount a fresh instance (render it with `key={src}`) to replay the fade,
 * so future scenes/backgrounds are a pure data change.
 */
export default function SceneBackground({ src, alt = "", fadeMs = 1000 }: SceneBackgroundProps) {
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
        className="object-cover ease-out"
        style={{ opacity: visible ? 1 : 0, transitionProperty: "opacity", transitionDuration: `${fadeMs}ms` }}
      />
      {/* Subtle darken so a bottom-anchored dialogue box always reads
          clearly regardless of the background art's own brightness. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30" />
    </div>
  );
}
