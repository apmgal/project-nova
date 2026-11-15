"use client";

import { useEffect, useRef, useState } from "react";
import { ARRIVAL_ASSETS, ARRIVAL_TIMELINE as T, ARRIVAL_TITLE, type ArrivalAssets } from "@/lib/nova/inspectorArrival";
import type { ArrivalScene } from "./arrivalScene";

type Mode = "video" | "three" | "spline" | "placeholder";
type SplineApp = { load(url: string): Promise<void>; emitEvent(event: string, name: string): void; dispose(): void };

const PLACEHOLDER_SHOTS = [
  { from: T.shotsIn, label: "SHOT 1 · Close-up: dark vehicle rolls to a stop (headlights, tyres)" },
  { from: T.shotDoor, label: "SHOT 2 · Close-up: car door opens and closes" },
  { from: T.shotFootsteps, label: "SHOT 3 · Low angle: two or three footsteps, briefcase / document case in hand" },
];

const initialMode = (a: ArrivalAssets): Mode => (a.video ? "video" : a.three ? "three" : a.spline ? "spline" : "placeholder");

/**
 * Inspector-arrival cinematic. One rAF clock drives everything (3D frames, fades, shot changes, sound
 * cues, title), so cues stay in sync and each fires exactly once. Unmounting stops all audio, video and
 * 3D playback. Hands-off: no buttons; calls onComplete once, on black.
 * Visual source: a pre-rendered video if one is configured, else the Three.js scene (arrivalScene.ts),
 * else a Spline scene, else labelled placeholder frames — falling back down the list on load failure.
 */
