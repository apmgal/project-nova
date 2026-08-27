"use client";

import type { GameState, ToolScreenBlock } from "@/lib/nova/types";
import { computeInspectionExhibit } from "@/lib/nova/state";

interface InspectionEvidenceExhibitProps {
  toolScreen: ToolScreenBlock;
  gameState: GameState;
  onContinue: () => void;
}

const NAVY = "#1f3864";
const LINE = "#c9c9c9";

/**
 * "inspection_evidence_exhibit" (ACT5_SCENE03) — the closing exhibit screen
 * for Whitfield's inspection. Deliberately ONE consolidated screen shown
 * after all four questions rather than four inline pull-ups interleaved
 * with the dialogue: it reuses the same single-toolId-per-scene
 * architecture as every other tool screen, and keeps the Audit Trail
 * Builder and this viewer independent build steps rather than making one a
 * prerequisite for the other. Read-only — there's nothing to submit,
 * just a "Continue" once the player has looked at what Whitfield reviewed.
 */
export default function InspectionEvidenceExhibit({
  toolScreen,
  gameState,
  onContinue,
}: InspectionEvidenceExhibitProps) {
  const items = computeInspectionExhibit(gameState);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/90 p-4">
      {toolScreen.instructions && <p className="text-sm text-zinc-300">{toolScreen.instructions}</p>}

      <div
        className="rounded border border-[#c9c9c9] bg-white p-4 text-[#1a1a1a]"
        style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 11 }}
      >
        <h3
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            color: NAVY,
            fontSize: 15,
            fontWeight: 700,
            margin: "0 0 10px 0",
          }}
        >
          MHRA Inspection — Evidence Reviewed
        </h3>

        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div key={item.id} className="rounded px-2.5 py-2" style={{ border: `1px solid ${LINE}` }}>
              <div className="text-[10.5px] font-semibold" style={{ color: "#333" }}>
                {item.title}
              </div>
              <div className="text-[10px]" style={{ color: "#666" }}>
                {item.detail}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          className="rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
