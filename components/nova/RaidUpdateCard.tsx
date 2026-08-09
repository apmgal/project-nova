"use client";

import { useState } from "react";
import type { ToolScreenBlock } from "@/lib/nova/types";

interface RaidUpdateCardProps {
  toolScreen: ToolScreenBlock;
  onSubmitUpdate: (submission: { owner: string; response: string; escalate: boolean }) => void;
}

const NAVY = "#1f3864";
const LINE = "#c9c9c9";
const BAR_CLASS =
  "bg-[#1f3864] px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white break-words";

/**
 * "raid_update_card" — a small, real RAID-log interaction, deliberately
 * NOT a three-button dialogue choice wearing a RAID-log hat (that was the
 * explicit thing being avoided — see the "Act 4 event redistribution"
 * entry in DESIGN_NOTES.md). Same visual language as StatusReportBuilder
 * (navy/lavender "real document" chrome) since this is conceptually the
 * same kind of artefact, just far smaller: one risk, a status readout
 * (never a choice — the risk really has materialised, that's not up to
 * the player), and three real calls (owner/response/escalate).
 *
 * Self-contained local state + a custom onSubmitUpdate prop, mirroring
 * StatusReportBuilder rather than the generic toolProgress/
 * computeToolComplete path — there's no single placement-style completion
 * condition to check here either.
 */
export default function RaidUpdateCard({ toolScreen, onSubmitUpdate }: RaidUpdateCardProps) {
  const ownerOptions = toolScreen.raidOwnerOptions ?? [];
  const responseOptions = toolScreen.raidResponseOptions ?? [];

  const [owner, setOwner] = useState<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [escalate, setEscalate] = useState<boolean | null>(null);

  const canSubmit = owner !== null && response !== null && escalate !== null;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmitUpdate({ owner: owner as string, response: response as string, escalate: escalate as boolean });
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
          RAID Log — Update
        </h3>

        <table className="mb-3 w-full border-collapse text-[10.5px]" style={{ tableLayout: "fixed" }}>
          <tbody>
            <tr>
              <td className={BAR_CLASS} style={{ width: "22%", border: `1px solid ${LINE}` }}>
                Risk
              </td>
              <td style={{ border: `1px solid ${LINE}`, padding: "7px 8px", color: "#333" }}>
                {toolScreen.raidRiskLabel}
              </td>
            </tr>
            <tr>
              <td className={BAR_CLASS} style={{ border: `1px solid ${LINE}` }}>
                Status
              </td>
              <td style={{ border: `1px solid ${LINE}`, padding: "7px 8px" }}>
                <span style={{ color: "#999", textDecoration: "line-through" }}>Risk</span>
                {"  →  "}
                <span style={{ color: "#8a1f1f", fontWeight: 700 }}>ISSUE</span>
                <span style={{ marginLeft: 8, color: "#333" }}>{toolScreen.raidIssueLabel}</span>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="flex flex-col gap-3">
          <div>
            <div className={BAR_CLASS}>Owner</div>
            <div className="flex flex-wrap gap-1.5" style={{ background: "#ddd8e6", padding: "6px 8px" }}>
              {ownerOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setOwner(opt)}
                  className="rounded border px-2.5 py-1 text-[10.5px]"
                  style={{
                    borderColor: owner === opt ? NAVY : LINE,
                    background: owner === opt ? NAVY : "#fff",
                    color: owner === opt ? "#fff" : "#333",
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className={BAR_CLASS}>Immediate response</div>
            <div className="flex flex-col gap-1" style={{ background: "#ddd8e6", padding: "6px 8px" }}>
              {responseOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setResponse(opt)}
                  className="rounded border px-2.5 py-1.5 text-left text-[10.5px]"
                  style={{
                    borderColor: response === opt ? NAVY : LINE,
                    background: response === opt ? NAVY : "#fff",
                    color: response === opt ? "#fff" : "#333",
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className={BAR_CLASS}>Escalate</div>
            <div className="flex gap-1.5" style={{ background: "#ddd8e6", padding: "6px 8px" }}>
              {[
                { label: "Yes", value: true },
                { label: "No", value: false },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setEscalate(opt.value)}
                  className="rounded border px-3 py-1 text-[10.5px]"
                  style={{
                    borderColor: escalate === opt.value ? NAVY : LINE,
                    background: escalate === opt.value ? NAVY : "#fff",
                    color: escalate === opt.value ? "#fff" : "#333",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {!canSubmit && (
          <p className="text-[11px] text-zinc-500">Choose an owner, a response, and whether to escalate.</p>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`ml-auto rounded-md px-4 py-2 text-xs font-semibold transition-colors ${
            canSubmit ? "bg-blue-600 text-white hover:bg-blue-500" : "cursor-not-allowed bg-zinc-800 text-zinc-600"
          }`}
        >
          Update RAID log
        </button>
      </div>
    </div>
  );
}
