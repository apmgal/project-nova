/**
 * Whitfield's inspection — the interactive sequence after "The Morning of the Inspection" (PROTOTYPE,
 * /prototype/inspection-film; not wired into GameRoot yet).
 *
 * Truth first, presentation second (the same split as the Status Report / Audit Trail):
 *  - buildInspectionDossier(state) turns what the save ACTUALLY holds into the four dossier documents,
 *    using the existing read-outs only (computeReadinessBoard, computeAuditTrailEvidence,
 *    choiceHistory / RAID log / status-report risk entries, statusReports / findMostMaterialReportMismatch, the Act 5 decisions).
 *    A document whose underlying record was never created reads "unavailable" — nothing is invented.
 *  - The conversation is a fixed spine of steps; the few questions that vary are chosen from the save and
 *    from what the player presents (pickFollowUp / recommendationQuestion / riskFollowUp).
 *  - Progress lives in GameState.decisions (insp_* keys), so a resumed inspection lands on the same step
 *    with the same evidence and answers, and nothing is asked or scored twice.
 *  - Scoring is not a second system: once, at the close, the inspection nudges two EXISTING metrics
 *    (regulatoryReadiness, boardConfidence) via applyEffects, which evaluateEnding already reads.
 *    Nothing is shown to the player.
 */
import type { GameState, RagStatus } from "./types";
import {
  applyEffects,
  applyFlags,
  computeAuditTrailEvidence,
  computeReadinessBoard,
  findMostMaterialReportMismatch,
  getReportableRiskTitle,
  hasReachedToolScreen,
  metricBand,
} from "./state";
import {
  READINESS_RECOMMENDATION,
  READINESS_RECOMMENDATION_KEY,
  RECOVERY_DECISION,
  RECOVERY_OUTCOME_KEY,
  RECOVERY_STRATEGY_KEY,
  type ReadinessRecommendationId,
} from "./act5Recovery";

// ---------------------------------------------------------------------------------------------------
// The dossier — four documents built from the save
// ---------------------------------------------------------------------------------------------------

export type InspectionDocId = "readiness" | "risks" | "quality" | "status";
export type EvidenceTone = "ok" | "partial" | "gap" | "neutral";

export interface DossierRow {
  label: string;
  value: string;
  tone: EvidenceTone;
}
export interface DossierSection {
  heading: string;
  rows: DossierRow[];
  note?: string;
}
export interface DossierDocument {
  id: InspectionDocId;
  title: string;
  subtitle: string;
  /** False when the save holds none of the records this document is made from. */
  available: boolean;
  /** Why it's unavailable: the player never created it ("not_recorded"), or the part of the project that
   *  produces it isn't in this save at all ("not_reached" — e.g. a dev jump). Only the first is held against
   *  the player. */
  unavailableReason?: "not_recorded" | "not_reached";
  sections: DossierSection[];
  /** How well the record supports itself — used only behind the scenes. */
  strength: "strong" | "partial" | "weak" | "unavailable";
}

const READINESS_TOOL = "TOOL_ACT5_SCENE01_READINESS";
const RAG_WORD: Record<RagStatus, string> = { green: "Green", amber: "Amber", red: "Red" };
const ragTone = (r: RagStatus): EvidenceTone => (r === "green" ? "ok" : r === "amber" ? "partial" : "gap");
const cardTone = (s: "present" | "partial" | "missing"): EvidenceTone => (s === "present" ? "ok" : s === "partial" ? "partial" : "gap");

export function getRecommendation(state: GameState): ReadinessRecommendationId | null {
  const v = state.decisions?.[READINESS_RECOMMENDATION_KEY];
  return v === "proceed" || v === "postpone" || v === "proceed_conditionally" ? v : null;
}

/** Outstanding readiness gaps (both product lines) — a pure read-out of the project's actual position. */
export function readinessGaps(state: GameState): { label: string; detail: string; product: "A" | "B" }[] {
  const board = computeReadinessBoard(state);
  return [
    ...board.productA.filter((i) => i.status === "gap").map((i) => ({ label: i.label, detail: i.detail, product: "A" as const })),
    ...board.productB.filter((i) => i.status === "gap").map((i) => ({ label: i.label, detail: i.detail, product: "B" as const })),
  ];
}

