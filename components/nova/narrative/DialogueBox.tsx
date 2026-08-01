"use client";

import { useEffect, useRef } from "react";

interface DialogueBoxProps {
  /** Display name, or null for unattributed narrator text. */
  speakerName: string | null;
  text: string;
  /** Optional voice-over clip for the current line — played once,
   * best-effort, whenever `text` changes. A missing/absent clip is a
   * silent no-op; the text still displays and the scene advances
   * normally either way, so voiceover is purely additive. */
  voiceSrc?: string;
  onAdvance: () => void;
  /** Current line / total lines, shown as a small progress hint. */
  lineNumber: number;
  lineCount: number;
}

/**
 * Bottom-anchored dialogue box: name plate, text, Continue action. Knows
 * nothing about scenes, characters, or story content beyond the current
 * line it's handed — a future scene just renders the same component with
 * different props.
 */
export default function DialogueBox({
  speakerName,
  text,
  voiceSrc,
  onAdvance,
  lineNumber,
  lineCount,
}: DialogueBoxProps) {
  const voiceRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    voiceRef.current?.pause();
    if (!voiceSrc) {
      voiceRef.current = null;
      return;
    }
    const audio = new Audio(voiceSrc);
    voiceRef.current = audio;
    audio.play().catch(() => {
      // No voice track present, or autoplay blocked — the text is already
      // on screen either way, so this is a silent no-op by design.
    });
    return () => {
      audio.pause();
    };
  }, [voiceSrc, text]);

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-3 sm:px-8 sm:pb-8">
      <button
        onClick={onAdvance}
        className="animate-nova-scene-fade-in w-full max-w-3xl rounded-lg border border-zinc-700/80 bg-zinc-900/95 p-5 text-left shadow-[0_12px_32px_rgba(0,0,0,0.55)] backdrop-blur-sm transition-colors hover:border-zinc-600 sm:p-6"
      >
        <div className="mb-2 flex items-center justify-between">
          {speakerName ? (
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-sky-500" aria-hidden />
              <span className="text-sm font-semibold uppercase tracking-wide text-sky-300">
                {speakerName}
              </span>
            </div>
          ) : (
            <span className="text-xs italic uppercase tracking-wide text-zinc-500">Narrator</span>
          )}
          <span className="text-[11px] text-zinc-600">
            {lineNumber} / {lineCount}
          </span>
        </div>

        <p key={text} className="animate-nova-scene-fade-in text-base leading-relaxed text-zinc-100 sm:text-lg">
          {text}
        </p>

        <div className="mt-4 flex items-center justify-end gap-1.5 text-xs font-medium text-zinc-400">
          <span>{lineNumber < lineCount ? "Continue" : "Begin"}</span>
          <span aria-hidden>▸</span>
        </div>
      </button>
    </div>
  );
}
