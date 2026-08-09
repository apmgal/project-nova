"use client";

import { useEffect } from "react";
import { Heart, MessageCircle, Repeat2, Share } from "lucide-react";
import type { Flags, RiskInvestigationBank, RiskInvestigationQuestion } from "@/lib/nova/types";

interface SocialFeedPanelProps {
  bank: RiskInvestigationBank;
  flags: Flags;
  onAsk: (question: RiskInvestigationQuestion) => void;
  onContinue: () => void;
}

// Cosmetic-only per-post engagement numbers/handle/time, matching the same
// pattern as TeamsThreadPanel's TEAMS_META/EmailInboxPanel's EMAIL_DATES —
// nothing here carries engine meaning, kept local since nothing else reads
// it. Falls back to plausible-looking defaults for any post without an
// entry so new posts don't need a matching edit here to render.
const SOCIAL_META: Record<string, { handle: string; time: string; likes: number; comments: number; shares: number }> = {
  q_social_1: { handle: "@LocalWatchNow", time: "2h", likes: 340, comments: 128, shares: 512 },
};

const DEFAULT_SOCIAL_META = { handle: "@user", time: "1h", likes: 12, comments: 3, shares: 4 };

/**
 * Bespoke chrome for risk_investigation.json banks with
 * visualStyle: "social_feed" — a generic public post feed (not any real
 * platform's UI, deliberately neutral) for Act 4 event panel lead-ins like
 * EV-15's social media safety claim. Reuses the shared question/answer
 * shape: dimension is the handle/display name, answerText the post body.
 * Every post is visible at once, same "transcript not a quiz" reasoning as
 * TeamsThreadPanel — all questions are marked asked on mount.
 */
export default function SocialFeedPanel({ bank, flags, onAsk, onContinue }: SocialFeedPanelProps) {
  useEffect(() => {
    for (const question of bank.questions) {
      if (!flags[question.flagOnAsk]) onAsk(question);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bank]);

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-zinc-950 p-3">
      <div className="flex max-h-[400px] flex-col overflow-y-auto rounded-md border border-zinc-300 bg-white text-zinc-900">
        {bank.questions.map((post) => {
          const meta = SOCIAL_META[post.id] ?? DEFAULT_SOCIAL_META;
          return (
            <div key={post.id} className="flex gap-2.5 border-b border-zinc-100 px-4 py-3.5 last:border-b-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-[11px] font-semibold text-white">
                {post.dimension.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-[12px]">
                  <span className="font-semibold text-[#0f1419]">{post.dimension}</span>{" "}
                  <span className="text-[#536471]">{meta.handle}</span>{" "}
                  <span className="text-[#536471]">· {meta.time}</span>
                </p>
                <p className="whitespace-pre-line text-[13px] leading-relaxed text-[#0f1419]">
                  {post.answerText}
                </p>
                <div className="mt-2 flex gap-5 text-[#536471]">
                  <span className="flex items-center gap-1 text-[11px]">
                    <MessageCircle size={13} /> {meta.comments}
                  </span>
                  <span className="flex items-center gap-1 text-[11px]">
                    <Repeat2 size={13} /> {meta.shares}
                  </span>
                  <span className="flex items-center gap-1 text-[11px]">
                    <Heart size={13} /> {meta.likes}
                  </span>
                  <span className="flex items-center gap-1 text-[11px]">
                    <Share size={13} />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end">
        <button
          onClick={onContinue}
          className="rounded-md bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Continue ▸
        </button>
      </div>
    </div>
  );
}