function readinessDocument(state: GameState): DossierDocument {
  const rec = getRecommendation(state);
  const recOption = READINESS_RECOMMENDATION.options.find((o) => o.id === rec);
  const strategyId = state.decisions?.[RECOVERY_STRATEGY_KEY];
  const strategy = RECOVERY_DECISION.options.find((o) => o.id === strategyId);
  const outcome = state.decisions?.[RECOVERY_OUTCOME_KEY];
  const reviewed = hasReachedToolScreen(state, READINESS_TOOL);
  const sections: DossierSection[] = [];

  const position: DossierRow[] = [];
  if (recOption) position.push({ label: "Recommendation to the Project Board", value: `${recOption.letter} — ${recOption.title}`, tone: "neutral" });
  if (strategy) position.push({ label: "Recovery strategy", value: strategy.title, tone: "neutral" });
  if (outcome) position.push({ label: "Recovery position at the time", value: outcome === "strong" ? "On track" : outcome === "partial" ? "Partially recovered" : "Not recovered", tone: outcome === "strong" ? "ok" : outcome === "partial" ? "partial" : "gap" });
  if (position.length) sections.push({ heading: "Final readiness position", rows: position });

  if (reviewed) {
    const board = computeReadinessBoard(state);
    const rows = (["A", "B"] as const).flatMap((p) =>
      (p === "A" ? board.productA : board.productB).map((i) => ({
        label: `Product ${p} — ${i.label}`,
        value: i.detail,
        tone: i.status === "clear" ? ("ok" as const) : ("gap" as const),
      })),
    );
    const closed = ["training", "validation", "sops", "docs"].filter((c) => state.flags[`readiness_close_${c}`]);
    sections.push({
      heading: "Commissioning criteria",
      rows,
      note: closed.length ? `Closed during the final readiness review: ${closed.join(", ")}.` : undefined,
    });
  }

  const available = sections.length > 0;
  const gaps = reviewed ? readinessGaps(state).length : null;
  return {
    id: "readiness",
    title: "Readiness Assessment",
    subtitle: "Commissioning criteria and outstanding conditions",
    available,
    unavailableReason: available ? undefined : "not_reached", // these records exist in every full playthrough
    sections,
    strength: !available ? "unavailable" : gaps === null ? "partial" : gaps === 0 ? "strong" : gaps <= 2 ? "partial" : "weak",
  };
}

/** Act 2 risk workshop — what the player actually did with each risk (choiceHistory), so the register shows
 *  responses, not only the three "_risk_logged" flags. */
const WORKSHOP: { choiceId: string; risk: string; responses: { match: string; value: string; tone: EvidenceTone }[]; loggedFlag: string; loggedValue: string }[] = [
  {
    choiceId: "CHOICE_ACT2_SCENE04",
    risk: "Electrical contractor reliability",
    loggedFlag: "contractor_risk_logged",
    loggedValue: "Logged formally on the risk register",
    responses: [
      { match: "Log this formally", value: "Logged formally on the risk register", tone: "ok" },
      { match: "ping Tomasz", value: "Raised informally with the contractor — not logged", tone: "partial" },
      { match: "keep an eye", value: "Monitored — not logged", tone: "partial" },
    ],
  },
  {
    choiceId: "CHOICE_ACT2_SCENE04_VALIDATION",
    risk: "Validation timeline",
    loggedFlag: "validation_risk_logged",
    loggedValue: "Logged — slack built into the validation timeline",
    responses: [
      { match: "Build slack", value: "Logged — slack built into the validation timeline", tone: "ok" },
      { match: "Note it, revisit", value: "Noted — no mitigation planned", tone: "partial" },
      { match: "timeline stays", value: "Accepted — no mitigation", tone: "gap" },
    ],
  },
  {
    choiceId: "CHOICE_ACT2_SCENE04_CONTINGENCY",
    risk: "Contingency budget adequacy",
    loggedFlag: "contingency_risk_logged",
    loggedValue: "Logged — escalated to the Board for more contingency",
    responses: [
      { match: "Push back to the Board", value: "Logged — escalated to the Board for more contingency", tone: "ok" },
      { match: "monitor spend", value: "Noted — spend monitored", tone: "partial" },
      { match: "stays as budgeted", value: "Accepted — managed within the existing budget", tone: "gap" },
    ],
  },
];
const OUTLOOK: Record<string, string> = { worsening: "worsening", stable: "stable", improving: "improving" };

