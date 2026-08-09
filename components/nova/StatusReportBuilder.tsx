"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { GameState, RagStatus, StatusReportRecord, ToolScreenBlock } from "@/lib/nova/types";
import { computeKnownReportableRisks } from "@/lib/nova/state";
import { getToolScreen } from "@/lib/nova/data";
import { useConceptHint, ConceptHintButton, ConceptHintPanel } from "./ConceptHint";

interface StatusReportBuilderProps {
  toolScreen: ToolScreenBlock;
  gameState: GameState;
  pmConcept?: string;
  onSubmitReport: (submission: Omit<StatusReportRecord, "actualSnapshot">) => void;
}

type DimensionKey = "budget" | "scope" | "resource" | "milestone";
type Outlook = "worsening" | "stable" | "improving";

interface RiskSlotDraft {
  key: string;
  riskId: string | null;
  mitigationText: string;
  rag: RagStatus | null;
  outlook: Outlook;
}

const RAG_CYCLE: (RagStatus | null)[] = [null, "green", "amber", "red"];
const RAG_FILL: Record<RagStatus, string> = { green: "#4a9d5a", amber: "#f2b134", red: "#df4a3d" };
const RAG_OFF_FILL = "#eef0f2";
const PILL_TEXT: Record<RagStatus, string> = { green: "#0b3d17", amber: "#4a3502", red: "#4a0e09" };

function cycleRag(current: RagStatus | null): RagStatus | null {
  const idx = RAG_CYCLE.indexOf(current);
  return RAG_CYCLE[(idx + 1) % RAG_CYCLE.length];
}

/** How many weeks of story time one Monthly Status Report represents —
 * see the doc comment on `currentWeek` below for why this replaces the
 * HUD's forecast-based week number for this feature specifically. */
const WEEKS_PER_REPORT = 4;

const NAVY = "#1f3864";
const LINE = "#c9c9c9";
const BAR_CLASS =
  "bg-[#1f3864] px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white break-words";
const BOX_CLASS = "bg-[#ddd8e6] px-2 py-1.5 text-[10.5px] text-[#555] break-words";

/** A navy header-bar label with an optional hover tooltip explaining what
 * the section below it is for / how to interact with it — matches the
 * approved mockup's info-icon-free "hover the title itself" convention. */
function InfoBar({ label, tip, className = "" }: { label: string; tip?: string; className?: string }) {
  return (
    <div className={`group relative inline-block w-full cursor-help ${BAR_CLASS} ${className}`}>
      {label}
      {tip && (
        <span className="pointer-events-none absolute left-0 top-full z-10 mt-1 w-56 rounded bg-[#1f3864] px-2 py-1.5 text-[10px] font-normal normal-case tracking-normal text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
          {tip}
        </span>
      )}
    </div>
  );
}

/** A single clickable RAG box — off (neutral gray) until tapped, then
 * cycles green -> amber -> red -> off. Deliberately starts unset for
 * every dimension and every risk (not pre-filled), the same "make your
 * own call" principle used everywhere else the player judges live game
 * state rather than guesses a hidden correct answer. */
