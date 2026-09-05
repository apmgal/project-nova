// Act 6 ending resolution — the three-gate model (see data/endings.json for
// the narrative spec and centralised, provisional thresholds this reads,
// and DESIGN_NOTES.md's "Four-family ending architecture" entry for the
// full design rationale). Deliberately a single pure function: no state
// mutation, no persistence of its own — GameState.decisions/.flags/
// .statusReports/.relationships/.projectMetrics are the only inputs, and
// every number this needs already exists there. Call it fresh wherever the
// resolved ending is needed (ACT6_SCENE02's batch result, ACT6_SCENE03's
// ending dialogue, the conditional NHS Procurement notice) rather than
// caching it on GameState — it's cheap and always a pure function of state
// already present, same reasoning as reportMismatchFlags/effectiveDialogueFlags
// in state.ts.

import type { GameState } from "./types";
import { findMostMaterialReportMismatch, STARTING_BUDGET, WARM_RELATIONSHIP_THRESHOLD } from "./state";
import endingsConfig from "@/data/endings.json";

export type ContractGateResult = "secured" | "lost";
export type BatchResult = "released" | "rejected";
export type EndingFamily =
  | "TRIUMPHANT_LAUNCH"
  | "PYRRHIC_VICTORY"
  | "CONTRACT_LOST"
  | "BATCH_REJECTED";
export type PyrrhicVariant = "financial" | "political" | "scrutiny" | "recoverable_quality_failure";

export interface EndingResult {
  contractGateResult: ContractGateResult;
  /** Null when the Contract Gate already resolved to "lost" — Gate 2 never
   * runs in that case, since the commercial outcome is already decided.
   * This is the field that keeps "batch event" and "ending family"
   * distinct: a rejected-then-recovered batch can still resolve to the
   * PYRRHIC_VICTORY family (see endingVariant "recoverable_quality_failure"),
   * so code must never infer endingFamily from batchResult alone. */
  batchResult: BatchResult | null;
  endingFamily: EndingFamily;
  /** Only set when endingFamily === "PYRRHIC_VICTORY". */
  endingVariant: PyrrhicVariant | null;
  /** Human-readable trace of exactly why each gate resolved the way it
   * did — every gate appends one line, in evaluation order, unconditionally
   * (including gates that never ran, so the array's length alone tells you
   * how far evaluation got). Intended for the debug panel and for sanity-
   * checking calibration during playtesting, not for player-facing copy. */
  diagnostics: string[];
}

type EndingsConfig = typeof endingsConfig;
const config: EndingsConfig = endingsConfig;
const gates = config.gateThresholds;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** consistent=100, borderline=55, material=0 — see deliveryComposite.weightsNote
 * in data/endings.json. Deliberately derived from findMostMaterialReportMismatch
 * on every call rather than tracked separately (see the "honesty tracking"
 * discussion in DESIGN_NOTES.md — reportsAccurate/reportsMisleading counters
 * were considered and rejected as duplicate state). */
function honestySubscore(state: GameState): number {
  const mismatch = findMostMaterialReportMismatch(state);
  if (!mismatch) return 100;
  return mismatch.severity === "material" ? 0 : 55;
}