function riskDocument(state: GameState): DossierDocument {
  const history = state.choiceHistory ?? [];
  const sections: DossierSection[] = [];

  // 1. Identified in the Act 2 risk workshop, with the response the player chose.
  const workshop: DossierRow[] = [];
  for (const w of WORKSHOP) {
    const entry = [...history].reverse().find((c) => c.choiceId === w.choiceId);
    const response = entry ? w.responses.find((r) => entry.optionText.includes(r.match)) : null;
    if (response) workshop.push({ label: w.risk, value: response.value, tone: response.tone });
    else if (state.flags?.[w.loggedFlag]) workshop.push({ label: w.risk, value: w.loggedValue, tone: "ok" });
  }
  if (workshop.length) sections.push({ heading: "Identified risks — Act 2 risk workshop", rows: workshop });

  // 2. The player's own entries in their monthly status reports (latest report per risk).
  const reported = new Map<string, { report: number; rag: RagStatus; outlook: string; mitigation?: string }>();
  state.statusReports.forEach((r, i) =>
    r.selectedRisks.forEach((sr) => reported.set(sr.riskId, { report: i + 1, rag: sr.reportedRag, outlook: sr.outlook, mitigation: sr.mitigationText })),
  );
  const reportedRows: DossierRow[] = [];
  for (const [riskId, e] of reported) {
    const title = getReportableRiskTitle(riskId) ?? riskId;
    reportedRows.push({ label: title, value: `Report ${e.report}: ${RAG_WORD[e.rag]}, ${OUTLOOK[e.outlook] ?? e.outlook}`, tone: ragTone(e.rag) });
    if (e.mitigation) reportedRows.push({ label: "   Mitigation (as reported)", value: e.mitigation, tone: "neutral" });
  }
  if (reportedRows.length) sections.push({ heading: "Risk entries — monthly status reports", rows: reportedRows });

  // 3. RAID log (owner, response, escalation) and issues that materialised, with the response on record.
  const raidOwner = state.decisions?.["raid_ev06_owner"];
  const issueRows: DossierRow[] = [];
  if (raidOwner) {
    const resp = state.decisions?.["raid_ev06_response"];
    issueRows.push({
      label: "RAID log — electrical contractor",
      value: `Owner: ${raidOwner}${resp ? ` · Response: ${resp}` : ""} · Escalated: ${state.flags?.["raid_ev06_escalated"] ? "yes" : "no"}`,
      tone: "ok",
    });
  }
  for (const eventId of state.eventsResolved) {
    const title = getReportableRiskTitle(eventId);
    if (!title) continue;
    const response = [...history].reverse().find((c) => c.choiceId === `CHOICE_${eventId}`);
    issueRows.push({
      label: title,
      value: response ? `Materialised · Response: ${response.optionText.replace(/\.$/, "")} · Outcome not tracked` : "Materialised · Response not recorded",
      tone: response ? "partial" : "gap",
    });
  }
  if (issueRows.length) sections.push({ heading: "Issues and RAID log", rows: issueRows });

  const available = sections.length > 0;
  if (available) {
    const band = metricBand(state.projectMetrics.riskExposure, false);
    sections.push({
      heading: "Overall exposure (derived from the project position, not a recorded entry)",
      rows: [{ label: "Exposure rating", value: band === "green" ? "Low" : band === "yellow" ? "Moderate" : "High", tone: band === "green" ? "ok" : band === "yellow" ? "partial" : "gap" }],
    });
  }
  const controlled = workshop.filter((r) => r.tone === "ok").length + (raidOwner ? 1 : 0) + [...reported.values()].filter((e) => e.mitigation).length;
  return {
    id: "risks",
    title: "Risk & Issue Register",
    subtitle: "Risks, mitigations and unresolved issues",
    available,
    // Nothing at all: the risk workshop was never played in this save (e.g. a dev jump) — not a player omission.
    unavailableReason: available ? undefined : "not_reached",
    sections,
    strength: !available ? "unavailable" : controlled >= 2 ? "strong" : controlled === 1 ? "partial" : "weak",
  };
}