export default function InspectorArrival({
  muted,
  onComplete,
  assets = ARRIVAL_ASSETS,
  holdAt,
}: {
  muted: boolean;
  onComplete: () => void;
  assets?: ArrivalAssets;
  /** Review aid (preview route only): freeze at this time, silent, never completes. */
  holdAt?: number;
}) {
  const [t, setT] = useState(holdAt ?? 0);
  const [mode, setMode] = useState<Mode>(() => initialMode(assets));
  const [sceneReady, setSceneReady] = useState(false);
  const completeRef = useRef(onComplete);
  useEffect(() => { completeRef.current = onComplete; });
  const mutedRef = useRef(muted);
  const audioRef = useRef<HTMLAudioElement[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const splineRef = useRef<SplineApp | null>(null);
  const threeRef = useRef<ArrivalScene | null>(null);
  const lastFrameRef = useRef(holdAt ?? T.shotsIn); // the 3D frame last drawn (redrawn after a resize)

  // Mute follows the game's setting, including clips already playing.
  useEffect(() => {
    mutedRef.current = muted;
    audioRef.current.forEach((a) => { a.muted = muted; });
    if (videoRef.current) videoRef.current.muted = muted || !assets.video?.includesAudio;
  }, [muted, assets.video]);

  // Three.js scene: built during the black hold; any failure (no WebGL, missing file) falls back.
  useEffect(() => {
    if (mode !== "three" || !assets.three || !canvasRef.current) return;
    let disposed = false;
    let ro: ResizeObserver | null = null;
    const canvas = canvasRef.current;
    (async () => {
      try {
        const { createArrivalScene } = await import("./arrivalScene");
        const scene = await createArrivalScene(canvas, assets.three!);
        if (disposed) { scene.dispose(); return; }
        // Resizing clears the canvas, so redraw the current frame straight away.
        const fit = () => { scene.resize(canvas.clientWidth, canvas.clientHeight); scene.render(lastFrameRef.current); };
        fit();
        ro = new ResizeObserver(fit);
        ro.observe(canvas);
        scene.render(holdAt ?? T.shotsIn); // compiles shaders now, so the first visible frame doesn't stutter
        threeRef.current = scene;
        setSceneReady(true);
      } catch (e) {
        console.warn("[nova] arrival cinematic: 3D scene unavailable, using fallback", e);
        if (!disposed) setMode(assets.spline ? "spline" : "placeholder");
      }
    })();
    return () => {
      disposed = true;
      ro?.disconnect();
      threeRef.current?.dispose();
      threeRef.current = null;
    };
  }, [mode, assets.three, assets.spline, holdAt]);

  // Spline: load during the black hold; any failure falls back to the placeholder shots.
  useEffect(() => {
    if (mode !== "spline" || !assets.spline || !canvasRef.current) return;
    let disposed = false;
    (async () => {
      try {
        const { Application } = (await import("@splinetool/runtime")) as unknown as { Application: new (c: HTMLCanvasElement) => SplineApp };
        if (disposed || !canvasRef.current) return;
        const app = new Application(canvasRef.current);
        splineRef.current = app;
        await app.load(assets.spline!.url);
      } catch {
        if (!disposed) setMode("placeholder");
      }
    })();
    return () => { disposed = true; splineRef.current?.dispose(); splineRef.current = null; };
  }, [mode, assets.spline]);

  // The clock: cues fire once each as t passes them; the 3D scene is drawn from the same t.
  useEffect(() => {
    if (holdAt !== undefined) return; // a held frame is drawn once, when the scene has loaded
    const play = (src: string | null, opts: { maxSeconds?: number; volume?: number } = {}) => {
      if (!src) return;
      try {
        const a = new Audio(src);
        a.muted = mutedRef.current;
        a.volume = opts.volume ?? 0.8;
        audioRef.current.push(a);
        a.play().catch(() => {});
        if (opts.maxSeconds) setTimeout(() => a.pause(), opts.maxSeconds * 1000);
      } catch { /* audio unavailable: silent */ }
    };
    const videoSound = !!assets.video?.includesAudio;
    const s = assets.sounds;
    const cues: { at: number; fire: () => void }[] = [
      { at: T.vehicleSound, fire: () => !videoSound && play(s.vehicle) },
      {
        at: T.shotsIn,
        fire: () => {
          if (videoRef.current) videoRef.current.play().catch(() => {});
          try { splineRef.current?.emitEvent("mouseDown", assets.spline?.startObject ?? ""); } catch { /* scene without the start object */ }
        },
      },
      { at: T.doorOpen, fire: () => !videoSound && play(s.door) },
      { at: T.doorClose, fire: () => !videoSound && play(s.doorClose ?? s.door) },
      { at: T.footsteps, fire: () => !videoSound && play(s.footsteps, { maxSeconds: T.footstepsDuration, volume: 0.7 }) },
      { at: T.titleIn, fire: () => play(s.title, { volume: 0.6 }) },
    ];
    let next = 0;
    let raf = 0;
    let t0 = 0;
    let done = false;
    const tick = (now: number) => {
      if (!t0) t0 = now;
      const time = (now - t0) / 1000;
      while (next < cues.length && time >= cues[next].at) cues[next++].fire();
      if (time >= T.shotsIn - 0.4 && time <= T.shotsOut + 0.1) {
        lastFrameRef.current = time;
        threeRef.current?.render(time);
      }
      setT(time);
      if (time >= T.end) {
        if (!done) { done = true; completeRef.current(); }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const audios = audioRef.current;
    const video = videoRef.current;
    return () => {
      cancelAnimationFrame(raf);
      audios.forEach((a) => a.pause());
      audioRef.current = [];
      video?.pause();
    };
  }, [assets, holdAt]);

  const ramp = (a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const shotsOpacity = (mode === "three" && !sceneReady ? 0 : 1) * ramp(T.shotsIn, T.shotsIn + 0.6) * (1 - ramp(T.shotsOut - 0.5, T.shotsOut));
  const titleOpacity = ramp(T.titleIn, T.titleIn + 0.8) * (1 - ramp(T.titleOut, T.end - 0.1));
  const shot = [...PLACEHOLDER_SHOTS].reverse().find((s) => t >= s.from) ?? PLACEHOLDER_SHOTS[0];

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-black text-white" style={{ fontFamily: "var(--font-body)" }} aria-label="Cinematic: the inspector arrives">
      <div className="absolute inset-0" style={{ opacity: shotsOpacity }}>
        {mode === "video" && assets.video && (
          <video
            ref={videoRef}
            src={assets.video.src}
            poster={assets.video.poster}
            muted={muted || !assets.video.includesAudio}
            playsInline
            preload="auto"
            onError={() => setMode(assets.three ? "three" : "placeholder")}
            className="h-full w-full object-cover"
          />
        )}
        {(mode === "spline" || mode === "three") && <canvas key={mode} ref={canvasRef} className="h-full w-full" />}
        {mode === "placeholder" && <PlaceholderShot key={shot.label} label={shot.label} index={PLACEHOLDER_SHOTS.indexOf(shot)} />}
        {/* Letterbox bars, a navy vignette and fine film grain, shared by every source. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[9vh] bg-black" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[9vh] bg-black" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 55%, rgba(10,18,36,0) 45%, rgba(4,8,18,0.7) 100%)" }} />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
          style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")" }}
        />
      </div>

      <div className="absolute inset-0 grid place-items-center" style={{ opacity: titleOpacity }}>
        <div className="text-center">
          <p className="text-[34px] font-semibold tracking-[0.42em] text-white/95 sm:text-[52px]" style={{ paddingLeft: "0.42em" }}>
            {ARRIVAL_TITLE}
          </p>
          <div className="mx-auto mt-4 h-px w-24 bg-[#B5C474]/70" />
        </div>
      </div>
    </div>
  );
}

/** A clearly labelled stand-in frame for one shot (used only when no visual source is available). */
function PlaceholderShot({ label, index }: { label: string; index: number }) {
  return (
    <div className="absolute inset-0 bg-[#070c17]">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            index === 0
              ? "radial-gradient(ellipse at 30% 62%, rgba(255,236,200,0.22) 0%, rgba(255,236,200,0) 18%), radial-gradient(ellipse at 70% 62%, rgba(255,236,200,0.22) 0%, rgba(255,236,200,0) 18%), linear-gradient(180deg, #0b1322 0%, #05080f 100%)"
              : index === 1
                ? "linear-gradient(100deg, #05080f 0%, #0d1830 48%, #172640 50%, #05080f 100%)"
                : "linear-gradient(180deg, #0a1120 0%, #121c30 70%, #1b2638 100%)",
          animation: "nova-arrival-drift 3s ease-out forwards",
        }}
      />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md border border-dashed border-white/30 bg-black/40 px-4 py-2 text-center">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-[#B5C474]">PLACEHOLDER</p>
        <p className="mt-1 text-[13px] text-zinc-200/90">{label}</p>
      </div>
      <style>{`@keyframes nova-arrival-drift { from { transform: scale(1.06); } to { transform: scale(1); } }`}</style>
    </div>
  );
}
