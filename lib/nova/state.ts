import type {
  GameState,
  Flags,
  Character,
  DialogueLine,
  ToolScreenBlock,
  RiskInvestigationBank,
  ArtefactStatus,
  RagStatus,
  StatusReportDimension,
  ActualStatusReport,
  ActiveRisk,
  StatusReportRecord,
  ReportableRisk,
  CbsClassification,
} from "./types";
import { getCharacter, getDefaultGameState, getEvent, getToolScreen, EVENT_FRAME_SUFFIX } from "./data";
import type { KenBurnsConfig } from "./narrative/kenBurns";

const SAVE_KEY = "projectNova.saveGame.v1";

/** Relationship score at/above which a "neutral" beat is shown as "warm"
 * instead, for characters whose portrait set has a warm variant. Generic
 * mood-shading rule, not specific to any one character or act. */
export const WARM_RELATIONSHIP_THRESHOLD = 65;

// ---------------------------------------------------------------------------
// Save / load
// ---------------------------------------------------------------------------

export function hasSavedGame(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SAVE_KEY) !== null;
}

export function loadGame(): GameState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw) as GameState;
    // Backfill fields added after some saves were already written, so an
    // older save doesn't crash a newer build of the engine.
    if (state.currentBackground === undefined) state.currentBackground = null;
    if (!state.toolProgress) state.toolProgress = {};
    if (!state.toolPlacements) state.toolPlacements = {};
    if (!state.toolSelections) state.toolSelections = {};
    if (!state.toolSubmitted) state.toolSubmitted = {};
    if (state.eventQueue === undefined) state.eventQueue = null;
    if (state.eventQueueIndex === undefined) state.eventQueueIndex = 0;
    if (state.eventQueueExitScene === undefined) state.eventQueueExitScene = null;
    if (!state.decisions) state.decisions = {};
    if (!state.statusReports) state.statusReports = [];
    if (!state.eventsResolved) state.eventsResolved = [];
    return state;
  } catch {
    return null;
  }
}

export function saveGame(state: GameState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function clearSavedGame(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SAVE_KEY);
}

export function newGameState(): GameState {
  return getDefaultGameState();
}

// ---------------------------------------------------------------------------
// Effects / flags — generic key-driven mutation, no story-specific hardcoding
// ---------------------------------------------------------------------------

/**
 * Applies a choice option's `effects` object additively.
 * Keys of the form `${characterId}Trust` are routed to
 * state.relationships[characterId]; every other key is routed to
 * state.projectMetrics[key] if that key exists there. Unknown keys are
 * logged and skipped rather than throwing, so new content data can add
 * metrics without an engine change.
 */
export function applyEffects(
  state: GameState,
  effects: Record<string, number> | undefined
): GameState {
  if (!effects || Object.keys(effects).length === 0) return state;
  const next: GameState = {
    ...state,
    projectMetrics: { ...state.projectMetrics },
    relationships: { ...state.relationships },
  };

  for (const [key, value] of Object.entries(effects)) {
    const trustMatch = key.match(/^(.+)Trust$/);
    const characterId = trustMatch?.[1];
    if (characterId && characterId in next.relationships) {
      next.relationships[characterId] += value;
      continue;
    }
    if (key in next.projectMetrics) {
      next.projectMetrics[key] += value;
      continue;
    }
    console.warn(`[nova-engine] applyEffects: unrecognised effect key "${key}"`);
  }

  return next;
}

/** Merges a choice option's `flags` object into state.flags. */
export function applyFlags(state: GameState, flags: Flags | undefined): GameState {
  if (!flags || Object.keys(flags).length === 0) return state;
  return { ...state, flags: { ...state.flags, ...flags } };
}

/** Merges a choice option's `decisions` object into state.decisions — the
 * categorical-outcome counterpart to applyFlags, see GameState.decisions'
 * own doc comment for why these are kept separate. */
export function applyDecisions(state: GameState, decisions: Record<string, string> | undefined): GameState {
  if (!decisions || Object.keys(decisions).length === 0) return state;
  return { ...state, decisions: { ...state.decisions, ...decisions } };
}

/** Applies a scene's own `flagsSet` array (flags that become true simply by
 * reaching/completing the scene, independent of any choice). */
export function applySceneFlagsSet(
  state: GameState,
  flagsSet: string[] | undefined
): GameState {
  if (!flagsSet || flagsSet.length === 0) return state;
  const nextFlags = { ...state.flags };
  for (const flag of flagsSet) {
    // Defensive: scenes.json can contain descriptive/conditional notes here
    // for later acts (e.g. "flag_x (conditional on y)") — only set clean
    // boolean flag names.
    if (/^[a-zA-Z0-9_]+$/.test(flag)) {
      nextFlags[flag] = true;
    }
  }
  return { ...state, flags: nextFlags };
}

/** Unions `characterIds` into state.charactersMet (deduplicated, order
 * preserved from first appearance). Called from GameRoot's enterScene
 * with the entered scene's Scene.charactersInvolved, so the persistent
 * character panel's "Already met" badge (CharacterPanel.tsx) is a live
 * readout of real story progress rather than a fixed snapshot. A no-op
 * if every id is already present — returns `state` unchanged so callers
 * don't need to guard against unnecessary re-renders themselves. */
export function markCharactersMet(state: GameState, characterIds: string[]): GameState {
  if (characterIds.length === 0) return state;
  const newIds = characterIds.filter((id) => !state.charactersMet.includes(id));
  if (newIds.length === 0) return state;
  return { ...state, charactersMet: [...state.charactersMet, ...newIds] };
}

// ---------------------------------------------------------------------------
// Monthly Status Report honesty mechanic — REMOVED. Used to live here
// (CHOICE_ACT4_SCENE05_M1/M2's honestyTone vs. actual-state comparison,
// deferred-penalty bookkeeping via hid_problem_from_marcus/
// honesty_penalty_pending), covering ACT4_SCENE05B/05C before they had
// real report-builder tool screens of their own. Superseded now that
// every Monthly Status Report (05/05B/05C) is the real StatusReportBuilder
// UI — keeping both would mean scoring the same submission twice through
// two different, potentially contradictory mechanics. Removed rather than
// left dangling per explicit instruction; see "Act 4 event redistribution"
// in DESIGN_NOTES.md. CHOICE_ACT4_SCENE05_M2 (the only choice that ever
// set honestyTone) is removed from choices.json too.

// ---------------------------------------------------------------------------
// Monthly Status Report — actual state (computeActualStatusReport). This is
// the project's real position, computed fresh every time a report screen
// opens — never shown directly to the player. What they choose to submit
// (a separate, independently-picked RAG per dimension) is the report UI's
// own concern, not modeled here.
//
// Every threshold lives in STATUS_REPORT_THRESHOLDS, nothing inline — these
// are first-pass numbers, expected to get retuned after the first report
// is actually playtested, and centralizing them is what makes that cheap.
//
// Each dimension's formula is deliberately built from signals that
// already exist (or, for big01Response/validationResourcing, a single
// small decisions-bag entry — see CHOICE_BIG-01/CHOICE_EV-NP2), and each
// is meant to answer one specific, narrow question rather than score
// "how well is the player doing":
//   - Budget: what fraction of the original budget is left.
//   - Milestone Plan: schedule health, same banding the HUD's Delivery
//     Pace already uses.
//   - Scope: is the agreed scope under formal control, not how much of it
//     there is. A big, formally re-planned scope can be green; scope that
//     grew without ever going through a real re-plan is the one thing
//     that's red.
//   - Resource: current capacity position, not a permanent verdict on any
//     one past choice. Only genuinely live signals (team morale, whether
//     the two roles later content treats as consequential — Ravi/Elin —
//     are both filled) drive the RAG; validationResourcing shows up only
//     as evidence text, since a one-time categorical choice can never
//     become "current" again the way a metric can.
// ---------------------------------------------------------------------------

export const STATUS_REPORT_THRESHOLDS = {
  BUDGET_GREEN_AT: 60, // % of STARTING_BUDGET remaining
  BUDGET_RED_BELOW: 30,
  SCHEDULE_GREEN_AT: 60, // scheduleHealth
  SCHEDULE_RED_BELOW: 30,
  MORALE_GREEN_AT: 60, // teamMorale
  MORALE_RED_BELOW: 40,
  /** Descoped items (CBS cut + MoSCoW "Won't") at/above this count is what
   * tips an otherwise-controlled Scope from green to amber — never red on
   * its own; see SCOPE_UNCONTROLLED_GROWTH below for the one red trigger. */
  SCOPE_DESCOPE_STRAIN_AT: 2,
};

/** The two candidates later content already treats as consequential — the
 * EV-07/EV-14 dialogue's own compound condition is keyed on exactly these
 * two names — reused here rather than counting raw headcount, so five
 * well-chosen hires can outscore six poorly-chosen ones the way the Team
 * Selection tool's own design clearly intends. */
const CRITICAL_HIRE_IDS = ["ravi", "elin"];

const MOSCOW_TOOL_ID = "TOOL_ACT2_SCENE02_MOSCOW";
const MOSCOW_WONT_BUCKET = "Won't";

function ragFromBand(band: MetricBand): RagStatus {
  return band === "yellow" ? "amber" : band;
}

/** Every MoSCoW card that ended up in "Won't" (state.toolPlacements
 * persists the final bucket per card, confirmed against
 * placePriorityCard itself rather than assumed). Act 3's CBS used to
 * contribute its own descoped task here too, but it no longer performs
 * any actual descoping — see the "cost_review_with_descope (CBS)" module
 * comment further down — so it correctly has nothing to add: a package
 * the player merely classified as a potential lever hasn't been descoped
 * under pressure, only flagged as somewhere pressure COULD land later. */
function countDescopedItems(state: GameState): number {
  return Object.values(state.toolPlacements[MOSCOW_TOOL_ID] ?? {}).filter(
    (bucket) => bucket === MOSCOW_WONT_BUCKET
  ).length;
}

function hasCriticalRoleCoverage(flags: Flags): boolean {
  return CRITICAL_HIRE_IDS.every((id) => Boolean(flags[`${id}_hired`]));
}

function computeBudgetDimension(state: GameState): StatusReportDimension {
  const T = STATUS_REPORT_THRESHOLDS;
  const pctRemaining = (state.projectMetrics.budgetRemaining / STARTING_BUDGET) * 100;
  const band = metricBand(pctRemaining, true, T.BUDGET_GREEN_AT, T.BUDGET_RED_BELOW);
  const reasonCodes = [band === "red" ? "BUDGET_CRITICAL" : band === "yellow" ? "BUDGET_TIGHT" : "BUDGET_HEALTHY"];
  return {
    rag: ragFromBand(band),
    reasonCodes,
    evidence: [`${Math.round(pctRemaining)}% of original budget remaining`],
  };
}

function computeMilestoneDimension(state: GameState): StatusReportDimension {
  const T = STATUS_REPORT_THRESHOLDS;
  const schedule = state.projectMetrics.scheduleHealth;
  const band = metricBand(schedule, true, T.SCHEDULE_GREEN_AT, T.SCHEDULE_RED_BELOW);
  const reasonCodes = [
    band === "red" ? "SCHEDULE_SEVERE_OVERRUN" : band === "yellow" ? "SCHEDULE_SLIPPING" : "SCHEDULE_ON_TRACK",
  ];
  const forecastWeek = computeWeeksRemaining(schedule);
  return {
    rag: ragFromBand(band),
    reasonCodes,
    evidence: [`Forecast completion: Week ${forecastWeek} (baseline Week 24)`],
  };
}

function computeScopeDimension(state: GameState): StatusReportDimension {
  const T = STATUS_REPORT_THRESHOLDS;
  const big01Response = state.decisions.big01Response;
  const descopedCount = countDescopedItems(state);

  if (big01Response === "phase_b_quietly") {
    return {
      rag: "red",
      reasonCodes: ["SCOPE_UNCONTROLLED_GROWTH"],
      evidence: ["Product B absorbed without a formal re-plan"],
    };
  }
  if (descopedCount >= T.SCOPE_DESCOPE_STRAIN_AT) {
    return {
      rag: "amber",
      reasonCodes: ["SCOPE_STRAINED_BY_DESCOPING"],
      evidence: [`${descopedCount} requirements descoped under pressure`],
    };
  }
  const evidence =
    big01Response === "full_replan"
      ? ["Scope formally re-planned after BIG-01"]
      : big01Response === "renegotiate"
        ? ["Timeline renegotiated before absorbing new scope"]
        : ["No uncontrolled scope growth so far"];
  return { rag: "green", reasonCodes: ["SCOPE_CONTROLLED"], evidence };
}

function computeResourceDimension(state: GameState): StatusReportDimension {
  const T = STATUS_REPORT_THRESHOLDS;
  const morale = state.projectMetrics.teamMorale;
  const criticalCovered = hasCriticalRoleCoverage(state.flags);
  const evidence = [
    `Team morale: ${morale}`,
    criticalCovered ? "Critical roles covered" : "Critical role gap — not both of Ravi/Elin hired",
  ];

  const reasonCodes: string[] = [];
  if (morale < T.MORALE_RED_BELOW) reasonCodes.push("MORALE_COLLAPSE");
  if (!criticalCovered) reasonCodes.push("CRITICAL_ROLE_GAP");
  if (reasonCodes.length > 0) {
    return { rag: "red", reasonCodes, evidence };
  }
  if (morale >= T.MORALE_GREEN_AT && criticalCovered) {
    return { rag: "green", reasonCodes: ["RESOURCE_HEALTHY"], evidence };
  }
  return { rag: "amber", reasonCodes: ["RESOURCE_STRAINED"], evidence };
}

/** Every Main/Late Wave event whose own eligibility condition (the exact
 * same check computeEventQueue uses) is true right now — reused rather
 * than reimplemented, so a risk shows up in the report's pool the moment
 * its real trigger condition is true, matching how a real PM's status
 * report reports on currently-live risk conditions, not just events the
 * player has personally already lived through as a scene. Order follows
 * each wave's own declared order (EVENT_WAVE_MEMBERS), Main Wave first.
 * Computed inline (rather than a top-level constant) because
 * EVENT_WAVE_MEMBERS itself is declared later in this file — by the time
 * this function is actually called the whole module has finished
 * initializing, but a top-level `const` referencing it here would trip
 * the temporal-dead-zone check at module-eval time. */
function computeActiveRisks(state: GameState): ActiveRisk[] {
  const pool = allAct4EventIds();
  // Same banding the HUD's own risk chip uses (metricBand(riskExposure,
  // false) — default 60/30 thresholds) — every active risk currently
  // shares this one severity rather than each having its own; see
  // ActiveRisk's doc comment for why that's a deliberate first pass.
  const rag = ragFromBand(metricBand(state.projectMetrics.riskExposure, false));
  return pool.filter((eventId) => isEventEligible(eventId, state)).map((eventId) => ({
    riskId: eventId,
    title: getEvent(eventId)?.title ?? eventId,
    rag,
  }));
}