function qualityDocument(state: GameState): DossierDocument {
  // Only once there's a validation record at all (the Act 4 resourcing decision or the Act 5 readiness
  // review) — the training card is a read-out of metrics, and must not appear on a save that never got there.
  const resourcing = state.decisions?.validationResourcing;
  const hasRecord = Boolean(resourcing) || hasReachedToolScreen(state, READINESS_TOOL);
  const cards = hasRecord
    ? computeAuditTrailEvidence(state).filter((c) => c.category === "validation_and_quality" && c.status !== "missing")
    : [];
  // "protect_a" / "split_thin" are recorded decisions, but they mean validation was incomplete somewhere.
  const toneFor = (c: (typeof cards)[number]): EvidenceTone =>
    c.id === "validation_resourcing" && (resourcing === "protect_a" || resourcing === "split_thin") ? "partial" : cardTone(c.status);
  const sections: DossierSection[] = [];
  if (cards.length) sections.push({ heading: "Qualification and validation", rows: cards.map((c) => ({ label: c.title, value: c.detail, tone: toneFor(c) })) });
  const quality = ["EV-02", "EV-05"].filter((e) => state.eventsResolved.includes(e));
  if (quality.length) {
    sections.push({
      heading: "Quality events",
      rows: quality.map((e) => ({ label: e === "EV-02" ? "Cleanroom GMP review" : "Commissioning contamination finding", value: "Recorded — rework required", tone: "gap" as const })),
    });
  }
  const available = sections.length > 0;
  const weak = cards.filter((c) => toneFor(c) !== "ok").length;
  return {
    id: "quality",
    title: "Quality & Validation Records",
    subtitle: "Testing and qualification evidence",
    available,
    unavailableReason: available ? undefined : "not_reached", // these records exist in every full playthrough
    sections,
    strength: !available ? "unavailable" : weak === 0 && quality.length === 0 ? "strong" : weak + quality.length <= 1 ? "partial" : "weak",
  };
}

function statusDocument(state: GameState): DossierDocument {
  const sections: DossierSection[] = state.statusReports.map((r, i) => ({
    heading: `Monthly Status Report ${i + 1}`,
    rows: [
      { label: "Overall", value: RAG_WORD[r.reported.overall], tone: ragTone(r.reported.overall) },
      { label: "Budget", value: RAG_WORD[r.reported.budget], tone: ragTone(r.reported.budget) },
      { label: "Scope", value: RAG_WORD[r.reported.scope], tone: ragTone(r.reported.scope) },
      { label: "Resource", value: RAG_WORD[r.reported.resource], tone: ragTone(r.reported.resource) },
      { label: "Milestone plan", value: RAG_WORD[r.reported.milestone], tone: ragTone(r.reported.milestone) },
    ],
  }));
  const available = sections.length > 0;
  const mismatch = findMostMaterialReportMismatch(state);
  return {
    id: "status",
    title: "Project Status Reports",
    subtitle: "Delivery progress and reported confidence",
    available,
    unavailableReason: available ? undefined : "not_reached", // these records exist in every full playthrough
    sections,
    strength: !available ? "unavailable" : mismatch?.severity === "material" ? "weak" : mismatch ? "partial" : "strong",
  };
}

export function buildInspectionDossier(state: GameState): DossierDocument[] {
  return [readinessDocument(state), riskDocument(state), qualityDocument(state), statusDocument(state)];
}

// ---------------------------------------------------------------------------------------------------
// The conversation
// ---------------------------------------------------------------------------------------------------

export interface InspectionOption {
  id: string;
  text: string;
  /** Hidden credit for this answer given the actual record (positive = defensible). */
  score: number;
}
export interface InspectionQuestion {
  id: string;
  text: string;
  options: InspectionOption[];
}

/** Scene 1 — the player's account of their recommendation (read from the save, never re-chosen). */
export const RECOMMENDATION_ACCOUNT: Record<ReadinessRecommendationId, string> = {
  proceed:
    "Based on our final readiness assessment, I recommended proceeding with commissioning. We considered the outstanding issues, the controls in place and the evidence available at the time.",
  postpone:
    "I recommended delaying commissioning. There were outstanding requirements that I felt needed further verification before we could responsibly proceed.",
  proceed_conditionally: "I recommended proceeding only once the outstanding conditions had been satisfied and verified.",
};

