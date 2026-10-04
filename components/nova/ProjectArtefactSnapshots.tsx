"use client";

import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { RagStatus, StatusReportRecord, ToolScreenBlock } from "@/lib/nova/types";
import { getReportableRiskTitle, type AuditTrailEvidenceCard } from "@/lib/nova/state";
import {
  resolveStatusReportItemText,
  type ReflectionScorecard,
  type ReflectionRating,
} from "@/lib/nova/projectArtefacts";

// ---------------------------------------------------------------------------
// Shared read-only presentational pieces for the Project Artefacts gallery's
// three "computed, not tool-stored" artefact kinds — a Monthly Status
// Report snapshot, an Audit Trail snapshot, and the new Phase 5 Project
// Reflection scorecard. None of these are interactive (no RAG cycling, no
// filing) — they render exactly what's already in GameState/derived from
// it, matching ToolScreen/PriorityBoard's own `readOnly` philosophy for the
// tool-output artefacts.
// ---------------------------------------------------------------------------

const RAG_FILL: Record<RagStatus, string> = { green: "#4a9d5a", amber: "#f2b134", red: "#df4a3d" };
const PILL_TEXT: Record<RagStatus, string> = { green: "#0b3d17", amber: "#4a3502", red: "#4a0e09" };
const NAVY = "#1f3864";
const LINE = "#c9c9c9";
const BAR_CLASS =
  "bg-[#1f3864] px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white break-words";

function RagPill({ value, label }: { value: RagStatus; label: string }) {
  return (
    <span
      className="rounded border px-3 py-1 text-[11px] font-bold"
      style={{ background: RAG_FILL[value], borderColor: RAG_FILL[value], color: PILL_TEXT[value] }}
    >
      {label}
    </span>
  );
}

const OUTLOOK_ICON = { worsening: ArrowUp, stable: Minus, improving: ArrowDown } as const;

