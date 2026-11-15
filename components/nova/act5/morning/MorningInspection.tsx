"use client";

import { useEffect, useRef, useState } from "react";
import { MORNING_ASSETS, MORNING_TIMELINE as T, MORNING_TITLE } from "@/lib/nova/morningInspection";
import type { MorningScene } from "./morningScene";

/**
 * "The Morning of the Inspection" — PROTOTYPE player (not wired into the game). Same approach as the
 * existing InspectorArrival: one rAF clock drives the 3D frames, the dips between shots, the title and
 * every sound cue, so each fires exactly once and stays in sync; the game's mute setting is respected;
 * unmounting stops everything. ~12.6 s, hands-off, calls onComplete once on black.
 */
export default function MorningInspection({
  muted,
  onComplete,
  holdAt,
}: {
  muted: boolean;
  onComplete: () => void;
  /** Review aid (preview route only): freeze at this time, silent, never completes. */
  holdAt?: number;
}) {
  const [t, setT] = useState(holdAt ?? 0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const completeRef = useRef(onComplete);
  useEffect(() => { completeRef.current = onComplete; });
  const mutedRef = useRef(muted);
  const audioRef = useRef<HTMLAudioElement[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<MorningScene | null>(null);
  const lastFrameRef = useRef(holdAt ?? 0);

  useEffect(() => {
    mutedRef.current = muted;
    audioRef.current.forEach((a) => { a.muted = muted; });
  }, [muted]);

  // Build the 3D scene (both environments) before the clock starts; WebGL failure → black + title.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let ro: ResizeObserver | null = null;
    (async () => {
      try {
        const { createMorningScene } = await import("./morningScene");
        const scene = await createMorningScene(canvas, { logo: MORNING_ASSETS.logo });
        if (disposed) { scene.dispose(); return; }
        const fit = () => { scene.resize(canvas.clientWidth, canvas.clientHeight); scene.render(lastFrameRef.current); };
        ro = new ResizeObserver(fit);
        ro.observe(canvas);
        fit();
        // Warm up both environments so neither cut stutters on first use.
        if (holdAt === undefined) { scene.render(T.shot2[0] + 0.1); scene.render(0); }
        sceneRef.current = scene;
        // Review aid (held frames on the preview route only): lets a profiler time renders of the scene.
        if (holdAt !== undefined) (window as unknown as { __novaMorning?: MorningScene }).__novaMorning = scene;
        setReady(true);
      } catch (e) {
        console.warn("[nova] morning-of-inspection: 3D unavailable", e);
        if (!disposed) { setFailed(true); setReady(true); }
      }
    })();
    return () => { disposed = true; ro?.disconnect(); sceneRef.current?.dispose(); sceneRef.current = null; };
  }, [holdAt]);

  // The clock (starts once the scene is ready).
  useEffect(() => {
    if (!ready || holdAt !== undefined) return;
    const s = MORNING_ASSETS.sounds;
    const play = (src: string, opts: { volume?: number; loop?: boolean; fadeInMs?: number } = {}) => {
      try {
        const a = new Audio(src);
        a.muted = mutedRef.current;
        a.loop = !!opts.loop;
        const target = opts.volume ?? 0.8;
        a.volume = opts.fadeInMs ? 0 : target;
        audioRef.current.push(a);
        a.play().catch(() => {});
        if (opts.fadeInMs) fade(a, target, opts.fadeInMs);
        return a;
      } catch { return null; }
    };
    const fade = (a: HTMLAudioElement, to: number, ms: number) => {
      const from = a.volume, t0 = performance.now();
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / ms);
        try { a.volume = from + (to - from) * k; } catch { return; }
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    let wind: HTMLAudioElement | null = null;
    let tone: HTMLAudioElement | null = null;
    const cues: { at: number; fire: () => void }[] = [
      { at: T.wind, fire: () => { wind = play(s.wind, { loop: true, volume: 0.55, fadeInMs: 1200 }); } },
      { at: T.distantVehicle, fire: () => { play(s.distantVehicle, { volume: 0.45 }); } },
      { at: T.roomTone - 0.12, fire: () => { if (wind) fade(wind, 0, 220); } }, // the wind cuts with the picture
      { at: T.roomTone, fire: () => { tone = play(s.roomTone, { loop: true, volume: 0.35, fadeInMs: 150 }); } },
      { at: T.doorClose, fire: () => { play(s.doorClose, { volume: 0.7 }); } },
      { at: T.footsteps, fire: () => { play(s.footsteps, { volume: 0.75 }); } },
      { at: T.footsteps + 1.45, fire: () => { if (tone) fade(tone, 0.18, 300); } }, // the room goes quiet when the steps stop
      { at: T.black, fire: () => { if (tone) fade(tone, 0, 120); } },
      { at: T.title, fire: () => { play(s.title, { volume: 0.6 }); } },
    ];
    let next = 0, raf = 0, t0 = 0, done = false;
    const tick = (now: number) => {
      if (!t0) t0 = now;
      const time = (now - t0) / 1000;
      while (next < cues.length && time >= cues[next].at) cues[next++].fire();
      if (time < T.black) { lastFrameRef.current = time; sceneRef.current?.render(time); }
      setT(time);
      if (time >= T.end) {
        if (!done) { done = true; completeRef.current(); }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const audios = audioRef.current;
    return () => { cancelAnimationFrame(raf); audios.forEach((a) => a.pause()); audioRef.current = []; };
  }, [ready, holdAt]);

  // Black: the opening fade-in, clean cuts between shots, a hard cut to black for the title.
  const ramp = (a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const black = failed ? 1 : Math.max(1 - ramp(T.fadeIn[0], T.fadeIn[1]), t >= T.black ? 1 : 0);
  const titleIn = ramp(T.titleIn, T.titleIn + 1.1);
  const titleOpacity = (1 - (1 - titleIn) ** 2) * (1 - ramp(T.titleOut, T.end - 0.05));
  const tracking = 0.42 + 0.16 * (1 - titleIn) ** 3; // letters settle together as the title fades in

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-black text-white" style={{ fontFamily: "var(--font-body)" }} aria-label="Cinematic: the morning of the inspection">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {/* Letterbox, a gentle vignette and fine grain over the 3D frames. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[7vh] bg-black" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[7vh] bg-black" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")" }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: ready ? black : 1 }} />
      <div className="absolute inset-0 grid place-items-center" style={{ opacity: titleOpacity }}>
        <div className="text-center">
          <p className="text-[34px] font-semibold text-white/95 sm:text-[52px]" style={{ letterSpacing: `${tracking}em`, paddingLeft: `${tracking}em` }}>
            {MORNING_TITLE}
          </p>
          <div className="mx-auto mt-4 h-px w-24 bg-[#B5C474]/70" />
        </div>
      </div>
    </div>
  );
}
