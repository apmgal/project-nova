import endingsConfig from "@/data/endings.json";
import { getAllToolScreens } from "./data";
import {
  computeAuditTrailEvidence,
  computeBudgetReconciliation,
  computeCbsClassifications,
  findMostMaterialReportMismatch,
  metricBand,
  type AuditTrailEvidenceCard,
  type MetricBand,
} from "./state";
import { evaluateEnding } from "./endings";
import { ARTEFACT_REGISTRY } from "./artefacts";
import { FIELD_GUIDE } from "./fieldGuide";
import type { CbsClassification, GameState, StatusReportRecord, ToolScreenBlock } from "./types";

// ---------------------------------------------------------------------------
// Project Artefacts — phase-grouped gallery model.
//
// Per direct instruction, the gallery is organised by APM lifecycle phase
// rather than as one flat list: Phase 1 Initiation (PID, PESTLE, SWOT,
// MoSCoW), Phase 2 Planning (Stakeholder Grid, Benefits Register, Cost
// Breakdown Review, Work Breakdown Structure, Communications Plan,
// Milestone Timeline), Phase 3 Execution (the 3 Monthly Status Reports
// plus any RAID Log Updates), Phase 4 Monitoring & Control (the Audit
// Trail), Phase 5 Closure (a new Project Reflection scorecard). This also
// absorbs ArtefactsDrawer's former standalone "Investigation Board" icon —
// PID and the Benefits Register are now entries here (under
// Initiation/Planning respectively) instead of living in their own panel;
// see DESIGN_NOTES.md for the merge rationale. ArtefactsDrawer itself still
// exists, but only as the full-size document viewer modal this gallery
// opens into.
// ---------------------------------------------------------------------------

export type ProjectPhaseId =
  | "initiation"
  | "planning"
  | "execution"
  | "monitoring_control"
  | "closure";

export interface ProjectPhaseMeta {
  id: ProjectPhaseId;
  number: number;
  label: string;
}

/** Deliberately the APM-process-group framing the player asked for
 * (Initiation/Planning/Execution/Monitoring & Control/Closure) — a
 * separate naming layer from the game's own Act 1-6 structure, which maps
 * to these phases loosely, not 1:1 (e.g. MoSCoW is built in Act 2 but the
 * player explicitly placed it under Initiation here, alongside PESTLE). */
export const PROJECT_PHASES: ProjectPhaseMeta[] = [
  { id: "initiation", number: 1, label: "Initiation" },
  { id: "planning", number: 2, label: "Planning" },
  { id: "execution", number: 3, label: "Execution" },
  { id: "monitoring_control", number: 4, label: "Monitoring & Control" },
  { id: "closure", number: 5, label: "Closure" },
];

const TOOL_VISUAL_STYLE_TITLES: Record<string, string> = {
  pestle_category_list: "PESTLE Analysis",
  swot_postit_quadrant: "SWOT Analysis",
  moscow_quadrant: "MoSCoW Prioritisation",
  power_interest_quadrant: "Stakeholder Power/Interest Grid",
};

const TOOL_VISUAL_STYLE_KIND: Record<string, "sort" | "priority"> = {
  pestle_category_list: "sort",
  swot_postit_quadrant: "sort",
  moscow_quadrant: "priority",
  power_interest_quadrant: "priority",
};

/** SWOT and MoSCoW both sit under Initiation per direct instruction (SWOT
 * wasn't named explicitly, but was confirmed to join PESTLE here); the
 * Stakeholder Grid sits under Planning, alongside the Benefits Register. */
const TOOL_VISUAL_STYLE_PHASE: Record<string, ProjectPhaseId> = {
  pestle_category_list: "initiation",
  swot_postit_quadrant: "initiation",
  moscow_quadrant: "initiation",
  power_interest_quadrant: "planning",
};

/** The Comms matching tool (TOOL_ACT3_SCENE05_COMMS) is a plain
 * sort_into_buckets screen with no visualStyle override — it already
 * renders through ToolScreen.tsx's default grid, which already supports
 * `readOnly`, so this is the only line of work it needs: a title/phase so
 * the main loop below picks it up as a "tool"/"sort" entry exactly like
 * PESTLE/SWOT, just keyed by toolId instead of visualStyle since it has
 * no visualStyle of its own to key off. */
