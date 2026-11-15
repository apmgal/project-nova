"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { CinematicControl } from "@/components/prototype/warehouse/WarehouseExplorer";
import SceneAudio from "@/components/nova/narrative/SceneAudio";
import { MONTAGE_CUES, MONTAGE_MUSIC, ROOM_LAYERS, playSound, stopActiveSounds } from "@/lib/nova/act5Sound";
import { beamShapes, cameraKeys, MONTAGE_SHOTS, shotCaptions, viewAt, type DaylightBeam } from "./montageShots";

// The Spline runtime needs the browser (WebGL): load the viewer client-side only.
const WarehouseExplorer = dynamic(() => import("@/components/prototype/warehouse/WarehouseExplorer"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-black" />,
});

const FADE_MS = 600; // fade in at the start of each shot, out at its end (through black between rooms)
const MIN_BLACK_MS = 600; // the black hold after the phone call, even if the scene is already cached
const BETWEEN_SHOTS_BLACK_MS = 500; // extra black between rooms, so the next room settles before it's revealed
const CAPTION_FADE_MS = 900;
/** Optional time-passing card on black before the first shot (~5 s): short pause, fade in, hold, fade out. */
const INTRO_MS = { delay: 300, fade: 800, hold: 3100 };
/** The caption showing at time t in a shot, if any. */
const captionAt = (shot: (typeof MONTAGE_SHOTS)[number], t: number) => shotCaptions(shot).find((c) => t >= c.from && t < c.to) ?? null;
const OLIVE = "#B5C474";
// Sunlight overlay: soft warm shapes screen-blended over the scene (no extra 3D lights or geometry).
const SUN_TINT = "#ffe6c0";
const BEAM_OPACITY = { shaft: 0.13, rays: 0.14, patch: 0.32 };
type BeamEls = {
  svg: SVGSVGElement | null;
  shaft: SVGPolygonElement | null;
  patch: SVGPolygonElement | null;
  rays: (SVGPolygonElement | null)[];
  shaftGrad: SVGLinearGradientElement | null;
  patchGrad: SVGLinearGradientElement | null;
};

/** Project a beam's world shapes through the scene camera and update the overlay (hidden when null). */
function drawBeam(els: BeamEls, control: CinematicControl, beam: DaylightBeam | null) {
  if (!els.svg) return;
  if (!beam) {
    els.svg.style.opacity = "0";
    return;
  }
  const shapes = beamShapes(beam);
  const pts = (poly: { x: number; y: number; z: number }[]) => {
    const out: string[] = [];
    for (const p of poly) {
      const v = control.project(p.x, p.y, p.z);
      if (!v || v.z >= 1) return null; // behind the camera: skip the frame's beam
      out.push(`${v.x.toFixed(1)},${v.y.toFixed(1)}`);
    }
    return out.join(" ");
  };
  const shaft = pts(shapes.shaft);
  const patch = pts(shapes.patch);
  const from = control.project(shapes.from.x, shapes.from.y, shapes.from.z);
  const to = control.project(shapes.to.x, shapes.to.y, shapes.to.z);
  const floorNear = control.project(shapes.from.x, beam.opening.y0, beam.opening.z);
  if (!shaft || !patch || !from || !to || !floorNear) {
    els.svg.style.opacity = "0";
    return;
  }
  els.shaft?.setAttribute("points", shaft);
  els.patch?.setAttribute("points", patch);
  shapes.rays.forEach((r, i) => { const p = pts(r); if (p) els.rays[i]?.setAttribute("points", p); });
  for (const [g, a, b] of [[els.shaftGrad, from, to], [els.patchGrad, floorNear, to]] as const) {
    g?.setAttribute("x1", String(a.x)); g?.setAttribute("y1", String(a.y));
    g?.setAttribute("x2", String(b.x)); g?.setAttribute("y2", String(b.y));
  }
  els.svg.style.opacity = String(beam.strength);
}

/**
 * Act 5 recovery montage: a hands-off cinematic on its own copy of the facility scene. Waits on black
 * until the scene is ready, then plays MONTAGE_SHOTS in order (fade in → scripted objects + camera
 * glide → fade out), and calls onComplete on black. No captions, controls or player input; if the
 * scene can't load, it simply continues the story.
 */
