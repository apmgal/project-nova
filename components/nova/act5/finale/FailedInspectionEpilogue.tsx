"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import TeamsToast from "./TeamsToast";
import { NOT_SATISFACTORY_FILM, type EpilogueFilm } from "@/lib/nova/epilogueFilm";

/**
 * The epilogue player. By default it plays the "Not satisfactory" epilogue (lib/nova/failedEpilogue.ts, via
 * NOT_SATISFACTORY_FILM); given `film` it plays another epilogue with the same architecture — e.g.
 * "Subject to conditions" (CONDITIONAL_FILM). See lib/nova/epilogueFilm.ts.
 *
 * Reuses the finale's Teams card (TeamsToast, as in "No News") and its notification note, the Morning
 * film's finish (letterbox, grain, slow single-piece camera moves), the title-card typography, and the
 * HTMLAudio play / ramp / cleanup pattern used across the finale for the ambience and the Teams note. The
 * score is one continuous Web Audio cue (useScore): it starts with the office, ducks under Mike's message,
 * loops gaplessly for as long as the message stays open, swells for the facility and resolves on the closing
 * card. The one thing the sequence waits for is the player closing the message; everything else is
 * timer-driven, so blocked audio never holds anything up.
 */

type ScoreState = { ctx: AudioContext | null; gain: GainNode | null; level: number; muted: boolean };

function applyScoreGain({ ctx, gain, level, muted }: ScoreState, seconds: number) {
  if (!ctx || !gain || ctx.state === "closed") return;
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  // An exponential approach reads as a smooth fade; ~4 time constants per ramp.
  gain.gain.setTargetAtTime(muted ? 0 : level, now, Math.max(0.02, seconds / 4));
}

/**
 * One persistent music cue: one decoded buffer, one source, one gain. `to(level, s)` moves the gain smoothly;
 * `release(s)` fades it to silence and then ends it; `stop()` ends it at once. Mute holds the gain at 0
 * while remembering the level. If the browser blocks audio, the cue starts on the next click or key press.
 */
function useScore(src: string, loopStart: number, loopEnd: number, muted: boolean, crossfade = 0, offset = 0) {
  const r = useRef<{ ctx: AudioContext | null; gain: GainNode | null; node: AudioBufferSourceNode | null; level: number; muted: boolean }>({
    ctx: null, gain: null, node: null, level: 0, muted,
  });
  const apply = (seconds: number) => applyScoreGain(r.current, seconds);
  // Only when the mute setting changes — re-renders must not interrupt a ramp in progress.
  useEffect(() => { r.current.muted = muted; applyScoreGain(r.current, 0.3); }, [muted]);
  const start = (level: number, seconds: number) => {
    const s = r.current;
    if (s.ctx) return; // one instance only
    s.level = level;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
      s.ctx = ctx; s.gain = gain;
      const unlock = () => { ctx.resume().catch(() => {}); };
      if (ctx.state === "suspended") {
        unlock();
        window.addEventListener("pointerdown", unlock, { once: true });
        window.addEventListener("keydown", unlock, { once: true });
      }
      fetch(src)
        .then((res) => res.arrayBuffer())
        .then((buf) => ctx.decodeAudioData(buf))
        .then((buffer) => {
          if (s.ctx !== ctx) return; // stopped (or replaced) while decoding
          const node = ctx.createBufferSource();
          // Optional seam: blend the last `crossfade` s before loopEnd into the audio just before loopStart, so
          // the jump back is continuous (equal-power). Only the decoded copy in memory is changed.
          if (crossfade > 0 && loopEnd > loopStart && loopEnd <= buffer.duration) {
            const n = Math.floor(crossfade * buffer.sampleRate);
            const e0 = Math.floor(loopEnd * buffer.sampleRate) - n;
            const s0 = Math.floor(loopStart * buffer.sampleRate) - n;
            if (s0 >= 0) {
              for (let c = 0; c < buffer.numberOfChannels; c++) {
                const d = buffer.getChannelData(c);
                for (let i = 0; i < n; i++) {
                  const k = (i / n) * (Math.PI / 2);
                  d[e0 + i] = d[e0 + i] * Math.cos(k) + d[s0 + i] * Math.sin(k);
                }
              }
            }
          }
          node.buffer = buffer;
          node.loop = true;
          node.loopStart = loopStart;
          node.loopEnd = loopEnd > loopStart ? Math.min(loopEnd, buffer.duration) : buffer.duration;
          node.connect(gain);
          node.start(0, Math.min(offset, buffer.duration - 1)); // where the cue begins in the track
          s.node = node;
          apply(seconds);
        })
        .catch(() => {}); // no score: the picture carries on without it
    } catch { /* no Web Audio: silent */ }
  };
  const to = (level: number, seconds: number) => { r.current.level = level; apply(seconds); };
  /** Stop looping: the cue plays on from wherever it is (no restart). */
  const unloop = () => { if (r.current.node) r.current.node.loop = false; };
  const release = (seconds: number) => {
    // Fade the cue out while it keeps playing (still looping, so it can never run out mid-fade and cut off),
    // then end the source once it is inaudible.
    to(0, seconds);
    const { ctx, node } = r.current;
    if (ctx && node) { try { node.stop(ctx.currentTime + seconds * 1.5); } catch { /* already ended */ } }
  };
  const stop = () => {
    const s = r.current;
    try { s.node?.stop(); } catch { /* already ended */ }
    s.ctx?.close().catch(() => {});
    s.ctx = null; s.gain = null; s.node = null;
  };
  return { start, to, release, stop, unloop };
}