export const LINES = {
  opening: "Perhaps you can walk me through the basis of your recommendation.",
  understood: "Understood. I'd like to see how you arrived at that position.",
  round1: "Let's start with the readiness assessment. What gave you confidence in the position you reported?",
  round2: "Now, let's turn to the outstanding risks. How did you determine which issues could materially affect commissioning?",
  closing: [
    { who: "whitfield", text: "That covers what I needed to review." },
    { who: "player", text: "Is there anything else you'd like us to provide?" },
    { who: "whitfield", text: "Not at this stage. I'll consider the documentation alongside the findings from the inspection." },
    { who: "whitfield", text: "You'll receive the formal outcome in due course." },
  ],
} as const;

/** Round 1's follow-up — depends on what was presented and what the record actually shows. */
export function pickFollowUp(state: GameState, presented: InspectionDocId): InspectionQuestion {
  const doc = buildInspectionDossier(state).find((d) => d.id === presented)!;
  if (!doc.available) {
    return {
      id: "r1_unavailable",
      text: "There's nothing in that file for me to review. How was completion established?",
      options: [
        { id: "team", text: "The team confirmed directly that the work was done.", score: -1 },
        { id: "elsewhere", text: "The records exist — they weren't compiled into the dossier.", score: -1 },
        { id: "gap", text: "It wasn't formally established. That's a gap in our records.", score: 1 },
      ],
    };
  }
  if (presented === "status") {
    const m = findMostMaterialReportMismatch(state);
    if (m) {
      return {
        id: "r1_mismatch",
        text: `${m.reportLabel} shows ${m.dimensionLabel.toLowerCase()} as ${RAG_WORD[m.reportedRag].toLowerCase()}. What supported that position at the time?`,
        options: [
          { id: "understated", text: `On reflection, it understated the position. It should have been reported as ${RAG_WORD[m.actualRag].toLowerCase()}.`, score: 1 },
          { id: "team_view", text: "It reflected the team's view at that point.", score: -1 },
          { id: "accurate", text: "It was accurate when it was written.", score: -2 },
        ],
      };
    }
    return {
      id: "r1_reported",
      text: "These are the positions you reported. How were they checked before they went to the Board?",
      options: [
        { id: "checked", text: "Each rating was checked against the underlying data before submission.", score: 1 },
        { id: "leads", text: "They reflected the workstream leads' own assessments.", score: 0 },
        { id: "plan", text: "They were based on the plan.", score: -1 },
      ],
    };
  }
  if (doc.strength === "strong") {
    return {
      id: "r1_assurance",
      text: "Who verified that, independently of the delivery team?",
      options: [
        { id: "qa", text: "Quality reviewed and signed the records. They report separately from delivery.", score: 2 },
        { id: "leads", text: "The workstream leads verified their own areas.", score: -1 },
        { id: "plan", text: "We relied on the completion dates in the plan.", score: -2 },
      ],
    };
  }
  return {
    id: "r1_verify",
    text: "You've described these activities as complete. How was that verified?",
    options: [
      { id: "documented", text: "Each item was closed against documented evidence — test records, signed protocols and QA sign-off.", score: doc.strength === "weak" ? -2 : -1 },
      { id: "review", text: "Leads confirmed status at the weekly review. Anything that couldn't be confirmed stayed open.", score: 1 },
      { id: "forecast", text: "The remaining activities were forecast to close before the commissioning date.", score: -1 },
    ],
  };
}