export default function RecoveryMontage({
  onComplete,
  holdAt,
  introText,
  muted = false,
}: {
  onComplete: () => void;
  /** The game's sound setting (the room beds go silent while muted). */
  muted?: boolean;
  /** A short line shown on black before the first shot (the scene loads behind it). */
  introText?: string;
  /** Review aid (preview route only): freeze a shot at a given time, e.g. { shot: 0, t: 3.5 }. */
  holdAt?: { shot: number; t: number };
}) {
  const [control, setControl] = useState<CinematicControl | null>(null);
  const [shotIndex, setShotIndex] = useState(holdAt?.shot ?? 0);
  const [veil, setVeil] = useState(1);
  const [captionShown, setCaptionShown] = useState(false);
  const [captionText, setCaptionText] = useState("");
  const [minHoldDone, setMinHoldDone] = useState(false);
  const [hasIntro] = useState(() => !!introText && !holdAt);
  const [introPhase, setIntroPhase] = useState<"wait" | "in" | "out" | "done">(hasIntro ? "wait" : "done");
  useEffect(() => {
    if (!hasIntro) return;
    const { delay, fade, hold } = INTRO_MS;
    const ids = [
      setTimeout(() => setIntroPhase("in"), delay),
      setTimeout(() => setIntroPhase("out"), delay + fade + hold),
      setTimeout(() => setIntroPhase("done"), delay + 2 * fade + hold),
    ];
    return () => ids.forEach(clearTimeout);
  }, [hasIntro]);
  const beamRef = useRef<BeamEls>({ svg: null, shaft: null, patch: null, rays: [], shaftGrad: null, patchGrad: null });
  const completeRef = useRef(onComplete);
  useEffect(() => { completeRef.current = onComplete; });
  const finishedRef = useRef(false);
  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    completeRef.current();
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setMinHoldDone(true), MIN_BLACK_MS);
    return () => clearTimeout(id);
  }, []);

  const onStatusChange = useCallback((s: "loading" | "ready" | "error") => {
    if (s === "error") finish(); // no facility (WebGL/network): skip straight on
  }, [finish]);

  // Sound: the game's mute setting, read by the shot loop; one-shots still sounding stop with the montage.
  const mutedRef = useRef(muted);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => () => stopActiveSounds(400), []);

  // Play the current shot once the scene is ready (and its room is applied — child effects run first).
  useEffect(() => {
    if (!control || !minHoldDone || introPhase !== "done") return;
    const shot = MONTAGE_SHOTS[shotIndex];
    if (!shot) return;
    const { update, restore, beam } = shot.setup(control.app);
    const els = beamRef.current;
    if (holdAt) {
      (window as unknown as { __novaMontage?: CinematicControl }).__novaMontage = control; // review aid: inspect the held frame
      update(holdAt.t);
      control.setView(viewAt(shot, holdAt.t));
      drawBeam(els, control, beam?.(holdAt.t) ?? null);
      const r = requestAnimationFrame(() => {
        setVeil(0);
        const c = captionAt(shot, holdAt.t);
        if (c) setCaptionText(c.text);
        setCaptionShown(!!c);
      });
      return () => {
        cancelAnimationFrame(r);
        drawBeam(els, control, null);
        restore?.();
      };
    }
    update(0);
    control.setView(shot.views.start);
    const keys = cameraKeys(shot);
    let nextKey = 0;
    const cues = MONTAGE_CUES[shot.room] ?? [];
    let nextCue = 0;
    let raf = 0;
    let t0 = 0;
    let fading = false;
    const tick = (now: number) => {
      if (!t0) {
        t0 = now;
        setVeil(0); // fade in now that the first frame is in place
      }
      const t = (now - t0) / 1000;
      update(Math.min(t, shot.duration));
      drawBeam(els, control, beam?.(Math.min(t, shot.duration)) ?? null);
      // The text only changes when the next caption starts, so a fading-out line keeps its words.
      const c = captionAt(shot, t);
      if (c) setCaptionText(c.text); // no-op re-render unless it changes
      setCaptionShown(!!c);
      // Each event's sound on the frame its object starts to move (same clock as the animation).
      while (nextCue < cues.length && t >= cues[nextCue][0]) {
        playSound(cues[nextCue][1], mutedRef.current);
        nextCue++;
      }
      while (nextKey < keys.length && t >= keys[nextKey].at) {
        control.setView(keys[nextKey].view, { duration: keys[nextKey].duration });
        nextKey++;
      }
      if (!fading && t >= shot.duration - FADE_MS / 1000) {
        fading = true;
        setVeil(1);
      }
      if (t >= shot.duration) {
        if (shotIndex + 1 < MONTAGE_SHOTS.length) setShotIndex(shotIndex + 1);
        else finish();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    // The room and its first frame are set up behind black; between rooms, hold black a moment longer.
    const startTimer = setTimeout(() => { raf = requestAnimationFrame(tick); }, shotIndex > 0 ? BETWEEN_SHOTS_BLACK_MS : 0);
    return () => {
      clearTimeout(startTimer);
      cancelAnimationFrame(raf);
      drawBeam(els, control, null);
      restore?.(); // put back shared lights/background before the next room (or on unmount)
    };
  }, [control, minHoldDone, introPhase, shotIndex, finish, holdAt]);

  const room = MONTAGE_SHOTS[shotIndex]?.room ?? "warehouse";
  const caption = captionText;
  const backdrop = MONTAGE_SHOTS[shotIndex]?.backdrop;
  // Sound (lib/nova/act5Sound.ts): the music pulse from the intro card to the end; under it, each shot's room
  // keeps the walkthrough's base ambience (crossfaded through the black between rooms); and each scripted
  // event sounds on the frame it moves (the shot loop above).
  const bed = control && introPhase === "done" && !holdAt ? ROOM_LAYERS[room][0] : null;
  const musicOn = !holdAt && (introPhase !== "wait" || !hasIntro);
  return (
    <div className="fixed inset-0 bg-black">
      <SceneAudio src={musicOn ? MONTAGE_MUSIC.src : null} volume={muted ? 0 : MONTAGE_MUSIC.volume} fadeInMs={3000} fadeOutMs={1800} />
      <SceneAudio key={shotIndex} src={bed?.src ?? null} volume={muted || !bed ? 0 : bed.volume * 0.8} fadeInMs={900} fadeOutMs={700} />
      <WarehouseExplorer
        mode="interior"
        room={room}
        cinematic
        ambientForklift={false}
        ambientLab={false}
        backdrop={backdrop}
        onCinematicReady={setControl}
        onStatusChange={onStatusChange}
      />
      {/* Sunlight through the dock: soft shaft, faint rays and a lit floor patch, all following the shutter. */}
      <svg
        ref={(el) => { beamRef.current.svg = el; }}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[70] h-full w-full"
        style={{ opacity: 0, mixBlendMode: "screen" }}
      >
        <defs>
          <filter id="montage-beam-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="10" /></filter>
          <filter id="montage-ray-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" /></filter>
          <linearGradient id="montage-shaft-grad" ref={(el) => { beamRef.current.shaftGrad = el; }} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={SUN_TINT} stopOpacity="1" />
            <stop offset="1" stopColor={SUN_TINT} stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="montage-patch-grad" ref={(el) => { beamRef.current.patchGrad = el; }} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={SUN_TINT} stopOpacity="1" />
            <stop offset="1" stopColor={SUN_TINT} stopOpacity="0.25" />
          </linearGradient>
        </defs>
        <polygon ref={(el) => { beamRef.current.patch = el; }} fill="url(#montage-patch-grad)" opacity={BEAM_OPACITY.patch} filter="url(#montage-beam-soft)" />
        <polygon ref={(el) => { beamRef.current.shaft = el; }} fill="url(#montage-shaft-grad)" opacity={BEAM_OPACITY.shaft} filter="url(#montage-beam-soft)" />
        {[0, 1, 2, 3].map((i) => (
          <polygon key={i} ref={(el) => { beamRef.current.rays[i] = el; }} fill="url(#montage-shaft-grad)" opacity={BEAM_OPACITY.rays} filter="url(#montage-ray-soft)" />
        ))}
      </svg>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[80] bg-black transition-opacity ease-in-out"
        style={{ opacity: veil, transitionDuration: `${FADE_MS}ms` }}
      />
      {/* Time-passing card on black before the first shot: centred, muted, no panel. */}
      {hasIntro && introPhase !== "done" && (
        <p
          aria-live="polite"
          className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center px-6 text-center text-[18px] tracking-[0.04em] text-zinc-200/85 transition-opacity ease-in-out sm:text-[22px]"
          style={{ fontFamily: "var(--font-body)", opacity: introPhase === "in" ? 1 : 0, transitionDuration: `${INTRO_MS.fade}ms` }}
        >
          {introText}
        </p>
      )}
      {/* Subtle narrative line: small, no box, a thin olive rule; fades gently in and out. A soft, feathered
          dark wash behind it (no hard edges) keeps it readable on bright rooms. */}
      <p
        aria-live="polite"
        className={`pointer-events-none fixed bottom-5 left-0 z-[85] max-w-[min(90vw,640px)] py-4 pl-7 pr-16 transition-[opacity,transform] ease-out sm:bottom-7 sm:left-4 ${
          captionShown ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
        }`}
        style={{
          // closest-side: the wash fades to fully transparent before every edge (no visible box).
          background: "radial-gradient(closest-side at 45% 50%, rgba(6,8,12,0.52) 0%, rgba(6,8,12,0.34) 55%, rgba(6,8,12,0) 100%)",
          transitionDuration: `${CAPTION_FADE_MS}ms`,
        }}
      >
        <span
          className="block border-l-2 pl-3 text-[15px] leading-snug tracking-[0.01em] text-zinc-100/90 sm:text-[17px]"
          style={{ fontFamily: "var(--font-body)", borderColor: OLIVE, textShadow: "0 1px 10px rgba(0,0,0,0.65)" }}
        >
          {caption}
        </span>
      </p>
    </div>
  );
}