function evaluateContractGate(state: GameState): { result: ContractGateResult; diagnostic: string } {
  const cfg = gates.contractGate;
  const schedule = state.projectMetrics.scheduleHealth;
  const goodwill = state.projectMetrics.stakeholderGoodwill;

  const graceApplies = state.decisions[cfg.graceDecision.key] === cfg.graceDecision.value;
  const effectiveFloor = graceApplies ? cfg.graceDecision.scheduleHealthFloorOverride : cfg.scheduleHealthFloor;

  const scheduleFailed = schedule < effectiveFloor;
  const investigationDelayedLaunch = goodwill <= cfg.severeGoodwillFloor;

  if (scheduleFailed || investigationDelayedLaunch) {
    const reason = scheduleFailed
      ? `scheduleHealth ${schedule} < floor ${effectiveFloor}${graceApplies ? " (grace applied)" : ""}`
      : `stakeholderGoodwill ${goodwill} <= severe floor ${cfg.severeGoodwillFloor} (external investigation delayed launch)`;
    return {
      result: "lost",
      diagnostic: `Gate 1 (Contract): LOST — ${reason}.`,
    };
  }

  return {
    result: "secured",
    diagnostic: `Gate 1 (Contract): SECURED — scheduleHealth ${schedule} >= floor ${effectiveFloor}${graceApplies ? " (grace applied)" : ""}, stakeholderGoodwill ${goodwill} > severe floor ${cfg.severeGoodwillFloor}.`,
  };
}

function evaluateQualityGate(
  state: GameState,
): { batchResult: BatchResult; family: "PYRRHIC_VICTORY" | "BATCH_REJECTED" | null; diagnostic: string } {
  const cfg = gates.qualityGate;
  const readiness = state.projectMetrics.regulatoryReadiness;
  const risk = state.projectMetrics.riskExposure;
  const mismatch = findMostMaterialReportMismatch(state);
  const mismatchLabel = mismatch ? mismatch.severity : "consistent";

  const released =
    readiness >= cfg.releaseRegulatoryReadinessFloor &&
    risk <= cfg.releaseRiskExposureCeiling &&
    mismatchLabel !== "material";

  if (released) {
    return {
      batchResult: "released",
      family: null,
      diagnostic: `Gate 2 (Quality): RELEASED — regulatoryReadiness ${readiness} >= ${cfg.releaseRegulatoryReadinessFloor}, riskExposure ${risk} <= ${cfg.releaseRiskExposureCeiling}, mismatch ${mismatchLabel}.`,
    };
  }

  const recoverable = readiness >= cfg.recoverableRegulatoryReadinessFloor && mismatchLabel !== "material";
  if (recoverable) {
    return {
      batchResult: "rejected",
      family: "PYRRHIC_VICTORY",
      diagnostic: `Gate 2 (Quality): REJECTED but RECOVERABLE — regulatoryReadiness ${readiness} >= recoverable floor ${cfg.recoverableRegulatoryReadinessFloor}, mismatch ${mismatchLabel} (not material) → routes to Pyrrhic Victory (recoverable_quality_failure).`,
    };
  }

  return {
    batchResult: "rejected",
    family: "BATCH_REJECTED",
    diagnostic: `Gate 2 (Quality): REJECTED, UNRECOVERABLE — regulatoryReadiness ${readiness} (recoverable floor ${cfg.recoverableRegulatoryReadinessFloor}), mismatch ${mismatchLabel}.`,
  };
}

