"use client";

import type { ReactNode } from "react";
import type { DialogueLine } from "@/lib/nova/types";

interface AnnouncementCardProps {
  lines: DialogueLine[];
  actionContent: ReactNode;
}

/**
 * Renders a scene whose `displayStyle` is "announcement" (e.g.
 * ACT3_SCENE06B, "Baseline Approved") as a single dramatic beat instead
 * of the normal one-line-at-a-time dialogue transcript: every line pops
 * in together (same animation, same start time), rather than being
 * click-revealed sequentially.
 *
 * A line authored with `style: "header"` renders as the big headline; a
 * line authored with `style: "badge"` renders as a pill; everything else
 * is an italic subline. Badge detection used to sniff the line's own text
 * for a "Week X / Y" shape instead of an explicit style tag — that broke
 * the moment the copy was reworded to something that no longer looked like
 * a week counter (see DIALOGUE_ACT3_SCENE06B's engineNote), so content and
 * presentation are now decoupled the same way "header" already was.
 *
 * GameRoot fast-forwards lineIndex straight past every line for
 * announcement scenes (see resolveInitialLineIndex), so by the time this
 * renders, `lines` is the complete set and `actionContent` (the scene's
 * Continue button, or whatever it would normally resolve to) is already
 * live — there's no separate "click to reveal the button" step.
 */
export default function AnnouncementCard({ lines, actionContent }: AnnouncementCardProps) {
  return (
    <div className="flex flex-col items-center gap-5 rounded-lg border border-zinc-800 bg-zinc-950 px-8 py-14 text-center">
      <div className="h-0.5 w-16 origin-center animate-nova-rule-reveal bg-emerald-500" />

      {lines.map((line, i) => {
        if (line.style === "header") {
          return (
            <div
              key={i}
              className="animate-nova-announce-pop text-3xl font-semibold uppercase tracking-wide text-zinc-100 sm:text-4xl"
            >
              {line.text}
            </div>
          );
        }
        if (line.style === "badge") {
          return (
            <div
              key={i}
              className="animate-nova-announce-pop rounded-full border border-emerald-700/50 bg-emerald-950/40 px-4 py-1.5 text-sm font-semibold text-emerald-300"
            >
              {line.text}
            </div>
          );
        }
        return (
          <p key={i} className="animate-nova-announce-pop text-lg italic text-zinc-400">
            {line.text}
          </p>
        );
      })}

      <div className="mt-2 w-full animate-nova-hint-fade">{actionContent}</div>
    </div>
  );
}
