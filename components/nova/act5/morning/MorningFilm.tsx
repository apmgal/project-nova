"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";
import { MORNING_TITLE } from "@/lib/nova/morningInspection";
import { DOOR_SHUT_OFFSET, MORNING_FILM_ASSETS, MORNING_FILM_TIMELINE as T, SEALED_LEVEL } from "@/lib/nova/morningFilm";

/**
 * "The Morning of the Inspection" — FILM version, PROTOTYPE player (not wired into the game).
 *
 * Three photographic stills cut together as footage. A paused GSAP timeline holds every move and is
 * scrubbed by one requestAnimationFrame clock that also fires the sound cues, so picture and sound stay
 * locked and each cue fires exactly once. What is (and isn't) going on, honestly:
 *  - Camera: perspective-correct 2.5D moves (scale, translate and a fraction of a degree of rotation under
 *    perspective). Straight lines stay straight; nothing is warped.
 *  - No artificial parallax: each photograph moves as one piece. (The layer-split exterior/room assets from
 *    the first pass are still in public/ but unused.)
 *  - Light: low-opacity soft-light overlays (window warmth, haze, a passing cloud). No blur or focus effects..
 * Same props as the 3D version: respects the game's mute, calls onComplete once, no Skip.
 */
export default function MorningFilm({
  muted,
  onComplete,
  holdAt,
}: {
  muted: boolean;
  onComplete: () => void;
  /** Review aid (preview route only): freeze at this time, silent, never completes. */
  holdAt?: number;
}) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const completeRef = useRef(onComplete);
  useEffect(() => { completeRef.current = onComplete; });
  const mutedRef = useRef(muted);
  const audioRef = useRef<HTMLAudioElement[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const frameRef = useRef<(t: number) => void>(() => {});

  useEffect(() => {
    mutedRef.current = muted;
    audioRef.current.forEach((a) => { a.muted = muted; });
  }, [muted]);

  // Load and decode every image before the clock starts, so no cut lands on a half-drawn frame.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      Object.values(MORNING_FILM_ASSETS.images).map((src) => {
        const img = new Image();
        img.src = src;
        return img.decode();
      }),
    )
      .then(() => { if (!cancelled) setReady(true); })
      .catch((e) => {
        console.warn("[nova] morning film: images unavailable", e);
        if (!cancelled) { setFailed(true); setReady(true); }
      });
    return () => { cancelled = true; };
  }, []);

  // The cut: every move on one paused timeline (seconds = cinematic time).
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const q = gsap.utils.selector(root);
    const one = (sel: string) => q(sel)[0] as HTMLElement;
    const tl = gsap.timeline({ paused: true, defaults: { ease: "none" } });
    const persp = 1600;

    // Each shot is built from separate, overlapping moves on different transform properties (a glide on
    // x/rotationY, a push on scale/y), so one move can hand over to the next without a visible join.

    // Shot 1 — arrival, a moment of uncertainty, then drawn in.
    //  · 2.8–6.45: the lateral glide decelerates (sine.out) into the engine stopping (~6.2) — almost settled,
    //    as if waiting to see who has arrived. A very slow pan (rotationY) runs under the whole shot, so the
    //    frame never actually stops.
    //  · 6.45–9.2: the push towards the entrance starts softly with the car door opening (6.70), is at its
    //    most purposeful around the slam (8.26) and finishes naturally. Push ≈ 5.5%.
    //  · 9.2–10.2: an almost-still hold on the facility (only the sub-pixel drift), then the fade out.
    const c1 = one("[data-cam='1']");
    tl.set(c1, { scale: 1.035, yPercent: 0.3, transformPerspective: persp, transformOrigin: "58% 64%" }, T.shot1[0] - 0.21);
    tl.fromTo(c1, { xPercent: 1.8 }, { xPercent: -0.5, duration: 3.65, ease: "sine.out" }, T.shot1[0] - 0.2);
    tl.fromTo(c1, { rotationY: 0.55 }, { rotationY: -0.2, duration: 6.3, ease: "sine.inOut" }, T.shot1[0] - 0.2);
    tl.to(c1, { scale: 1.092, yPercent: -0.3, duration: 2.75, ease: "power2.inOut" }, 6.45);
    tl.fromTo(q("[data-fx='windows']"), { opacity: 0.3 }, { opacity: 0.85, duration: 5.4, ease: "sine.inOut" }, T.shot1[0] + 0.3);
    tl.fromTo(one("[data-fx='haze']"), { opacity: 0.35, xPercent: -3 }, { opacity: 0.7, xPercent: 3, duration: 6.0, ease: "sine.inOut" }, T.shot1[0]);

    // Shot 2 — isolation. Revealed still: ~0.95 s with only the outside activity. Then, as the door handle
    // turns, a drift begins gently (sine.inOut) from the off-centre opening frame (far end of the table right
    // of centre) so the far end comes in towards the centre; it decelerates to near-stillness just *before* the door lands
    // (15.85) — the camera anticipates it. Held ~0.45 s in the new quiet, then 16.3 → past the cut: a
    // restrained push anchored on the far end of the table (≈8%), so it grows towards the centre of frame.
    const c2 = one("[data-cam='2']");
    tl.set(c2, { scale: 1.035, yPercent: 0.4, xPercent: 2.0, rotationY: 0.6, transformPerspective: persp, transformOrigin: "80% 46%" }, T.shot2[0] - 0.05);
    tl.to(c2, { xPercent: -1.0, rotationY: -0.15, duration: T.roomDrift[1] - T.roomDrift[0], ease: "sine.inOut" }, T.roomDrift[0]);
    tl.to(c2, { scale: 1.12, yPercent: -0.4, duration: 3.15, ease: "power1.in" }, T.doorClose + 0.215 + 0.45);
    // A thin cloud passes: the sunlight dims a shade and returns.
    tl.fromTo(one("[data-fx='sun']"), { opacity: 0.9 }, { opacity: 0.4, duration: 2.2, ease: "sine.inOut" }, T.shot2[0] + 0.6)
      .to(one("[data-fx='sun']"), { opacity: 0.85, duration: 2.6, ease: "sine.inOut" }, T.shot2[0] + 3.2);

    // Shot 3 — a minimal push (≈3.5%) onto "COMMISSIONING READINESS", settled and perfectly still from ~22.45 s.
    tl.fromTo(one("[data-cam='3']"),
      { scale: 1.025, xPercent: 0.4, yPercent: 0.7, rotationX: 0.8, transformPerspective: persp, transformOrigin: "46% 31%" },
      { scale: 1.06, xPercent: 0, yPercent: 0, rotationX: 0, duration: 3.2, ease: "power3.out" }, T.shot3[0] - 0.1);

    // Shot 4 — the title arrives with the impact: a plain fade, a still hold, a fade out into the hand-off.
    tl.set(one("[data-title]"), { letterSpacing: "0.42em", paddingLeft: "0.42em" }, 0);
    tl.fromTo(one("[data-title]"), { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power1.out" }, T.titleIn);
    tl.fromTo(one("[data-title-rule]"), { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power1.out" }, T.titleIn);
    tl.to(q("[data-title-wrap]"), { opacity: 0, duration: T.end - 0.05 - T.titleOut, ease: "sine.inOut" }, T.titleOut);
    tl.set({}, {}, T.end);
    tlRef.current = tl;

    const shots = [one("[data-shot='1']"), one("[data-shot='2']"), one("[data-shot='3']")];
    const black = one("[data-black]");
    const weave = one("[data-weave]");
    const grain = one("[data-grain]");
    let lastGrain = -1;
    frameRef.current = (t: number) => {
      tl.seek(Math.min(t, T.end), false);
      // Black at the head (the car is heard first) → fade up → exterior → fade out, a beat of black, the room
      // fades up → clean cut to the dossier → hard cut to black for the title.
      const s = t < T.shot1[0] ? -1 : t < T.shot1[1] ? 0 : t < T.shot2[0] ? -1 : t < T.shot3[0] ? 1 : t < T.black ? 2 : -1;
      shots.forEach((el, i) => { el.style.visibility = i === s ? "visible" : "hidden"; });
      const ss = (a: number, b: number) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
      const dark = s < 0 ? 1
        : s === 0 ? Math.max(1 - ss(T.fadeIn[0], T.fadeIn[1]), ss(T.fadeOut[0], T.fadeOut[1]))
        : s === 1 ? 1 - ss(T.roomIn[0], T.roomIn[1])
        : 0;
      black.style.opacity = String(dark);
      // A fluid-head drift far below a pixel or two — enough to stop the frame feeling locked off.
      const w = Math.min(1, Math.max(0, (T.shot3[0] + 3.1 - t) / 0.8)); // the dossier ends perfectly still
      weave.style.transform = `translate3d(${(Math.sin(t * 0.73) * 0.9 * w).toFixed(2)}px, ${(Math.sin(t * 0.91 + 1.3) * 0.6 * w).toFixed(2)}px, 0)`;
      // Moving film grain (a new offset every other frame at 60 fps ≈ 24–30 fps grain).
      const g = Math.floor(t * 26);
      if (g !== lastGrain) {
        lastGrain = g;
        const r = (n: number) => ((Math.sin(g * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
        grain.style.transform = `translate3d(${(r(1) * -160).toFixed(0)}px, ${(r(2) * -160).toFixed(0)}px, 0)`;
      }
    };
    frameRef.current(holdAt ?? 0);
    return () => { tl.kill(); tlRef.current = null; };
  }, [holdAt]);

  // Hold mode: draw the requested moment once the images are in.
  useEffect(() => {
    if (ready && holdAt !== undefined) frameRef.current(holdAt);
  }, [ready, holdAt]);

  // The clock: scrubs the timeline and fires the sound cues. Every sound is created (and starts loading)
  // once, up front, so a cue only has to press play — no fetch latency at the cut, nothing created twice.
  useEffect(() => {
    if (!ready || holdAt !== undefined) return;
    const x = MORNING_FILM_ASSETS.sounds;
    const fade = (a: HTMLAudioElement | null, to: number, ms: number) => {
      if (!a) return;
      const from = a.volume, t0 = performance.now();
      const step = (now: number) => {
        const k = Math.max(0, Math.min(1, (now - t0) / ms)); // a frame's timestamp can precede t0: never a negative volume
        try { a.volume = from + (to - from) * k; } catch { return; }
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const make = (src: string, volume: number, loop = false) => {
      try {
        const a = new Audio(src);
        a.preload = "auto";
        a.loop = loop;
        a.volume = volume;
        a.muted = mutedRef.current;
        a.addEventListener("error", () => console.warn("[nova] morning film: sound unavailable", src));
        audioRef.current.push(a);
        return a;
      } catch { return null; } // a missing or blocked sound is simply silent
    };
    const start = (a: HTMLAudioElement | null) => { if (a) a.play().catch(() => {}); };
    const el = {
      car: make(x.car, 0.75),
      activity: make(x.activity, 1),
      carDoor: make(x.carDoor, 1),
      doorOpen: make(x.doorOpen, 1),
      steps: make(x.footsteps, 1),
      doorClose: make(x.doorClose, 1),
      paper: make(x.paper, 1),
      impact: make(x.impact, 1),
    };
    // The door shuts: outside activity drops ~18 dB in 250 ms; what's left is the faint sealed-room sound.
    let sealed = false;
    const seal = () => {
      if (sealed) return;
      sealed = true;
      fade(el.activity, SEALED_LEVEL, 250);
    };
    const cues: { at: number; fire: () => void }[] = [
      { at: T.car, fire: () => start(el.car) },
      { at: T.activity, fire: () => start(el.activity) },
      { at: T.carDoor, fire: () => start(el.carDoor) },
      { at: T.doorOpen, fire: () => start(el.doorOpen) },
      { at: T.footsteps, fire: () => start(el.steps) },
      { at: T.doorClose, fire: () => start(el.doorClose) },
      { at: T.paper, fire: () => start(el.paper) },
      { at: T.quiet, fire: () => fade(el.activity, 0, 600) },
      { at: T.impact, fire: () => start(el.impact) },
    ];
    let next = 0, raf = 0, t0 = 0, done = false;
    const tick = (now: number) => {
      if (!t0) t0 = now;
      const time = (now - t0) / 1000;
      while (next < cues.length && time >= cues[next].at) cues[next++].fire();
      // Key the drop to the door landing as actually heard (the file's own playhead), not to the clock;
      // fall back to the clock if the door sound is missing or blocked.
      if (!sealed && time >= T.doorClose) {
        const d = el.doorClose;
        if ((d && !d.paused && d.currentTime >= DOOR_SHUT_OFFSET) || time >= T.doorClose + DOOR_SHUT_OFFSET + 0.2) seal();
      }
      frameRef.current(time);
      if (time >= T.end) {
        if (!done) { done = true; completeRef.current(); }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const audios = audioRef.current;
    // Unmount (end, Skip/leave, navigation): stop everything. The impact's tail is already faded by then.
    return () => { cancelAnimationFrame(raf); audios.forEach((a) => a.pause()); audioRef.current = []; };
  }, [ready, holdAt]);

  const I = MORNING_FILM_ASSETS.images;
  /** The photograph's own box: covers the viewport at the image's aspect, cropped around a focal point. */
  const cover = (fx: number, fy: number): CSSProperties => ({
    position: "absolute",
    width: "max(100vw, 177.69vh)",
    height: "max(56.28vw, 100vh)",
    left: `calc((100vw - max(100vw, 177.69vh)) * ${fx})`,
    top: `calc((100vh - max(56.28vw, 100vh)) * ${fy})`,
  });
  const fill = "absolute inset-0 h-full w-full select-none";
  const img = (src: string, extra: Record<string, string> = {}, style?: CSSProperties) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" draggable={false} className={fill} style={{ willChange: "transform, opacity", ...style }} {...extra} />
  );

  return (
    <div ref={rootRef} className="fixed inset-0 z-[60] overflow-hidden bg-black text-white" style={{ fontFamily: "var(--font-body)" }} aria-label="Cinematic: the morning of the inspection">
      <div data-weave className="absolute inset-0" style={{ visibility: failed ? "hidden" : "visible" }}>
        {/* Shot 1 — exterior at dawn */}
        <div data-shot="1" className="absolute inset-0" style={{ visibility: "hidden" }}>
          <div style={cover(0.95, 0.4)}>
            <div data-cam="1" className="absolute inset-0" style={{ willChange: "transform" }}>
              {img(I.exterior)}
              {/* Lit glazing warms a shade as the morning comes up. */}
              <div data-fx="windows" className="pointer-events-none absolute mix-blend-soft-light" style={{ left: "47%", top: "0%", width: "22%", height: "42%", background: "radial-gradient(closest-side, rgba(255,186,110,0.55), rgba(255,186,110,0))" }} />
              <div data-fx="windows" className="pointer-events-none absolute mix-blend-soft-light" style={{ left: "46%", top: "47%", width: "25%", height: "35%", background: "radial-gradient(closest-side, rgba(255,186,110,0.6), rgba(255,186,110,0))" }} />
              <div data-fx="windows" className="pointer-events-none absolute mix-blend-soft-light" style={{ left: "31%", top: "37%", width: "16%", height: "14%", background: "radial-gradient(closest-side, rgba(255,186,110,0.5), rgba(255,186,110,0))" }} />
              {/* Low mist drifting across the far end of the site. */}
              <div data-fx="haze" className="pointer-events-none absolute" style={{ left: "-6%", top: "52%", width: "52%", height: "30%", background: "radial-gradient(closest-side, rgba(196,206,224,0.22), rgba(196,206,224,0))" }} />
            </div>
          </div>
        </div>

        {/* Shot 2 — the inspection room */}
        <div data-shot="2" className="absolute inset-0" style={{ visibility: "hidden" }}>
          <div style={cover(0.62, 0.5)}>
            <div data-cam="2" className="absolute inset-0" style={{ willChange: "transform" }}>
              {img(I.room)}
              {/* Morning sun through the glazing; a passing cloud dims it a shade. */}
              <div data-fx="sun" className="pointer-events-none absolute inset-0 mix-blend-soft-light" style={{ background: "linear-gradient(105deg, rgba(255,196,128,0.32) 0%, rgba(255,196,128,0.12) 45%, rgba(255,196,128,0) 70%)" }} />
            </div>
          </div>
        </div>

        {/* Shot 3 — the dossier */}
        <div data-shot="3" className="absolute inset-0" style={{ visibility: "hidden" }}>
          <div style={cover(0.45, 0.35)}>
            <div data-cam="3" className="absolute inset-0" style={{ willChange: "transform" }}>
              {img(I.dossier)}
            </div>
          </div>
        </div>
      </div>

      {/* Letterbox, moving grain and the black. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[6vh] bg-black" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[6vh] bg-black" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.07] mix-blend-overlay">
        <div
          data-grain
          className="absolute"
          style={{ inset: "-160px 0 0 -160px", width: "calc(100% + 320px)", height: "calc(100% + 320px)", backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")" }}
        />
      </div>
      <div data-black aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black" />

      <div data-title-wrap className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p data-title className="text-[30px] font-light text-white/95 sm:text-[50px]" style={{ opacity: 0 }}>
            {MORNING_TITLE}
          </p>
          <div data-title-rule className="mx-auto mt-5 h-px w-24 bg-[#B5C474]/70" style={{ opacity: 0 }} />
        </div>
      </div>
    </div>
  );
}