function evaluateDeliveryComposite(state: GameState): { family: EndingFamily; variant: PyrrhicVariant; diagnostic: string } {
  const cfg = gates.deliveryComposite;
  const w = cfg.weights;
  const metrics = state.projectMetrics;

  const budgetPct = clamp((metrics.budgetRemaining / STARTING_BUDGET) * 100, 0, 100);
  const benefits = clamp(metrics.benefitsRealisationScore, 0, 100);
  const goodwill = clamp(metrics.stakeholderGoodwill, 0, 100);
  const morale = clamp(metrics.teamMorale, 0, 100);
  const boardConfidence = clamp(metrics.boardConfidence, 0, 100);
  const honesty = honestySubscore(state);

  const composite =
    budgetPct * w.budgetRemainingPct +
    benefits * w.benefitsRealisationScore +
    goodwill * w.stakeholderGoodwill +
    morale * w.teamMorale +
    boardConfidence * w.boardConfidence +
    honesty * w.honesty;

  const compositeSummary = `composite ${composite.toFixed(1)} (budget% ${budgetPct.toFixed(0)}, benefits ${benefits}, goodwill ${goodwill}, morale ${morale}, boardConfidence ${boardConfidence}, honesty ${honesty})`;

  // Political isolation is checked BEFORE the composite threshold, not as a
  // fallback once the composite already reads low — a high composite must
  // never be able to average away a cold sponsor/QA relationship into a
  // Triumphant reading (see DESIGN_NOTES.md: "excellent everything else +
  // Camille cold" is exactly the disproportionate-punishment case this
  // design is meant to avoid IN THE OTHER DIRECTION — it can't become a
  // hidden Triumphant either).
  const marcusTrust = state.relationships.marcus ?? 0;
  const camilleTrust = state.relationships.camille ?? 0;
  const politicallyIsolated = marcusTrust < WARM_RELATIONSHIP_THRESHOLD || camilleTrust < WARM_RELATIONSHIP_THRESHOLD;

  if (politicallyIsolated) {
    return {
      family: "PYRRHIC_VICTORY",
      variant: "political",
      diagnostic: `Gate 3 (Delivery): PYRRHIC / political — min(marcus ${marcusTrust}, camille ${camilleTrust}) < WARM_RELATIONSHIP_THRESHOLD ${WARM_RELATIONSHIP_THRESHOLD} (checked before the composite; ${compositeSummary} not decisive here).`,
    };
  }

  if (composite >= cfg.triumphantThreshold) {
    return {
      family: "TRIUMPHANT_LAUNCH",
      variant: "financial", // unused when family isn't Pyrrhic; see EndingResult.endingVariant
      diagnostic: `Gate 3 (Delivery): TRIUMPHANT — ${compositeSummary} >= threshold ${cfg.triumphantThreshold}; relationships above WARM_RELATIONSHIP_THRESHOLD.`,
    };
  }

  const variant: PyrrhicVariant = budgetPct <= goodwill ? "financial" : "scrutiny";
  return {
    family: "PYRRHIC_VICTORY",
    variant,
    diagnostic: `Gate 3 (Delivery): PYRRHIC / ${variant} — ${compositeSummary} < threshold ${cfg.triumphantThreshold}; relationships above WARM_RELATIONSHIP_THRESHOLD; picked lower of budget% ${budgetPct.toFixed(0)} vs goodwill ${goodwill}.`,
  };
}

/**
 * Resolves Act 6's ending in one pass: Gate 1 (Contract) → Gate 2 (Quality,
 * only if secured) → Gate 3 (Delivery composite, only if released). Every
 * branch is documented in data/endings.json's gateThresholds — this
 * function contains no thresholds of its own, only the branching logic,
 * so recalibration after playtesting never needs a code change.
 */
export function evaluateEnding(state: GameState): EndingResult {
  const diagnostics: string[] = [];

  const contract = evaluateContractGate(state);
  diagnostics.push(contract.diagnostic);

  if (contract.result === "lost") {
    return {
      contractGateResult: "lost",
      batchResult: null,
      endingFamily: "CONTRACT_LOST",
      endingVariant: null,
      diagnostics,
    };
  }

  const quality = evaluateQualityGate(state);
  diagnostics.push(quality.diagnostic);

  if (quality.family) {
    // Rejected — either recoverable (Pyrrhic) or not (Batch Rejected).
    // Gate 3 never runs: "how well did you get there" is moot when the
    // core deliverable itself failed or only survived via recovery.
    return {
      contractGateResult: "secured",
      batchResult: quality.batchResult,
      endingFamily: quality.family,
      endingVariant: quality.family === "PYRRHIC_VICTORY" ? "recoverable_quality_failure" : null,
      diagnostics,
    };
  }

  const delivery = evaluateDeliveryComposite(state);
  diagnostics.push(delivery.diagnostic);

  return {
    contractGateResult: "secured",
    batchResult: "released",
    endingFamily: delivery.family,
    endingVariant: delivery.family === "PYRRHIC_VICTORY" ? delivery.variant : null,
    diagnostics,
  };
}
