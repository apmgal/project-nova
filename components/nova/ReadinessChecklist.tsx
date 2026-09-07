"use client";

import type { GameState, ToolScreenBlock } from "@/lib/nova/types";
import {
  computeReadinessBoard,
  computeReadinessInterventionOptions,
  readinessInterventionSlotsUsed,
} from "@/lib/nova/state";

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
 * decisions (see computeReadinessBoard in state.ts), followed by up to TWO
 * sequential picks — "two days of recovery capacity" taken literally, one
 * day at a time. Each render shows whichever gaps are still genuinely open
 * (see computeReadinessInterventionOptions/applyReadinessIntervention) —
 * closing one re-renders the board before the second day is offered, and a
 * category never comes back around a second time. This is deliberately NOT
 * another placement/pass-fail exercise — nothing here is "fixed" by the
 * player, only reviewed and, for up to two items, triaged. Same
 * navy/lavender "real document" chrome as StatusReportBuilder/
 * RaidUpdateCard, since this is conceptually the same family of artefact.
 */
export default function ReadinessChecklist({ toolScreen, gameState, onPick }: ReadinessChecklistProps) {
  const board = computeReadinessBoard(gameState);
  const options = computeReadinessInterventionOptions(gameState);
  const slotsUsed = readinessInterventionSlotsUsed(gameState);
  const daysRemaining = 2 - slotsUsed;

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
          <div className={BAR_CLASS}>
            {options.length === 0
              ? "Recovery capacity"
              : daysRemaining === 2
                ? "Two days of recovery capacity remaining"
                : "One day of recovery capacity remaining"}
          </div>
          <div className="flex flex-col gap-1.5" style={{ background: "#ddd8e6", padding: "8px" }}>
            {options.length === 0 ? (
              <p className="text-[10.5px]" style={{ color: "#333" }}>
                Nothing outstanding to spend it on. The board&apos;s clean.
              </p>
            ) : daysRemaining === 2 ? (
              <p className="text-[10.5px]" style={{ color: "#333" }}>
                You have two days before the next gate. Spend today closing one gap below, or move on and leave
                it — you&apos;ll decide what to do with the second day after.
              </p>
            ) : (
              <p className="text-[10.5px]" style={{ color: "#333" }}>
                One day left before the next gate. This is your last chance to close anything on this board.
              </p>
            )}
            <div className="flex flex-col gap-1">
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onPick(option.id)}
                  className="rounded border px-2.5 py-1.5 text-left hover:border-[#1f3864]"
                  style={{ borderColor: LINE, background: "#fff", color: "#333" }}
                >
                  <div className="text-[10.5px] font-semibold">{option.label}</div>
                  <div className="mt-0.5 text-[9.5px] leading-snug" style={{ color: "#666" }}>
                    {option.description}
                  </div>
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
                  : "Move on and leave this gap unresolved."}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
