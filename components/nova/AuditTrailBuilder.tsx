"use client";

import { useState } from "react";
import type { GameState, ToolScreenBlock } from "@/lib/nova/types";
import { computeAuditTrailEvidence, type AuditTrailEvidenceCard } from "@/lib/nova/state";

interface AuditTrailBuilderProps {
  toolScreen: ToolScreenBlock;
  gameState: GameState;
  onSubmit: () => void;
}

const NAVY = "#1f3864";
const LINE = "#c9c9c9";

const STATUS_STYLE: Record<AuditTrailEvidenceCard["status"], { bg: string; color: string; label: string }> = {
  present: { bg: "#e4efe4", color: "#2e6b2e", label: "On file" },
  partial: { bg: "#f7e6d8", color: "#a05a1f", label: "Partial" },
  missing: { bg: "#f3d9d9", color: "#8a1f1f", label: "Missing" },
};

/**
 * "audit_trail_builder" (ACT5_SCENE02) — files computeAuditTrailEvidence's
 * cards into folders, click-to-select then click-a-folder-to-file, rather
 * than drag-and-drop. Deliberately NOT the generic sort_into_buckets engine
 * (PESTLE/SWOT/WBS): those bounce a wrong placement back with no penalty,
 * enforcing a single correct bucket per card. This tool has no correct
 * folder to enforce — the point (per design brief) is that the player
 * organises the pack knowing what's actually there, including cards
 * genuinely marked "missing" that no amount of clever filing turns into
 * real evidence. Filing every card (right or wrong) is all that's required
 * to continue; nothing here is graded.
 */
export default function AuditTrailBuilder({ toolScreen, gameState, onSubmit }: AuditTrailBuilderProps) {
  const cards = computeAuditTrailEvidence(gameState);
  const folders = toolScreen.auditTrailFolders ?? [];
  const [filed, setFiled] = useState<Record<string, string>>({});
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const unfiled = cards.filter((card) => !filed[card.id]);
  const canSubmit = unfiled.length === 0;

  function handleFile(folder: string) {
    if (!selectedCardId) return;
    setFiled((current) => ({ ...current, [selectedCardId]: folder }));
    setSelectedCardId(null);
  }

  function renderCard(card: AuditTrailEvidenceCard, filedView: boolean) {
    const status = STATUS_STYLE[card.status];
    const selected = selectedCardId === card.id;
    return (
      <button
        key={card.id}
        type="button"
        onClick={() => setSelectedCardId(selected ? null : card.id)}
        className="flex w-full flex-col gap-1 rounded border px-2.5 py-2 text-left"
        style={{
          borderColor: selected ? NAVY : LINE,
          background: selected ? "#eef1f8" : "#fff",
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10.5px] font-semibold" style={{ color: "#333" }}>
            {card.title}
          </span>
          <span
            className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
            style={{ background: status.bg, color: status.color }}
          >
            {status.label}
          </span>
        </div>
        {!filedView && (
          <span className="text-[10px]" style={{ color: "#666" }}>
            {card.detail}
          </span>
        )}
      </button>
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
          Audit Trail
        </h3>

        {unfiled.length > 0 && (
          <div className="mb-4">
            <div
              className="mb-1.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ color: "#666" }}
            >
              Unfiled evidence — select a card, then click a folder below
            </div>
            <div className="flex flex-col gap-1.5">{unfiled.map((card) => renderCard(card, false))}</div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {folders.map((folder) => {
            const filedCards = cards.filter((card) => filed[card.id] === folder);
            return (
              <div key={folder}>
                <button
                  type="button"
                  onClick={() => handleFile(folder)}
                  disabled={!selectedCardId}
                  className={BAR_CLASS(Boolean(selectedCardId))}
                >
                  {folder}
                </button>
                <div
                  className="flex min-h-[40px] flex-col gap-1.5 p-2"
                  style={{ border: `1px solid ${LINE}`, borderTop: "none" }}
                >
                  {filedCards.length === 0 ? (
                    <span className="text-[10px]" style={{ color: "#999" }}>
                      Empty
                    </span>
                  ) : (
                    filedCards.map((card) => renderCard(card, true))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between">
        {!canSubmit && (
          <p className="text-[11px] text-zinc-500">
            {unfiled.length} card{unfiled.length === 1 ? "" : "s"} still unfiled.
          </p>
        )}
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className={`ml-auto rounded-md px-4 py-2 text-xs font-semibold transition-colors ${
            canSubmit ? "bg-blue-600 text-white hover:bg-blue-500" : "cursor-not-allowed bg-zinc-800 text-zinc-600"
          }`}
        >
          Close the audit trail
        </button>
      </div>
    </div>
  );
}

function BAR_CLASS(active: boolean): string {
  return `w-full px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-white break-words ${
    active ? "bg-[#1f3864] hover:bg-[#16294b] cursor-pointer" : "bg-[#5a6b8c] cursor-default"
  }`;
}