const TOOL_ID_OVERRIDES: Record<string, { title: string; phase: ProjectPhaseId }> = {
  TOOL_ACT3_SCENE05_COMMS: { title: "Communications Plan", phase: "planning" },
};

export interface DocumentArtefactEntry {
  kind: "document";
  id: string;
  phase: ProjectPhaseId;
  title: string;
  available: boolean;
  /** Key into ARTEFACT_REGISTRY / gameState.artefacts — what
   * ProjectArtefactsPanel hands to ArtefactsDrawer's onViewingChange to
   * open the full-size image viewer. */
  artefactId: string;
}

export interface ToolArtefactEntry {
  kind: "tool";
  id: string;
  phase: ProjectPhaseId;
  title: string;
  available: boolean;
  toolId: string;
  toolScreen: ToolScreenBlock;
  rendererKind: "sort" | "priority";
}

/** CBS (cost_review_with_descope) — Planning. Its Protect/Potential lever
 * judgements live in GameState.decisions (see getCbsClassification's own
 * doc comment in state.ts), not in a tool kind this file already has a
 * shape for, so it gets its own entry kind alongside the matching
 * CBSReview `readOnly` render mode. */
export interface CbsArtefactEntry {
  kind: "cbs";
  id: string;
  phase: ProjectPhaseId;
  title: string;
  available: boolean;
  toolScreen: ToolScreenBlock;
  classifications: Record<string, CbsClassification | undefined>;
}

/** WBS (warehouse_blueprint) — Planning. Shares WBSBlueprint's own tree
 * layout (and WBS_ZONE_STYLE) rather than the generic sort-into-buckets
 * grid ToolScreen.tsx renders, so — like CBS — it needs its own kind
 * rather than folding into ToolArtefactEntry's "sort" rendererKind. */
export interface WbsArtefactEntry {
  kind: "wbs";
  id: string;
  phase: ProjectPhaseId;
  title: string;
  available: boolean;
  toolScreen: ToolScreenBlock;
  placedCardIds: string[];
}

/** Milestone Timeline (gantt_placement) — Planning, per direct
 * instruction ("a plan on a page"). `available` (toolSubmitted) already
 * requires every milestone placed AND the critical path correctly
 * confirmed, so the snapshot never needs a separate "was it correct"
 * flag — GanttBoard's own readOnly mode recomputes the critical path
 * fresh from `placements` via computeCriticalPath, same as the live
 * board. */
export interface GanttArtefactEntry {
  kind: "gantt";
  id: string;
  phase: ProjectPhaseId;
  title: string;
  available: boolean;
  toolScreen: ToolScreenBlock;
  placements: Record<string, string>;
}

/** RAID Update (raid_update_card) — Execution, alongside the 3 Monthly
 * Status Reports, per direct instruction. Unlike CBS/WBS/Gantt this was
 * already fully persisted before this change (handleSubmitRaidUpdate
 * writes owner/response to GameState.decisions and escalate to a flag,
 * keyed by toolScreen.raidKey ?? toolId) — RaidUpdateCard.tsx itself just
 * never had anywhere to read that back from, which is what
 * RaidUpdateSnapshot is for. */
export interface RaidArtefactEntry {
  kind: "raid";
  id: string;
  phase: ProjectPhaseId;
  title: string;
  available: boolean;
  toolScreen: ToolScreenBlock;
  owner: string | undefined;
  response: string | undefined;
  escalated: boolean;
}

export interface StatusReportArtefactEntry {
  kind: "status_report";
  id: string;
  phase: ProjectPhaseId;
  title: string;
  available: boolean;
  report: StatusReportRecord | null;
}

export interface AuditTrailArtefactEntry {
  kind: "audit_trail";
  id: string;
  phase: ProjectPhaseId;
  title: string;
  available: boolean;
  cards: AuditTrailEvidenceCard[];
}

export type ReflectionRating = "strong" | "mixed" | "at_risk";

export interface ReflectionCategory {
  id: string;
  label: string;
  rating: ReflectionRating;
  commentary: string;
}

