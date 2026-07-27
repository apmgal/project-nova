"use client";

import type { Flags, RiskInvestigationBank, RiskInvestigationQuestion } from "@/lib/nova/types";
import { countAskedQuestions } from "@/lib/nova/state";

interface RiskInvestigationPanelProps {
  bank: RiskInvestigationBank;
  flags: Flags;
  onAsk: (question: RiskInvestigationQuestion) => void;
  onContinue: () => void;
}

/**
 * "Pick maxQuestions of the bank's questions, see each answer" interstitial
 * that plays in front of a choice referencing it via riskInvestigationId.
 * Generic over any bank shape — doesn't know these are risks, dimensions,
 * or which characters are involved beyond what the data tells it.
 */
export default function RiskInvestigationPanel({
  bank,
  flags,
  onAsk,
  onContinue,
}: RiskInvestigationPanelProps) {
  const askedCount = countAskedQuestions(bank, flags);
  const locked = askedCount >= bank.maxQuestions;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/90 p-4">
      {bank.instructions && <p className="text-sm text-zinc-300">{bank.instructions}</p>}
      <div className="flex flex-col gap-2">
        {bank.questions.map((question) => {
          const wasAsked = Boolean(flags[question.flagOnAsk]);
          const isDisabled = !wasAsked && locked;
          return (
            <div
              key={question.id}
              className={`rounded-md border px-4 py-3 text-sm transition-colors ${
                wasAsked
                  ? "border-emerald-700/60 bg-emerald-950/30"
                  : isDisabled
                    ? "border-zinc-800 bg-zinc-900/60 opacity-50"
                    : "border-zinc-700 bg-zinc-800/80"
              }`}
            >
              {wasAsked ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-emerald-400">
                    {question.dimension}
                  </span>
                  <span className="text-zinc-100">{question.questionText}</span>
                  <span className="italic text-zinc-300">{question.answerText}</span>
                </div>
              ) : (
                <button
                  onClick={() => onAsk(question)}
                  disabled={isDisabled}
                  className={`flex w-full flex-col gap-1 text-left ${
                    isDisabled ? "cursor-not-allowed" : "hover:text-emerald-300"
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                    {question.dimension}
                  </span>
                  <span>{question.questionText}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
      {locked && (
        <div className="flex justify-end">
          <button
            onClick={onContinue}
            className="rounded-md bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Continue ▸
          </button>
        </div>
      )}
    </div>
  );
}