export function StatusReportSnapshot({ record }: { record: StatusReportRecord }) {
  return (
    <div
      className="rounded border border-[#c9c9c9] bg-white p-4 text-[#1a1a1a]"
      style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 11 }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            color: NAVY,
            fontSize: 17,
            fontWeight: 700,
            margin: 0,
          }}
        >
          Project Nova
        </h3>
        <RagPill value={record.reported.overall} label="Overall status" />
      </div>

      <div className="mb-3 grid grid-cols-4 gap-2">
        {(["budget", "scope", "resource", "milestone"] as const).map((dim) => (
          <div key={dim} className="flex flex-col items-center gap-1">
            <span className={`${BAR_CLASS} w-full text-center`}>
              {dim === "milestone" ? "Milestone plan" : dim[0].toUpperCase() + dim.slice(1)}
            </span>
            <div
              className="h-[26px] w-full rounded-sm border"
              style={{ background: RAG_FILL[record.reported[dim]], borderColor: LINE }}
            />
          </div>
        ))}
      </div>

      {record.selectedRisks.length > 0 && (
        <div className="mb-3">
          <div className={BAR_CLASS}>Risks reported</div>
          <div className="flex flex-col gap-1.5 border border-t-0 p-2" style={{ borderColor: LINE }}>
            {record.selectedRisks.map((risk) => {
              const Icon = OUTLOOK_ICON[risk.outlook];
              return (
                <div key={risk.riskId} className="flex items-start justify-between gap-2 text-[10.5px]">
                  <div className="flex-1">
                    <div className="font-semibold text-[#333]">
                      {getReportableRiskTitle(risk.riskId) ?? risk.riskId}
                    </div>
                    {risk.mitigationText && (
                      <div className="text-[#666]">{risk.mitigationText}</div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <RagPill value={risk.reportedRag} label={risk.reportedRag} />
                    <Icon size={14} style={{ color: NAVY }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className={BAR_CLASS}>Key accomplishments</div>
          <div className="flex flex-col gap-0.5 border border-t-0 p-2" style={{ borderColor: LINE, background: "#ddd8e6" }}>
            {record.selectedAccomplishments.length === 0 ? (
              <span className="text-[10.5px] text-[#777]">Nothing reported.</span>
            ) : (
              record.selectedAccomplishments.map((id) => (
                <span key={id} className="text-[10.5px] text-[#333]">
                  • {resolveStatusReportItemText(record, id)}
                </span>
              ))
            )}
          </div>
        </div>
        <div>
          <div className={BAR_CLASS}>Upcoming activities</div>
          <div className="flex flex-col gap-0.5 border border-t-0 p-2" style={{ borderColor: LINE, background: "#ddd8e6" }}>
            {record.selectedUpcomingActivities.length === 0 ? (
              <span className="text-[10.5px] text-[#777]">Nothing planned.</span>
            ) : (
              record.selectedUpcomingActivities.map((id) => (
                <span key={id} className="text-[10.5px] text-[#333]">
                  • {resolveStatusReportItemText(record, id)}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const AUDIT_STATUS_STYLE: Record<AuditTrailEvidenceCard["status"], { bg: string; color: string; label: string }> = {
  present: { bg: "#e4efe4", color: "#2e6b2e", label: "On file" },
  partial: { bg: "#f7e6d8", color: "#a05a1f", label: "Partial" },
  missing: { bg: "#f3d9d9", color: "#8a1f1f", label: "Missing" },
};

const AUDIT_CATEGORY_LABELS: Record<AuditTrailEvidenceCard["category"], string> = {
  change_control: "Change Control",
  risk_and_issues: "Risk & Issues",
  validation_and_quality: "Validation & Quality",
  governance_and_reporting: "Governance & Reporting",
};

export function AuditTrailSnapshot({ cards }: { cards: AuditTrailEvidenceCard[] }) {
  const categories = Array.from(new Set(cards.map((c) => c.category)));
  return (
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
      <p className="mb-3 text-[10.5px] text-[#666]">
        This reflects the evidence on file at close — not how it was organised into folders, which wasn&apos;t
        saved.
      </p>
      <div className="flex flex-col gap-3">
        {categories.map((category) => (
          <div key={category}>
            <div className={BAR_CLASS}>{AUDIT_CATEGORY_LABELS[category]}</div>
            <div className="flex flex-col gap-1.5 border border-t-0 p-2" style={{ borderColor: LINE }}>
              {cards
                .filter((c) => c.category === category)
                .map((card) => {
                  const status = AUDIT_STATUS_STYLE[card.status];
                  return (
                    <div key={card.id} className="flex flex-col gap-0.5 rounded border px-2.5 py-2" style={{ borderColor: LINE }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10.5px] font-semibold text-[#333]">{card.title}</span>
                        <span
                          className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                          style={{ background: status.bg, color: status.color }}
                        >
                          {status.label}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#666]">{card.detail}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Static read-only version of RaidUpdateCard's "real document" chrome —
 * same navy/lavender styling, but every field is a filled-in badge read
 * back from GameState rather than a live button, since there's nothing
 * left to choose once this entry is available. The three values are
 * already persisted by handleSubmitRaidUpdate (owner/response into
 * decisions, escalate into flags, keyed by toolScreen.raidKey ?? toolId —
 * see that handler's own doc comment in GameRoot.tsx) rather than kept in
 * RaidUpdateCard's local-only form state, so this is a real snapshot, not
 * a guess.
 */
export function RaidUpdateSnapshot({
  toolScreen,
  owner,
  response,
  escalated,
}: {
  toolScreen: ToolScreenBlock;
  owner: string | undefined;
  response: string | undefined;
  escalated: boolean;
}) {
  return (
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
          <div
            className="px-2.5 py-1.5 text-[10.5px] font-semibold"
            style={{ background: "#ddd8e6", color: NAVY }}
          >
            {owner ?? "—"}
          </div>
        </div>
        <div>
          <div className={BAR_CLASS}>Immediate response</div>
          <div
            className="px-2.5 py-1.5 text-[10.5px] font-semibold"
            style={{ background: "#ddd8e6", color: NAVY }}
          >
            {response ?? "—"}
          </div>
        </div>
        <div>
          <div className={BAR_CLASS}>Escalate</div>
          <div
            className="px-2.5 py-1.5 text-[10.5px] font-semibold"
            style={{ background: "#ddd8e6", color: NAVY }}
          >
            {escalated ? "Yes" : "No"}
          </div>
        </div>
      </div>
    </div>
  );
}

const REFLECTION_RATING_STYLE: Record<ReflectionRating, { bg: string; color: string; label: string }> = {
  strong: { bg: "bg-emerald-950/50", color: "text-emerald-300", label: "Strong" },
  mixed: { bg: "bg-amber-950/50", color: "text-amber-300", label: "Mixed" },
  at_risk: { bg: "bg-rose-950/50", color: "text-rose-300", label: "At Risk" },
};

/**
 * Renders the full Project Reflection content — the 6 category ratings,
 * the 19-module breakdown grouped under them, and the curated pivotal
 * decisions. Shared verbatim between the Project Artefacts panel's Phase
 * 5 Closure entry and the new end-of-game ProjectReflectionEnding screen,
 * so the two never drift into two different versions of "the reflection."
 */
export function ReflectionScorecardView({ scorecard }: { scorecard: ReflectionScorecard }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2.5">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">Overall outcome</div>
          <div className="mt-0.5 text-sm font-semibold text-zinc-100">{scorecard.outcomeLabel}</div>
        </div>
        <div className="flex flex-col gap-2">
          {scorecard.categories.map((category) => {
            const style = REFLECTION_RATING_STYLE[category.rating];
            return (
              <div key={category.id} className="rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-zinc-200">{category.label}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.bg} ${style.color}`}>
                    {style.label}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{category.commentary}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">
          APM Module Breakdown ({scorecard.moduleBreakdown.length} of 27 modules with a real tie to this
          playthrough)
        </div>
        <p className="mb-2 text-[10.5px] leading-relaxed text-zinc-500">
          Each module&apos;s rating is inherited from its parent category above — there&apos;s no separate
          per-module score, only whether that category read Strong, Mixed, or At Risk overall.
          &quot;Encountered&quot; just means you personally reached that module&apos;s own in-story beat.
        </p>
        <div className="flex flex-col gap-2">
          {scorecard.categories.map((category) => {
            const modules = scorecard.moduleBreakdown.filter((m) => m.categoryId === category.id);
            if (modules.length === 0) return null;
            const style = REFLECTION_RATING_STYLE[category.rating];
            return (
              <div key={category.id} className="rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    {category.label}
                  </span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${style.bg} ${style.color}`}>
                    {style.label}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {modules.map((module) => (
                    <div key={module.id} className="flex items-center justify-between gap-2 text-[11.5px]">
                      <span className="text-zinc-300">
                        {module.moduleNumber}. {module.title}
                      </span>
                      {module.encountered && (
                        <span className="shrink-0 text-[9px] uppercase tracking-wide text-teal-400">
                          Encountered
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">Key Decisions</div>
        <div className="flex flex-col gap-2">
          {scorecard.pivotalDecisions.map((decision) => (
            <div key={decision.id} className="rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2.5">
              <div className="text-[12px] font-medium text-zinc-200">{decision.label}</div>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{decision.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