/** One of the 19 FIELD_GUIDE modules confirmed to have a real in-game tie
 * (at least one matchesConcepts entry) — see MODULE_CATEGORY's doc comment
 * for why the other 8 are left out entirely rather than shown with a
 * cosmetic score. `rating` is NOT an independent per-module assessment —
 * there is no such signal anywhere in GameState — it's the parent
 * category's own rating, inherited. `encountered` (from fieldGuideSeen) is
 * shown alongside purely as context on whether the player personally hit
 * that module's specific in-story beat; it never gates inclusion. */
export interface ModuleScoreEntry {
  id: string;
  moduleNumber: number;
  title: string;
  categoryId: string;
  categoryLabel: string;
  rating: ReflectionRating;
  encountered: boolean;
}

export interface PivotalDecision {
  id: string;
  label: string;
  detail: string;
}

export interface ReflectionScorecard {
  outcomeLabel: string;
  outcomeSummary: string;
  categories: ReflectionCategory[];
  moduleBreakdown: ModuleScoreEntry[];
  pivotalDecisions: PivotalDecision[];
}

export interface ReflectionArtefactEntry {
  kind: "reflection";
  id: string;
  phase: ProjectPhaseId;
  title: string;
  available: boolean;
  scorecard: ReflectionScorecard | null;
}

export type ProjectArtefactEntry =
  | DocumentArtefactEntry
  | ToolArtefactEntry
  | CbsArtefactEntry
  | WbsArtefactEntry
  | GanttArtefactEntry
  | RaidArtefactEntry
  | StatusReportArtefactEntry
  | AuditTrailArtefactEntry
  | ReflectionArtefactEntry;

export interface ProjectPhaseGroup {
  phase: ProjectPhaseMeta;
  entries: ProjectArtefactEntry[];
}

// ---------------------------------------------------------------------------
// Phase 5 — Project Reflection scorecard
// ---------------------------------------------------------------------------

const CURRENCY = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 1,
});

function bandToRating(band: MetricBand): ReflectionRating {
  if (band === "green") return "strong";
  if (band === "yellow") return "mixed";
  return "at_risk";
}

/** Human-readable label per Pyrrhic variant — data/endings.json's
 * variants only carry narrativeSummary/tone, no short display name of
 * their own, so this is a small presentation-only addition rather than a
 * second source of truth for anything the ending engine itself resolves. */
const PYRRHIC_VARIANT_LABELS: Record<string, string> = {
  financial: "Financial Strain",
  political: "Political Cost",
  scrutiny: "Under Scrutiny",
  organisational: "Confidence Cost",
  recoverable_quality_failure: "Recovered Quality Failure",
};

interface EndingFamilyConfig {
  name: string;
  narrativeSummary: string;
}
interface EndingsConfigShape {
  endingFamilies: Record<string, EndingFamilyConfig & { variants?: Record<string, { narrativeSummary: string }> }>;
}
const typedEndingsConfig = endingsConfig as unknown as EndingsConfigShape;

/**
 * Which of the 6 scorecard categories each FIELD_GUIDE module's rating is
 * inherited from. Deliberately only the 19 modules confirmed to have a
 * real in-game tie (a non-empty `matchesConcepts`) — the other 8
 * (Organisational Structures, Sustainability, Diversity & Inclusion,
 * Integrated Planning, Leadership, Team Management, Conflict Resolution,
 * Ethics) have zero gameplay behind them in this build, so scoring them
 * would be purely cosmetic (there's nothing the player actually did under
 * that name to inherit a rating "for"). Left out of this map entirely —
 * see getProjectReflectionModuleBreakdown's own doc comment for how that
 * omission is enforced.
 *
 * Every rating here is inherited from its category, never computed
 * per-module — there is no module-level performance signal anywhere in
 * GameState, only these 6 whole-project metrics. See
 * ModuleScoreEntry's own doc comment for the same caveat stated from the
 * data-shape side.
 */
