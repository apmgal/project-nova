"use client";

import { useState } from "react";
import type { ToolScreenBlock } from "@/lib/nova/types";
import { benefitFieldId } from "@/lib/nova/state";

interface BenefitsBuilderProps {
  toolScreen: ToolScreenBlock;
  builtFieldIds: string[];
  onBuildField: (benefitId: string, field: string) => void;
}

/**
 * "proof_chain_builder" (Benefits Register) — builds Measure and Evidence
 * per benefit. Where the data defines a tensionMoment (currently just
 * "More Patients Treated"'s Measure), that field is a real 2-option choice
 * with a correcting reaction on the wrong pick and no penalty, same spirit
 * as every other tool's wrong-placement bounce-back. Every other field has
 * no listed alternative in the data, so it's a guided reveal: tap once,
 * see the correct answer. Owner and When Measurable are never player-built
 * — they're just shown, read-only, once a benefit's Measure and Evidence
 * are both in place.
 */
export default function BenefitsBuilder({
  toolScreen,
  builtFieldIds,
  onBuildField,
}: BenefitsBuilderProps) {
  const benefits = toolScreen.benefits ?? [];
  const builtSet = new Set(builtFieldIds);
  const [wrongPick, setWrongPick] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900/90 p-4">
      {toolScreen.instructions && (
        <p className="text-sm text-zinc-300">{toolScreen.instructions}</p>
      )}

      {benefits.map((benefit) => {
        const measureId = benefitFieldId(benefit.id, "Measure");
        const evidenceId = benefitFieldId(benefit.id, "Evidence");
        const measureBuilt = builtSet.has(measureId);
        const evidenceBuilt = builtSet.has(evidenceId);
        const chainComplete = measureBuilt && evidenceBuilt;
        const tension = benefit.tensionMoment;

        return (
          <div
            key={benefit.id}
            className="flex flex-col gap-2 rounded-md border border-zinc-700 bg-zinc-950/40 p-3"
          >
            <div className="text-sm font-semibold text-zinc-100">{benefit.text}</div>

            <div className="flex flex-col gap-1 text-xs">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">Measure</span>
              {measureBuilt ? (
                <span className="rounded bg-emerald-950/40 px-2 py-1 text-emerald-300">
                  ✓ {benefit.correctMeasure}
                </span>
              ) : tension ? (
                <div className="flex flex-col gap-1">
                  {tension.marcusLine && (
                    <p className="italic text-zinc-400">Marcus: “{tension.marcusLine}”</p>
                  )}
                  {tension.camilleLine && (
                    <p className="italic text-zinc-400">Camille: “{tension.camilleLine}”</p>
                  )}
                  {wrongPick === measureId && (
                    <p className="rounded border border-amber-700/50 bg-amber-950/40 px-2 py-1 text-amber-200">
                      Facility completion tells you the building&rsquo;s finished. It doesn&rsquo;t
                      tell you anyone&rsquo;s been treated.
                    </p>
                  )}
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => setWrongPick(measureId)}
                      className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-left text-zinc-200 hover:border-zinc-500"
                    >
                      {tension.wrongOption}
                    </button>
                    <button
                      onClick={() => {
                        setWrongPick(null);
                        onBuildField(benefit.id, "Measure");
                      }}
                      className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-left text-zinc-200 hover:border-emerald-500"
                    >
                      {tension.correctOption}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => onBuildField(benefit.id, "Measure")}
                  className="w-fit rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-zinc-200 hover:border-emerald-500"
                >
                  Build Measure
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1 text-xs">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">Evidence</span>
              {evidenceBuilt ? (
                <span className="rounded bg-emerald-950/40 px-2 py-1 text-emerald-300">
                  ✓ {benefit.correctEvidence}
                </span>
              ) : (
                <button
                  onClick={() => onBuildField(benefit.id, "Evidence")}
                  className="w-fit rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-zinc-200 hover:border-emerald-500"
                >
                  Build Evidence
                </button>
              )}
            </div>

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