export function computeActualStatusReport(state: GameState): ActualStatusReport {
  return {
    budget: computeBudgetDimension(state),
    scope: computeScopeDimension(state),
    resource: computeResourceDimension(state),
    milestone: computeMilestoneDimension(state),
    risks: computeActiveRisks(state),
  };
}

/**
 * Records a player's Monthly Status Report submission — see
 * StatusReportRecord's doc comment for why both `actualSnapshot` (a fresh
 * computeActualStatusReport() capture, taken here, at submission time) and
 * `submission`'s own reported/selectedRisks/etc. views are kept. The
 * report-builder UI (step 4/5) owns everything about what the player
 * actually picked; this function's only job is pairing that with the
 * truth at the same moment and appending it to the log.
 */
export function submitStatusReport(
  state: GameState,
  submission: Omit<StatusReportRecord, "actualSnapshot">
): GameState {
  const record: StatusReportRecord = {
    ...submission,
    actualSnapshot: computeActualStatusReport(state),
  };
  return { ...state, statusReports: [...state.statusReports, record] };
}

// ---------------------------------------------------------------------------
// Act 5 — report mismatch detection. Replaces the old hid_problem_from_marcus
// boolean (removed alongside the honesty mechanic earlier this project) as
// the input to Inspector Whitfield's fourth inspection question — see the
// "Act 5 build" entry in DESIGN_NOTES.md. Walks every submitted report's
// OWN actualSnapshot (captured at submission time by submitStatusReport,
// above) against what the player independently chose to report, and finds
// the single most material discrepancy across the whole run. Deliberately
// only flags cases where the player's reported RAG was BETTER than the
// truth (understating a problem) — a report that's more cautious than
// reality is conservative, not a governance issue, and shouldn't read as
// one.
// ---------------------------------------------------------------------------

const RAG_SEVERITY: Record<RagStatus, number> = { green: 0, amber: 1, red: 2 };
const RAG_LABEL: Record<RagStatus, string> = { green: "Green", amber: "Amber", red: "Red" };

/** The four dimensions StatusReportRecord.reported and .actualSnapshot both
 * carry — "overall" is reported-only (the player's own summary judgement,
 * with no single ground-truth equivalent) so it's deliberately excluded
 * from this comparison. */
const REPORT_MISMATCH_DIMENSIONS = ["budget", "scope", "resource", "milestone"] as const;
type ReportMismatchDimension = (typeof REPORT_MISMATCH_DIMENSIONS)[number];

const REPORT_MISMATCH_DIMENSION_LABELS: Record<ReportMismatchDimension, string> = {
  budget: "Budget",
  scope: "Scope",
  resource: "Resource",
  milestone: "Milestone Plan",
};

export interface ReportMismatch {
  reportIndex: number;
  reportLabel: string;
  dimension: ReportMismatchDimension;
  dimensionLabel: string;
  reportedRag: RagStatus;
  actualRag: RagStatus;
  actualEvidence: string[];
  /** "material" = understated by two full bands (green reported, red
   * actual) — the "this concerns me" case. "borderline" = understated by
   * one band (green->amber or amber->red) — "questions it but accepts a
   * defensible explanation" per the design brief. */
  severity: "material" | "borderline";
}

/** The single most material "reported better than reality" discrepancy
 * across every report the player has submitted so far, or null if none
 * exists (every report was as-bad-or-worse than the truth, in every
 * dimension, every time — the "consistent reporting" case). Ties broken
 * toward the more recent report, since that's the one freshest in the
 * player's — and the narrative's — memory going into the inspection. */
export function findMostMaterialReportMismatch(state: GameState): ReportMismatch | null {
  let best: ReportMismatch | null = null;
  let bestDiff = 0;
  state.statusReports.forEach((report, reportIndex) => {
    for (const dimension of REPORT_MISMATCH_DIMENSIONS) {
      const reportedRag = report.reported[dimension];
      const actualRag = report.actualSnapshot[dimension].rag;
      const diff = RAG_SEVERITY[actualRag] - RAG_SEVERITY[reportedRag];
      if (diff <= 0) continue;
      if (diff < bestDiff) continue;
      if (diff === bestDiff && best && reportIndex < best.reportIndex) continue;
      bestDiff = diff;
      best = {
        reportIndex,
        reportLabel: `Report ${reportIndex + 1}`,
        dimension,
        dimensionLabel: REPORT_MISMATCH_DIMENSION_LABELS[dimension],
        reportedRag,
        actualRag,
        actualEvidence: report.actualSnapshot[dimension].evidence,
        severity: diff >= 2 ? "material" : "borderline",
      };
    }
  });
  return best;
}

/** Synthetic, never-persisted condition flags derived from
 * findMostMaterialReportMismatch — merged into dialogue-visibility checks
 * only (see effectiveDialogueFlags), never into gameState.flags itself,
 * since this is a pure readout of state.statusReports and needs no
 * separate storage. Exactly one is ever true. */
function reportMismatchFlags(state: GameState): Record<string, boolean> {
  const mismatch = findMostMaterialReportMismatch(state);
  return {
    report_mismatch_material: mismatch?.severity === "material",
    report_mismatch_borderline: mismatch?.severity === "borderline",
    report_mismatch_consistent: mismatch === null,
  };
}

/** {token} values for the report-mismatch dialogue lines (see
 * DIALOGUE_ACT5_SCENE03) — same substitution mechanism as {currentWeek}/
 * {chosenSupplier} (supplierTemplateValues), just sourced from
 * findMostMaterialReportMismatch instead. Empty object (no tokens) when
 * there's no mismatch, since the "consistent" dialogue variant never
 * references any of these. */
export function reportMismatchTemplateValues(state: GameState): Record<string, string> {
  const mismatch = findMostMaterialReportMismatch(state);
  if (!mismatch) return {};
  return {
    mismatchReportLabel: mismatch.reportLabel,
    mismatchDimensionLabel: mismatch.dimensionLabel,
    mismatchReportedRag: RAG_LABEL[mismatch.reportedRag],
    mismatchActualRag: RAG_LABEL[mismatch.actualRag],
    mismatchEvidence: mismatch.actualEvidence[0] ?? "the record at the time",
  };
}

/** The flags object dialogue visibility conditions (isLineVisible) should
 * actually read — state.flags plus reportMismatchFlags' synthetic layer on
 * top. Never persisted, never passed to applyFlags/saveGame; purely a
 * render-time view. Used everywhere computeSceneLines is called (both the
 * live render in GameRoot and resolveInitialLineIndex's resume-time
 * fast-forward) so a scene's visible-line count can never disagree with
 * itself between those two call sites — this is a pure function of
 * state.statusReports, so calling it repeatedly is always safe and always
 * gives the same answer. */
export function effectiveDialogueFlags(state: GameState): Flags {
  return { ...state.flags, ...reportMismatchFlags(state) };
}

// ---------------------------------------------------------------------------
// Act 5.1 — Commissioning & Readiness. The board itself is a read-only
// review of consequences already in motion (see the "Act 5 build" entry in
// DESIGN_NOTES.md) — every item is DERIVED from decisions the player
// already made, never a new pass/fail exercise of its own. Six categories
// per product line; only four are ever gap-able (equipment/utilities are
// always clear — the physical build itself was never in question, per
// Vaughn's own opening line this scene). "Product B" only exists as a real
// product once BIG-01 has fired, but this function is only ever called from
// ACT5_SCENE01, which is unreachable before that, so no separate guard is
// needed.
//
// The one real decision here — the readiness intervention, below — is
// deliberately sequential across up to two picks ("two days of recovery
// capacity", read literally rather than as a single flat choice): closing a
// genuine gap is Act 5's own chance to demonstrate regulatory readiness
// through fresh effort, not just inherit whatever Acts 1-4 already built.
// See the "Regulatory Readiness provenance audit" entry in DESIGN_NOTES.md
// for the full rationale and the four-archetype calibration this was tuned
// against. A category closed via intervention is marked with its own
// readiness_close_<category> flag (below) and computeReadinessColumn treats
// that flag as authoritative over the live metric threshold from then on —
// otherwise a gap closed by a partial (+15, not enough to cross e.g. the
// SOPs 60-threshold) would still misleadingly show as an open gap on the
// board immediately after being "fixed".
// ---------------------------------------------------------------------------

export interface ReadinessItem {
  id: string;
  label: string;
  status: "clear" | "gap";
  detail: string;
}

export interface ReadinessBoard {
  productA: ReadinessItem[];
  productB: ReadinessItem[];
}

/** Category display labels, shared between computeReadinessBoard (per-item
 * label) and computeReadinessInterventionOptions (gap-close option label) —
 * kept as one map so the two never drift out of sync with each other. */
const READINESS_CATEGORY_LABELS: Record<string, string> = {
  training: "Operators trained",
  validation: "Validation complete",
  sops: "SOPs approved",
  docs: "Batch documentation ready",
};

/** Narrative-only framing for each category's intervention option — what
 * the day buys and what it costs, in plain English, deliberately without
 * the actual +15/-5 numbers (those live in the HUD's own colour bands and
 * the Baseline Approved panel, not repeated here — see the Act 5
 * attainability audit in DESIGN_NOTES.md). Every category reads the same
 * two-clause shape ("closes X" / "further pressure on the delivery
 * schedule") on purpose, since the trade-off itself is identical
 * regardless of which category is picked — only what's being closed
 * differs. */
const READINESS_INTERVENTION_DESCRIPTIONS: Record<string, string> = {
  training: "Spend one of the remaining days getting operators properly signed off, rather than compressed under schedule pressure. Improves inspection readiness, but puts further pressure on an already-strained delivery schedule.",
  validation: "Spend one of the remaining days resolving the outstanding validation work. Improves regulatory readiness, but puts further pressure on the delivery schedule.",
  sops: "Spend one of the remaining days getting SOPs formally approved rather than left outstanding. Improves regulatory readiness, but puts further pressure on the delivery schedule.",
  docs: "Spend one of the remaining days completing the batch documentation that budget pressure pushed down the list. Improves regulatory readiness, but puts further pressure on the delivery schedule.",
};

/** Prefix shared with applyReadinessIntervention's flag naming
 * (`readiness_close_<category>`) — a category closed via intervention
 * reads as "clear" from then on regardless of the live metric threshold
 * that originally flagged it. Necessary because a partial fix (+15) isn't
 * always enough to cross an unrelated global threshold (e.g. SOPs' <60 on
 * regulatoryReadiness) — without this override, a genuinely-closed gap
 * would still misleadingly show "Gap" on the board one screen later. */
function isClosedViaIntervention(state: GameState, category: string): boolean {
  return Boolean(state.flags[`readiness_close_${category}`]);
}

function computeReadinessColumn(product: "A" | "B", state: GameState): ReadinessItem[] {
  const metrics = state.projectMetrics;
  const validationResourcing = state.decisions.validationResourcing;
  const trainingGap = metrics.scheduleHealth < 40 && !isClosedViaIntervention(state, "training");
  const sopsGap = metrics.regulatoryReadiness < 60 && !isClosedViaIntervention(state, "sops");
  const docsGap = metrics.budgetRemaining < STARTING_BUDGET * 0.15 && !isClosedViaIntervention(state, "docs");

  let validationGap: boolean;
  let validationDetail: string;
  if (isClosedViaIntervention(state, "validation")) {
    validationGap = false;
    validationDetail = "Closed during the final readiness review.";
  } else if (validationResourcing === "protect_a") {
    validationGap = product === "B";
    validationDetail =
      product === "A"
        ? "Fully validated on schedule."
        : "Outstanding evidence — resource was protected for Product A instead.";
  } else if (validationResourcing === "split_thin") {
    validationGap = true;
    validationDetail = "Partial — resource was split thin across both lines.";
  } else if (validationResourcing === "premium_contract") {
    validationGap = false;
    validationDetail = "Fully validated — premium contract resource covered both lines.";
  } else {
    // Defensive default (EV-NP2 is always eligible once BIG-01 has fired,
    // so this shouldn't be reachable in practice — see isEventEligible).
    validationGap = false;
    validationDetail = "Fully validated.";
  }

  return [
    {
      id: `equipment_${product}`,
      label: "Equipment commissioned",
      status: "clear",
      detail: "Physically installed and commissioned.",
    },
    {
      id: `utilities_${product}`,
      label: "Utilities qualified",
      status: "clear",
      detail: "Utilities qualified against spec.",
    },
    {
      id: `training_${product}`,
      label: READINESS_CATEGORY_LABELS.training,
      status: trainingGap ? "gap" : "clear",
      detail: trainingGap
        ? "Partial — training got compressed under schedule pressure."
        : "Operators trained and signed off.",
    },
    {
      id: `validation_${product}`,
      label: READINESS_CATEGORY_LABELS.validation,
      status: validationGap ? "gap" : "clear",
      detail: validationDetail,
    },
    {
      id: `sops_${product}`,
      label: READINESS_CATEGORY_LABELS.sops,
      status: sopsGap ? "gap" : "clear",
      detail: sopsGap ? "Outstanding — regulatory readiness hasn't cleared the bar yet." : "Approved.",
    },
    {
      id: `docs_${product}`,
      label: READINESS_CATEGORY_LABELS.docs,
      status: docsGap ? "gap" : "clear",
      detail: docsGap ? "Incomplete — budget pressure pushed documentation down the list." : "Ready.",
    },
  ];
}

export function computeReadinessBoard(state: GameState): ReadinessBoard {
  return {
    productA: computeReadinessColumn("A", state),
    productB: computeReadinessColumn("B", state),
  };
}

export interface ReadinessInterventionOption {
  /** Also the flag name applyReadinessIntervention sets on pick (prefixed
   * "readiness_") — e.g. "readiness_close_training". */
  id: string;
  label: string;
  /** Narrative-only framing of the trade-off — see
   * READINESS_INTERVENTION_DESCRIPTIONS' own doc comment for why this
   * deliberately never states the actual +15/-5 numbers. */
  description: string;
}

/** The options offered for ONE intervention slot — built ONLY from gaps
 * computeReadinessBoard actually found (which already excludes anything
 * closed via an earlier slot this scene — see isClosedViaIntervention), so
 * the choice is never wider than what's genuinely still outstanding, and a
 * category can never be offered twice. A category gapped on both products
 * still yields one option, not two (closing it closes it everywhere at
 * once); a category gapped on only one (currently only ever `validation`,
 * via `protect_a`) says which. Empty once the board's genuinely clean —
 * nothing left to spend a day on. */