const MODULE_CATEGORY: Record<string, string> = {
  "module-1": "outcome", // Projects, Programmes and Portfolios
  "module-2": "outcome", // Project Lifecycles
  "module-4": "stakeholders", // Aspects of Project Governance
  "module-5": "outcome", // The Importance of the Business Case
  "module-6": "outcome", // Tools & Techniques of a Business Case (PESTLE/SWOT)
  "module-7": "schedule", // Requirements Management (MoSCoW)
  "module-8": "schedule", // Solutions Development
  "module-12": "schedule", // Schedule Management
  "module-13": "team", // Resource Management
  "module-14": "budget", // Budgeting & Cost Control
  "module-15": "stakeholders", // Stakeholder Engagement & Communications
  "module-19": "budget", // Procurement & Negotiation
  "module-20": "risk", // Quality Management
  "module-21": "risk", // Reviews
  "module-22": "risk", // Assurance
  "module-23": "risk", // Risk & Issue Management
  "module-24": "outcome", // Transition Management
  "module-25": "risk", // Change Control
  "module-26": "outcome", // Benefits Management
};

const PIVOTAL_DECISION_LABELS: Record<string, string> = {
  supplier_decision: "Supplier Selection",
  isolator: "Isolator Delay Response",
  filling_line: "Filling Line Change Control",
  big01: "Response to the BIG-01 Curveball",
  validation_resourcing: "Validation Resourcing Trade-off",
};

/**
 * The 5 simple ones reuse computeAuditTrailEvidence's own cards verbatim
 * (same id, same authored `detail` copy) rather than re-deriving the same
 * flags/decisions a second time with new wording — one source of truth
 * for "what actually happened" on each of these. The last 2 have no
 * Audit Trail card of their own (reporting honesty spans all 3 reports
 * rather than being a single filed decision; early risk investigation is
 * a count across 3 separate flags) so those are computed fresh here.
 */
function computePivotalDecisions(state: GameState): PivotalDecision[] {
  const auditCards = computeAuditTrailEvidence(state);
  const decisions: PivotalDecision[] = [];

  for (const id of ["supplier_decision", "isolator", "filling_line", "big01", "validation_resourcing"]) {
    const card = auditCards.find((c) => c.id === id);
    if (card) {
      decisions.push({ id, label: PIVOTAL_DECISION_LABELS[id], detail: card.detail });
    }
  }

  const riskFlags: Array<{ flag: string; label: string }> = [
    { flag: "contractor_risk_logged", label: "electrical contractor reliability" },
    { flag: "validation_risk_logged", label: "validation timeline" },
    { flag: "contingency_risk_logged", label: "contingency budget adequacy" },
  ];
  const loggedLabels = riskFlags.filter((r) => state.flags[r.flag]).map((r) => r.label);
  decisions.push({
    id: "early_risk_investigation",
    label: "Early Risk Investigation",
    detail:
      loggedLabels.length === 0
        ? "None of the 3 known risk areas (contractor reliability, validation timeline, contingency adequacy) were formally investigated in Act 2."
        : `${loggedLabels.length} of 3 known risk areas investigated and formally logged in Act 2: ${loggedLabels.join(", ")}.`,
  });

  const mismatch = findMostMaterialReportMismatch(state);
  decisions.push({
    id: "reporting_honesty",
    label: "Status Reporting Honesty",
    detail: mismatch
      ? `${mismatch.reportLabel} reported ${mismatch.dimensionLabel.toLowerCase()} as healthier than it actually was — the most material gap across your three reports.`
      : "Every status report you submitted held up against what was actually true.",
  });

  return decisions;
}

/**
 * New for the Phase 5 Closure gallery slot — per direct instruction, a
 * structured scorecard (one rating + one line of commentary per APM
 * competency) rather than free-text narrative or a bare checklist. Every
 * figure is read fresh from GameState/evaluateEnding, same "pure readout,
 * nothing separately persisted" pattern as reportMismatchFlags/
 * endingConditionFlags elsewhere in this codebase — there is no
 * GameState.reflection field.
 */