function RagCell({
  value,
  onClick,
  large,
  label,
}: {
  value: RagStatus | null;
  onClick: () => void;
  large?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${value ? value : "not set"}. Tap to change.`}
      className={`w-full border border-[#c9c9c9] transition-colors ${large ? "h-[30px]" : "h-[26px]"}`}
      style={{ background: value ? RAG_FILL[value] : RAG_OFF_FILL }}
    />
  );
}

/**
 * "status_report_builder" — the real Monthly Status Report screen,
 * matching the corporate pptx template mockup the player will actually
 * see in-fiction (navy/lavender chrome, not the dark game-UI palette used
 * by every other tool screen) — deliberate, per direct art direction:
 * this is meant to look like a real document, not a puzzle.
 *
 * Every judgement call (overall status, the four RAG dimensions, each
 * risk's reported RAG/outlook/mitigation, which accomplishments/upcoming
 * activities to surface) lives in local component state and is entirely
 * the player's own call — nothing here is pre-filled, suggested, or
 * graded against computeActualStatusReport's hidden truth. That truth is
 * read only far enough to (a) list which risks currently exist to report
 * on (id + title only, never their real rag) and (b) split the real
 * Milestone Timeline placements into "still upcoming" vs "already
 * complete, so it's an accomplishment now" — both real game-state facts,
 * not verdicts on how the player is doing.
 */
export default function StatusReportBuilder({
  toolScreen,
  gameState,
  pmConcept,
  onSubmitReport,
}: StatusReportBuilderProps) {
  const hint = useConceptHint(pmConcept);
  const [openRiskPicker, setOpenRiskPicker] = useState<string | null>(null);
  const maxRiskSlots = toolScreen.maxRiskSlots ?? 4;

  const [overall, setOverall] = useState<RagStatus | null>(null);
  const [dims, setDims] = useState<Record<DimensionKey, RagStatus | null>>({
    budget: null,
    scope: null,
    resource: null,
    milestone: null,
  });
  // Fixed-length, always maxRiskSlots rows — the player fills in whichever
  // ones they want to report on (a blank row is simply skipped at submit
  // time), rather than starting empty and growing via an "Add risk"
  // action. Matches the approved mockup, which always shows all 4 slots.
  const [riskSlots, setRiskSlots] = useState<RiskSlotDraft[]>(() =>
    Array.from({ length: maxRiskSlots }, (_, i) => ({
      key: `slot_${i}`,
      riskId: null,
      mitigationText: "",
      rag: null,
      outlook: "stable" as Outlook,
    }))
  );
  const [accomplishments, setAccomplishments] = useState<Set<string>>(new Set());
  const [activities, setActivities] = useState<Set<string>>(new Set());

  // Only risks the player has actual in-fiction evidence for — never the
  // hidden truth-engine's full eligible-event pool. See
  // computeKnownReportableRisks' doc comment in state.ts for the full
  // discovered/materialised model.
  const risks = computeKnownReportableRisks(gameState);

  // Deliberately NOT computeWeeksRemaining(scheduleHealth) — that's a
  // forecast ("if this pace holds, the whole project would take about X
  // weeks"), not real elapsed story time, and it can already read close
  // to 24 very early in a playthrough with poor schedule health (a known,
  // documented issue — see DESIGN_NOTES.md's "HUD 'current week' is a
  // forecast, not real elapsed time"). Reusing it here made EVERY Gantt
  // milestone read as already-complete from report #1 onward, leaving
  // Upcoming Milestones permanently empty regardless of what the player
  // actually placed. Instead: each Monthly Status Report genuinely
  // represents about a month of story time (the scene's own title says
  // "x3" reports covering the project), so report N's reporting week is
  // simply N * WEEKS_PER_REPORT — real, deterministic, and independent of
  // the flawed forecast. Report #1 opens at week 4, #2 at week 8, #3 at
  // week 12, leaving plenty of the 24-week plan still genuinely ahead.
  const currentWeek = Math.min(24, (gameState.statusReports.length + 1) * WEEKS_PER_REPORT);

  const ganttTool = toolScreen.ganttToolId ? getToolScreen(toolScreen.ganttToolId) : null;
  const ganttPlacements = ganttTool ? (gameState.toolPlacements[ganttTool.toolId] ?? {}) : {};
  const resolvedMilestones = (ganttTool?.milestones ?? [])
    .map((m) => {
      const startRaw = ganttPlacements[m.id];
      if (startRaw === undefined) return null;
      const start = Number(startRaw);
      return { id: m.id, text: m.text, start, end: start + m.durationWeeks, wbsCategory: m.wbsCategory };
    })
    .filter(
      (m): m is { id: string; text: string; start: number; end: number; wbsCategory: string | undefined } =>
        m !== null
    );

  // "Upcoming" means genuinely hasn't started yet — a milestone already
  // under way (start <= currentWeek < end) isn't upcoming just because
  // it's unfinished, so this checks start, not end.
  const upcomingMilestones = resolvedMilestones
    .filter((m) => m.start > currentWeek)
    .sort((a, b) => a.start - b.start);
  const completedMilestones = resolvedMilestones.filter((m) => m.end <= currentWeek);

  const accomplishmentCandidates = [
    ...(toolScreen.accomplishmentCandidates ?? []),
    ...completedMilestones.map((m) => ({
      id: `gantt_${m.id}`,
      text: `${m.text} (completed Week ${m.end})`,
    })),
  ];

  // Upcoming Activities is a finer-grained, near-term breakdown of the same
  // real Gantt data — deliberately NOT just Upcoming Milestones restated.
  // A milestone counts as "near future" once it's already in progress
  // (start <= currentWeek) or starts within upcomingActivityWindowWeeks —
  // for each one, its individual WBS task cards (matched by
  // milestone.wbsCategory === card.correctBucket) become separate
  // checkable activities instead of one headline title, so the player is
  // choosing among real, specific pieces of work rather than restating a
  // milestone name they already saw in the table above.
  const activityWindowWeeks = toolScreen.upcomingActivityWindowWeeks ?? 4;
  const wbsTool = toolScreen.wbsToolId ? getToolScreen(toolScreen.wbsToolId) : null;
  const wbsCards = wbsTool?.cards ?? [];
  const nearTermMilestones = resolvedMilestones.filter(
    (m) => m.end > currentWeek && m.start <= currentWeek + activityWindowWeeks
  );
  const activityCandidates =
    nearTermMilestones.length > 0
      ? nearTermMilestones.flatMap((m) => {
          const zoneTasks = wbsCards.filter((c) => c.correctBucket === m.wbsCategory);
          if (zoneTasks.length === 0) {
            return [{ id: `gantt_activity_${m.id}`, text: m.text }];
          }
          return zoneTasks.map((c) => ({
            id: `wbs_activity_${c.id}`,
            text: c.text,
          }));
        })
      : (toolScreen.upcomingActivityCandidates ?? []);

  const usedRiskIds = new Set(riskSlots.map((s) => s.riskId).filter((id): id is string => id !== null));

  function updateRiskSlot(key: string, patch: Partial<RiskSlotDraft>) {
    setRiskSlots((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function toggleInSet(set: Set<string>, id: string, setter: (next: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  const dimsComplete = dims.budget !== null && dims.scope !== null && dims.resource !== null && dims.milestone !== null;
  const canSubmit = overall !== null && dimsComplete;

  function handleReset() {
    setOverall(null);
    setDims({ budget: null, scope: null, resource: null, milestone: null });
    setRiskSlots(
      Array.from({ length: maxRiskSlots }, (_, i) => ({
        key: `slot_${i}`,
        riskId: null,
        mitigationText: "",
        rag: null,
        outlook: "stable" as Outlook,
      }))
    );
    setAccomplishments(new Set());
    setActivities(new Set());
  }

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmitReport({
      reportId: `report_${toolScreen.sourceScene}_${gameState.statusReports.length + 1}`,
      submittedAtScene: toolScreen.sourceScene,
      reported: {
        overall: overall as RagStatus,
        budget: dims.budget as RagStatus,
        scope: dims.scope as RagStatus,
        resource: dims.resource as RagStatus,
        milestone: dims.milestone as RagStatus,
      },
      selectedRisks: riskSlots
        .filter((s): s is RiskSlotDraft & { riskId: string; rag: RagStatus } => s.riskId !== null && s.rag !== null)
        .map((s) => ({
          riskId: s.riskId,
          reportedRag: s.rag,
          outlook: s.outlook,
          mitigationText: s.mitigationText.trim() || undefined,
        })),
      selectedAccomplishments: [...accomplishments],
      selectedUpcomingActivities: [...activities],
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/90 p-4">
      {(toolScreen.instructions || pmConcept) && (
        <div className="flex items-start justify-between gap-3">
          {toolScreen.instructions && <p className="text-sm text-zinc-300">{toolScreen.instructions}</p>}
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <ConceptHintButton entry={hint.entry} open={hint.open} onToggle={hint.toggle} />
            <button
              type="button"
              onClick={handleReset}
              className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
            >
              Reset
            </button>
          </div>
        </div>
      )}
      <ConceptHintPanel entry={hint.entry} open={hint.open} onClose={hint.close} />

      <div
        className="relative rounded border border-[#c9c9c9] bg-white p-4 text-[#1a1a1a]"
        style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 11 }}
      >
        <div className="mb-3 flex items-start justify-between">
          <h3 style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: NAVY, fontSize: 19, fontWeight: 700, margin: 0 }}>
            Project Nova
          </h3>
          <button
            type="button"
            onClick={() => setOverall(cycleRag(overall))}
            className="rounded border px-3.5 py-1.5 text-[11px] font-bold"
            style={{
              background: overall ? RAG_FILL[overall] : "#fff",
              borderColor: overall ? RAG_FILL[overall] : LINE,
              color: overall ? PILL_TEXT[overall] : "#333",
            }}
          >
            Overall status
          </button>
        </div>

        <table className="mb-3 w-full border-collapse text-[10.5px]" style={{ tableLayout: "fixed" }}>
          <tbody>
            <tr>
              <td className={BAR_CLASS} style={{ width: "15%", border: `1px solid ${LINE}` }}>
                Project manager
              </td>
              <td className={BOX_CLASS} style={{ width: "35%", border: `1px solid ${LINE}` }}>
                {toolScreen.projectManagerLabel ?? "You"}
              </td>
              <td className={BAR_CLASS} style={{ width: "15%", border: `1px solid ${LINE}` }}>
                Project sponsor
              </td>
              <td className={BOX_CLASS} style={{ width: "35%", border: `1px solid ${LINE}` }}>
                {toolScreen.projectSponsorLabel ?? ""}
              </td>
            </tr>
            <tr>
              <td className={BAR_CLASS} style={{ border: `1px solid ${LINE}` }}>
                Reporting date
              </td>
              <td className={BOX_CLASS} style={{ border: `1px solid ${LINE}` }}>
                Week {currentWeek}
              </td>
              <td className={BAR_CLASS} style={{ border: `1px solid ${LINE}` }}>
                Tax tower
              </td>
              <td className={BOX_CLASS} style={{ border: `1px solid ${LINE}` }}>
                {toolScreen.taxTower ?? ""}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="grid min-w-0 gap-3.5" style={{ gridTemplateColumns: "0.55fr 1fr" }}>
          <div className="flex min-w-0 flex-col gap-3">
            <div>
              <InfoBar label="Project description" />
              <div style={{ background: "#ddd8e6", padding: "6px 8px", fontSize: 10.5, color: "#555" }}>
                {toolScreen.projectDescription}
              </div>
            </div>

            <div>
              <InfoBar
                label="Key accomplishments"
                tip="Pick from this period's evidence — what actually happened, not what you'd like to have happened."
              />
              <div className="flex flex-col gap-0.5" style={{ background: "#ddd8e6", minHeight: 90, padding: "6px 8px" }}>
                {accomplishmentCandidates.length === 0 && (
                  <span className="text-[10.5px] text-[#777]">Nothing to report yet.</span>
                )}
                {accomplishmentCandidates.map((item) => (
                  <label key={item.id} className="flex items-start gap-1.5 py-0.5 text-[10.5px] text-[#333]">
                    <input
                      type="checkbox"
                      checked={accomplishments.has(item.id)}
                      onChange={() => toggleInSet(accomplishments, item.id, setAccomplishments)}
                      className="mt-0.5"
                    />
                    <span>{item.text}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <InfoBar
                label="Upcoming activities"
                tip="What you plan to do next period — sets expectations for the following report."
              />
              <div className="flex flex-col gap-0.5" style={{ background: "#ddd8e6", minHeight: 90, padding: "6px 8px" }}>
                {activityCandidates.length === 0 && (
                  <span className="text-[10.5px] text-[#777]">Nothing planned yet.</span>
                )}
                {activityCandidates.map((item) => (
                  <label key={item.id} className="flex items-start gap-1.5 py-0.5 text-[10.5px] text-[#333]">
                    <input
                      type="checkbox"
                      checked={activities.has(item.id)}
                      onChange={() => toggleInSet(activities, item.id, setActivities)}
                      className="mt-0.5"
                    />
                    <span>{item.text}</span>
                  </label>
                ))}
              </div>
            </div>

          </div>

          <div className="flex min-w-0 flex-col gap-2.5">
            <div className="w-full min-w-0 overflow-x-auto">
            <table className="w-full border-collapse text-[10.5px]" style={{ tableLayout: "fixed", minWidth: 320 }}>
              <tbody>
                <tr>
                  <td className={`${BAR_CLASS} group relative cursor-help`} style={{ width: "22%", border: `1px solid ${LINE}` }}>
                    RAG status
                    <span className="pointer-events-none absolute left-0 top-full z-10 mt-1 w-56 rounded bg-[#1f3864] px-2 py-1.5 text-[10px] font-normal normal-case tracking-normal text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                      Tap a box to cycle its colour — green, amber, or red.
                    </span>
                  </td>
                  <td className={BAR_CLASS} style={{ width: "19.5%", textAlign: "center", border: `1px solid ${LINE}` }}>
                    Budget
                  </td>
                  <td className={BAR_CLASS} style={{ width: "19.5%", textAlign: "center", border: `1px solid ${LINE}` }}>
                    Scope
                  </td>
                  <td className={BAR_CLASS} style={{ width: "19.5%", textAlign: "center", border: `1px solid ${LINE}` }}>
                    Resource
                  </td>
                  <td className={BAR_CLASS} style={{ width: "19.5%", textAlign: "center", border: `1px solid ${LINE}` }}>
                    Milestone plan
                  </td>
                </tr>
                <tr>
                  <td style={{ border: `1px solid ${LINE}`, padding: 0 }} />
                  {(["budget", "scope", "resource", "milestone"] as DimensionKey[]).map((key) => (
                    <td key={key} style={{ border: `1px solid ${LINE}`, padding: 0 }}>
                      <RagCell
                        value={dims[key]}
                        onClick={() => setDims((prev) => ({ ...prev, [key]: cycleRag(prev[key]) }))}
                        large
                        label={key}
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            </div>

            <table className="w-full min-w-0 border-collapse text-[10.5px]" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th className={BAR_CLASS} style={{ width: "28%", border: `1px solid ${LINE}`, textAlign: "left" }}>
                    Risk
                  </th>
                  <th className={BAR_CLASS} style={{ width: "37%", border: `1px solid ${LINE}`, textAlign: "left" }}>
                    Mitigation actions
                  </th>
                  <th
                    className={`${BAR_CLASS} group relative cursor-help`}
                    style={{ width: "17%", border: `1px solid ${LINE}`, textAlign: "center" }}
                  >
                    RAG
                    <span className="pointer-events-none absolute left-0 top-full z-10 mt-1 w-52 rounded bg-[#1f3864] px-2 py-1.5 text-[10px] font-normal normal-case tracking-normal text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                      Tap the box to change colour.
                    </span>
                  </th>
                  <th className={BAR_CLASS} style={{ width: "18%", border: `1px solid ${LINE}`, textAlign: "center" }}>
                    Outlook
                  </th>
                </tr>
              </thead>
              <tbody>
                {riskSlots.map((slot) => {
                  const slotOptions = risks.filter((r) => r.riskId === slot.riskId || !usedRiskIds.has(r.riskId));
                  const selected = risks.find((r) => r.riskId === slot.riskId);
                  const pickerOpen = openRiskPicker === slot.key;
                  return (
                    <tr key={slot.key}>
                      <td style={{ border: `1px solid ${LINE}`, padding: "7px 8px", position: "relative" }}>
                        <button
                          type="button"
                          onClick={() => setOpenRiskPicker(pickerOpen ? null : slot.key)}
                          className={`w-full text-left text-[10.5px] leading-snug hover:text-[#1f3864] ${
                            selected ? "text-[#333]" : "text-[#999]"
                          }`}
                          style={{ whiteSpace: "normal", wordBreak: "break-word" }}
                        >
                          {selected ? selected.title : "Select a risk"}
                        </button>
                        {pickerOpen && (
                          <>
                            <button
                              type="button"
                              aria-label="Close risk picker"
                              onClick={() => setOpenRiskPicker(null)}
                              className="fixed inset-0 z-10 cursor-default"
                            />
                            <div className="absolute left-0 top-full z-20 mt-1 w-56 max-w-[80vw] rounded border border-[#c9c9c9] bg-white shadow-lg">
                              <button
                                type="button"
                                onClick={() => {
                                  updateRiskSlot(slot.key, { riskId: null });
                                  setOpenRiskPicker(null);
                                }}
                                className="block w-full px-2 py-1.5 text-left text-[10.5px] italic leading-snug text-[#999] hover:bg-[#eef0f2]"
                              >
                                — none —
                              </button>
                              {slotOptions.map((r) => (
                                <button
                                  key={r.riskId}
                                  type="button"
                                  onClick={() => {
                                    updateRiskSlot(slot.key, { riskId: r.riskId });
                                    setOpenRiskPicker(null);
                                  }}
                                  className="block w-full px-2 py-1.5 text-left text-[10.5px] leading-snug text-[#333] hover:bg-[#eef0f2]"
                                  style={{ whiteSpace: "normal", wordBreak: "break-word" }}
                                >
                                  {r.title}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </td>
                      <td style={{ border: `1px solid ${LINE}`, padding: "7px 8px" }}>
                        <input
                          value={slot.mitigationText}
                          onChange={(e) => updateRiskSlot(slot.key, { mitigationText: e.target.value })}
                          placeholder="Mitigation action"
                          className="w-full border-none bg-transparent text-[10.5px] outline-none"
                        />
                      </td>
                      <td style={{ border: `1px solid ${LINE}`, padding: "7px 8px" }}>
                        <RagCell
                          value={slot.rag}
                          onClick={() => updateRiskSlot(slot.key, { rag: cycleRag(slot.rag) })}
                          large
                          label="Risk RAG"
                        />
                      </td>
                      <td style={{ border: `1px solid ${LINE}`, padding: "7px 8px" }}>
                        <div className="flex items-center justify-center gap-2 text-[#aaa]">
                          <button
                            type="button"
                            onClick={() => updateRiskSlot(slot.key, { outlook: "worsening" })}
                            aria-label="Worsening"
                            style={{ color: slot.outlook === "worsening" ? NAVY : "#aaa" }}
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => updateRiskSlot(slot.key, { outlook: "stable" })}
                            aria-label="Stable"
                            style={{ color: slot.outlook === "stable" ? NAVY : "#aaa" }}
                          >
                            <Minus size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => updateRiskSlot(slot.key, { outlook: "improving" })}
                            aria-label="Improving"
                            style={{ color: slot.outlook === "improving" ? NAVY : "#aaa" }}
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div>
              <div className={BAR_CLASS}>Upcoming milestones</div>
              <table className="w-full min-w-0 border-collapse text-[10.5px]">
                <thead>
                  <tr>
                    <th className={BAR_CLASS} style={{ border: `1px solid ${LINE}`, textAlign: "left" }}>
                      Name
                    </th>
                    <th className={BAR_CLASS} style={{ border: `1px solid ${LINE}`, textAlign: "center" }}>
                      Start
                    </th>
                    <th className={BAR_CLASS} style={{ border: `1px solid ${LINE}`, textAlign: "center" }}>
                      End
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingMilestones.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ border: `1px solid ${LINE}`, padding: "5px 6px", textAlign: "center", color: "#888" }}>
                        None remaining
                      </td>
                    </tr>
                  )}
                  {upcomingMilestones.map((m) => (
                    <tr key={m.id}>
                      <td style={{ border: `1px solid ${LINE}`, padding: "5px 6px" }}>{m.text}</td>
                      <td style={{ border: `1px solid ${LINE}`, padding: "5px 6px", textAlign: "center" }}>
                        Wk {m.start}
                      </td>
                      <td style={{ border: `1px solid ${LINE}`, padding: "5px 6px", textAlign: "center" }}>
                        Wk {m.end}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="mt-3.5 flex justify-end">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/branding/astrazeneca_icon_logo_transparent.png"
            alt="AstraZeneca logo"
            className="h-12 w-auto"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        {!canSubmit && (
          <p className="text-[11px] text-zinc-500">
            Set an overall status and all four RAG ratings to submit this report.
          </p>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`ml-auto rounded-md px-4 py-2 text-xs font-semibold transition-colors ${
            canSubmit
              ? "bg-blue-600 text-white hover:bg-blue-500"
              : "cursor-not-allowed bg-zinc-800 text-zinc-600"
          }`}
        >
          Submit report
        </button>
      </div>
    </div>
  );
}
