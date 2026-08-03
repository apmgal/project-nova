"use client";

import { useState } from "react";
import type { Flags, RiskInvestigationBank, RiskInvestigationQuestion } from "@/lib/nova/types";

interface EmailInboxPanelProps {
  bank: RiskInvestigationBank;
  flags: Flags;
  onAsk: (question: RiskInvestigationQuestion) => void;
  onContinue: () => void;
}

// Cosmetic-only: the date shown next to each message in the list, and the
// folder rail's decorative Inbox/Sent Items/Drafts/Archive labels below.
// Neither carries any engine meaning — this is chrome dressing to match the
// approved Outlook-desktop mockup, kept local rather than added to the
// content schema since nothing else needs to read it.
const EMAIL_DATES: Record<string, string> = {
  q_email_ellis: "3 Apr",
  q_email_camille: "14 Apr",
  q_email_tomasz: "2 May",
};

/**
 * Bespoke chrome for risk_investigation.json banks with
 * visualStyle: "outlook_inbox" — mirrors the real Outlook desktop app's
 * folder rail + message list + reading pane, re-themed as a light card
 * floating on the game's dark background (matching the approved mockup).
 * Reuses the shared question/answer shape: dimension is the sender,
 * questionText the subject line, answerText the body. Nothing here is
 * gated behind maxQuestions — these are optional colour, not a quiz, so
 * Continue is always available.
 */
export default function EmailInboxPanel({ bank, flags, onAsk, onContinue }: EmailInboxPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(bank.questions[0]?.id ?? null);
  const selected = bank.questions.find((q) => q.id === selectedId) ?? null;

  function handleSelect(question: RiskInvestigationQuestion) {
    setSelectedId(question.id);
    if (!flags[question.flagOnAsk]) onAsk(question);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-zinc-950 p-3">
      {bank.instructions && <p className="px-1 text-sm text-zinc-300">{bank.instructions}</p>}
      <div className="flex h-[360px] overflow-hidden rounded-md border border-zinc-300 bg-white text-zinc-900">
        <div className="w-[110px] shrink-0 border-r border-zinc-200 bg-[#f3f2f1] py-3">
          <div className="bg-[#0078d4] px-3.5 py-1.5 text-[12px] font-semibold text-white">Inbox</div>
          <div className="px-3.5 py-1.5 text-[12px] text-[#3b3a39]">Sent Items</div>
          <div className="px-3.5 py-1.5 text-[12px] text-[#3b3a39]">Drafts</div>
          <div className="px-3.5 py-1.5 text-[12px] text-[#3b3a39]">Archive</div>
        </div>

        <ul className="w-[210px] shrink-0 overflow-y-auto border-r border-zinc-200">
          {bank.questions.map((question) => {
            const active = question.id === selectedId;
            return (
              <li key={question.id}>
                <button
                  onClick={() => handleSelect(question)}
                  className={`flex w-full flex-col gap-0.5 border-b border-[#edebe9] px-3 py-2.5 text-left ${
                    active ? "border-l-[3px] border-l-[#0078d4] bg-[#f3f9fd]" : "hover:bg-[#f5f5f5]"
                  }`}
                >
                  <span className="flex justify-between gap-2">
                    <span className="truncate text-[12px] font-semibold text-[#201f1e]">
                      {question.dimension}
                    </span>
                    <span className="shrink-0 text-[10px] text-[#605e5c]">
                      {EMAIL_DATES[question.id] ?? ""}
                    </span>
                  </span>
                  <span className="truncate text-[12px] text-[#201f1e]">{question.questionText}</span>
                  <span className="truncate text-[11px] text-[#605e5c]">
                    {question.answerText.split("\n")[0]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {selected && (
            <div className="flex flex-col gap-1">
              <p className="text-[15px] font-semibold text-[#201f1e]">{selected.questionText}</p>
              <p className="mb-2 text-[12px] text-[#605e5c]">{selected.dimension}</p>
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-[#323130]">
                {selected.answerText}
              </p>
            </div>
          )}
        </div>
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