export function computeProjectReflectionScorecard(state: GameState): ReflectionScorecard {
  const reconciliation = computeBudgetReconciliation(state);
  const contingencyRatio =
    reconciliation.originalContingency > 0
      ? reconciliation.headroom / reconciliation.originalContingency
      : 0;
  const budgetRating: ReflectionRating =
    contingencyRatio >= 0.4 ? "strong" : contingencyRatio >= 0 ? "mixed" : "at_risk";

  const scheduleRating = bandToRating(metricBand(state.projectMetrics.scheduleHealth, true));

  const stakeholderAvg =
    (state.projectMetrics.stakeholderGoodwill + state.projectMetrics.boardConfidence) / 2;
  const stakeholderRating = bandToRating(metricBand(stakeholderAvg, true));

  const mismatch = findMostMaterialReportMismatch(state);
  const riskBandRating = bandToRating(metricBand(state.projectMetrics.riskExposure, false));
  // A material reporting mismatch caps this category's rating regardless
  // of how healthy riskExposure itself reads — under-reporting a real risk
  // is a governance failure independent of whether the risk ultimately
  // materialised.
  const riskRating: ReflectionRating =
    mismatch?.severity === "material"
      ? "at_risk"
      : mismatch?.severity === "borderline" && riskBandRating === "strong"
        ? "mixed"
        : riskBandRating;

  const teamRating = bandToRating(metricBand(state.projectMetrics.teamMorale, true));

  const ending = evaluateEnding(state);
  const familyConfig = typedEndingsConfig.endingFamilies[ending.endingFamily];
  let outcomeLabel = familyConfig?.name ?? ending.endingFamily;
  let outcomeSummary = familyConfig?.narrativeSummary ?? "";
  const outcomeRating: ReflectionRating =
    ending.endingFamily === "TRIUMPHANT_LAUNCH"
      ? "strong"
      : ending.endingFamily === "PYRRHIC_VICTORY"
        ? "mixed"
        : "at_risk";
  if (ending.endingFamily === "PYRRHIC_VICTORY" && ending.endingVariant) {
    const variantConfig = familyConfig?.variants?.[ending.endingVariant];
    const variantLabel = PYRRHIC_VARIANT_LABELS[ending.endingVariant] ?? ending.endingVariant;
    outcomeLabel = `${familyConfig?.name ?? "Pyrrhic Victory"} — ${variantLabel}`;
    if (variantConfig?.narrativeSummary) outcomeSummary = variantConfig.narrativeSummary;
  }

  const categories: ReflectionCategory[] = [
    {
      id: "budget",
      label: "Budget & Cost Control",
      rating: budgetRating,
      commentary: `${CURRENCY.format(Math.max(0, reconciliation.headroom))} of the ${CURRENCY.format(
        reconciliation.originalContingency,
      )} contingency remained at close.`,
    },
    {
      id: "schedule",
      label: "Schedule Delivery",
      rating: scheduleRating,
      commentary: `Schedule health finished at ${Math.round(state.projectMetrics.scheduleHealth)}/100.`,
    },
    {
      id: "stakeholders",
      label: "Stakeholder & Governance",
      rating: stakeholderRating,
      commentary: `Stakeholder goodwill ${Math.round(
        state.projectMetrics.stakeholderGoodwill,
      )}/100, Board confidence ${Math.round(state.projectMetrics.boardConfidence)}/100.`,
    },
    {
      id: "risk",
      label: "Risk Management & Reporting Integrity",
      rating: riskRating,
      commentary: mismatch
        ? `Risk exposure ${Math.round(state.projectMetrics.riskExposure)}/100. ${mismatch.reportLabel} reported ${mismatch.dimensionLabel.toLowerCase()} as healthier than it actually was.`
        : `Risk exposure ${Math.round(state.projectMetrics.riskExposure)}/100. Every status report held up against what was actually true.`,
    },
    {
      id: "team",
      label: "Team & Culture",
      rating: teamRating,
      commentary: `Team morale finished at ${Math.round(state.projectMetrics.teamMorale)}/100.`,
    },
    {
      id: "outcome",
      label: "Overall Outcome",
      rating: outcomeRating,
      commentary: outcomeSummary || outcomeLabel,
    },
  ];
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const seenModules = new Set(state.fieldGuideSeen);
  const moduleBreakdown: ModuleScoreEntry[] = FIELD_GUIDE.filter((entry) => entry.id in MODULE_CATEGORY)
    .map((entry) => {
      const categoryId = MODULE_CATEGORY[entry.id];
      const category = categoryById.get(categoryId);
      return {
        id: entry.id,
        moduleNumber: entry.moduleNumber,
        title: entry.title,
        categoryId,
        categoryLabel: category?.label ?? categoryId,
        rating: category?.rating ?? "mixed",
        encountered: seenModules.has(entry.id),
      };
    })
    .sort((a, b) => a.moduleNumber - b.moduleNumber);

  return {
    outcomeLabel,
    outcomeSummary,
    categories,
    moduleBreakdown,
    pivotalDecisions: computePivotalDecisions(state),
  };
}