/** Round 1's second exchange — about the recommendation itself, judged against the actual position. */
export function recommendationQuestion(state: GameState): InspectionQuestion {
  const rec = getRecommendation(state) ?? "proceed_conditionally";
  const gaps = readinessGaps(state).length;
  const highRisk = metricBand(state.projectMetrics.riskExposure, false) === "red";
  if (rec === "proceed") {
    return {
      id: "r1_rec_proceed",
      text: gaps > 0 ? "You recommended proceeding. Why were the outstanding items acceptable?" : "You recommended proceeding. What would have changed your mind?",
      options: [
        { id: "controlled", text: "Each open item had an owner and a control, and none affected product quality.", score: gaps <= 1 && !highRisk ? 1 : -1 },
        { id: "contract", text: "The commissioning date was a contractual commitment.", score: -2 },
        { id: "later", text: "The remaining items were minor and could be closed after go-live.", score: gaps === 0 ? 0 : -1 },
      ],
    };
  }
  if (rec === "postpone") {
    return {
      id: "r1_rec_postpone",
      text: "You recommended a delay. What would have justified reconsidering that?",
      options: [
        { id: "verified", text: "Closure of the open qualification and quality items, verified by QA.", score: gaps > 0 ? 2 : 0 },
        { id: "sponsor", text: "An instruction from the sponsor to proceed.", score: -1 },
        { id: "date", text: "A revised date the Board was prepared to accept.", score: 0 },
      ],
    };
  }
  return {
    id: "r1_rec_conditional",
    text: "Who verifies that the conditions have been met — and what happens if they aren't?",
    options: [
      { id: "qa_gate", text: "Quality verifies each condition. If any isn't met, commissioning doesn't start and it goes back to the Board.", score: 2 },
      { id: "workaround", text: "The project team confirms them, and we'd agree a workaround.", score: -1 },
      { id: "close_later", text: "We'd proceed and close them during early production.", score: -2 },
    ],
  };
}

/** Round 2's follow-up — mitigation, unless the register never recorded the risks at all. */
export function riskFollowUp(state: GameState, presented: InspectionDocId): InspectionQuestion {
  const risks = buildInspectionDossier(state).find((d) => d.id === "risks")!;
  const exposure = metricBand(state.projectMetrics.riskExposure, false);
  if (!risks.available || presented !== "risks") {
    return {
      id: "r2_unlogged",
      text: risks.available ? "That doesn't show me the risks themselves. How were they being tracked?" : "I don't see these risks formally recorded. How were they being managed?",
      options: [
        { id: "meetings", text: "Through the weekly delivery meetings.", score: -1 },
        { id: "elsewhere", text: "They were tracked elsewhere, by the workstream leads.", score: -1 },
        { id: "gap", text: "Not formally enough. That's something I'd change.", score: 1 },
      ],
    };
  }
  return {
    id: "r2_mitigation",
    text: "And if the mitigation had not worked, what would your next step have been?",
    options: [
      { id: "escalate", text: "Escalate to the sponsor and the Project Board, with a go/no-go decision before commissioning.", score: 2 },
      { id: "verify", text: "Commission additional verification before deciding whether to proceed.", score: 1 },
      { id: "absorb", text: "Absorb it within the schedule and keep going.", score: exposure === "green" ? -1 : -2 },
    ],
  };
}

export function authorityQuestion(state: GameState): InspectionQuestion {
  const raidOwner = Boolean(state.decisions?.["raid_ev06_owner"]);
  return {
    id: "r2_authority",
    text: "And who had the authority to make that decision?",
    options: [
      { id: "board", text: "The Project Board, on the sponsor's recommendation. Quality holds the release sign-off.", score: raidOwner ? 2 : 1 },
      { id: "pm", text: "I did, as project manager.", score: -1 },
      { id: "site", text: "The site and engineering leads.", score: -1 },
    ],
  };
}

// ---------------------------------------------------------------------------------------------------
// Progress (in GameState.decisions) and the one-time effect on the existing metrics
// ---------------------------------------------------------------------------------------------------

export const INSP = {
  intro: "insp_intro_done",
  r1Doc: "insp_r1_doc",
  r1Answer: "insp_r1_answer", // "<questionId>:<optionId>"
  r1Rec: "insp_r1_rec",
  r2Doc: "insp_r2_doc",
  r2Answer: "insp_r2_answer",
  r2Authority: "insp_r2_authority",
  closed: "insp_closed",
  selected: "insp_selected",
} as const;
export const INSPECTION_SCORED_FLAG = "inspection_scored";

export type InspectionStep = "intro" | "r1_present" | "r1_answer" | "r1_rec" | "r2_present" | "r2_answer" | "r2_authority" | "closing" | "done";

