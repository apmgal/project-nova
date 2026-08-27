"use client";

import type { GameState, ToolScreenBlock } from "@/lib/nova/types";
import { computeReadinessBoard, computeReadinessInterventionOptions } from "@/lib/nova/state";

interface ReadinessChecklistProps {
  toolScreen: ToolScreenBlock;
  gameState: GameState;
  onPick: (interventionId: string | null) => void;
}

const NAVY = "#1f3864";
const LINE = "#c9c9c9";
const BAR_CLASS =
  "bg-[#1f3864] px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white break-words";

/**
 * "readiness_checklist" (ACT5_SCENE01) — a read-only review of the two
 * product lines' physical/quality readiness, entirely derived from earlier
 * decisions (see computeReadinessBoard in state.ts), followed by ONE
 * constrained pick: which of the currently-outstanding gaps to spend two
 * days closing, or push forward on the compressed schedule instead (see
 * computeReadinessInterventionOptions/applyReadinessIntervention). This is
 * deliberately NOT another placement/pass-fail exercise — nothing here is
 * "fixed" by the player, only reviewed and, for one item, triaged. Same
 * navy/lavender "real document" chrome as StatusReportBuilder/
 * RaidUpdateCard, since this is conceptually the same family of artefact.
 */
export default function ReadinessChecklist({ toolScreen, gameState, onPick }: ReadinessChecklistProps) {
  const board = computeReadinessBoard(gameState);
  const options = computeReadinessInterventionOptions(gameState);

  function renderColumn(title: string, items: ReturnType<typeof computeReadinessBoard>["productA"]) {
    return (
      <div className="flex-1">
        <div className={BAR_CLASS}>{title}</div>
        <div className="flex flex-col" style={{ border: `1px solid ${LINE}`, borderTop: "none" }}>
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-2 px-2.5 py-2 text-[11px]"
              style={{ borderBottom: `1px solid ${LINE}` }}
            >
              <div>
                <div style={{ color: "#333", fontWeight: 600 }}>{item.label}</div>
                <div style={{ color: "#666", fontSize: 10.5 }}>{item.detail}</div>
              </div>
              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase"
                style={{
                  background: item.status === "clear" ? "#e4efe4" : "#f7e6d8",
                  color: item.status === "clear" ? "#2e6b2e" : "#a05a1f",
                }}
              >
                {item.status === "clear" ? "Clear" : "Gap"}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

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
          Commissioning Readiness Review
        </h3>

        <div className="flex gap-3">
          {renderColumn("Product A", board.productA)}
          {renderColumn("Product B", board.productB)}
        </div>

        <div className="mt-4">
          <div className={BAR_CLASS}>Two days of recovery capacity</div>
          <div className="flex flex-col gap-1.5" style={{ background: "#ddd8e6", padding: "8px" }}>
            {options.length === 0 ? (
              <p className="text-[10.5px]" style={{ color: "#333" }}>
                Nothing outstanding to spend it on. The board&apos;s clean.
              </p>
            ) : (
              <p className="text-[10.5px]" style={{ color: "#333" }}>
                You have two days before the next gate. Where do you put them? You can&apos;t close everything.
              </p>
            )}
            <div className="flex flex-col gap-1">
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onPick(option.id)}
                  className="rounded border px-2.5 py-1.5 text-left text-[10.5px] hover:border-[#1f3864]"
                  style={{ borderColor: LINE, background: "#fff", color: "#333" }}
                >
                  {option.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onPick(null)}
                className="rounded border px-2.5 py-1.5 text-left text-[10.5px] hover:border-[#1f3864]"
                style={{ borderColor: LINE, background: "#fff", color: "#333" }}
              >
                {options.length === 0
                  ? "Proceed — the schedule doesn't need it."
                  : "Proceed on the compressed schedule instead."}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