export function computeReadinessInterventionOptions(state: GameState): ReadinessInterventionOption[] {
  const board = computeReadinessBoard(state);
  const options: ReadinessInterventionOption[] = [];
  for (const category of ["training", "validation", "sops", "docs"]) {
    const aGap = board.productA.find((item) => item.id === `${category}_A`)?.status === "gap";
    const bGap = board.productB.find((item) => item.id === `${category}_B`)?.status === "gap";
    if (!aGap && !bGap) continue;
    const productSuffix = aGap && bGap ? "" : aGap ? " (Product A)" : " (Product B)";
    options.push({
      id: `readiness_close_${category}`,
      label: `Close the gap: ${READINESS_CATEGORY_LABELS[category]}${productSuffix}`,
      description: READINESS_INTERVENTION_DESCRIPTIONS[category],
    });
  }
  return options;
}

/** readiness_intervention_<N>_used flags, in order — how ReadinessChecklist/
 * GameRoot track which of the two sequential "days" have been spent this
 * playthrough, independent of whether that day actually closed a gap (push-
 * forward still consumes the slot). Exactly 2 slots, matching "two days of
 * recovery capacity" read literally rather than as one flat choice — see
 * the "Regulatory Readiness provenance audit" entry in DESIGN_NOTES.md. */
const READINESS_INTERVENTION_SLOT_FLAGS = ["readiness_intervention_1_used", "readiness_intervention_2_used"];

/** How many of the two intervention slots have been resolved so far. */
export function readinessInterventionSlotsUsed(state: GameState): number {
  return READINESS_INTERVENTION_SLOT_FLAGS.filter((flag) => state.flags[flag]).length;
}

/** True once ACT5_SCENE01's whole sequence is done and the scene can
 * advance — either both slots are used, or nothing genuinely remains to
 * offer a not-yet-used slot (so a clean board, or a board fully closed
 * after just one pick, never forces a second empty prompt). Checked by
 * GameRoot after every pick instead of always advancing on the first one. */
export function isReadinessInterventionSequenceComplete(state: GameState): boolean {
  if (readinessInterventionSlotsUsed(state) >= READINESS_INTERVENTION_SLOT_FLAGS.length) return true;
  return computeReadinessInterventionOptions(state).length === 0;
}

/** Applies one intervention slot's pick — either a specific gap-close
 * option's id (from computeReadinessInterventionOptions) or null for
 * "move on and leave it unresolved." Closing a gap costs scheduleHealth -5
 * / gains regulatoryReadiness +15 (provisional pending playtesting — see
 * the "Regulatory Readiness provenance audit" DESIGN_NOTES.md entry for
 * the calibration this was tuned against); moving on costs regulatoryReadiness
 * -10, but ONLY when a genuine gap was actually available to skip — proceeding
 * on an already-clean board costs nothing, matching ReadinessChecklist's own
 * "the schedule doesn't need it" copy. Consumes exactly one of the two
 * READINESS_INTERVENTION_SLOT_FLAGS per call; a defensive no-op once both are
 * already used (GameRoot shouldn't call this once isReadinessInterventionSequenceComplete
 * is true, but this keeps the function itself safe regardless). The closed
 * category's own flag (the option's id) is what both computeReadinessColumn
 * (this scene, immediately) and computeAuditTrailEvidence (Act 5.2) read to
 * know a gap was actually closed, not just left outstanding. */
export function applyReadinessIntervention(state: GameState, interventionId: string | null): GameState {
  const slotsUsed = readinessInterventionSlotsUsed(state);
  if (slotsUsed >= READINESS_INTERVENTION_SLOT_FLAGS.length) return state;
  const slotFlag = READINESS_INTERVENTION_SLOT_FLAGS[slotsUsed];

  if (interventionId === null) {
    const wasGenuineGapAvailable = computeReadinessInterventionOptions(state).length > 0;
    const next = wasGenuineGapAvailable ? applyEffects(state, { regulatoryReadiness: -10 }) : state;
    return applyFlags(next, { [slotFlag]: true });
  }
  let next = applyEffects(state, { scheduleHealth: -5, regulatoryReadiness: 15 });
  next = applyFlags(next, { [interventionId]: true, [slotFlag]: true });
  return next;
}

// ---------------------------------------------------------------------------
// Act 5.2 — Audit Trail. Truth/data layer first, presentation second (same
// split the Monthly Status Report was built with) — see the "Act 5 build"
// entry in DESIGN_NOTES.md. computeAuditTrailEvidence(state) is the ONLY
// thing AuditTrailBuilder.tsx is allowed to read from; it aggregates across
// every part of the save that currently lives somewhere different
// (choiceHistory/flags/decisions/statusReports) into one flat list of
// cards. Deliberately never invents evidence that doesn't exist — a card
// whose underlying decision was never made reads "missing", not absent
// from the list entirely, so the gap itself is what the player has to
// organise around, not something they can quietly avoid seeing.
// ---------------------------------------------------------------------------

export type AuditTrailCategory =
  | "change_control"
  | "risk_and_issues"
  | "validation_and_quality"
  | "governance_and_reporting";

export interface AuditTrailEvidenceCard {
  id: string;
  title: string;
  category: AuditTrailCategory;
  status: "present" | "partial" | "missing";
  detail: string;
}

export function computeAuditTrailEvidence(state: GameState): AuditTrailEvidenceCard[] {
  const cards: AuditTrailEvidenceCard[] = [];

  // --- Change Control ---
  if (state.flags.filling_line_approved) {
    cards.push({
      id: "filling_line",
      title: "Filling line change control",
      category: "change_control",
      status: "present",
      detail: "Approved — cost, schedule, and quality impact assessed before Mike E. signed off.",
    });
  } else if (state.flags.filling_line_deferred) {
    cards.push({
      id: "filling_line",
      title: "Filling line change control",
      category: "change_control",
      status: "present",
      detail: "Deferred — logged with a documented re-review point after commissioning.",
    });
  } else if (state.flags.filling_line_rejected) {
    cards.push({
      id: "filling_line",
      title: "Filling line change control",
      category: "change_control",
      status: "present",
      detail: "Rejected — revalidation risk weighed against benefit and recorded.",
    });
  } else {
    cards.push({
      id: "filling_line",
      title: "Filling line change control",
      category: "change_control",
      status: "missing",
      detail: "No decision on record.",
    });
  }

  if (state.flags.isolator_expedited) {
    cards.push({
      id: "isolator",
      title: "Isolator delay response",
      category: "change_control",
      status: "present",
      detail: "Expedited — costed and signed off the same day.",
    });
  } else if (state.flags.isolator_absorbed) {
    cards.push({
      id: "isolator",
      title: "Isolator delay response",
      category: "change_control",
      status: "present",
      detail: "Absorbed — the schedule slip was flagged to Mike E. in writing before it happened.",
    });
  } else {
    cards.push({
      id: "isolator",
      title: "Isolator delay response",
      category: "change_control",
      status: "missing",
      detail: "No decision on record.",
    });
  }

  const big01Response = state.decisions.big01Response;
  if (big01Response) {
    cards.push({
      id: "big01",
      title: "BIG-01 re-scoping record",
      category: "change_control",
      status: big01Response === "phase_b_quietly" ? "partial" : "present",
      detail:
        big01Response === "full_replan"
          ? "Full re-plan, both lines, same week."
          : big01Response === "renegotiate"
            ? "Timeline renegotiated before absorbing new scope."
            : "Product B absorbed without a formal re-plan.",
    });
  } else {
    cards.push({
      id: "big01",
      title: "BIG-01 re-scoping record",
      category: "change_control",
      status: "missing",
      detail: "No decision on record.",
    });
  }

  // --- Risk & Issues ---
  cards.push({
    id: "contractor_risk",
    title: "Electrical contractor reliability — risk register entry",
    category: "risk_and_issues",
    status: state.flags.contractor_risk_logged ? "present" : "missing",
    detail: state.flags.contractor_risk_logged
      ? "Logged formally in Act 2, with a named mitigation."
      : "Never formally logged.",
  });

  cards.push({
    id: "validation_risk",
    title: "Validation timeline — risk register entry",
    category: "risk_and_issues",
    status: state.flags.validation_risk_logged ? "present" : "missing",
    detail: state.flags.validation_risk_logged
      ? "Logged formally in Act 2, with a named mitigation."
      : "Never formally logged.",
  });

  const raidOwner = state.decisions["raid_ev06_owner"];
  cards.push({
    id: "raid_ev06",
    title: "RAID log — electrical contractor",
    category: "risk_and_issues",
    status: raidOwner ? "present" : "missing",
    detail: raidOwner
      ? `Owner: ${raidOwner}. Escalated: ${state.flags["raid_ev06_escalated"] ? "yes" : "no"}.`
      : "No RAID record on file.",
  });

  // --- Validation & Quality ---
  const validationResourcing = state.decisions.validationResourcing;
  cards.push({
    id: "validation_resourcing",
    title: "Validation resourcing decision",
    category: "validation_and_quality",
    status: validationResourcing ? "present" : "missing",
    detail:
      validationResourcing === "protect_a"
        ? "Product A fully validated on time; Product B delayed."
        : validationResourcing === "split_thin"
          ? "Resource split thin across both lines."
          : validationResourcing === "premium_contract"
            ? "Premium contract resource covered both lines."
            : "No decision on record.",
  });

  const trainingClosed = Boolean(state.flags.readiness_close_training);
  const trainingStillGapped = state.projectMetrics.scheduleHealth < 40;
  cards.push({
    id: "training_evidence",
    title: "Operator training evidence",
    category: "validation_and_quality",
    status: trainingClosed || !trainingStillGapped ? "present" : "partial",
    detail: trainingClosed
      ? "Closed during the final readiness review — two days spent, signed off."
      : trainingStillGapped
        ? "Partial — training was compressed and the gap was never closed."
        : "Complete — no schedule pressure to compress it.",
  });

  // --- Governance & Reporting ---
  const supplierChosen = getFlagString(state.flags, "supplier_chosen");
  cards.push({
    id: "supplier_decision",
    title: "Supplier decision / goods-in record",
    category: "governance_and_reporting",
    status: supplierChosen ? "present" : "missing",
    detail: supplierChosen
      ? `${SUPPLIER_NAMES[supplierChosen] ?? supplierChosen} selected in the Act 3 Procurement Pitch.`
      : "No decision on record.",
  });

  const reportCount = state.statusReports.length;
  cards.push({
    id: "status_reports",
    title: "Monthly Status Reports (x3)",
    category: "governance_and_reporting",
    status: reportCount >= 3 ? "present" : reportCount > 0 ? "partial" : "missing",
    detail:
      reportCount >= 3
        ? "All three reports on file."
        : reportCount > 0
          ? `${reportCount} of 3 reports on file.`
          : "No reports on file.",
  });

  const danielMapped = Boolean(state.flags.daniel_power_recognized);
  const camilleMapped = Boolean(state.flags.camille_power_recognized);
  cards.push({
    id: "stakeholder_map",
    title: "Stakeholder power/interest map",
    category: "governance_and_reporting",
    status: "present",
    detail:
      danielMapped && camilleMapped
        ? "Both Daniel's budget authority and Camille's quality leverage correctly mapped."
        : danielMapped
          ? "Daniel's budget authority mapped; Camille's influence underestimated."
          : camilleMapped
            ? "Camille's influence mapped; Daniel's budget authority underestimated."
            : "Neither Daniel's budget authority nor Camille's influence correctly mapped.",
  });

  return cards;
}

/** One item in the closing evidence exhibit at the end of ACT5_SCENE03 —
 * the four things Whitfield actually asked about, in the order she asked
 * about them, rather than the full 11-card Audit Trail pack (that's
 * ACT5_SCENE02's screen; showing it again here would just be redundant).
 * Deliberately a thin readout, not a new data source: three of the four
 * items are computeAuditTrailEvidence cards looked up by id, and the
 * fourth is findMostMaterialReportMismatch formatted the same way a card
 * would be. */
export interface InspectionExhibitItem {
  id: string;
  title: string;
  detail: string;
}

export function computeInspectionExhibit(state: GameState): InspectionExhibitItem[] {
  const evidence = computeAuditTrailEvidence(state);
  const byId = (id: string) => evidence.find((card) => card.id === id);
  const items: InspectionExhibitItem[] = [];

  const fillingLine = byId("filling_line");
  if (fillingLine) {
    items.push({ id: fillingLine.id, title: fillingLine.title, detail: fillingLine.detail });
  }

  const stakeholderMap = byId("stakeholder_map");
  if (stakeholderMap) {
    items.push({ id: stakeholderMap.id, title: stakeholderMap.title, detail: stakeholderMap.detail });
  }

  const isolator = byId("isolator");
  if (isolator) {
    items.push({ id: isolator.id, title: isolator.title, detail: isolator.detail });
  }

  const mismatch = findMostMaterialReportMismatch(state);
  items.push(
    mismatch
      ? {
          id: "report_mismatch",
          title: `${mismatch.reportLabel} — ${mismatch.dimensionLabel}`,
          detail: `Reported ${RAG_LABEL[mismatch.reportedRag]}. Actual: ${RAG_LABEL[mismatch.actualRag]} — ${
            mismatch.actualEvidence[0] ?? "the record at the time"
          }.`,
        }
      : {
          id: "report_mismatch",
          title: "Status reports vs. the record",
          detail: "All three reports checked against what was actually true — no discrepancy found.",
        },
  );

  return items;
}

// ---------------------------------------------------------------------------
// Report-builder risk picker — a DELIBERATELY separate model from
// computeActiveRisks/ActualStatusReport.risks above. That truth-engine pool
// exists to answer "what does the event system know is eligible right now"
// and is never shown to the player directly. This one answers a completely
// different question — "what would the PLAYER themselves actually know
// about, right now, to write into a report" — and is the only one
// StatusReportBuilder.tsx is allowed to read from. Pulling the risk
// dropdown straight from event eligibility was the original (wrong) design:
// it surfaced future plot events (including purely positive ones like "The
// Ally You Didn't Expect") before the player had any in-fiction reason to
// know about them, which both spoils the story and undercuts Act 4's whole
// point of interpreting evidence rather than reading the engine's mind.
//
// Lifecycle every catalog entry follows:
//   1. Potential threat (event exists in the catalog, not yet eligible or
//      not yet evidenced) -> invisible.
//   2. Risk discovered (player has picked up real in-fiction evidence —
//      see `preDiscovery.anyOfFlags` below, all sourced from the Act 2 Risk
//      Workshop investigation) -> appears with a deliberately vaguer label
//      than the eventual event title, since the player hasn't lived it yet.
//   3. Risk materialises (the event has actually played out as a scene —
//      see GameState.eventsResolved, appended to in GameRoot's
//      advanceEventQueue) -> appears as an "issue" with a plain, no-longer-
//      a-spoiler label.
// There's no explicit "closed" state yet (nothing currently un-sets
// eventsResolved or offers a mitigated/resolved label) — logged as a
// follow-up in DESIGN_NOTES.md rather than half-built here.
//
// Reversal/positive events (EV-R1–EV-R4) are absent from this catalog
// entirely, on purpose — they're retrospective recontextualisations of a
// past decision, not risks the player could ever be "reporting on" in the
// RAID sense, and at least two of them are explicitly good news. EV-NP1/
// EV-12/BIG-01 are absent because they're standalone scripted beats, not
// pooled events, and are always fully visible to the player the moment they
// happen anyway (no "discovery" phase makes sense for them).
interface ReportableRiskCatalogEntry {
  /** Shown once state.eventsResolved confirms the event has actually
   * fired — plain, specific phrasing, since by now it's history rather
   * than a spoiler. */
  issueLabel: string;
  /** Shown before the event fires, and ONLY if the player has evidence of
   * it via one of these flags — every one currently traces back to the
   * Act 2 Risk Workshop (ACT2_SCENE04)'s three risk_investigation banks
   * (contractor/validation/contingency) and their paired "_risk_logged"
   * choice. Events with no preDiscovery block have no evidence channel
   * built yet and are simply invisible until they materialise — never
   * shown speculatively just because they're currently eligible. */
  preDiscovery?: { label: string; anyOfFlags: string[] };
}