// ---------------------------------------------------------------------------
// Phase assembly
// ---------------------------------------------------------------------------

/**
 * Every artefact the gallery knows about, grouped into the 5 phases above.
 * Each entry carries its own `available` flag rather than being filtered
 * out when unavailable — ProjectArtefactsPanel shows the full 5-phase
 * skeleton with locked/"not reached yet" entries, the same non-spoiler
 * "full reference, lit up as encountered" rule FieldGuidePanel already
 * follows (these are structural categories, not story spoilers).
 */
export function getProjectArtefactsByPhase(gameState: GameState): ProjectPhaseGroup[] {
  const allTools = getAllToolScreens();
  const auditTrailTool = allTools.find((t) => t.type === "audit_trail_builder") ?? null;

  const entries: ProjectArtefactEntry[] = [];

  entries.push({
    kind: "document",
    id: "pid",
    phase: "initiation",
    title: ARTEFACT_REGISTRY.pid?.title ?? "Project Initiation Document",
    available: Boolean(gameState.artefacts.pid),
    artefactId: "pid",
  });
  entries.push({
    kind: "document",
    id: "benefitsRegister",
    phase: "planning",
    title: ARTEFACT_REGISTRY.benefitsRegister?.title ?? "Benefits Register",
    available: Boolean(gameState.artefacts.benefitsRegister),
    artefactId: "benefitsRegister",
  });

  for (const toolScreen of allTools) {
    const visualStyle = toolScreen.visualStyle;
    const available = gameState.toolSubmitted[toolScreen.toolId] === true;

    if (visualStyle && visualStyle in TOOL_VISUAL_STYLE_TITLES) {
      entries.push({
        kind: "tool",
        id: toolScreen.toolId,
        phase: TOOL_VISUAL_STYLE_PHASE[visualStyle],
        title: TOOL_VISUAL_STYLE_TITLES[visualStyle],
        available,
        toolId: toolScreen.toolId,
        toolScreen,
        rendererKind: TOOL_VISUAL_STYLE_KIND[visualStyle],
      });
      continue;
    }

    const idOverride = TOOL_ID_OVERRIDES[toolScreen.toolId];
    if (idOverride) {
      entries.push({
        kind: "tool",
        id: toolScreen.toolId,
        phase: idOverride.phase,
        title: idOverride.title,
        available,
        toolId: toolScreen.toolId,
        toolScreen,
        rendererKind: "sort",
      });
      continue;
    }

    if (toolScreen.type === "cost_review_with_descope") {
      entries.push({
        kind: "cbs",
        id: toolScreen.toolId,
        phase: "planning",
        title: "Cost Breakdown Review",
        available,
        toolScreen,
        classifications: computeCbsClassifications(gameState, toolScreen),
      });
      continue;
    }

    if (visualStyle === "warehouse_blueprint") {
      entries.push({
        kind: "wbs",
        id: toolScreen.toolId,
        phase: "planning",
        title: "Work Breakdown Structure",
        available,
        toolScreen,
        placedCardIds: gameState.toolProgress[toolScreen.toolId] ?? [],
      });
      continue;
    }

    if (toolScreen.type === "gantt_placement") {
      entries.push({
        kind: "gantt",
        id: toolScreen.toolId,
        phase: "planning",
        title: "Milestone Timeline",
        available,
        toolScreen,
        placements: gameState.toolPlacements[toolScreen.toolId] ?? {},
      });
      continue;
    }

    if (toolScreen.type === "raid_update_card") {
      const raidKey = toolScreen.raidKey ?? toolScreen.toolId;
      entries.push({
        kind: "raid",
        id: toolScreen.toolId,
        phase: "execution",
        title: "RAID Log Update",
        available,
        toolScreen,
        owner: gameState.decisions[`${raidKey}_owner`],
        response: gameState.decisions[`${raidKey}_response`],
        escalated: Boolean(gameState.flags[`${raidKey}_escalated`]),
      });
      continue;
    }
  }

  for (let i = 0; i < 3; i++) {
    const report = gameState.statusReports[i] ?? null;
    entries.push({
      kind: "status_report",
      id: `status_report_${i + 1}`,
      phase: "execution",
      title: `Monthly Status Report ${i + 1}`,
      available: report !== null,
      report,
    });
  }

  entries.push({
    kind: "audit_trail",
    id: "audit_trail",
    phase: "monitoring_control",
    title: "Audit Trail",
    available: auditTrailTool ? gameState.toolSubmitted[auditTrailTool.toolId] === true : false,
    cards: computeAuditTrailEvidence(gameState),
  });

  // Gated on having reached Act 6 (where the ending is actually revealed
  // in-fiction) rather than any new persisted flag — evaluateEnding is
  // already a pure, cheap readout of existing GameState (same pattern as
  // endingConditionFlags), so there's nothing to store, only a point past
  // which showing it stops being premature.
  const reflectionAvailable = gameState.currentScene.startsWith("ACT6");
  entries.push({
    kind: "reflection",
    id: "project_reflection",
    phase: "closure",
    title: "Project Reflection",
    available: reflectionAvailable,
    scorecard: reflectionAvailable ? computeProjectReflectionScorecard(gameState) : null,
  });

  return PROJECT_PHASES.map((phase) => ({
    phase,
    entries: entries.filter((e) => e.phase === phase.id),
  }));
}

