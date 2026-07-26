"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Image from "next/image";
import { getCharacter } from "@/lib/nova/data";
import { resolvePortrait, speakerColor } from "@/lib/nova/state";
import type { DialogueLine, Relationships } from "@/lib/nova/types";

interface DialogueTranscriptProps {
  sceneAct: string;
  sceneTitle: string;
  lines: DialogueLine[];
  revealedCount: number;
  relationships: Relationships;
  inDialogue: boolean;
  onAdvance: () => void;
  actionContent: ReactNode;
}

function displayName(speakerId: string): string {
  if (speakerId === "narrator") return "Narrator";
  return getCharacter(speakerId)?.name ?? speakerId;
}

/**
 * Per-scene scrollback transcript: every line revealed so far in the
 * current scene accumulates here (instead of replacing the previous line),
 * with a stack of portraits for whichever characters have spoken. Resets
 * naturally each time GameRoot mounts a new scene, since `lines` and
 * `revealedCount` are scoped to the current scene only.
 */
export default function DialogueTranscript({
  sceneAct,
  sceneTitle,
  lines,
  revealedCount,
  relationships,
  inDialogue,
  onAdvance,
  actionContent,
}: DialogueTranscriptProps) {
  const revealed = lines.slice(0, revealedCount);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [revealedCount]);

  const speakerOrder: string[] = [];
  const lastEmotion: Record<string, string | null> = {};
  for (const line of revealed) {
    if (line.speaker === "narrator") continue;
    if (!speakerOrder.includes(line.speaker)) speakerOrder.push(line.speaker);
    lastEmotion[line.speaker] = line.emotion;
  }

  return (
    <div className="flex flex-col rounded-lg border border-zinc-800 bg-zinc-900/95 p-4">
      <div className="mb-3 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
        {sceneAct} — {sceneTitle}
      </div>

      <div className="flex gap-4">
        <div className="flex flex-shrink-0 flex-col gap-2">
          {speakerOrder.map((id) => {
            const resolved = resolvePortrait(id, lastEmotion[id] ?? null, relationships[id]);
            return (
              <div
                key={id}
                title={displayName(id)}
                className="relative h-10 w-10 overflow-hidden rounded-full bg-zinc-700"
              >
                {resolved?.src ? (
                  <Image src={resolved.src} alt={displayName(id)} fill sizes="40px" className="object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-sm font-medium text-zinc-200">
                    {displayName(id).slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div
          ref={scrollRef}
          onClick={inDialogue ? onAdvance : undefined}
          className={`flex max-h-[45vh] flex-1 flex-col gap-3 overflow-y-auto ${
            inDialogue ? "cursor-pointer" : ""
          }`}
        >
          {revealed.map((line, i) => (
            <p
              key={i}
              className={line.speaker === "narrator" ? "italic text-zinc-400" : "text-zinc-100"}
            >
              {line.speaker !== "narrator" && (
                <span style={{ color: speakerColor(line.speaker) }} className="font-medium">
                  {displayName(line.speaker)}:{" "}
                </span>
              )}
              {line.text}
            </p>
          ))}

          {inDialogue && (
            <div className="mt-1 flex justify-end">
              <span className="text-xs text-zinc-500">Click to continue ▸</span>
            </div>
          )}
        </div>
      </div>

      {!inDialogue && <div className="mt-4 border-t border-zinc-800 pt-4">{actionContent}</div>}
    </div>
  );
}