const REPORTABLE_RISK_CATALOG: Record<string, ReportableRiskCatalogEntry> = {
  "EV-02": {
    preDiscovery: {
      label: "Validation timeline / cleanroom review risk",
      anyOfFlags: ["validation_risk_logged", "asked_validation_impact", "asked_validation_mitigation"],
    },
    issueLabel: "Cleanroom GMP review failure — rework required",
  },
  "EV-06": {
    preDiscovery: {
      label: "Electrical contractor financial instability",
      anyOfFlags: ["contractor_risk_logged", "asked_contractor_impact", "asked_contractor_mitigation"],
    },
    issueLabel: "Electrical contractor insolvency — replacement required",
  },
  "EV-10": {
    preDiscovery: {
      label: "Contingency budget adequacy risk",
      anyOfFlags: ["contingency_risk_logged", "asked_contingency_impact", "asked_contingency_mitigation"],
    },
    issueLabel: "Finance has frozen part of the contingency budget",
  },
  // The remaining Main/Late Wave events have no built-in early-evidence
  // channel yet (no risk_investigation bank or equivalent flag exists for
  // them) — first-pass scope, expected to grow as more Act 4 content gets
  // its own investigation beats. Until then they can only ever appear
  // post-materialisation, as an issue.
  "EV-NP2": { issueLabel: "Validation resourcing stretched thin across two product lines" },
  "EV-03": { issueLabel: "Local resident complaints about construction traffic" },
  "EV-04": { issueLabel: "Investor visit brought forward — workstream visibility pressure" },
  "EV-05": { issueLabel: "Contamination found during commissioning" },
  "EV-08": { issueLabel: "Loading bay flood damage from extreme weather" },
  "EV-11": { issueLabel: "New MHRA guidance note requires a design review" },
  "EV-13": { issueLabel: "Supplier shipped incorrect voltage equipment" },
  "EV-07": { issueLabel: "Key automation engineer resignation — team capacity gap" },
  "EV-09": { issueLabel: "Cyberattack — building management system locked" },
  "EV-14": { issueLabel: "Validation engineer poached by a competitor" },
  "EV-15": { issueLabel: "Social media safety claim — reputational exposure" },
};

/** What the player can actually see and pick in the report-builder's risk
 * dropdown — see the block comment above REPORTABLE_RISK_CATALOG for the
 * full model. Still gated on isEventEligible (a risk that literally cannot
 * fire this playthrough — e.g. its metric threshold was never crossed — is
 * not "still relevant" to report on, even if the player once investigated
 * around it), on top of the evidence/materialisation gating below. */
export function computeKnownReportableRisks(state: GameState): ReportableRisk[] {
  const results: ReportableRisk[] = [];
  for (const [eventId, entry] of Object.entries(REPORTABLE_RISK_CATALOG)) {
    if (!isEventEligible(eventId, state)) continue;
    if (state.eventsResolved.includes(eventId)) {
      results.push({ riskId: eventId, title: entry.issueLabel, status: "issue" });
      continue;
    }
    if (entry.preDiscovery && entry.preDiscovery.anyOfFlags.some((flag) => state.flags[flag])) {
      results.push({ riskId: eventId, title: entry.preDiscovery.label, status: "risk" });
    }
  }
  return results;
}

/** Adds or upgrades an entry in the player's artefacts drawer. Never
 * downgrades: if `pid` is already "complete" and something tries to set it
 * back to "incomplete" (shouldn't happen, but scenes can in principle be
 * revisited), the more-finished version wins so re-reading old content
 * can't regress a document the player already saw completed. */
export function setArtefactStatus(
  state: GameState,
  artefactId: string,
  status: ArtefactStatus
): GameState {
  const current = state.artefacts[artefactId];
  if (current === "complete") return state;
  if (current === status) return state;
  return { ...state, artefacts: { ...state.artefacts, [artefactId]: status } };
}

// ---------------------------------------------------------------------------
// Dialogue line visibility
// ---------------------------------------------------------------------------

/**
 * Evaluates a single condition term against flags. Two negation
 * conventions show up in the content, both meaning "this flag is false or
 * absent" rather than a separately-stored flag:
 *  - infix "_not_" (e.g. "automation_not_marked_must", "camilleTrust_not_
 *    high") — derived by replacing the first "_not_" with "_" to get the
 *    positive flag's name.
 *  - prefix "not_" on a term inside an "_and_" compound (see
 *    isLineVisible) — e.g. "not_daniel_power_recognized".
 * Neither is ever a real stored flag; both are evaluated at render time.
 */
function evaluateConditionTerm(term: string, flags: Flags): boolean {
  if (term.startsWith("not_")) {
    return !flags[term.slice(4)];
  }
  const negationMarker = "_not_";
  const markerIndex = term.indexOf(negationMarker);
  if (markerIndex !== -1) {
    const positiveFlag =
      term.slice(0, markerIndex) + "_" + term.slice(markerIndex + negationMarker.length);
    return !flags[positiveFlag];
  }
  return Boolean(flags[term]);
}

/**
 * A dialogue line's `condition` can be a single flag/negation term, or a
 * compound of several joined with "_and_" (e.g. "daniel_power_recognized_
 * and_camille_power_recognized", "not_daniel_power_recognized_and_camille_
 * power_recognized") — every term must hold for the line to show. This
 * lets content author N-way mutually-exclusive variants (covering every
 * combination of a small set of flags) without the engine needing to know
 * anything about which flags or how many.
 */
export function isLineVisible(condition: string | undefined, flags: Flags): boolean {
  if (!condition) return true;
  return condition.split("_and_").every((term) => evaluateConditionTerm(term, flags));
}

// ---------------------------------------------------------------------------
// Tool marker detection — derives where a tool sits in a scene's dialogue
// ---------------------------------------------------------------------------

/**
 * Content convention (consistent across every tool scene in the data,
 * built or not yet built): a scene with a toolId marks exactly where the
 * tool belongs with a bracketed narrator line, e.g. "[Player builds the
 * SWOT.]", "[Player tags PESTLE factors...]", "[Player builds the
 * stakeholder power/interest grid.]". Detecting this line lets the engine
 * split a scene's single dialogue block into pre-tool/post-tool halves
 * automatically, instead of requiring content to also maintain a separate
 * postToolDialogueId field in scenes.json — which is easy to lose (or
 * simply never populate) on a content re-export, whereas the marker line
 * is already part of the canonical script itself.
 */
