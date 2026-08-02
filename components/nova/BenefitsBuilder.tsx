"use client";

import { useState } from "react";
import type { BenefitTensionMoment, ToolBenefit, ToolScreenBlock } from "@/lib/nova/types";
import { benefitFieldId } from "@/lib/nova/state";
import { useConceptHint, ConceptHintButton, ConceptHintPanel } from "./ConceptHint";
import { ResetToolButton } from "./ResetTool";

interface BenefitsBuilderProps {
  toolScreen: ToolScreenBlock;
  builtFieldIds: string[];
  onBuildField: (benefitId: string, field: string) => void;
  pmConcept?: string;
  onReset: () => void;
}

/**
 * "proof_chain_builder" (Benefits Register) — builds Measure and Evidence
 * per benefit. Every field now carries its own tension moment (Measure
 * and Evidence independently) — a real 2-option choice between a
 * tempting-but-wrong pick and the correct one, with a corrective reaction
 * line on the wrong pick and no penalty, same spirit as every other
 * tool's wrong-placement bounce-back (PESTLE, SWOT, WBS...). A field
 * without a tensionMoment in the data falls back to a plain guided
 * reveal. Owner and When Measurable are never player-built — they're
 * just shown, read-only, once a benefit's Measure and Evidence are both
 * in place.
 */
export default function BenefitsBuilder({
  toolScreen,
  builtFieldIds,
  onBuildField,
  pmConcept,
  onReset,
}: BenefitsBuilderProps) {
  const benefits = toolScreen.benefits ?? [];
  const builtSet = new Set(builtFieldIds);
  const [wrongPick, setWrongPick] = useState<string | null>(null);
  const hint = useConceptHint(pmConcept);

  // wrongPick is local UI-only state (which field's tension moment is
  // showing its corrective reaction) — clear it alongside the underlying
  // progress so a stale reaction line can't linger after reset.
  function handleReset() {
    setWrongPick(null);
    onReset();
  }

  function renderField(
    benefit: ToolBenefit,
    field: "Measure" | "Evidence",
    tension: BenefitTensionMoment | undefined,
    correctText: string | undefined
  ) {
    const fieldId = benefitFieldId(benefit.id, field);
    const built = builtSet.has(fieldId);

    return (
      <div className="flex flex-col gap-1 text-xs">
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">{field}</span>
        {built ? (
          <span className="rounded bg-emerald-950/40 px-2 py-1 text-emerald-300">
            ✓ {correctText}
          </span>
        ) : tension ? (
          <div className="flex flex-col gap-1">
            {tension.marcusLine && (
              <p className="italic text-zinc-400">Mike E.: “{tension.marcusLine}”</p>
            )}
            {tension.camilleLine && (
              <p className="italic text-zinc-400">Camille: “{tension.camilleLine}”</p>
            )}
            {wrongPick === fieldId && (
              <p className="rounded border border-amber-700/50 bg-amber-950/40 px-2 py-1 text-amber-200">
                {tension.reaction}
              </p>
            )}
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setWrongPick(fieldId)}
                className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-left text-zinc-200 hover:border-zinc-500"
              >
                {tension.wrongOption}
              </button>
              <button
                onClick={() => {
                  setWrongPick(null);
                  onBuildField(benefit.id, field);
                }}
                className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-left text-zinc-200 hover:border-emerald-500"
              >
                {tension.correctOption}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => onBuildField(benefit.id, field)}
            className="w-fit rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-zinc-200 hover:border-emerald-500"
          >
            Build {field}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900/90 p-4">
      {(toolScreen.instructions || pmConcept) && (
        <div className="flex items-start justify-between gap-3">
          {toolScreen.instructions && (
            <p className="text-sm text-zinc-300">{toolScreen.instructions}</p>
          )}
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <ConceptHintButton entry={hint.entry} open={hint.open} onToggle={hint.toggle} />
            <ResetToolButton onReset={handleReset} />
          </div>
        </div>
      )}
      <ConceptHintPanel entry={hint.entry} open={hint.open} onClose={hint.close} />

      {benefits.map((benefit) => {
        const measureId = benefitFieldId(benefit.id, "Measure");
        const evidenceId = benefitFieldId(benefit.id, "Evidence");
        const chainComplete = builtSet.has(measureId) && builtSet.has(evidenceId);

        return (
          <div
            key={benefit.id}
            className="flex flex-col gap-2 rounded-md border border-zinc-700 bg-zinc-950/40 p-3"
          >
            <div className="text-sm font-semibold text-zinc-100">{benefit.text}</div>

            {renderField(benefit, "Measure", benefit.measureTensionMoment, benefit.correctMeasure)}
            {renderField(benefit, "Evidence", benefit.evidenceTensionMoment, benefit.correctEvidence)}

            {chainComplete && (
              <div className="flex gap-4 border-t border-zinc-800 pt-2 text-[11px] text-zinc-400">
                <span>
                  Owner: <span className="text-zinc-200">{benefit.correctOwner}</span>
                </span>
                <span>
                  When measurable: <span className="text-zinc-200">{benefit.correctWhen}</span>
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