const OLIVE = "#B5C474";
const LETTERBOX = "max(7vh, 48px)";
const GRAIN = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

/**
 * A box with the photograph's aspect ratio that covers the viewport (like object-fit: cover, anchored at
 * fx/fy), so overlays can be placed in the photograph's own coordinates.
 */
function CoverBox({ aspect, fx, fy, children }: { aspect: number; fx: number; fy: number; children: ReactNode }) {
  const w = `max(100vw, ${aspect * 100}vh)`;
  const h = `max(100vh, ${100 / aspect}vw)`;
  return (
    <div className="absolute" style={{ width: w, height: h, left: `calc((100vw - ${w}) * ${fx})`, top: `calc((100vh - ${h}) * ${fy})` }}>
      {children}
    </div>
  );
}

function Still({ src, filter }: { src: string; filter?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- full-bleed still
  return <img src={src} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" style={{ filter }} />;
}

/** A slow camera move on one photograph: from → to over `ms` once `moving` is set (none if reduced). */
const moveStyle = (moving: boolean, reduced: boolean, from: string, to: string, ms: number, ease: string, origin: string): CSSProperties => ({
  transformOrigin: origin,
  transform: moving && !reduced ? to : from,
  transition: moving && !reduced ? `transform ${ms}ms ${ease}` : "none",
  willChange: "transform",
});

export default function FailedInspectionEpilogue({
  muted,
  onComplete,
  startAt = 0,
  film = NOT_SATISFACTORY_FILM,
}: {
  muted: boolean;
  /** Which epilogue to play (default: "Not satisfactory"). */
  film?: EpilogueFilm;
  /** Called once the closing card has faded to black after "Review Your Decisions". */
  onComplete: () => void;
  /** Review aid (preview route only): start this many seconds into part one. */
  startAt?: number;
}) {
  const [F] = useState(film); // fixed for the life of the sequence
  const T = F.timing, B = F.after, MUSIC = F.music, MIKE = F.message, CLOSING = F.closing;
  const V = F.volumes, SND = F.sounds;
  const [officeShown, setOfficeShown] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [message, setMessage] = useState<"none" | "in" | "closed">("none");
  const [screenLit, setScreenLit] = useState(false); // the screen brightens a touch as the message lands
  const [screenDim, setScreenDim] = useState(false);
  const [officeOut, setOfficeOut] = useState(false);
  const [exteriorShown, setExteriorShown] = useState(false);
  const [pullBack, setPullBack] = useState(false);
  const [exteriorOut, setExteriorOut] = useState(false);
  const [closing, setClosing] = useState(0); // 0 none · 1 title · 2 outcome · 3 sentence · 4 action
  const [leaving, setLeaving] = useState(false);
  const [reduced] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

  // --- sound ------------------------------------------------------------------------------------------
  const mutedRef = useRef(muted);
  const sounds = useRef<Record<string, HTMLAudioElement | null>>({});
  const all = useRef<HTMLAudioElement[]>([]);
  useEffect(() => {
    mutedRef.current = muted;
    all.current.forEach((a) => { a.muted = muted; });
  }, [muted]);
  const play = (src: string, volume: number, loop = false) => {
    try {
      const a = new Audio(src);
      a.volume = volume; a.loop = loop; a.muted = mutedRef.current;
      all.current.push(a);
      a.play().catch(() => {}); // blocked: the picture carries on without it
      return a;
    } catch { return null; }
  };
  const ramp = (a: HTMLAudioElement | null | undefined, to: number, ms: number) => {
    if (!a) return;
    const from = a.volume, t0 = performance.now();
    const step = (now: number) => {
      if (a.paused && to > 0) return;
      const k = Math.min(1, (now - t0) / ms);
      try { a.volume = Math.max(0, Math.min(1, from + (to - from) * k * k * (3 - 2 * k))); } catch { return; }
      if (k < 1) requestAnimationFrame(step);
      else if (to === 0) a.pause(); // faded out: stop it rather than play on silently
    };
    requestAnimationFrame(step);
  };

  const score = useScore(MUSIC.src, MUSIC.loopStart, MUSIC.loopEnd, muted, MUSIC.crossfade ?? 0, MUSIC.offset ?? 0);
  const scoreRef = useRef(score);
  useEffect(() => { scoreRef.current = score; });

  // --- the timeline -----------------------------------------------------------------------------------
  const timers = useRef<number[]>([]);
  const after = (sec: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, Math.max(0, sec * 1000))); };
  const completeRef = useRef(onComplete);
  useEffect(() => { completeRef.current = onComplete; });

  // Part one: the dark office, up to Mike's message (which then waits for the player).
  useEffect(() => {
    const s = sounds.current;
    const at = (sec: number, fn: () => void) => after(sec - startAt, fn);
    at(T.roomTone, () => {
      s.room = play(SND.roomTone, 0, true); ramp(s.room, V.roomTone, 2800);
      s.hum = play(SND.buildingHum, 0, true); ramp(s.hum, V.humOffice, 3500);
      scoreRef.current.start(MUSIC.office.level, MUSIC.office.ramp); // the tune, quietly, under the room
    });
    at(T.officeIn, () => setOfficeShown(true));
    at(T.officeIn + 0.05, () => setPushing(true));
    at(T.message, () => {
      setMessage("in");
      setScreenLit(true);
      play(SND.ping, V.ping); // the same Teams note as the rest of the day
      scoreRef.current.to(MUSIC.message.level, MUSIC.message.ramp); // ducked — still there, underneath
    });

    const ids = timers.current;
    const audio = all.current;
    const sc = scoreRef;
    return () => {
      ids.forEach((id) => window.clearTimeout(id));
      audio.forEach((a) => a.pause());
      sc.current.stop();
      timers.current = [];
      all.current = [];
      sounds.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Part two: from the moment the player closes the message.
  const closeMessage = () => {
    if (message !== "in") return;
    setMessage("closed");
    const s = sounds.current;
    if (MUSIC.loopOnlyWhileReading) score.unloop(); // the read is over: let the cue run on into its build
    after(B.musicReturn, () => score.to(MUSIC.afterMessage.level, MUSIC.afterMessage.ramp));
    after(B.screenDim, () => { setScreenLit(false); setScreenDim(true); });
    // The dimmed office holds (the music stays low), then fades away; the facility brings the music up.
    after(B.officeOut, () => { setOfficeOut(true); ramp(s.room, 0, 3400); ramp(s.hum, V.humExterior, 3400); score.to(MUSIC.officeOut.level, MUSIC.officeOut.ramp); });
    after(B.exteriorIn, () => { setExteriorShown(true); score.to(MUSIC.exterior.level, MUSIC.exterior.ramp); });
    after(B.move, () => setPullBack(true));
    after(B.exteriorOut, () => { setExteriorOut(true); ramp(s.hum, 0, 5500); score.to(MUSIC.exteriorOut.level, MUSIC.exteriorOut.ramp); });
    after(B.closingTitle, () => { setClosing(1); score.release(MUSIC.resolve); });
    after(B.closingOutcome, () => setClosing(2));
    after(B.closingSentence, () => setClosing(3));
    after(B.closingAction, () => setClosing(4));
  };

  const review = () => {
    if (leaving) return;
    setLeaving(true);
    all.current.forEach((a) => ramp(a, 0, 1100));
    score.to(0, 1.0);
    after(1.4, () => {
      all.current.forEach((a) => a.pause()); // nothing carries into the Decision Analysis
      score.stop();
      completeRef.current();
    });
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-black text-white" style={{ fontFamily: "var(--font-body)" }} aria-label="Epilogue">
      {/* 1 — the office, late evening. One composition: a slow push towards the laptop. */}
      <div
        className="absolute inset-0 transition-opacity ease-in-out"
        style={{ opacity: officeShown && !officeOut ? 1 : 0, transitionDuration: officeOut ? `${B.officeFade * 1000}ms` : "2200ms" }}
        aria-hidden="true"
      >
        <div className="absolute inset-0" style={moveStyle(pushing, reduced, F.office.move.from, F.office.move.to, T.pushDuration * 1000, F.office.move.ease, F.office.move.origin)}>
          <CoverBox aspect={F.office.aspect} fx={F.office.fx} fy={F.office.fy}>
            <Still src={F.office.src} filter={F.office.filter} />
            {F.office.overlay && <div className="absolute inset-0" style={{ background: F.office.overlay }} />}
            {/* The screen: a touch brighter as the message lands, then dimmed once it's closed. */}
            {F.office.screen && (<>
            <div className="absolute inset-0" style={{ filter: "blur(3px)" }}>
              <div
                className="absolute inset-0 mix-blend-screen transition-opacity duration-[900ms] ease-out"
                style={{ clipPath: F.office.screen.clip, background: "rgba(170,195,230,0.22)", opacity: screenLit ? 1 : 0 }}
              />
              <div
                className="absolute inset-0 transition-opacity ease-in-out"
                style={{ clipPath: F.office.screen.clip, background: "rgba(4,7,12,0.82)", opacity: screenDim ? 1 : 0, transitionDuration: `${B.screenDimFade * 1000}ms` }}
              />
            </div>
            {/* The screen's light on the desk and keyboard falls away with it. */}
            <div
              className="absolute inset-0 transition-opacity ease-in-out"
              style={{ background: F.office.screen.deskShadow, opacity: screenDim ? 1 : 0, transitionDuration: `${B.screenDimFade * 1000}ms` }}
            />
            </>)}
          </CoverBox>
        </div>
      </div>

      {/* 2 — the facility at dusk: held, then a slow pull-back. */}
      <div
        className="absolute inset-0 transition-opacity ease-in-out"
        style={{ opacity: exteriorShown && !exteriorOut ? 1 : 0, transitionDuration: exteriorOut ? `${B.exteriorFade * 1000}ms` : "2200ms" }}
        aria-hidden="true"
      >
        {/* The departure: a closer frame on the buildings, then an eased retreat to the whole picture (more road and
            forecourt in front, more sky above), a brief hold, and the fade. A still can only zoom out, not move
            through space — this is the restrained version of a camera backing away. */}
        <div className="absolute inset-0" style={moveStyle(pullBack, reduced, F.exterior.move.from, F.exterior.move.to, B.moveDuration * 1000, F.exterior.move.ease, F.exterior.move.origin)}>
          <CoverBox aspect={F.exterior.aspect} fx={F.exterior.fx} fy={F.exterior.fy}>
            <Still src={F.exterior.src} filter={F.exterior.filter} />
            {/* The grade: the lit glazing and the lamps are left alone. */}
            {F.exterior.overlay && <div className="absolute inset-0" style={{ background: F.exterior.overlay }} />}
          </CoverBox>
        </div>
      </div>

      {/* The film finish: vignette, letterbox, grain. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 75% at 50% 48%, rgba(0,0,0,0) 55%, rgba(3,5,8,0.5) 100%)" }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 bg-black" style={{ height: LETTERBOX }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 bg-black" style={{ height: LETTERBOX }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.07] mix-blend-overlay">
        <div
          className="absolute"
          style={{ inset: "-160px 0 0 -160px", width: "calc(100% + 320px)", height: "calc(100% + 320px)", backgroundImage: GRAIN, animation: reduced ? "none" : "epiGrain 0.9s steps(6) infinite" }}
        />
      </div>

      {/* Mike's message: the existing Teams card, waiting for the player. */}
      {message !== "none" && (
        <TeamsToast
          from={MIKE.from}
          role={MIKE.role}
          initials={MIKE.initials}
          colour={MIKE.colour}
          text={MIKE.text}
          shown={message === "in"}
          onClose={closeMessage}
          className="absolute right-4 sm:right-6"
          style={{ bottom: `calc(${LETTERBOX} + 16px)`, pointerEvents: message === "in" ? "auto" : "none" }}
          actions={
            <button type="button" onClick={closeMessage} className="rounded px-3 py-1 text-[12px] font-semibold text-[#5b5fc7] hover:bg-[#f0f0fa]">
              {MIKE.ack}
            </button>
          }
        />
      )}

      {/* 3 — the closing card: the only one. */}
      {closing > 0 && (
        <div className="absolute inset-0 grid place-items-center bg-black px-6 text-center transition-opacity duration-[1200ms] ease-in-out" style={{ opacity: leaving ? 0 : 1, animation: "epiFade 1600ms ease-out" }}>
          <div className="max-w-xl">
            <p className="text-[24px] font-light uppercase text-white/90 sm:text-[38px]" style={{ letterSpacing: "0.42em", paddingLeft: "0.42em" }}>
              {CLOSING.title}
            </p>
            <div className="mx-auto mt-5 h-px w-24" style={{ background: `${OLIVE}b3` }} />
            <p className="mt-12 text-[21px] font-light text-white/90 transition-opacity duration-[1400ms] ease-out sm:text-[26px]" style={{ opacity: closing >= 2 ? 1 : 0 }}>
              {CLOSING.outcome}
            </p>
            <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-white/55 transition-opacity duration-[1400ms] ease-out sm:text-[16px]" style={{ opacity: closing >= 3 ? 1 : 0 }}>
              {CLOSING.sentence}
            </p>
            <div className="mt-14 h-11">
              <button
                type="button"
                onClick={review}
                disabled={closing < 4 || leaving}
                className="rounded-full border border-white/20 px-6 py-2.5 text-[14px] tracking-[0.02em] text-white/85 transition-[opacity,background-color] duration-[1200ms] ease-out hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-default"
                style={{ opacity: closing >= 4 ? 1 : 0, outlineColor: OLIVE }}
                aria-hidden={closing < 4}
              >
                {CLOSING.action} <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes epiFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes epiGrain { 0% { transform: translate(0,0) } 20% { transform: translate(-40px,30px) } 40% { transform: translate(50px,-20px) } 60% { transform: translate(-20px,-50px) } 80% { transform: translate(30px,40px) } 100% { transform: translate(0,0) } }`}</style>
    </div>
  );
}