export function isToolMarkerLine(line: DialogueLine): boolean {
  return line.speaker === "narrator" && /^\[Player\b/.test(line.text.trim());
}

/**
 * Splits an already-visibility-filtered line list around its tool marker
 * line (dropped from both halves — it's a structural cue, never actually
 * displayed). If no marker is found, everything is "pre-tool" and the
 * tool is treated as an interstitial at the very end of dialogue, same as
 * a scene with no dialogue at all before its tool.
 */
export function splitAroundToolMarker(lines: DialogueLine[]): {
  preLines: DialogueLine[];
  postLines: DialogueLine[];
} {
  const markerIndex = lines.findIndex(isToolMarkerLine);
  if (markerIndex === -1) return { preLines: lines, postLines: [] };
  return {
    preLines: lines.slice(0, markerIndex),
    postLines: lines.slice(markerIndex + 1),
  };
}

// ---------------------------------------------------------------------------
// Portrait resolution
// ---------------------------------------------------------------------------

const KNOWN_REAL_ASSETS = new Set([
  "marcus_neutral.jpg",
  "marcus_displeased.jpg",
  "marcus_pleased.jpg",
  "camille.jpg",
  "priya.jpg",
  "vaughn.jpg",
  "benneutral.png",
  "bensmile.png",
]);

export interface ResolvedPortrait {
  src: string | null;
  emotionUsed: string;
  character: Character;
}

/**
 * Picks the portrait image for a speaking character.
 *
 * Rule: use the dialogue line's explicit `emotion` tag if the character has
 * that portrait defined. If the line is emotionally neutral (no emotion, or
 * "neutral") and the player's relationship score with that character has
 * crossed WARM_RELATIONSHIP_THRESHOLD, upgrade to the "warm" portrait when
 * one exists — a generic, data-driven way for goodwill to visibly show on
 * screen without hardcoding any particular scene's mood.
 */
export function resolvePortrait(
  characterId: string,
  emotion: string | null,
  relationshipScore: number | undefined
): ResolvedPortrait | null {
  const character = getCharacter(characterId);
  if (!character || !character.portraits) return null;
  const portraits = character.portraits;

  let emotionUsed = emotion ?? "neutral";

  const isNeutralBeat = !emotion || emotion === "neutral";
  if (
    isNeutralBeat &&
    portraits.warm &&
    relationshipScore !== undefined &&
    relationshipScore >= WARM_RELATIONSHIP_THRESHOLD
  ) {
    emotionUsed = "warm";
  }

  const file =
    portraits[emotionUsed] ?? portraits["neutral"] ?? Object.values(portraits)[0];

  if (!file || !KNOWN_REAL_ASSETS.has(file)) {
    return { src: null, emotionUsed, character };
  }

  return { src: `/assets/characters/${file}`, emotionUsed, character };
}

/** Small, legible-on-dark palette for inline speaker-name coloring in the
 * transcript. Not tied to any specific character — see speakerColor. */
const SPEAKER_COLOR_PALETTE = [
  "#f0c98a", // amber
  "#7fb8e8", // sky
  "#a8d0a0", // sage
  "#e0a15a", // warm gold
  "#c9a8e0", // lavender
  "#e8a8b8", // dusty rose
];

/** Deterministic accent color per character id, so any speaker (including
 * ones added to future acts) gets a stable, distinct name color without
 * hardcoding a lookup table. */
export function speakerColor(characterId: string): string {
  let hash = 0;
  for (let i = 0; i < characterId.length; i++) {
    hash = (hash * 31 + characterId.charCodeAt(i)) >>> 0;
  }
  return SPEAKER_COLOR_PALETTE[hash % SPEAKER_COLOR_PALETTE.length];
}

// ---------------------------------------------------------------------------
// Backgrounds — carried-forward backdrop, generic across every scene
// ---------------------------------------------------------------------------

/**
 * Folds a `baseline` background forward through `lines` up to (and
 * including) `uptoIndexInclusive`, applying each visible line's own
 * `background` field in order. Lines without the field, or hidden by a
 * failed condition, leave the running value untouched — this is how a
 * backdrop "carries forward" across lines and scene boundaries without
 * ever needing to be explicitly reset.
 *
 * Used two ways: pass the full dialogue array with uptoIndex = last index
 * to compute the backdrop in effect at the END of a scene (the baseline the
 * next scene inherits); pass it with uptoIndex = the currently displayed
 * line to compute what should be on screen right now.
 */
export function foldBackground(
  baseline: string | null,
  lines: DialogueLine[],
  flags: Flags,
  uptoIndexInclusive: number
): string | null {
  let background = baseline;
  for (let i = 0; i <= uptoIndexInclusive && i < lines.length; i++) {
    const line = lines[i];
    if (!isLineVisible(line.condition, flags)) continue;
    if (line.background) background = line.background;
  }
  return background;
}

/** Same carry-forward fold as `foldBackground`, for the looping ambience
 * bed (DialogueLine.ambient). Unlike background, this is only ever folded
 * within a single scene's own lines (baseline null each time GameRoot
 * computes it) — ambience is a localized, scene-specific effect, not
 * something that needs to persist across scene boundaries the way a
 * backdrop does, so there's no GameState field carrying it forward. */
export function foldAmbient(
  baseline: string | null,
  lines: DialogueLine[],
  flags: Flags,
  uptoIndexInclusive: number
): string | null {
  let ambient = baseline;
  for (let i = 0; i <= uptoIndexInclusive && i < lines.length; i++) {
    const line = lines[i];
    if (!isLineVisible(line.condition, flags)) continue;
    if (line.ambient) ambient = line.ambient;
  }
  return ambient;
}

/** Same carry-forward fold as `foldBackground`/`foldAmbient`, for the
 * footstep overlay (DialogueLine.footsteps). Explicit `true`/`false`
 * overrides the running value; `undefined` (the field simply isn't set on
 * that line) leaves it unchanged, same convention as the other two. */
export function foldFootsteps(
  baseline: boolean,
  lines: DialogueLine[],
  flags: Flags,
  uptoIndexInclusive: number
): boolean {
  let footsteps = baseline;
  for (let i = 0; i <= uptoIndexInclusive && i < lines.length; i++) {
    const line = lines[i];
    if (!isLineVisible(line.condition, flags)) continue;
    if (line.footsteps !== undefined) footsteps = line.footsteps;
  }
  return footsteps;
}

/**
 * Real background files that actually exist on disk under
 * /public/assets/backgrounds, keyed by extension-agnostic stem. assets.json
 * (content) and the real files (art) have drifted on file extension more
 * than once — content says .png, disk has .jpg — so comparing by stem and
 * always serving the file that's ACTUALLY on disk avoids ever constructing
 * a broken <img> src, regardless of what extension the content export
 * claims. An unlisted stem falls back to a labeled placeholder rectangle,
 * same pattern as portraits' KNOWN_REAL_ASSETS.
 */
const REAL_BACKGROUND_FILES_BY_STEM: Record<string, string> = {
  // _v2: replaced with a brighter, more on-brand lobby shot. Renamed
  // rather than overwriting bg_reception.jpg per project convention —
  // that file stays on disk, just unreferenced.
  bg_reception: "bg_reception_v2.png",
  bg_marcus_office: "bg_marcus_office.jpg",
  bg_hallway: "bg_hallway_a.png",
  // _v2: same corridor/staircase as the reception shot (same wall art +
  // signage), so the cut from reception reads as continuing space rather
  // than a jump to a new location. Renamed, not overwritten — the
  // original bg_hallway_stairs.png stays on disk, just unreferenced.
  bg_hallway_stairs: "bg_hallway_stairs_v2.png",
  // Third beat: top-of-stairs vantage looking back over the open-plan
  // office, reception's "Welcome" screen tiny through the railing below —
  // the vantage change itself is what sells "you just climbed" better
  // than any zoom on a static shot could.
  bg_upstairs_landing: "bg_upstairs_landing.png",
  // Player's own desk — the backdrop for the email/Teams/SharePoint
  // investigation beats (ACT1_SCENE02_EMAIL/TEAMS/DRIVE etc). Same
  // AstraZeneca branding (mug, "Curious Brave Together" poster) as the
  // reception/hallway shots, so it reads as the same building.
  bg_player_desk: "bg_player_desk.png",
};

/**
 * Per-background-key Ken Burns tuning, for a specific shot that needs a
 * stronger push than SceneBackground's own gentle ambient default —
 * checked by GameRoot ahead of that default whenever it renders a plain
 * (non-panorama) background. "hallway_stairs" (the shot right as Joan
 * sends the player up to Mike E.'s office) wants to read as "a sideways
 * glance, then the stairs coming closer" — a more noticeable horizontal
 * drift plus a tighter, faster zoom-in than the default's barely-there
 * one, tuned for the pace of a couple of dialogue lines rather than a
 * long static scene.
 */
export const BACKGROUND_KEN_BURNS_OVERRIDES: Record<string, KenBurnsConfig> = {
  hallway_stairs: {
    scaleFrom: 1.1,
    scaleTo: 1.32,
    xToPercent: 5,
    yToPercent: -1.5,
    durationMs: 9000,
  },
  // Arrival beat: the vantage change already does most of the "we
  // climbed" work, so this stays gentler than hallway_stairs — a slow
  // settle/push rather than another aggressive drift, letting the player
  // register the new view before the next line lands.
  upstairs_landing: {
    scaleFrom: 1.06,
    scaleTo: 1.16,
    xToPercent: -2,
    yToPercent: 1,
    durationMs: 10000,
  },
};

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

/** Derives an assets.json backgrounds key from a tool screen's
 * `backgroundAsset` filename hint, by convention "bg_<key>.<ext>" (e.g.
 * "bg_warehouse_week1.png" -> "warehouse_week1"). Best-effort: if the
 * filename doesn't start with "bg_", returns the stem as-is. */
export function deriveBackgroundKeyFromAssetFilename(filename: string): string {
  return stripExtension(filename).replace(/^bg_/, "");
}

export interface ResolvedBackground {
  src: string | null;
  key: string;
  file: string | null;
}

/** Resolves a background key to a real image src if one exists, else null
 * (caller renders a placeholder). */
export function resolveBackground(
  key: string | null,
  file: string | null
): ResolvedBackground | null {
  if (!key) return null;
  const realFile = file ? REAL_BACKGROUND_FILES_BY_STEM[stripExtension(file)] : undefined;
  if (realFile) {
    return { src: `/assets/backgrounds/${realFile}`, key, file };
  }
  return { src: null, key, file };
}

/** Real ambient-sound files under /public/assets/sfx, keyed by
 * extension-agnostic stem — same drift-safety convention as
 * REAL_BACKGROUND_FILES_BY_STEM. "none" (explicit silence) is
 * intentionally absent: it has no file, and resolveAmbientSound already
 * returns a null src for any key with no entry here. */
const REAL_AMBIENT_SOUND_FILES_BY_STEM: Record<string, string> = {
  reception_ambience: "reception_ambience.mp3",
  sharepoint_browsing: "sharepoint_browsing.mp3",
};

/** Resolves an ambient sound key to a real audio src if one exists, else
 * null (caller renders no SceneAudio instance, i.e. silence). Mirrors
 * resolveBackground's shape/behavior. */
export function resolveAmbientSound(key: string | null, file: string | null): string | null {
  if (!key) return null;
  const realFile = file ? REAL_AMBIENT_SOUND_FILES_BY_STEM[stripExtension(file)] : undefined;
  return realFile ? `/assets/sfx/${realFile}` : null;
}

/** The one footstep-overlay track (DialogueLine.footsteps toggles it on/
 * off) — a fixed effect rather than a content-selectable key like
 * ambient/background, so it's a plain constant rather than routed through
 * assets.json's map-and-resolve machinery. */
export const FOOTSTEPS_SFX_SRC = "/assets/sfx/footsteps_loop.mp3";

/**
 * Per-background-key target volume for the ambient bed and footstep
 * overlay — keyed by whatever `backgroundKey` GameRoot already computes
 * for the visuals, since that reliably tracks which beat of the walk
 * we're on without needing a separate per-line volume field. SceneAudio
 * ramps to a new `volume` prop smoothly (see its own [volume] effect)
 * rather than jumping, so listing a lower number at a later beat reads as
 * a fade rather than a cut — loud at reception, easing down through the
 * stairs climb, then either an explicit "none"/false cut (a full
 * SceneAudio unmount, which fades via fadeOutMs) or, for footsteps, one
 * more quiet step at the top of the stairs before the final cut in
 * Mike's office. An unlisted key falls back to the DEFAULT_* constant —
 * this only ever matters for reception's fallback (its own volume before
 * any beat-specific number applies) and for ambient keys that aren't part
 * of this walk at all (e.g. sharepoint_browsing, whose backgroundKey is
 * always "player_desk" and never appears here).
 */
const AMBIENT_VOLUME_BY_BACKGROUND: Record<string, number> = {
  reception: 0.65,
  hallway: 0.65,
  hallway_stairs: 0.45,
};
const DEFAULT_AMBIENT_VOLUME = 0.4;

export function ambientVolumeForBackground(backgroundKey: string | null): number {
  if (!backgroundKey) return DEFAULT_AMBIENT_VOLUME;
  return AMBIENT_VOLUME_BY_BACKGROUND[backgroundKey] ?? DEFAULT_AMBIENT_VOLUME;
}

const FOOTSTEPS_VOLUME_BY_BACKGROUND: Record<string, number> = {
  hallway_stairs: 0.7,
  upstairs_landing: 0.35,
};
const DEFAULT_FOOTSTEPS_VOLUME = 0.5;

export function footstepsVolumeForBackground(backgroundKey: string | null): number {
  if (!backgroundKey) return DEFAULT_FOOTSTEPS_VOLUME;
  return FOOTSTEPS_VOLUME_BY_BACKGROUND[backgroundKey] ?? DEFAULT_FOOTSTEPS_VOLUME;
}

export interface PanoramaFocus {
  src: string;
  focusPercent: number;
}

/**
 * Background keys that are actually crops of the same wide panoramic
 * photo, rather than independent shots — checked BEFORE the normal
 * resolveBackground path (see GameRoot) so a transition between two keys
 * in the same group renders as one continuous PanoramaBackground sliding
 * sideways, instead of two separate SceneBackground instances crossfading.
 * _v3: swapped to the widest of the reception/hallway/stairs photo set —
 * same physical corridor, but framed to also include the base of the
 * staircase on its right edge, so the hallway crop already leans toward
 * the stairs. That makes the eventual hard cut into the hallway_stairs
 * beat (a different, tighter photo of the same staircase) land as a
 * near-seamless continuation instead of a jump. Renamed rather than
 * overwritten per project convention — bg_reception_hallway_pano_v2.png
 * stays on disk, just unreferenced. focusPercent is each key's horizontal
 * object-position crop within that single image (0 = leftmost, 100 =
 * rightmost) — tuned by eye, not derived from anything.
 */
export const PANORAMA_GROUPS: Record<string, PanoramaFocus> = {
  reception: { src: "/assets/backgrounds/bg_reception_hallway_pano_v3.png", focusPercent: 10 },
  hallway: { src: "/assets/backgrounds/bg_reception_hallway_pano_v3.png", focusPercent: 75 },
};

// ---------------------------------------------------------------------------
// Tool screen progress — generic "sort into buckets" persistence
// ---------------------------------------------------------------------------

/** True once the player has reached a tool screen's action phase (even
 * with zero cards placed yet). Used to skip replaying dialogue on resume. */
export function hasReachedToolScreen(
  state: GameState,
  toolId: string | null | undefined
): boolean {
  if (!toolId) return false;
  return state.toolProgress[toolId] !== undefined;
}

/** Marks a tool screen as reached (dialogue finished, action phase shown)
 * without placing any cards yet. Idempotent. */
export function markToolScreenReached(state: GameState, toolId: string): GameState {
  if (state.toolProgress[toolId] !== undefined) return state;
  return { ...state, toolProgress: { ...state.toolProgress, [toolId]: [] } };
}

/** Records a correctly-placed card. Idempotent for a card already placed. */
export function placeToolCard(state: GameState, toolId: string, cardId: string): GameState {
  const existing = state.toolProgress[toolId] ?? [];
  if (existing.includes(cardId)) return state;
  return {
    ...state,
    toolProgress: { ...state.toolProgress, [toolId]: [...existing, cardId] },
  };
}

export function isToolComplete(
  state: GameState,
  toolId: string,
  totalCards: number
): boolean {
  return (state.toolProgress[toolId]?.length ?? 0) >= totalCards;
}

// ---------------------------------------------------------------------------
// Priority-assignment tool progress — generic "assign every card to a
// bucket at a real cost" persistence (e.g. MoSCoW). Every bucket is valid;
// nothing here is specific to Must/Should/Could/Won't or to budget.
// ---------------------------------------------------------------------------

/** Re-checks a priority tool's overcommitRule (if it has one) against the
 * current bucket distribution and sets/clears its reactionFlag to match —
 * live off the FINAL distribution, not sticky from the first time the
 * threshold was crossed, so moving cards back out of the bucket un-fires
 * it again before the player finishes. */
function applyOvercommitRule(
  state: GameState,
  toolScreen: ToolScreenBlock,
  placements: Record<string, string>
): GameState {
  const rule = toolScreen.overcommitRule;
  if (!rule) return state;
  const count = Object.values(placements).filter((bucket) => bucket === rule.bucket).length;
  const shouldBeSet = count >= rule.minCount;
  if (Boolean(state.flags[rule.reactionFlag]) === shouldBeSet) return state;
  return { ...state, flags: { ...state.flags, [rule.reactionFlag]: shouldBeSet } };
}

/**
 * Places (or re-places) a card into a bucket for a priority_assignment
 * tool. Unlike placeToolCard, every bucket is a valid destination — there
 * is no wrong-bucket rejection. Refunds the card's cost in its previous
 * bucket (if any) before charging its cost in the new one, so re-placing
 * a card doesn't stack both costs. Applies the new bucket's flagsByBucket
 * (positive flags only), then re-evaluates the tool's overcommitRule
 * against the resulting distribution.
 */
export function placePriorityCard(
  state: GameState,
  toolScreen: ToolScreenBlock,
  cardId: string,
  bucket: string
): GameState {
  const card = (toolScreen.cards ?? []).find((c) => c.id === cardId);
  if (!card) return state;

  const toolId = toolScreen.toolId;
  const currentPlacements = state.toolPlacements[toolId] ?? {};
  const previousBucket = currentPlacements[cardId];
  if (previousBucket === bucket) return state;

  // costByBucket is optional — a tool like the stakeholder power/interest
  // grid has no cost at all (every quadrant is free), same shape as
  // MoSCoW's cards otherwise.
  const budgetKey = toolScreen.budgetVariable ?? "budgetRemaining";
  let budget = state.projectMetrics[budgetKey] ?? 0;
  if (card.costByBucket) {
    if (previousBucket) budget += card.costByBucket[previousBucket] ?? 0;
    budget -= card.costByBucket[bucket] ?? 0;
  }

  const nextFlags = { ...state.flags };
  const flagsForBucket = card.flagsByBucket?.[bucket];
  if (flagsForBucket) {
    for (const [key, value] of Object.entries(flagsForBucket)) {
      if (value) nextFlags[key] = true; // only positive flags are ever set
    }
  }

  const nextPlacements = { ...currentPlacements, [cardId]: bucket };

  let next: GameState = {
    ...state,
    projectMetrics: { ...state.projectMetrics, [budgetKey]: budget },
    flags: nextFlags,
    toolPlacements: { ...state.toolPlacements, [toolId]: nextPlacements },
  };

  next = applyOvercommitRule(next, toolScreen, nextPlacements);
  return next;
}

export function isPriorityToolComplete(
  state: GameState,
  toolId: string,
  totalCards: number
): boolean {
  return Object.keys(state.toolPlacements[toolId] ?? {}).length >= totalCards;
}

// ---------------------------------------------------------------------------
// Risk investigation — "pick maxQuestions of the bank's questions" progress.
// Deliberately stateless beyond the flags themselves: whether a question
// has been asked is just whether its flagOnAsk is true, so there's nothing
// extra to persist or backfill on older saves.
// ---------------------------------------------------------------------------

/** How many of a risk investigation bank's questions have been asked so
 * far, derived purely from which flagOnAsk flags are currently true. */
export function countAskedQuestions(bank: RiskInvestigationBank, flags: Flags): number {
  return bank.questions.filter((q) => Boolean(flags[q.flagOnAsk])).length;
}

/** True once the player has asked as many questions as the bank allows
 * (or more, defensively, though the UI never lets that happen). */
export function isRiskInvestigationComplete(bank: RiskInvestigationBank, flags: Flags): boolean {
  return countAskedQuestions(bank, flags) >= bank.maxQuestions;
}

// ---------------------------------------------------------------------------
// Template substitution — {token} placeholders in dialogue text, filled in
// from live game state at render time (e.g. "Week {currentWeek}." or
// EV-R1's "{chosenSupplier}"). Generic string-replace, no engine knowledge
// of what any particular token means — callers build the values map.
// ---------------------------------------------------------------------------

export function substituteTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match
  );
}

// ---------------------------------------------------------------------------
// cost_review_with_descope (CBS) — fixed-total cost review; totalIfAllIncluded
// is the accepted £8.0M cost baseline and never changes here (it's the same
// figure the financial-reconciliation read-time function elsewhere treats as
// referenceBaselineCost — nothing in this tool subtracts from it). The
// player's actual task is a contingency-planning judgement: explicitly
// classify every task in classifiableTaskIds as Protected or a Potential
// lever, stored in GameState.decisions (categorical, not boolean, matching
// every other named-outcome choice — see the field's own doc comment in
// types.ts), keyed `cbsClassification_<taskId>` rather than a flag, since
// this is Act 3's INTENT, not an event that happened. Deliberately never
// writes anything that could later be mistaken for "this was actually
// reduced" — that's a separate Act 4 decision (e.g. EV-10) this module
// knows nothing about. A task absent from classifiableTaskIds (currently
// Foundations and Filling Equipment — no consequence exists for either yet)
// simply can't be classified at all; setCbsClassification no-ops for it.
// ---------------------------------------------------------------------------