export function currentStep(state: GameState): InspectionStep {
  const d = state.decisions ?? {};
  if (!d[INSP.intro]) return "intro";
  if (!d[INSP.r1Doc]) return "r1_present";
  if (!d[INSP.r1Answer]) return "r1_answer";
  if (!d[INSP.r1Rec]) return "r1_rec";
  if (!d[INSP.r2Doc]) return "r2_present";
  if (!d[INSP.r2Answer]) return "r2_answer";
  if (!d[INSP.r2Authority]) return "r2_authority";
  if (!d[INSP.closed]) return "closing";
  return "done";
}

/** The question for an answer step (null for non-answer steps). Re-derived on resume, so it's stable. */
export function questionFor(state: GameState, step: InspectionStep): InspectionQuestion | null {
  const d = state.decisions ?? {};
  if (step === "r1_answer") return pickFollowUp(state, d[INSP.r1Doc] as InspectionDocId);
  if (step === "r1_rec") return recommendationQuestion(state);
  if (step === "r2_answer") return riskFollowUp(state, d[INSP.r2Doc] as InspectionDocId);
  if (step === "r2_authority") return authorityQuestion(state);
  return null;
}

/** Hidden credit for presenting a document in a round. */
function evidenceCredit(doc: DossierDocument, round: 1 | 2): number {
  if (!doc.available) return doc.unavailableReason === "not_reached" ? 0 : -1;
  const relevant = round === 1 ? doc.id === "readiness" || doc.id === "quality" : doc.id === "risks";
  if (!relevant) return doc.id === "status" ? 0 : -1;
  return doc.strength === "strong" ? 2 : doc.strength === "partial" ? 1 : 0;
}

/** Was the recommendation defensible given the actual readiness and risk position? (No option is
 *  correct in itself: delaying with real gaps is credited; proceeding into them is not.) */
export function recommendationCredit(state: GameState): number {
  const rec = getRecommendation(state);
  if (!rec) return 0;
  const gaps = readinessGaps(state).length;
  const highRisk = metricBand(state.projectMetrics.riskExposure, false) === "red";
  if (rec === "proceed") return gaps >= 3 || highRisk ? -2 : gaps <= 1 ? 1 : 0;
  if (rec === "postpone") return gaps >= 2 || highRisk ? 2 : gaps === 0 ? -1 : 0;
  return gaps >= 1 && gaps <= 4 ? 1 : 0;
}

function answerScore(state: GameState, key: string, step: InspectionStep): number {
  const raw = state.decisions?.[key];
  if (!raw) return 0;
  const [, optionId] = raw.split(":");
  // Re-derive the question with the state as it was when it was asked (progress keys only affect which
  // step we're on, not the record the question reads), so the score can't drift.
  const q = questionFor(state, step);
  return q?.options.find((o) => o.id === optionId)?.score ?? 0;
}

export function inspectionScore(state: GameState): number {
  const docs = buildInspectionDossier(state);
  const doc = (k: string) => docs.find((d) => d.id === state.decisions?.[k]);
  const r1 = doc(INSP.r1Doc);
  const r2 = doc(INSP.r2Doc);
  return (
    (r1 ? evidenceCredit(r1, 1) : 0) +
    (r2 ? evidenceCredit(r2, 2) : 0) +
    answerScore(state, INSP.r1Answer, "r1_answer") +
    answerScore(state, INSP.r1Rec, "r1_rec") +
    answerScore(state, INSP.r2Answer, "r2_answer") +
    answerScore(state, INSP.r2Authority, "r2_authority") +
    recommendationCredit(state)
  );
}

/** Applied exactly once, at the close: the inspection's findings move the same two metrics the existing
 *  ending gates read (Quality gate: regulatoryReadiness; Delivery composite: boardConfidence).
 *  Bounded (±6 / ±4) so it can tip a borderline outcome without overriding the rest of the project. */
export function applyInspectionOutcome(state: GameState): GameState {
  if (state.flags?.[INSPECTION_SCORED_FLAG]) return state;
  const s = inspectionScore(state);
  const clamp = (n: number, m: number) => Math.max(-m, Math.min(m, n));
  const next = applyEffects(state, {
    regulatoryReadiness: clamp(Math.round(s * 0.6), 6),
    boardConfidence: clamp(Math.round(s * 0.4), 4),
  });
  return applyFlags(next, { [INSPECTION_SCORED_FLAG]: true });
}