/** Whether the panel's edge tab should show at all — mirrors
 * ArtefactsDrawer's own former "nothing to show yet" rule: hidden entirely
 * until the player has at least one available entry anywhere. */
export function hasAnyAvailableProjectArtefact(gameState: GameState): boolean {
  return getProjectArtefactsByPhase(gameState).some((group) =>
    group.entries.some((entry) => entry.available),
  );
}

// ---------------------------------------------------------------------------
// Status report text resolution — resolves a StatusReportRecord's
// selectedAccomplishments/selectedUpcomingActivities ids (and risk ids)
// back to display text, for the read-only snapshot view. Mirrors exactly
// how StatusReportBuilder.tsx itself builds these candidate lists, just
// run once against the toolScreen that produced this specific record
// rather than kept in interactive state.
// ---------------------------------------------------------------------------

export function resolveStatusReportItemText(
  record: StatusReportRecord,
  itemId: string,
): string {
  const toolScreen = getAllToolScreens().find(
    (t) => t.type === "status_report_builder" && t.sourceScene === record.submittedAtScene,
  );
  if (!toolScreen) return itemId;

  const staticMatch =
    toolScreen.accomplishmentCandidates?.find((c) => c.id === itemId) ??
    toolScreen.upcomingActivityCandidates?.find((c) => c.id === itemId);
  if (staticMatch) return staticMatch.text;

  const ganttTool = toolScreen.ganttToolId ? getAllToolScreens().find((t) => t.toolId === toolScreen.ganttToolId) : null;
  const wbsTool = toolScreen.wbsToolId ? getAllToolScreens().find((t) => t.toolId === toolScreen.wbsToolId) : null;

  if (itemId.startsWith("gantt_activity_")) {
    const milestoneId = itemId.slice("gantt_activity_".length);
    const milestone = ganttTool?.milestones?.find((m) => m.id === milestoneId);
    if (milestone) return milestone.text;
  } else if (itemId.startsWith("wbs_activity_")) {
    const cardId = itemId.slice("wbs_activity_".length);
    const card = wbsTool?.cards?.find((c) => c.id === cardId);
    if (card) return card.text;
  } else if (itemId.startsWith("gantt_")) {
    const milestoneId = itemId.slice("gantt_".length);
    const milestone = ganttTool?.milestones?.find((m) => m.id === milestoneId);
    if (milestone) return `${milestone.text} (completed)`;
  }
  return itemId;
}