function cbsClassificationKey(taskId: string): string {
  return `cbsClassification_${taskId}`;
}

/** The player's classification for one task, if they've made it. Reads
 * GameState.decisions — see module note above for why that store rather
 * than flags or toolProgress. */
export function getCbsClassification(
  state: GameState,
  taskId: string
): CbsClassification | undefined {
  const value = state.decisions[cbsClassificationKey(taskId)];
  return value === "protected" || value === "potentialLever" ? value : undefined;
}

/** Every classifiable task's current classification, keyed by taskId —
 * what CBSReview.tsx actually renders from (undefined entries render as
 * unclassified). */
export function computeCbsClassifications(
  state: GameState,
  toolScreen: ToolScreenBlock
): Record<string, CbsClassification | undefined> {
  const ids = toolScreen.classifiableTaskIds ?? [];
  const result: Record<string, CbsClassification | undefined> = {};
  for (const id of ids) result[id] = getCbsClassification(state, id);
  return result;
}

/** True once every classifiableTaskIds entry has an explicit classification
 * — deliberately NOT true by default (unlike most other tools' completion
 * conditions, an untouched CBS must not be indistinguishable from one
 * where the player considered every line and protected it). */
export function isCbsClassificationComplete(state: GameState, toolScreen: ToolScreenBlock): boolean {
  const ids = toolScreen.classifiableTaskIds ?? [];
  return ids.every((id) => getCbsClassification(state, id) !== undefined);
}

/** Sets (or changes) one task's classification. A no-op if taskId isn't in
 * classifiableTaskIds — see module note. Re-picking the same classification
 * a task already has is harmless (just overwrites with the same value). */
export function setCbsClassification(
  state: GameState,
  toolScreen: ToolScreenBlock,
  taskId: string,
  classification: CbsClassification
): GameState {
  if (!(toolScreen.classifiableTaskIds ?? []).includes(taskId)) return state;
  return {
    ...state,
    decisions: { ...state.decisions, [cbsClassificationKey(taskId)]: classification },
  };
}

// ---------------------------------------------------------------------------
// pick_n_of_m_swipeable (Team Selection) — browse via swipe (no state
// change), toggle hire/un-hire independently, capped at maxHires. Selection
// lives in toolSelections (a live toggle set, unlike toolProgress's
// append-only history) because un-hiring must be able to fully reverse a
// candidate's effects/flags, not just leave them accumulated.
// ---------------------------------------------------------------------------

/**
 * Toggles a candidate's hired state. Hiring applies budgetEffect/
 * otherEffects and sets flagOnHire true; un-hiring reverses both. A no-op
 * if trying to hire past maxHires (the UI already greys the button out,
 * this is just the defensive backstop).
 */
export function toggleHire(
  state: GameState,
  toolScreen: ToolScreenBlock,
  candidateId: string
): GameState {
  const candidate = (toolScreen.candidates ?? []).find((c) => c.id === candidateId);
  if (!candidate) return state;

  const toolId = toolScreen.toolId;
  const currentlyHired = state.toolSelections[toolId] ?? [];
  const isHired = currentlyHired.includes(candidateId);
  const maxHires = toolScreen.maxHires ?? Infinity;

  if (!isHired && currentlyHired.length >= maxHires) return state;

  const sign = isHired ? -1 : 1;
  const effects: Record<string, number> = { ...(candidate.otherEffects ?? {}) };
  if (candidate.budgetEffect) effects.budgetRemaining = candidate.budgetEffect;
  const signedEffects = Object.fromEntries(
    Object.entries(effects).map(([key, value]) => [key, value * sign])
  );

  let next = applyEffects(state, signedEffects);
  if (candidate.flagOnHire) {
    next = {
      ...next,
      flags: { ...next.flags, [candidate.flagOnHire]: !isHired },
    };
  }

  const nextSelection = isHired
    ? currentlyHired.filter((id) => id !== candidateId)
    : [...currentlyHired, candidateId];

  return {
    ...next,
    toolSelections: { ...next.toolSelections, [toolId]: nextSelection },
  };
}

export function isHiringComplete(state: GameState, toolId: string, maxHires: number): boolean {
  return (state.toolSelections[toolId]?.length ?? 0) === maxHires;
}

// ---------------------------------------------------------------------------
// gantt_placement (Milestone Timeline) — place fixed-duration bars on a
// week axis, subject to hard dependency rules written as prose in the
// data ("X cannot start before [BOTH] Y [and Z] end[s]"). Placements reuse
// toolPlacements' existing milestoneId -> string shape (the week number
// stringified) rather than inventing a new GameState field.
// ---------------------------------------------------------------------------

/** Parses a dependencyRules[].rule prose string into a structured
 * milestoneId + prerequisite id list. Generic pattern match, not tied to
 * any specific milestone name — new rules of the same shape need no
 * engine change. Returns null if the sentence doesn't match the
 * convention (defensive; such a rule is simply not enforced). */
function parseDependencyRule(
  rule: string
): { milestoneId: string; prerequisiteIds: string[] } | null {
  const match = rule.match(/^(\S+)\s+cannot start before\s+(?:BOTH\s+)?(.+?)\s+ends?$/i);
  if (!match) return null;
  return {
    milestoneId: match[1],
    prerequisiteIds: match[2].split(/\s+and\s+/i).map((s) => s.trim()),
  };
}

/** Checks a proposed milestone placement against every dependencyRule that
 * applies to it. Returns an error message if it violates one ("Error:
 * Dependency", matching the data's own wrongPlacementBehavior note), or
 * null if the placement is valid. Doesn't mutate state — the caller only
 * calls placeMilestone once this returns null, same bounce-back-without-
 * penalty pattern as every other tool's wrong placement. */
export function validateMilestonePlacement(
  toolScreen: ToolScreenBlock,
  placements: Record<string, string>,
  milestoneId: string,
  startWeek: number
): string | null {
  for (const { rule } of toolScreen.dependencyRules ?? []) {
    const parsed = parseDependencyRule(rule);
    if (!parsed || parsed.milestoneId !== milestoneId) continue;
    for (const prerequisiteId of parsed.prerequisiteIds) {
      const prerequisiteStart = placements[prerequisiteId];
      if (prerequisiteStart === undefined) return "Error: Dependency";
      const prerequisite = toolScreen.milestones?.find((m) => m.id === prerequisiteId);
      const prerequisiteEnd = Number(prerequisiteStart) + (prerequisite?.durationWeeks ?? 0);
      if (startWeek < prerequisiteEnd) return "Error: Dependency";
    }
  }
  return null;
}

/** Places (or re-places) a milestone's starting week. Assumes the caller
 * already validated via validateMilestonePlacement. */
export function placeMilestone(
  state: GameState,
  toolScreen: ToolScreenBlock,
  milestoneId: string,
  startWeek: number
): GameState {
  const toolId = toolScreen.toolId;
  const nextPlacements = {
    ...(state.toolPlacements[toolId] ?? {}),
    [milestoneId]: String(startWeek),
  };
  return { ...state, toolPlacements: { ...state.toolPlacements, [toolId]: nextPlacements } };
}

/**
 * Computes the critical path — the chain of milestones with zero slack
 * that actually determines the project's finish date — from the player's
 * real placements, not the dependency graph's shape alone. Fully generic:
 * built from parseDependencyRule's structured output plus each
 * milestone's placed end time (start + durationWeeks); no milestone id is
 * ever hardcoded, so it stays correct no matter how the player arranged
 * the timeline (e.g. it correctly swaps to a different prerequisite if
 * the player placed it to finish later than its sibling).
 *
 * Algorithm: find whichever milestone finishes last overall (the true
 * project end); walk backward through its prerequisites, at each step
 * following whichever prerequisite finishes latest (the one actually
 * gating the next milestone's start), until a milestone with no
 * prerequisites is reached. Milestones off this backward walk — including
 * ones with no dependency edges at all — have slack and aren't returned.
 *
 * Returned in end-to-start order (the final milestone first). Returns []
 * if any milestone isn't placed yet — callers should gate on
 * isPriorityToolComplete first.
 */
export function computeCriticalPath(
  toolScreen: ToolScreenBlock,
  placements: Record<string, string>
): string[] {
  const milestones = toolScreen.milestones ?? [];
  if (milestones.length === 0) return [];

  const endTime = (id: string): number | null => {
    const milestone = milestones.find((m) => m.id === id);
    const start = placements[id];
    if (!milestone || start === undefined) return null;
    return Number(start) + milestone.durationWeeks;
  };

  if (milestones.some((m) => endTime(m.id) === null)) return [];

  const prerequisitesOf = new Map<string, string[]>();
  for (const { rule } of toolScreen.dependencyRules ?? []) {
    const parsed = parseDependencyRule(rule);
    if (parsed) prerequisitesOf.set(parsed.milestoneId, parsed.prerequisiteIds);
  }

  let current = milestones[0].id;
  let latestEnd = endTime(current) ?? -Infinity;
  for (const m of milestones) {
    const end = endTime(m.id) ?? -Infinity;
    if (end > latestEnd) {
      latestEnd = end;
      current = m.id;
    }
  }

  const path: string[] = [];
  let cursor: string | undefined = current;
  while (cursor) {
    path.push(cursor);
    const prerequisites = prerequisitesOf.get(cursor) ?? [];
    if (prerequisites.length === 0) break;
    let next: string | undefined;
    let nextEnd = -Infinity;
    for (const prerequisiteId of prerequisites) {
      const end = endTime(prerequisiteId) ?? -Infinity;
      if (end > nextEnd) {
        nextEnd = end;
        next = prerequisiteId;
      }
    }
    cursor = next;
  }
  return path;
}

/** True if the player's guessed set of milestone ids exactly matches the
 * computed critical path (order-independent — the player taps bars in
 * whatever order, only the final set matters). */
export function isCriticalPathGuessCorrect(guessedIds: string[], criticalPath: string[]): boolean {
  if (guessedIds.length !== criticalPath.length) return false;
  const guessedSet = new Set(guessedIds);
  return criticalPath.every((id) => guessedSet.has(id));
}

/**
 * Toggles a milestone in/out of the player's live critical-path guess.
 * Lives in toolSelections (the same live, reversible toggle-set shape as
 * Team Selection's hire toggle) rather than toolProgress, since changing
 * your mind mid-guess should fully remove a milestone, not just leave it
 * accumulated in a history.
 */
export function toggleCriticalPathGuess(
  state: GameState,
  toolScreen: ToolScreenBlock,
  milestoneId: string
): GameState {
  const toolId = toolScreen.toolId;
  const current = state.toolSelections[toolId] ?? [];
  const next = current.includes(milestoneId)
    ? current.filter((id) => id !== milestoneId)
    : [...current, milestoneId];
  return { ...state, toolSelections: { ...state.toolSelections, [toolId]: next } };
}

// ---------------------------------------------------------------------------
// HUD — Deployment Countdown. Purely a display-derivation layer over
// existing projectMetrics/toolPlacements; introduces no new stored
// variables of its own (per design: weeksRemaining is derived, never
// persisted).
// ---------------------------------------------------------------------------

/** weeksRemaining = round((200 - scheduleHealth) / 100 * 24). scheduleHealth
 * starts at 100, which anchors to exactly week 24 (on target). Choices that
 * "speed delivery up" push scheduleHealth above 100, which must pull the
 * week count BELOW 24 (finishing ahead of schedule) — and choices that slow
 * it down push scheduleHealth below 100, pulling the week count above 24
 * (running late/OVERDUE). Deliberately the inverse of a naive
 * scheduleHealth/100*24: that reads scheduleHealth as "how many weeks
 * this used up" rather than "how healthy the schedule is", so raising it
 * (good choices) perversely made the project look later, not earlier. Not
 * clamped — a bad scheduleHealth can still push this past 24; the HUD
 * displays whatever comes out, it never gates progression. */
export function computeWeeksRemaining(scheduleHealth: number): number {
  return Math.round(((200 - scheduleHealth) / 100) * 24);
}

export type MetricBand = "green" | "yellow" | "red";

/** Generic threshold banding for a 0-100-ish score, reused across every
 * HUD metric (Budget/Schedule/Risk/Quality/Benefits). `higherIsBetter`
 * flips which end reads as red — e.g. scheduleHealth: higher is better,
 * riskExposure: lower is better — so the same two thresholds work for
 * both without the caller pre-inverting anything. */
export function metricBand(
  value: number,
  higherIsBetter: boolean,
  greenAt = 60,
  redBelow = 30
): MetricBand {
  const score = higherIsBetter ? value : 100 - value;
  if (score >= greenAt) return "green";
  if (score < redBelow) return "red";
  return "yellow";
}

/**
 * "Current Objective" — whichever Gantt milestone(s) the current week
 * falls inside. If more than one bar covers the week (Utilities/Training
 * can overlap others), joins all of their names. If the week falls in a
 * gap covered by no bar, shows the nearest upcoming milestone instead. If
 * every milestone's window has already passed (or `currentWeek` — really a
 * scheduleHealth-derived forecast, not a real elapsed-time clock, see
 * DESIGN_NOTES.md — has simply overshot all of them), falls back to
 * "Facility go live": the project's aim regardless of timing, so unlike a
 * "Deployment complete" claim it can never contradict the story (e.g.
 * showing up beside "Deployment begins." on the same screen).
 */
export function computeCurrentObjective(
  toolScreen: ToolScreenBlock | null,
  placements: Record<string, string>,
  currentWeek: number
): string {
  const milestones = toolScreen?.milestones ?? [];
  const placed = milestones
    .map((m) => {
      const start = placements[m.id];
      return start === undefined ? null : { ...m, start: Number(start) };
    })
    .filter((m): m is (typeof milestones)[number] & { start: number } => m !== null);

  const active = placed.filter((m) => currentWeek >= m.start && currentWeek < m.start + m.durationWeeks);
  if (active.length > 0) return active.map((m) => m.text).join(", ");

  const upcoming = placed
    .filter((m) => m.start > currentWeek)
    .sort((a, b) => a.start - b.start);
  if (upcoming.length > 0) return `Next: ${upcoming[0].text}`;

  return placed.length > 0 ? "Facility go live" : "";
}

