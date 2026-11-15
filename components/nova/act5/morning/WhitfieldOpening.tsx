"use client";

import { useEffect, useRef, useState } from "react";
import { MORNING_FILM_ASSETS, WHITFIELD_HANDOFF as H } from "@/lib/nova/morningFilm";
import { LINES, RECOMMENDATION_ACCOUNT } from "@/lib/nova/inspection";
import type { ReadinessRecommendationId } from "@/lib/nova/act5Recovery";

/**
 * Scene 1 of Whitfield's inspection — straight on from "The Morning of the Inspection". From the title's
 * black, a J-cut: the sealed room is heard first, then the room fades up as shot 2 left it, then the
 * exchange: Whitfield asks for the basis of the recommendation; the player's account is the one that
 * matches the Final Readiness Decision already saved in Act 5 (never re-asked); Whitfield neither agrees
 * nor disagrees. Then InspectionSequence opens the dossier. Reads the stored recommendation; changes nothing.
 */
const NO_RECOMMENDATION =
  "Our recommendation went to the Project Board with the readiness assessment. I can take you through both.";

export default function WhitfieldOpening({
  recommendation,
  muted,
  onComplete,
}: {
  recommendation: ReadinessRecommendationId | null | undefined;
  muted: boolean;
  onComplete: () => void;
}) {
  const [t, setT] = useState(0);
  const [index, setIndex] = useState(0);
  const lines = [
    { who: "Inspector Whitfield", text: LINES.opening },
    { who: "You", text: recommendation ? RECOMMENDATION_ACCOUNT[recommendation] : NO_RECOMMENDATION },
    { who: "Inspector Whitfield", text: LINES.understood },
  ];
  const mutedRef = useRef(muted);
  const audioRef = useRef<HTMLAudioElement[]>([]);

  useEffect(() => {
    mutedRef.current = muted;
    audioRef.current.forEach((a) => { a.muted = muted; });
  }, [muted]);

  useEffect(() => {
    const play = (src: string, volume: number, loop = false) => {
      try {
        const a = new Audio(src);
        a.muted = mutedRef.current;
        a.loop = loop;
        a.volume = volume;
        audioRef.current.push(a);
        a.play().catch(() => {});
      } catch { /* a missing sound is simply silent */ }
    };
    const cues = [
      { at: H.roomQuiet, fire: () => play(MORNING_FILM_ASSETS.sounds.roomLoop, 0.55, true) },
    ];
    let next = 0, raf = 0, t0 = 0;
    const tick = (now: number) => {
      if (!t0) t0 = now;
      const time = (now - t0) / 1000;
      while (next < cues.length && time >= cues[next].at) cues[next++].fire();
      setT(time);
      if (time < H.dialogueIn + 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const audios = audioRef.current;
    return () => { cancelAnimationFrame(raf); audios.forEach((a) => a.pause()); audioRef.current = []; };
  }, []);

  const ramp = (a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const room = ramp(0.5, 1.6); // the room returns, framed where shot 2 left it, still easing in
  const box = ramp(H.dialogueIn, H.dialogueIn + 0.5);
  const line = lines[index];
  const advance = () => {
    if (box < 1) return;
    if (index < lines.length - 1) setIndex(index + 1);
    else onComplete();
  };

  return (
    <div
      className="fixed inset-0 z-[60] overflow-hidden bg-black text-white"
      style={{ fontFamily: "var(--font-body)", cursor: box >= 1 ? "pointer" : "default" }}
      onClick={advance}
      aria-label="Inspector Whitfield"
    >
      {/* The room again, as shot 2 left it — kept dark so the dialogue carries the moment. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={MORNING_FILM_ASSETS.images.room}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity: room * 0.42, objectPosition: "62% 50%", transform: `scale(${(1.12 + 0.015 * room).toFixed(4)})`, transformOrigin: "72% 50%" }}
      />
      <div className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-[8vh]" style={{ opacity: box, transform: `translateY(${(1 - box) * 8}px)` }}>
        <div className="w-full max-w-3xl rounded-lg border border-white/10 bg-black/70 px-6 py-5 backdrop-blur-sm">
          <p className={`mb-2 text-sm font-semibold tracking-wide ${line.who === "You" ? "text-white/60" : "text-[#B5C474]"}`}>{line.who}</p>
          <p key={index} className="text-base leading-relaxed text-white/90 transition-opacity sm:text-lg">{line.who === "You" ? `“${line.text}”` : line.text}</p>
          <p className="mt-3 text-right text-xs text-white/40">Click to continue</p>
        </div>
      </div>
    </div>
  );
}
