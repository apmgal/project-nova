"use client";

import { useEffect } from "react";
import { MessagesSquare } from "lucide-react";
import type { Flags, RiskInvestigationBank, RiskInvestigationQuestion } from "@/lib/nova/types";

interface TeamsThreadPanelProps {
  bank: RiskInvestigationBank;
  flags: Flags;
  onAsk: (question: RiskInvestigationQuestion) => void;
  onContinue: () => void;
}

/**
 * Bespoke chrome for risk_investigation.json banks with
 * visualStyle: "teams_thread" — a read-only channel log instead of the
 * generic tap-to-reveal panel. Every message is visible at once (it's a
 * transcript, not a quiz), so all questions are marked asked on mount.
 * Field mapping onto the shared question shape: dimension is the sender's
 * display name, questionText (optional) is a quoted snippet shown above
 * the bubble for a reply-to-message, answerText is the message body.
 */
export default function TeamsThreadPanel({ bank, flags, onAsk, onContinue }: TeamsThreadPanelProps) {
  useEffect(() => {
    for (const question of bank.questions) {
      if (!flags[question.flagOnAsk]) onAsk(question);
    }
    // Only needs to run once per bank mount — re-running on every flags
    // change would be a no-op anyway since onAsk already guards on flagOnAsk.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bank]);

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/90">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2.5">
        <MessagesSquare size={15} className="text-emerald-400" />
        <span className="text-[12px] font-semibold text-zinc-200">Project NOVA</span>
        <span className="text-[11px] text-zinc-500">Team channel</span>
      </div>
      <div className="flex h-72 flex-col gap-3 overflow-y-auto px-4 py-3">
        {bank.questions.map((message) => (
          <div key={message.id} className="flex flex-col gap-1">
            {message.questionText && (
              <div className="ml-9 rounded-md border-l-2 border-zinc-700 bg-zinc-800/50 px-2 py-1 text-[11px] italic text-zinc-500">
                {message.questionText}
              </div>
            )}
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-[10px] font-semibold text-zinc-200">
                {message.dimension
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-[12px] font-semibold text-zinc-200">{message.dimension}</span>
                <span className="text-[13px] leading-relaxed text-zinc-300">{message.answerText}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end border-t border-zinc-800 px-4 py-3">
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