// ---------------------------------------------------------------------------
// Event Library checkpoint system (Act 4 curveball waves) — each report-
// gap scene hands off, via its own Scene.eventWaveId, to a pool of
// conditionally-triggered events from events.json. GameRoot routes through
// the resulting queue one entry at a time — see
// isActiveQueuedEventScene/advanceEventQueue in GameRoot.tsx, and
// synthesizeEventScene/synthesizeEventFrameScene in data.ts for how a
// queued event becomes a real playable "scene".
//
// Restructured (see "Act 4 event redistribution" in DESIGN_NOTES.md) from
// the original two-wave design (one giant Main Wave before Report 1, one
// Late Wave after Report 3, and nothing between Reports 1/2/3) into four
// narrative periods, each answering a distinct question rather than just
// evenly redistributing the same 18 events:
//   - EVENT_WAVE_MEMBERS.MAIN_WAVE (BIG-01 -> Report 1): EV-NP2 + EV-R2
//     only — direct, immediate BIG-01 consequences, not general texture.
//   - GAP_WAVE_SPECS.MID_WAVE_1 (Report 1 -> Report 2): capped substantive
//     + reversal pools — "the project operating under the new reality",
//     not just more bad news.
//   - GAP_WAVE_SPECS.MID_WAVE_2 (Report 2 -> Report 3): the EV-06 RAID
//     anchor, a capped substantive pool, and a single-slot final shock —
//     "this is what the project formally says right before inspection."
//   - After Report 3 (ACT4_SCENE06): no event wave at all anymore — every
//     event that used to live in the old LATE_WAVE has moved into
//     MID_WAVE_2 above, so nothing operationally significant happens after
//     the final report that its own record doesn't capture.
// EV-NP1 (=ACT4_SCENE01), EV-12 (=ACT4_SCENE02) and BIG-01 (=ACT4_SCENE03)
// are already wired as their own standalone scenes, not part of any wave's
// pool. EV-E1/E2/E3 are earlier-act content, also not part of Act 4's
// pools. EV-01 is a dead v1 stub explicitly superseded by EV-NP1.
// ---------------------------------------------------------------------------

/** Reads a flag whose value is a string rather than the usual boolean —
 * e.g. supplier_chosen ("steritech"/"rapidform"/"pharmacraft"), set by a
 * choice's own `flags` effects exactly like any other flag, just carrying
 * a value rather than a plain true. Flags is typed as
 * Record<string, boolean> since that's what almost every flag actually
 * is; this is the one narrow, explicit escape hatch for the handful that
 * aren't. */
