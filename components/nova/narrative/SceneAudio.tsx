"use client";

import { useEffect, useRef } from "react";

interface SceneAudioProps {
  /** Track to play. Passing null plays nothing (any currently-playing
   * track owned by this instance fades out and stops). */
  src: string | null;
  /** Target volume once fade-in completes, 0-1. */
  volume?: number;
  /** Native looping — the browser just repeats whatever file is given, so
   * swapping in a longer or shorter track later needs no code change
   * here; nothing about the fade/loop logic hardcodes a duration. */
  loop?: boolean;
  fadeInMs?: number;
  fadeOutMs?: number;
}

/**
 * Reusable, scene-agnostic background-music player. Renders nothing — it
 * owns a plain HTMLAudioElement created imperatively (not JSX), so its
 * fade-out can keep running for `fadeOutMs` after the owning component
 * unmounts (e.g. when a scene transitions to the next one) without being
 * cut off by React tearing down the DOM. Each `SceneAudio` instance only
 * ever manages the one track it was told to play; mounting a new instance
 * for the next scene while this one's fade-out is still finishing is what
 * produces a natural crossfade between scenes.
 *
 * Autoplay-with-sound is blocked by most browsers until a user gesture
 * has occurred on the page; `.play()`'s rejection is swallowed here so a
 * scene that starts before any click just plays silently until the first
 * click (e.g. the player's first "Continue" tap), rather than throwing.
 */
export default function SceneAudio({
  src,
  volume = 0.55,
  loop = true,
  fadeInMs = 1800,
  fadeOutMs = 1200,
}: SceneAudioProps) {
  // Kept in a ref (not state) because none of this should ever trigger a
  // re-render — it's a side effect running alongside whatever the rest of
  // the scene is doing.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Fade helper: ramps the given element's volume from its current value
  // to `target` over `durationMs`, using elapsed wall-clock time (not a
  // fixed step count) so the ramp is smooth regardless of frame rate.
  // `onDone` fires once, after the last frame — used to pause/release the
  // element once a fade-out reaches zero.
  function fadeTo(audio: HTMLAudioElement, target: number, durationMs: number, onDone?: () => void) {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const start = audio.volume;
    const startTime = performance.now();

    function step(now: number) {
      const elapsed = now - startTime;
      const t = durationMs <= 0 ? 1 : Math.min(1, elapsed / durationMs);
      audio.volume = start + (target - start) * t;
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
        onDone?.();
      }
    }
    rafRef.current = requestAnimationFrame(step);
  }

  useEffect(() => {
    if (!src) return;

    const audio = new Audio(src);
    audio.loop = loop;
    audio.volume = 0;
    audioRef.current = audio;

    let unlock: (() => void) | null = null;
    audio.play().catch(() => {
      // Autoplay-with-sound was blocked. Retry once on the first user
      // gesture anywhere on the page (e.g. the player's first "Continue"
      // click) rather than leaving the track silent for the rest of the
      // scene.
      unlock = () => {
        audio.play().catch(() => {});
      };
      window.addEventListener("pointerdown", unlock, { once: true });
      window.addEventListener("keydown", unlock, { once: true });
    });
    fadeTo(audio, volume, fadeInMs);

    return () => {
      if (unlock) {
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("keydown", unlock);
      }
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      // Fade this exact element out in place, then release it. Not tied
      // to component/DOM lifecycle — a bare setTimeout/rAF loop keeps
      // running after unmount just fine.
      fadeTo(audio, 0, fadeOutMs, () => {
        audio.pause();
        audio.src = "";
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Target volume can change without swapping tracks (e.g. a scene wants
  // to duck the music) — ramp to it gently rather than restarting.
  useEffect(() => {
    if (!audioRef.current) return;
    fadeTo(audioRef.current, volume, 400);
  }, [volume]);

  return null;
}
