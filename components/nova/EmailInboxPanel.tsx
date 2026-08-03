"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import type { Flags, RiskInvestigationBank, RiskInvestigationQuestion } from "@/lib/nova/types";

interface EmailInboxPanelProps {
  bank: RiskInvestigationBank;
  flags: Flags;
  onAsk: (question: RiskInvestigationQuestion) => void;
  onContinue: () => void;
}

/**
 * Bespoke chrome for risk_investigation.json banks with
 * visualStyle: "outlook_inbox" — a two-pane inbox (message list + reading
 * pane) instead of the generic RiskInvestigationPanel list. Reuses the same
 * underlying question/answer shape: dimension is the sender, questionText
 * the subject line, answerText the body. Unlike the generic panel, nothing
 * here is gated behind maxQuestions — these are optional colour, not a
 * quiz, so Continue is always available.
 */
export default function EmailInboxPanel({ bank, flags, onAsk, onContinue }: EmailInboxPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = bank.questions.find((q) => q.id === selectedId) ?? null;

  function handleSelect(question: RiskInvestigationQuestion) {
    setSelectedId(question.id);
    if (!flags[question.flagOnAsk]) onAsk(question);
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/90">
      {bank.instructions && <p className="px-4 pt-3 text-sm text-zinc-300">{bank.instructions}</p>}
      <div className="flex h-72 divide-x divide-zinc-800">
        <ul className="w-2/5 min-w-[170px] overflow-y-auto">
          {bank.questions.map((question) => {
            const read = Boolean(flags[question.flagOnAsk]);
            const active = question.id === selectedId;
            return (
              <li key={question.id}>
                <button
                  onClick={() => handleSelect(question)}
                  className={`flex w-full flex-col gap-0.5 border-b border-zinc-800/70 px-3 py-2.5 text-left transition-colors ${
                    active ? "bg-zinc-800" : "hover:bg-zinc-800/60"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {!read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />}
                    <span
                      className={`truncate text-[12px] ${read ? "text-zinc-400" : "font-semibold text-zinc-100"}`}
                    >
                      {question.dimension}
                    </span>
                  </span>
                  <span className={`truncate text-[12px] ${read ? "text-zinc-500" : "text-zinc-300"}`}>
                    {question.questionText}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex-1 overflow-y-auto p-4">
          {selected ? (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] uppercase tracking-wide text-zinc-500">From</span>
              <span className="text-sm font-semibold text-zinc-100">{selected.dimension}</span>
              <span className="mt-1 text-[13px] font-medium text-zinc-200">{selected.questionText}</span>
              <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-zinc-300">
                {selected.answerText}
              </p>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-600">
              <Mail size={20} />
              <span className="text-[12px]">Select a message to read it.</span>
            </div>
          )}
        </div>
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