export function getFlagString(flags: Flags, key: string): string | undefined {
  const value = (flags as unknown as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

const SUPPLIER_NAMES: Record<string, string> = {
  steritech: "SteriTech",
  rapidform: "RapidForm",
  pharmacraft: "PharmaCraft",
};

/** {chosenSupplier}/{alternateSupplier} substitution values for EV-R1's
 * dialogue/choices — see CHOICE_EV-R1's own engineNote. alternateSupplier
 * deliberately never resolves to RapidForm (reserved as EV-R4's failure
 * case) unless RapidForm itself was the chosen supplier, in which case
 * SteriTech — "the option that's still standing" per its own Act 3 pitch
 * — is the one offered as a fallback instead. */
export function supplierTemplateValues(
  state: GameState
): { chosenSupplier: string; alternateSupplier: string } {
  const chosen = getFlagString(state.flags, "supplier_chosen") ?? "";
  const chosenSupplier = SUPPLIER_NAMES[chosen] ?? "the other supplier";
  const alternateKey = chosen === "steritech" ? "pharmacraft" : chosen === "pharmacraft" ? "steritech" : "steritech";
  const alternateSupplier = SUPPLIER_NAMES[alternateKey];
  return { chosenSupplier, alternateSupplier };
}

/** {token} values for Act 6's reconciled cost-performance line
 * (DIALOGUE_ACT6_SCENE03) — deliberately its own line, separate from the
 * unconditional "£12M Investment Justified — not yet demonstrable" ROI
 * line right above it in that file. Cost performance (did the project
 * land inside its approved budget) and investment justification (did the
 * spend actually deliver value) are different questions — this answers
 * only the first, honestly, without being read as evidence for the
 * second. See computeBudgetReconciliation's own doc comment for what
 * feeds it. */
export function budgetReconciliationTemplateValues(state: GameState): Record<string, string> {
  const r = computeBudgetReconciliation(state);
  const formatMillions = (value: number) => `£${(value / 1_000_000).toFixed(1)}M`;
  const delta = r.approvedBudget - r.forecastCostAgainstBaseline;
  const costPerformanceLabel =
    delta > 0
      ? `${formatMillions(delta)} under budget`
      : delta < 0
        ? `${formatMillions(Math.abs(delta))} over budget`
        : "exactly on budget";
  return {
    forecastCostFormatted: formatMillions(r.forecastCostAgainstBaseline),
    approvedBudgetFormatted: formatMillions(r.approvedBudget),
    costPerformanceLabel,
  };
}

/** {token} values for Act 6's Benefits Register readout (DIALOGUE_ACT6_
 * SCENE03) — a pure read of the Benefits Register tool's OWN Measure/
 * Evidence/When data (TOOL_ACT3_SCENE06_BENEFITS in tool_screens.json),
 * not a hand-authored restatement of it, so the ROI line always matches
 * whatever that tool actually asks the player to prove. Only the ROI
 * benefit needs this: NHS Contract Secured and More Patients Treated are
 * assessed via endingConditionFlags' contract_secured/contract_lost and
 * batch_released/batch_rejected (Gate 1/Gate 2 results are, unlike ROI,
 * things the game's own timeline actually resolves by Act 6). Falls back
 * to the tool's own authored defaults if the screen is ever missing, same
 * defensive pattern as computeBudgetReconciliation's FALLBACK constant. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- state param kept for call-site consistency with its siblings (all spread as `...xTemplateValues(state)` in GameRoot's templateValues); this one just doesn't need it yet.
export function benefitsRegisterTemplateValues(state: GameState): Record<string, string> {
  const tool = getToolScreen("TOOL_ACT3_SCENE06_BENEFITS");
  const roi = tool?.benefits?.find((b) => b.id === "benefit_roi");
  return {
    roiMeasure: roi?.correctMeasure ?? "ROI",
    roiEvidence: roi?.correctEvidence ?? "Finance report",
    roiWhen: roi?.correctWhen ?? "12 months after go-live",
  };
}

export const EVENT_WAVE_MEMBERS: Record<string, string[]> = {
  MAIN_WAVE: ["EV-NP2", "EV-R2"],
};

/** One inter-report gap's event pool — see GAP_WAVE_SPECS. Deliberately
 * NOT "every eligible member fires": that's what produced the original
 * "one giant wave" problem this whole restructure fixes, just at gap
 * scale instead of whole-Act-4 scale. Each category is capped, and
 * selection is deterministic-but-rotated (see selectCapped) so a
 * later-declared pool member isn't structurally starved by an
 * earlier-declared one that's commonly eligible. */
interface GapWaveSpec {
  /** Fires first if eligible, ahead of every capped category — used for a
   * gap's one "anchor" beat (e.g. EV-06) rather than being just another
   * pool member, since its follow-up (anchorFollowUp) depends on it. */
  anchor?: string;
  /** Spliced directly after `anchor` in the returned queue whenever
   * `anchor` itself fires — NOT independently eligibility-gated (never
   * passed through isEventEligible at all), since its only precondition
   * is "the anchor just fired". See "EV-06-RAID" in events.json. */
  anchorFollowUp?: string;
  substantive: string[];
  substantiveCap: number;
  /** Pairs that should never both be selected in the same draw (e.g. two
   * quality/regulatory events reading as repetitive back to back). Only
   * checked within `substantive`. */
  mutuallyExclusive?: string[][];
  reversals?: string[];
  reversalCap?: number;
  /** A single-slot pool evaluated independently of `substantive` — e.g.
   * "at most one of {cyberattack, key-engineer resignation}", never both
   * in the same gap. */
  finalShock?: string[];
  finalShockCap?: number;
}

const GAP_WAVE_SPECS: Record<string, GapWaveSpec> = {
  MID_WAVE_1: {
    substantive: ["EV-02", "EV-13", "EV-04", "EV-08", "EV-05", "EV-11", "EV-03"],
    substantiveCap: 2,
    mutuallyExclusive: [["EV-02", "EV-05"]],
    reversals: ["EV-R1", "EV-R3", "EV-R4"],
    reversalCap: 1,
  },
  MID_WAVE_2: {
    anchor: "EV-06",
    anchorFollowUp: "EV-06-RAID",
    substantive: ["EV-15", "EV-14", "EV-10"],
    substantiveCap: 2,
    finalShock: ["EV-09", "EV-07"],
    finalShockCap: 1,
  },
};

/** Every real (non-synthetic) Act 4 event id across every wave/gap pool —
 * single source of truth so the hidden truth engine (computeActiveRisks)
 * can't silently drift out of sync with the player-facing wave structure
 * the way it would have the instant MAIN_WAVE stopped being "everything".
 * Deliberately excludes anchorFollowUp ids (e.g. "EV-06-RAID") — those
 * aren't risks/events, just a governance-interaction beat glued to a real
 * one, and have no events.json trigger condition of their own. */
function allAct4EventIds(): string[] {
  const gapIds = Object.values(GAP_WAVE_SPECS).flatMap((spec) => [
    ...(spec.anchor ? [spec.anchor] : []),
    ...spec.substantive,
    ...(spec.reversals ?? []),
    ...(spec.finalShock ?? []),
  ]);
  return [...EVENT_WAVE_MEMBERS.MAIN_WAVE, ...gapIds];
}

/** Deterministic-but-rotated pick of up to `cap` eligible members of
 * `pool`, respecting `exclude` (ids already picked elsewhere in this same
 * draw) and `mutuallyExclusive` pairs. Never random (nothing else in this
 * engine uses RNG, and reproducibility matters for testing/debugging a
 * save) — instead the pool's start point rotates by a value derived from
 * live project state, so the same save always yields the same pick, but
 * different playthroughs (which have different metric/history values by
 * the time they reach a given gap) don't all favour the same
 * early-declared pool members. See "Anti-starvation mechanism" in
 * DESIGN_NOTES.md. */
function selectCapped(
  pool: string[],
  cap: number,
  state: GameState,
  seed: number,
  exclude: Set<string>,
  mutuallyExclusive: string[][] = []
): string[] {
  const eligible = pool.filter((id) => !exclude.has(id) && isEventEligible(id, state));
  if (eligible.length === 0 || cap <= 0) return [];
  const offset = seed % eligible.length;
  const rotated = [...eligible.slice(offset), ...eligible.slice(0, offset)];
  const picked: string[] = [];
  for (const id of rotated) {
    if (picked.length >= cap) break;
    const blocked = mutuallyExclusive.some(
      (group) => group.includes(id) && group.some((other) => other !== id && picked.includes(other))
    );
    if (blocked) continue;
    picked.push(id);
  }
  return picked;
}

/** The rotation seed for selectCapped — deliberately built from values
 * that vary meaningfully across different playthroughs' project state
 * (not wall-clock time or anything non-reproducible), so the same save
 * always rotates the same way but different playthroughs generally
 * don't. */
function gapRotationSeed(state: GameState): number {
  const metrics = state.projectMetrics;
  return (
    Math.round(metrics.riskExposure) +
    Math.round(metrics.budgetRemaining / 10000) +
    state.eventsResolved.length
  );
}

/** Builds one gap wave's queue from its GapWaveSpec — anchor (+ its
 * follow-up, if the anchor fires) first, then capped substantive picks,
 * then capped reversal picks, then the capped final-shock slot. Order
 * matters here (it's the order the player experiences them in), unlike
 * computeActiveRisks' pool, which doesn't care about order at all. */
function computeGapEventQueue(waveId: string, state: GameState): string[] {
  const spec = GAP_WAVE_SPECS[waveId];
  if (!spec) return [];
  const seed = gapRotationSeed(state);
  const queue: string[] = [];
  const picked = new Set<string>();

  if (spec.anchor && isEventEligible(spec.anchor, state)) {
    queue.push(spec.anchor);
    picked.add(spec.anchor);
    if (spec.anchorFollowUp) queue.push(spec.anchorFollowUp);
  }

  const substantivePicks = selectCapped(
    spec.substantive,
    spec.substantiveCap,
    state,
    seed,
    picked,
    spec.mutuallyExclusive
  );
  queue.push(...substantivePicks);
  substantivePicks.forEach((id) => picked.add(id));

  if (spec.reversals && spec.reversalCap) {
    const reversalPicks = selectCapped(spec.reversals, spec.reversalCap, state, seed, picked);
    queue.push(...reversalPicks);
    reversalPicks.forEach((id) => picked.add(id));
  }

  if (spec.finalShock && spec.finalShockCap) {
    const shockPicks = selectCapped(spec.finalShock, spec.finalShockCap, state, seed, picked);
    queue.push(...shockPicks);
  }

  return queue;
}

/** Starting budgetRemaining every playthrough begins with (see
 * game_state.json) — EV-10's "Budget Remaining < 15%" trigger is relative
 * to this baseline, not a live-recomputed total. Exported so lib/nova/
 * endings.ts's deliveryComposite gate can compute the same
 * percent-of-starting-budget reading without duplicating the constant. */
export const STARTING_BUDGET = 12000000;

/** Fallback only — used if TOOL_ACT3_SCENE02_CBS is ever missing from
 * tool_screens.json (shouldn't happen; defensive, matching this file's
 * usual style of never hard-crashing on a missing data lookup). The real
 * value always comes from that tool's own totalIfAllIncluded, read fresh
 * by computeBudgetReconciliation rather than duplicated here as a second
 * hardcoded £8.0M. */
const FALLBACK_REFERENCE_BASELINE_COST = 8000000;

export interface BudgetReconciliation {
  /** £12.0M — the Board-approved investment ceiling. Same figure as
   * STARTING_BUDGET; named separately here since this whole struct exists
   * to give the financial-model figures their own honest names, not to
   * introduce a second source of truth. */
  approvedBudget: number;
  /** £8.0M, fixed — TOOL_ACT3_SCENE02_CBS's own totalIfAllIncluded, the
   * uncut cost baseline Act 3 establishes. Deliberately NEVER the
   * player's actual post-Act-3 committed cost (there isn't one — CBS
   * doesn't cut anything, see the "CBS classification rework" entry in
   * DESIGN_NOTES.md) and deliberately fixed for the whole game: the
   * financial score must not move just because a package got classified
   * differently, only because money was actually spent. */
  referenceBaselineCost: number;
  /** approvedBudget − referenceBaselineCost. £4.0M — the contingency
   * Act 3 establishes exists, fixed for the same reason
   * referenceBaselineCost is fixed. */
  originalContingency: number;
  /** approvedBudget − budgetRemaining — however much has actually been
   * spent beyond zero so far, live. */
  additionalSpend: number;
  /** referenceBaselineCost + additionalSpend — what the project's actual
   * total cost is forecast to be against the fixed baseline, independent
   * of anything CBS did or didn't cut. */
  forecastCostAgainstBaseline: number;
  /** approvedBudget − forecastCostAgainstBaseline. Algebraically equal to
   * budgetRemaining − referenceBaselineCost — how much of the £4.0M
   * contingency is still unspent. This is the number Gate 3's financial
   * subscore is built from (see evaluateDeliveryComposite in
   * endings.ts), not budgetRemaining/approvedBudget directly: measuring
   * against the full £12.0M approved figure understated how exposed the
   * £4.0M contingency actually was (spending exactly the contingency
   * still read as "66% of budget remaining, looks healthy" under the old
   * formula, rather than the true "0% of contingency left"). */
  headroom: number;
}

/** Pure, read-time reconciliation of the financial model established in
 * Act 3 (approvedBudget/referenceBaselineCost/originalContingency) against
 * whatever's actually happened to budgetRemaining since. No GameState
 * field stores any of this — every call recomputes it fresh from
 * projectMetrics.budgetRemaining and the CBS tool's own fixed baseline,
 * same pattern as reportMismatchFlags/effectiveDialogueFlags elsewhere in
 * this file. Safe to call before Act 3's CBS is ever reached (budgetRemaining
 * is still STARTING_BUDGET then, so additionalSpend is 0 and headroom
 * equals originalContingency) — callers that only want to change what they
 * show once CBS is actually done should gate on that themselves (e.g. the
 * HUD), not on anything in here. */
export function computeBudgetReconciliation(state: GameState): BudgetReconciliation {
  const cbsToolScreen = getToolScreen("TOOL_ACT3_SCENE02_CBS");
  const approvedBudget = STARTING_BUDGET;
  const referenceBaselineCost = cbsToolScreen?.totalIfAllIncluded ?? FALLBACK_REFERENCE_BASELINE_COST;
  const originalContingency = approvedBudget - referenceBaselineCost;
  const additionalSpend = approvedBudget - state.projectMetrics.budgetRemaining;
  const forecastCostAgainstBaseline = referenceBaselineCost + additionalSpend;
  const headroom = approvedBudget - forecastCostAgainstBaseline;
  return {
    approvedBudget,
    referenceBaselineCost,
    originalContingency,
    additionalSpend,
    forecastCostAgainstBaseline,
    headroom,
  };
}

/**
 * Per-event eligibility, straight from each event's own `trigger` prose in
 * events.json — see the comment on each case for the exact source text.
 * Deliberately checks only ELIGIBILITY (does this event fire at all this
 * playthrough), never the dynamic per-flag severity/effect adjustments a
 * few events' engineNotes also describe (EV-02/EV-06/EV-10's
 * validation_risk_logged &c. softening, and the "asked_X_impact" /
 * "asked_X_mitigation" extra-effect modifiers) — those choice options
 * still apply, unmodified, whatever static effects choices.json lists for
 * them. That refinement needs a general dynamic-effects resolver (the
 * same underlying gap blocking the honesty-tracking mechanic, task #178)
 * and is logged in DESIGN_NOTES.md rather than half-built here.
 */
export function isEventEligible(eventId: string, state: GameState): boolean {
  const metrics = state.projectMetrics;
  switch (eventId) {
    // "Conditional — fires only after BIG-01." Main Wave is only ever
    // reached via ACT4_SCENE03 (BIG-01), so this is always true by the
    // time eligibility is checked.
    case "EV-NP2":
      return true;
    // "Conditional — fires if the player deferred or rejected the
    // automated inspection camera change request." CHOICE_ACT4_SCENE02's
    // three options set filling_line_approved/deferred/rejected
    // individually — evaluated inline here rather than depending on a
    // separate filling_line_deferred_or_rejected flag, since nothing ever
    // actually sets that combined flag (a real gap: EV-R2 could never
    // have fired before this fix). DIALOGUE_EV-R2's own (only) line is
    // itself gated on the same pair of flags — checked here too so an
    // ineligible EV-R2 is skipped from the queue entirely rather than
    // materializing as an empty scene.
    case "EV-R2":
      return Boolean(state.flags.filling_line_deferred || state.flags.filling_line_rejected);
    // "Conditional (Regulatory Readiness < 60 at trigger)."
    case "EV-02":
      return metrics.regulatoryReadiness < 60;
    // "Conditional (contractor risk flagged in Act 2 unresolved)" —
    // designTag reads "Standard — foreshadowed since Act 2", and its own
    // engineNote frames contractor_risk_logged as a severity modifier
    // ("existing severity/softening logic... is unchanged"), not an
    // existence gate — the contractor collapses either way, just harder
    // if the risk was never logged. Always eligible.
    case "EV-06":
      return true;
    // "Scheduled."
    case "EV-03":
    case "EV-04":
    case "EV-08":
    case "EV-11":
    case "EV-13":
      return true;
    // "Conditional (Risk Exposure > 50)."
    case "EV-05":
      return metrics.riskExposure > 50;
    // "Conditional — fires against whichever supplier was NOT chosen in
    // Act 3." There's always exactly one unchosen supplier once
    // supplier_chosen is set (Act 3's Procurement Pitch, always played by
    // Act 4), so this is always true.
    case "EV-R1":
      return Boolean(getFlagString(state.flags, "supplier_chosen"));
    // "Conditional — fires if the player chose the cheapest supplier
    // (SteriTech) in Act 3." Confirmed by CHOICE_EV-R1's own engineNote:
    // RapidForm — not SteriTech — is the supplier that goes bankrupt here,
    // vindicating whichever of the other two the player picked instead.
    case "EV-R4":
      return getFlagString(state.flags, "supplier_chosen") === "steritech";
    // "Conditional — fires if Camille's trust band is Cold/Cool through
    // Act 2–3." No Cold/Cool banding is tracked historically (relationships
    // only ever hold a live running total) — reusing the same
    // WARM_RELATIONSHIP_THRESHOLD the portraits already band mood on: below
    // it reads as Cold/Cool, at/above it doesn't, checked at the moment
    // Main Wave's queue is computed.
    case "EV-R3":
      return (state.relationships.camille ?? 0) < WARM_RELATIONSHIP_THRESHOLD;
    // "Conditional (Team Morale < 40)."
    case "EV-07":
      return metrics.teamMorale < 40;
    // "Conditional (Team Morale < 50 OR Mike E. Trust Cold/Cool)."
    case "EV-14":
      return metrics.teamMorale < 50 || (state.relationships.marcus ?? 0) < WARM_RELATIONSHIP_THRESHOLD;
    // "Conditional (BMS flagged as a dependency)" — no flag anywhere in the
    // codebase ever sets this (searched exhaustively); treated as always
    // eligible, same as this wave's other "Scheduled" members, rather than
    // an event that could never fire. Logged in DESIGN_NOTES.md.
    case "EV-09":
      return true;
    // "Conditional (Budget Remaining < 15%)."
    case "EV-10":
      return metrics.budgetRemaining < STARTING_BUDGET * 0.15;
    // "Scheduled."
    case "EV-15":
      return true;
    default:
      console.warn(`[nova-engine] isEventEligible: unrecognised event id "${eventId}"`);
      return false;
  }
}

/** The queue for `waveId` — computed once, the instant the wave scene's
 * own dialogue finishes, and never recomputed for the rest of that wave
 * (matching "eligibility checked at trigger", the same semantics
 * events.json's own trigger prose implies). Dispatches to
 * computeGapEventQueue for a capped/rotated GAP_WAVE_SPECS entry, or the
 * simple "every eligible member, declared order" behaviour for a plain
 * EVENT_WAVE_MEMBERS array (currently just MAIN_WAVE, which is small
 * enough — 2 candidates — to need no cap). */
export function computeEventQueue(waveId: string, state: GameState): string[] {
  if (GAP_WAVE_SPECS[waveId]) return computeGapEventQueue(waveId, state);
  return (EVENT_WAVE_MEMBERS[waveId] ?? []).filter((eventId) => isEventEligible(eventId, state));
}

/** The actual scene id to enter for a given queue slot — the event's own
 * synthesized scene (see synthesizeEventScene in data.ts), unless it has a
 * precedingDialogueId OR a leadInPanelId, in which case its synthesized
 * lead-in scene plays first (see synthesizeEventFrameScene). */
export function resolveEventQueueEntryScene(eventId: string): string {
  const event = getEvent(eventId);
  return event?.precedingDialogueId || event?.leadInPanelId ? `${eventId}${EVENT_FRAME_SUFFIX}` : eventId;
}

/** True when `state.currentScene` is exactly the queue's current entry's
 * OWN event scene (never its lead-in beat, if it has one) — the moment
 * this event's own dialogue/choice concludes and something tries to
 * transition away from it, that transition should advance the queue
 * instead of going wherever the event's own (mostly null/placeholder)
 * static nextScene data says. Deliberately compares against the raw
 * eventId, not resolveEventQueueEntryScene's result — leaving a lead-in
 * beat should just flow into its own event normally, not advance the
 * queue a step early. */
export function isActiveQueuedEventScene(state: GameState): boolean {
  const queue = state.eventQueue;
  if (!queue) return false;
  return queue[state.eventQueueIndex] === state.currentScene;
}

// ---------------------------------------------------------------------------
// proof_chain_builder (Benefits Register) — builds Measure/Evidence per
// benefit. Reuses placeToolCard/isToolComplete's existing "list of
// resolved ids" persistence with a composite id (benefitId:field), rather
// than inventing new state shape — Owner/When Measurable are dialogue-
// revealed, not player-built, so they need no persistence at all.
// ---------------------------------------------------------------------------

export function benefitFieldId(benefitId: string, field: string): string {
  return `${benefitId}:${field}`;
}

// ---------------------------------------------------------------------------
// resetTool — "undo all" for a single tool screen. Wipes only that tool's
// own toolProgress/toolPlacements/toolSelections entries and reverses any
// budget/flag side effects it caused, without touching any other tool's
// state or narrative flags. Dispatches per toolScreen.type since each type
// stores progress in a different shape, and two of them (priority
// placement, hiring) have live budget/flag side effects that must be
// unwound rather than just cleared.
// ---------------------------------------------------------------------------

/**
 * Resets a single tool screen back to its untouched state — refunding any
 * budget it spent, clearing any flags it set, and wiping its progress —
 * without affecting any other tool or narrative flag. Powers the per-
 * screen "undo all" button so a player can restart one activity without
 * losing the rest of their save.
 */
export function resetTool(state: GameState, toolScreen: ToolScreenBlock): GameState {
  const toolId = toolScreen.toolId;
  let result: GameState;

  switch (toolScreen.type) {
    case "priority_assignment":
    case "power_interest_grid": {
      // Mirrors placePriorityCard in reverse: refund each placed card's
      // cost in its current bucket, delete the flags it set (only the
      // ones this tool's own cards can set — safe since flagsByBucket is
      // scoped to this toolScreen's data), then re-run the overcommitRule
      // against an empty distribution so its reactionFlag clears too.
      const placements = state.toolPlacements[toolId] ?? {};
      const budgetKey = toolScreen.budgetVariable ?? "budgetRemaining";
      let budget = state.projectMetrics[budgetKey] ?? 0;
      const nextFlags = { ...state.flags };

      for (const [cardId, bucket] of Object.entries(placements)) {
        const card = (toolScreen.cards ?? []).find((c) => c.id === cardId);
        if (!card) continue;
        if (card.costByBucket) budget += card.costByBucket[bucket] ?? 0;
        const flagsForBucket = card.flagsByBucket?.[bucket];
        if (flagsForBucket) {
          for (const key of Object.keys(flagsForBucket)) {
            if (flagsForBucket[key]) delete nextFlags[key];
          }
        }
      }

      let next: GameState = {
        ...state,
        projectMetrics: { ...state.projectMetrics, [budgetKey]: budget },
        flags: nextFlags,
        toolPlacements: { ...state.toolPlacements, [toolId]: {} },
      };
      next = applyOvercommitRule(next, toolScreen, {});
      result = next;
      break;
    }

    case "cost_review_with_descope": {
      // Clears every classification decision this tool's own classifiable
      // ids set — nothing else to unwind, since classifying a task never
      // touched flags, budget, or any other metric.
      const nextDecisions = { ...state.decisions };
      for (const id of toolScreen.classifiableTaskIds ?? []) {
        delete nextDecisions[cbsClassificationKey(id)];
      }
      result = { ...state, decisions: nextDecisions };
      break;
    }

    case "pick_n_of_m_swipeable": {
      // Un-hire every currently-hired candidate through toggleHire itself
      // rather than hand-reversing effects, so budget/otherEffects/
      // flagOnHire all unwind exactly the same way a manual un-hire would.
      const hired = state.toolSelections[toolId] ?? [];
      let next = state;
      for (const candidateId of hired) {
        next = toggleHire(next, toolScreen, candidateId);
      }
      result = next;
      break;
    }

    case "gantt_placement":
      result = {
        ...state,
        toolPlacements: { ...state.toolPlacements, [toolId]: {} },
        toolSelections: { ...state.toolSelections, [toolId]: [] },
        toolProgress: { ...state.toolProgress, [toolId]: [] },
      };
      break;

    // "sort_into_buckets" (PESTLE/SWOT/Comms/WBS) and "proof_chain_builder"
    // (Benefits) both store progress purely as a toolProgress id list, with
    // no cost or flags of their own to reverse.
    case "sort_into_buckets":
    case "proof_chain_builder":
    default:
      result = {
        ...state,
        toolProgress: { ...state.toolProgress, [toolId]: [] },
      };
      break;
  }

  // A reset always un-submits too — otherwise the (now-empty) tool screen
  // would still read as "already submitted" from a stale flag, blocking
  // the player from redoing the activity and tapping Submit again.
  if (!result.toolSubmitted[toolId]) return result;
  const nextSubmitted = { ...result.toolSubmitted };
  delete nextSubmitted[toolId];
  return { ...result, toolSubmitted: nextSubmitted };
}

// ---------------------------------------------------------------------------
// submitTool — the explicit "I'm done" action for a tool screen. Kept
// entirely separate from completion (isToolComplete/isPriorityToolComplete/
// etc., which just report whether the activity's requirements are met): a
// tool used to auto-advance the scene the instant its completion condition
// became true, with no player action in between. This flag instead gates
// that advance behind a real tap, so the screen — and its enabled Submit
// button — stays up until the player chooses to move on.
// ---------------------------------------------------------------------------

export function submitTool(state: GameState, toolScreen: ToolScreenBlock): GameState {
  const toolId = toolScreen.toolId;
  if (state.toolSubmitted[toolId]) return state;
  return { ...state, toolSubmitted: { ...state.toolSubmitted, [toolId]: true } };
}
