import type { ChoiceOption, GameState } from "@/lib/nova/types";
import { getChoiceBlock, getEvent, getScene } from "@/lib/nova/data";
import { findMostMaterialReportMismatch, getFlagString, metricBand } from "@/lib/nova/state";
import { computeProjectReflectionScorecard, type ReflectionRating } from "@/lib/nova/projectArtefacts";
import { FIELD_GUIDE } from "@/lib/nova/fieldGuide";
import { buildDetermination, type DeterminationKind } from "@/lib/nova/finale";
import { INSP, buildInspectionDossier, readinessGaps, recommendationCredit } from "@/lib/nova/inspection";
import {
  READINESS_RECOMMENDATION,
  READINESS_RECOMMENDATION_KEY,
  RECOVERY_DECISION,
  RECOVERY_OUTCOME_KEY,
  RECOVERY_STRATEGY_KEY,
  SPONSOR_DECISION,
  SPONSOR_UPDATE_KEY,
} from "@/lib/nova/act5Recovery";

/**
 * Decision Analysis — a pure read-out of the saved game for the end-of-game review
 * (components/nova/analysis/DecisionAnalysis.tsx). Nothing here is stored and nothing changes scoring:
 *
 *  - Project outcome: the inspection determination (buildDetermination → evaluateQualityGate, unchanged).
 *  - Category ratings + their metric line: the existing Project Reflection scorecard
 *    (computeProjectReflectionScorecard, unchanged). Its sixth "Overall Outcome" category is the project
 *    outcome, not decision quality, so it is not shown as a performance rating here.
 *  - Decisions: only what the save actually records — state.choiceHistory (the option text the player
 *    picked, appended by GameRoot.handleSelectChoice for scenes and Act 4 events alike), plus the Act 5
 *    decisions bag (recovery strategy, sponsor update, readiness recommendation), the status reports and the
 *    inspection records. A decision that isn't recorded isn't shown.
 *  - Consequences: the chosen option's own effects from data/choices.json (exactly what applyEffects
 *    applied), plus the follow-on links the game logic actually has (e.g. a logged Act 2 risk softens its
 *    Act 4 event) — only when the save shows the follow-on happened.
 *  - Assessments: a short authored reading of each option of the key decisions (positive practice /
 *    trade-off / opportunity to improve), grounded in that option's effects and the designers' engine notes.
 *    Decisions designed with no dominant answer are marked as trade-offs. The readiness recommendation reuses
 *    the inspection's own recommendationCredit rule. Everything else is shown but "not assessed".
 *  - APM modules: the existing 19-module category mapping (MODULE_CATEGORY) and fieldGuideSeen. A module is
 *    only "applied" when an assessed decision in this save is linked to it — never inherited from a rating.
 */

export type Indicator = "positive" | "tradeoff" | "improve" | "not_assessed";
export type CategoryId = "budget" | "schedule" | "stakeholders" | "risk" | "team";

export interface Effect { label: string; value: string; good: boolean | null }
export interface Alternative { text: string; effects: Effect[]; note?: string }

export interface JourneyDecision {
  id: string;
  act: number;
  phase: string;
  title: string;
  situation: string;
  /** What the player chose, as the game recorded it. */
  choice: string;
  /** Extra lines for composite records (e.g. the three Act 2 risks). */
  choiceDetail?: string[];
  indicator: Indicator;
  /** Why it was assessed that way (absent when not assessed). */
  assessment?: string;
  effects: Effect[];
  /** Follow-on consequences the save shows actually happened. */
  consequences: string[];
  alternatives: Alternative[];
  categories: CategoryId[];
  modules: string[];
  /** Key decisions lead the timeline; the rest sit under "other decisions" in their act. */
  key: boolean;
  /** Higher = weighed first for the takeaways. */
  weight: number;
}

export interface ActGroup { act: number; label: string; key: JourneyDecision[]; other: JourneyDecision[] }

export interface CategoryReview {
  id: CategoryId;
  label: string;
  rating: ReflectionRating;
  metric: string;
  wellDone: JourneyDecision[];
  improve: JourneyDecision[];
  tradeoffs: JourneyDecision[];
  whyItMatters: string;
  consequences: string[];
  modules: ModuleView[];
  /** False when no recorded decision bears on this category: the rating is end-state metrics only. */
  hasDecisionEvidence: boolean;
}

export interface ModuleView {
  id: string;
  number: number;
  title: string;
  summary: string;
  encountered: boolean;
  /** Decisions in this save linked to the module that carry an assessment. */
  appliedIn: { id: string; title: string; indicator: Indicator }[];
}

export interface ModuleGroup { id: CategoryId | "outcome"; label: string; rating: ReflectionRating | null; modules: ModuleView[] }

export interface Takeaway { title: string; text: string; source?: string; general: boolean }

export interface DecisionAnalysis {
  outcome: { kind: DeterminationKind; label: string; statement: string };
  categories: CategoryReview[];
  journey: ActGroup[];
  decisionCount: number;
  apm: ModuleGroup[];
  apmUncovered: number;
  takeaways: { strength: Takeaway; develop: Takeaway; lesson: Takeaway };
  /** Honest notes about what this save can and can't support. */
  dataNotes: string[];
}

// ---------------------------------------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------------------------------------

const OUTCOME_COPY: Record<DeterminationKind, { label: string; statement: string }> = {
  satisfactory: { label: "Satisfactory", statement: "The facility received clearance to proceed with commissioning." },
  conditional: { label: "Subject to Conditions", statement: "Commissioning may proceed once the inspection's conditions have been met and verified." },
  unsatisfactory: { label: "Not Satisfactory", statement: "The facility did not receive clearance to proceed with commissioning." },
};

const CATEGORY_LABEL: Record<CategoryId, string> = {
  budget: "Budget & Cost Control",
  schedule: "Schedule Delivery",
  stakeholders: "Stakeholder & Governance",
  risk: "Risk Management & Reporting Integrity",
  team: "Team & Culture",
};

/** How each area connects to delivery — the general mechanism, shown alongside the player's own evidence. */
const CATEGORY_WHY: Record<CategoryId, string> = {
  budget: "Contingency is what absorbs the unexpected. Every pound spent buying time or quality earlier is a pound unavailable when the next event lands.",
  schedule: "Schedule decisions decide how much time is left for validation and readiness — the evidence an inspector expects to see complete.",
  stakeholders: "The Board and sponsor act on what they are told. Confidence earned through accurate, timely communication is what keeps support in place when the news is bad.",
  risk: "Risks named early can be planned for: in this project, risks logged in Act 2 soften the events they foreshadow in Act 4, and honest reporting keeps decisions grounded in the project's real position.",
  team: "Resourcing choices under pressure show up later as capacity and morale — the people who have to finish validation and readiness work.",
};

const CHARACTER_NAMES: Record<string, string> = {
  marcus: "Mike E.", camille: "Camille", priya: "Priya", daniel: "Daniel", vaughn: "Vaughn", aisha: "Aisha", tomasz: "Tomasz", ben: "Ben",
};
const METRIC_LABELS: Record<string, { label: string; higherIsBetter: boolean }> = {
  budgetRemaining: { label: "Budget", higherIsBetter: true },
  scheduleHealth: { label: "Schedule health", higherIsBetter: true },
  riskExposure: { label: "Risk exposure", higherIsBetter: false },
  regulatoryReadiness: { label: "Regulatory readiness", higherIsBetter: true },
  boardConfidence: { label: "Board confidence", higherIsBetter: true },
  stakeholderGoodwill: { label: "Stakeholder goodwill", higherIsBetter: true },
  teamMorale: { label: "Team morale", higherIsBetter: true },
};
/** The scorecard's commentary prints whole pounds with a ".0" ("£1,250,000.0"): shown here as £m. */
function tidyMoney(text: string): string {
  return text.replace(/£([\d,]+)(?:\.\d)?/g, (_, n: string) => {
    const v = Number(n.replace(/,/g, ""));
    return v >= 100_000 ? `£${(v / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}m` : `£${n}`;
  });
}
const SUPPLIERS: Record<string, string> = { steritech: "SteriTech", rapidform: "RapidForm", pharmacraft: "PharmaCraft" };

function formatEffects(effects: Record<string, number> | undefined): Effect[] {
  if (!effects) return [];
  const out: Effect[] = [];
  for (const [key, v] of Object.entries(effects)) {
    if (!v) continue;
    const trust = key.match(/^(.+)Trust$/);
    if (trust) {
      out.push({ label: `${CHARACTER_NAMES[trust[1]] ?? trust[1]}'s trust`, value: `${v > 0 ? "+" : "−"}${Math.abs(v)}`, good: v > 0 });
      continue;
    }
    const m = METRIC_LABELS[key];
    if (!m) continue;
    const value = key === "budgetRemaining"
      ? `${v > 0 ? "+" : "−"}£${(Math.abs(v) / 1_000_000).toFixed(Math.abs(v) % 1_000_000 === 0 ? 0 : 1)}m`
      : `${v > 0 ? "+" : "−"}${Math.abs(v)}`;
    out.push({ label: m.label, value, good: m.higherIsBetter ? v > 0 : v < 0 });
  }
  return out;
}

/** Player-facing option text: fills the supplier placeholders some event options carry. */
function optionText(text: string, state: GameState): string {
  const chosen = getFlagString(state.flags, "supplier_chosen");
  return text
    .replace("{chosenSupplier}", chosen ? SUPPLIERS[chosen] ?? chosen : "your chosen supplier")
    .replace("{alternateSupplier}", "the alternative supplier");
}

function actOf(sceneId: string): number {
  const scene = getScene(sceneId);
  const raw = getEvent(sceneId)?.act ?? scene?.act ?? "";
  const n = Number(String(raw).match(/\d/)?.[0]);
  return Number.isFinite(n) && n > 0 ? n : 4;
}
function titleOf(sceneId: string): string {
  return getEvent(sceneId)?.title ?? getScene(sceneId)?.title?.replace(/\s*\(.*\)\s*$/, "") ?? sceneId;
}

/** The player's latest pick for a choice block (index into its options), if the save records one. */
function picked(state: GameState, choiceId: string): { index: number; option: ChoiceOption; options: ChoiceOption[] } | null {
  const block = getChoiceBlock(choiceId);
  if (!block) return null;
  const entries = (state.choiceHistory ?? []).filter((h) => h.choiceId === choiceId);
  for (let i = entries.length - 1; i >= 0; i--) {
    const idx = block.options.findIndex((o) => o.text === entries[i].optionText);
    if (idx >= 0 && !block.options[idx].reaction) return { index: idx, option: block.options[idx], options: block.options };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------
// The key decisions (authored readings of each option — see the module comment)
// ---------------------------------------------------------------------------------------------------------

type Reading = { indicator: Indicator; note: string };
interface KeyChoice {
  id: string;
  choiceId: string;
  act: number;
  phase: string;
  title: string;
  situation: string;
  categories: CategoryId[];
  modules: string[];
  weight: number;
  readings: (state: GameState) => Reading[];
  consequences?: (state: GameState, index: number) => string[];
}

const KEY_CHOICES: KeyChoice[] = [
  {
    id: "first_diagnosis", choiceId: "CHOICE_ACT1_SCENE06", act: 1, phase: "Initiation", title: "First diagnosis to the sponsor", weight: 4,
    situation: "After your first days of investigation, Mike E. asked what you thought was really wrong with the project.",
    categories: ["stakeholders"], modules: ["module-5", "module-4"],
    readings: () => [
      { indicator: "positive", note: "Your diagnosis was grounded in what you had found: an unfinished business case and a benefits plan nobody had signed off." },
      { indicator: "tradeoff", note: "A fair read of the pressure on the team, but not tied to the evidence you had gathered." },
      { indicator: "tradeoff", note: "Honest about what you didn't yet know, but it cost Mike E.'s confidence and set an expectation of more meetings." },
    ],
  },
  {
    id: "moscow", choiceId: "CHOICE_ACT2_SCENE02", act: 2, phase: "Discovery", title: "MoSCoW prioritisation at the Board", weight: 5,
    situation: "At the Board, Priya pressed for another automation Must while Camille argued for validating what was already committed.",
    categories: ["stakeholders", "schedule"], modules: ["module-7", "module-4"],
    readings: () => [
      { indicator: "positive", note: "You held the agreed priorities and put validation first." },
      { indicator: "tradeoff", note: "You met Priya's case for the retrofit, at £0.5m and some of Camille's confidence." },
      { indicator: "improve", note: "You deferred a decision the Board was ready to take, and Mike E.'s confidence fell." },
    ],
  },
  {
    id: "lifecycle", choiceId: "CHOICE_ACT2_SCENE05", act: 2, phase: "Discovery", title: "Delivery approach", weight: 3,
    situation: "You had to choose how the project would be run: staged gates, a flexible approach, or a hybrid.",
    categories: ["risk", "schedule"], modules: ["module-2"],
    readings: () => [
      { indicator: "positive", note: "Staged gates suit a regulated build: lower risk exposure, at some cost to the schedule." },
      { indicator: "tradeoff", note: "Faster, but looser control where regulation needs evidence." },
      { indicator: "positive", note: "You matched the approach to the work: gated where validation demands it, flexible for automation." },
    ],
  },
  {
    id: "supplier", choiceId: "CHOICE_ACT3_SCENE07", act: 3, phase: "Planning", title: "Supplier selection", weight: 5,
    situation: "Three suppliers pitched for the equipment package, each strong on a different one of cost, speed and validation record.",
    categories: ["budget"], modules: ["module-19"],
    readings: () => [
      { indicator: "tradeoff", note: "You protected the budget (£0.3m back) for slightly higher risk exposure." },
      { indicator: "tradeoff", note: "You bought schedule for £0.4m." },
      { indicator: "tradeoff", note: "You paid £0.6m for validation quality and lower risk exposure." },
    ],
    consequences: (s) => (s.eventsResolved?.includes("EV-R1") ? ["One of the suppliers you didn't choose came back into play in Act 4 (the supplier reversal)."] : []),
  },
  {
    id: "isolator", choiceId: "CHOICE_ACT4_SCENE01", act: 4, phase: "Execution", title: "Isolator supplier delay", weight: 5,
    situation: "The isolator supplier announced a delay. Expediting would cost money; absorbing it would cost schedule. This decision was designed with no dominant answer.",
    categories: ["schedule", "budget"], modules: ["module-23", "module-12"],
    readings: () => [
      { indicator: "tradeoff", note: "You protected the schedule for £0.4m, costed and signed off the same day." },
      { indicator: "tradeoff", note: "You kept the budget and accepted the schedule slip, flagged to Mike E. in writing before it happened." },
    ],
  },
  {
    id: "filling_line", choiceId: "CHOICE_ACT4_SCENE02", act: 4, phase: "Execution", title: "Change control: the extra filling line", weight: 7,
    situation: "Late in delivery, Priya asked for an extra filling line. Mike E. liked it; Camille opposed it because of the revalidation it would need.",
    categories: ["risk"], modules: ["module-25"],
    readings: () => [
      { indicator: "tradeoff", note: "Approving late scope pleased Priya and Mike E., but cost £0.5m, 10 points of regulatory readiness and Camille's confidence." },
      { indicator: "positive", note: "You logged it with a re-review point after commissioning, protecting validation without losing the idea." },
      { indicator: "positive", note: "You weighed the revalidation risk against the benefit and recorded the rejection." },
    ],
  },
  {
    id: "big01", choiceId: "CHOICE_BIG-01", act: 4, phase: "Execution", title: "Response to the second product (BIG-01)", weight: 8,
    situation: "The Board bought another company: the facility now had to deliver a second product line.",
    categories: ["schedule"], modules: ["module-25", "module-12", "module-26"],
    readings: () => [
      { indicator: "tradeoff", note: "You bought time, but left the new scope itself unresolved, and Board confidence fell." },
      { indicator: "positive", note: "You re-planned both lines properly. It was costly (£1m), but scope, benefits and validation were redefined together." },
      { indicator: "improve", note: "You absorbed Product B without a formal re-plan. Its benefits were never defined, and the status reports' scope reads as uncontrolled growth." },
    ],
  },
  {
    id: "validation_resourcing", choiceId: "CHOICE_EV-NP2", act: 4, phase: "Execution", title: "Two products, one validation engineer", weight: 6,
    situation: "With a second product line, one validation engineer had to cover both. There was no clean answer.",
    categories: ["team", "schedule"], modules: ["module-13"],
    readings: () => [
      { indicator: "tradeoff", note: "You protected Product A's validation (regulatory readiness +10) and accepted the delay on B." },
      { indicator: "improve", note: "Spreading one engineer across both lines brought slippage, and lower readiness and morale, on both." },
      { indicator: "tradeoff", note: "You covered both lines with premium contract resource at £0.6m." },
    ],
  },
  {
    id: "contractor", choiceId: "CHOICE_EV-06", act: 4, phase: "Execution", title: "Electrical contractor bankruptcy", weight: 6,
    situation: "The electrical contractor collapsed mid-build — the risk raised in the Act 2 workshop.",
    categories: ["risk", "budget"], modules: ["module-23", "module-19"],
    readings: (s) => [
      { indicator: "tradeoff", note: "An emergency re-tender under pressure cost schedule and £0.3m." },
      s.flags.contractor_risk_logged
        ? { indicator: "positive", note: "You drew on the secondary supplier your Act 2 risk entry had identified: the mildest impact of the three options." }
        : { indicator: "tradeoff", note: "You chose the secondary-supplier route, though the risk hadn't been formally logged in Act 2." },
      { indicator: "tradeoff", note: "Delaying dependent work packages protected the budget, but cost 15 points of schedule." },
    ],
    consequences: (s) => {
      const owner = s.decisions?.raid_ev06_owner;
      return owner ? [`RAID log: owner ${owner}${s.decisions?.raid_ev06_response ? `, response "${s.decisions.raid_ev06_response}"` : ""}; escalated: ${s.flags.raid_ev06_escalated ? "yes" : "no"}.`] : [];
    },
  },
  {
    id: "gmp_review", choiceId: "CHOICE_EV-02", act: 4, phase: "Execution", title: "Cleanroom GMP review failure", weight: 6,
    situation: "A GMP review failed the cleanroom.",
    categories: ["risk"], modules: ["module-20"],
    readings: () => [
      { indicator: "positive", note: "You funded the rework: £0.4m, but regulatory readiness +15 and Camille's confidence." },
      { indicator: "improve", note: "Appealing the finding raised risk exposure by 10." },
      { indicator: "tradeoff", note: "Phasing the fix around commissioning protected the schedule, but cost 10 points of regulatory readiness." },
    ],
  },
  {
    id: "contamination", choiceId: "CHOICE_EV-05", act: 4, phase: "Execution", title: "Contamination found during commissioning", weight: 6,
    situation: "Contamination was found during commissioning activities.",
    categories: ["risk"], modules: ["module-20"],
    readings: () => [
      { indicator: "positive", note: "You stopped the line to investigate: a real schedule cost for quality." },
      { indicator: "improve", note: "Continuing in parallel with a contamination finding open raised risk exposure by 10." },
      { indicator: "positive", note: "You escalated to the quality lead, who owns the call." },
    ],
  },
  {
    id: "mhra_guidance", choiceId: "CHOICE_EV-11", act: 4, phase: "Execution", title: "New MHRA guidance note", weight: 4,
    situation: "New regulatory guidance was published mid-build.",
    categories: ["risk"], modules: ["module-20", "module-22"],
    readings: () => [
      { indicator: "positive", note: "You reviewed the design in full now: regulatory readiness +15, at a schedule cost." },
      { indicator: "tradeoff", note: "You deferred the review, with the risk acceptance documented." },
      { indicator: "tradeoff", note: "You reviewed only the highest-risk areas: a measured middle course." },
    ],
  },
  {
    id: "contingency_freeze", choiceId: "CHOICE_EV-10", act: 4, phase: "Execution", title: "Finance freezes part of the contingency", weight: 4,
    situation: "Finance froze part of the contingency budget.",
    categories: ["budget"], modules: ["module-14", "module-26"],
    readings: () => [
      { indicator: "positive", note: "You built the case to unfreeze the funds with the Benefits Register: an evidence-based argument." },
      { indicator: "tradeoff", note: "You descoped a 'Should' requirement to stay within the freeze." },
      { indicator: "tradeoff", note: "You absorbed the freeze and re-planned, at a schedule cost." },
    ],
  },
  {
    id: "automation_engineer", choiceId: "CHOICE_EV-07", act: 4, phase: "Execution", title: "Automation engineer resigns", weight: 3,
    situation: "A key automation engineer resigned.",
    categories: ["team"], modules: ["module-13"],
    readings: () => [
      { indicator: "tradeoff", note: "You bought cover with an emergency contractor (£0.35m)." },
      { indicator: "tradeoff", note: "You redistributed the work internally, and morale fell by 10." },
      { indicator: "tradeoff", note: "You renegotiated the Act 5 timeline with Mike E." },
    ],
  },
  {
    id: "validation_engineer", choiceId: "CHOICE_EV-14", act: 4, phase: "Execution", title: "Validation engineer poached", weight: 3,
    situation: "A competitor poached your validation engineer.",
    categories: ["team"], modules: ["module-13"],
    readings: () => [
      { indicator: "tradeoff", note: "You hired emergency contract cover at a premium (£0.4m)." },
      { indicator: "tradeoff", note: "You redistributed the work with Camille's support, at some cost to morale." },
      { indicator: "tradeoff", note: "You delayed commissioning to re-recruit properly." },
    ],
  },
];

/** Act 2's risk workshop: three separate decisions, read together. */
const RISK_CHOICES = [
  { choiceId: "CHOICE_ACT2_SCENE04", flag: "contractor_risk_logged", label: "Electrical contractor reliability", event: "EV-06", eventLabel: "the electrical contractor's bankruptcy" },
  { choiceId: "CHOICE_ACT2_SCENE04_VALIDATION", flag: "validation_risk_logged", label: "Validation timeline", event: "EV-02", eventLabel: "the cleanroom GMP review failure" },
  { choiceId: "CHOICE_ACT2_SCENE04_CONTINGENCY", flag: "contingency_risk_logged", label: "Contingency adequacy", event: "EV-10", eventLabel: "the contingency freeze" },
];

function keyDecision(def: KeyChoice, state: GameState): JourneyDecision | null {
  const p = picked(state, def.choiceId);
  if (!p) return null;
  const readings = def.readings(state);
  const r = readings[p.index] ?? { indicator: "not_assessed" as const, note: "" };
  return {
    id: def.id, act: def.act, phase: def.phase, title: def.title, situation: def.situation,
    choice: optionText(p.option.text, state),
    indicator: r.indicator, assessment: r.note || undefined,
    effects: formatEffects(p.option.effects),
    consequences: def.consequences?.(state, p.index) ?? [],
    alternatives: p.options.map((o, i) => ({ o, i })).filter(({ i, o }) => i !== p.index && !o.reaction)
      .map(({ o, i }) => ({ text: optionText(o.text, state), effects: formatEffects(o.effects), note: readings[i]?.note })),
    categories: def.categories, modules: def.modules, key: true, weight: def.weight,
  };
}

function riskWorkshop(state: GameState): JourneyDecision | null {
  const picks = RISK_CHOICES.map((r) => ({ ...r, p: picked(state, r.choiceId) }));
  if (picks.every((r) => !r.p)) return null;
  const logged = picks.filter((r) => state.flags[r.flag]);
  const n = logged.length;
  const consequences: string[] = [];
  for (const r of picks) {
    if (!state.eventsResolved?.includes(r.event)) continue;
    consequences.push(state.flags[r.flag]
      ? `${r.label}: when ${r.eventLabel} came in Act 4, its impact was softened because you had logged the risk.`
      : `${r.label}: when ${r.eventLabel} came in Act 4, it hit at full severity, because the risk had never been formally logged.`);
  }
  const effects: Record<string, number> = {};
  for (const r of picks) for (const [k, v] of Object.entries(r.p?.option.effects ?? {})) effects[k] = (effects[k] ?? 0) + v;
  return {
    id: "risk_workshop", act: 2, phase: "Discovery", title: "Early risk investigation",
    situation: "In the Act 2 risk workshop, Vaughn, Camille and Daniel each raised a known risk: contractor reliability, the validation timeline and contingency adequacy.",
    choice: n === 3 ? "You formally logged all three risks, each with a response." : n === 0 ? "None of the three risks was formally logged." : `You formally logged ${n} of the 3 risks.`,
    choiceDetail: picks.filter((r) => r.p).map((r) => `${r.label}: "${r.p!.option.text}"`),
    indicator: n === 3 ? "positive" : n === 0 ? "improve" : "tradeoff",
    assessment: n === 3
      ? "Each known risk was put on the register with a response while there was still time to act on it."
      : n === 0
        ? "None of the three known risk areas was formally investigated in Act 2. Logging them would have given the later events something to respond with."
        : `${3 - n} known risk area${3 - n > 1 ? "s were" : " was"} left informal. Only a logged risk changes how its later event lands.`,
    effects: formatEffects(effects),
    consequences,
    alternatives: picks.filter((r) => r.p && !state.flags[r.flag]).map((r) => {
      const formal = getChoiceBlock(r.choiceId)!.options[0];
      return { text: `${r.label}: "${formal.text}"`, effects: formatEffects(formal.effects), note: `Logging this risk would have softened ${r.eventLabel} in Act 4.` };
    }),
    categories: ["risk"], modules: ["module-23"], key: true, weight: 9,
  };
}

function statusReporting(state: GameState): JourneyDecision | null {
  const n = state.statusReports?.length ?? 0;
  if (!n) return null;
  const m = findMostMaterialReportMismatch(state);
  return {
    id: "status_reporting", act: 4, phase: "Execution", title: "Status reporting integrity",
    situation: "Each month you reported the project's position to the Board. Each report can be compared with what was actually true at the time.",
    choice: `${n} monthly status report${n > 1 ? "s" : ""} submitted.`,
    indicator: !m ? "positive" : m.severity === "material" ? "improve" : "tradeoff",
    assessment: !m
      ? "Every report you submitted held up against the project's actual condition."
      : `${m.reportLabel} reported ${m.dimensionLabel.toLowerCase()} as ${m.reportedRag} when it was actually ${m.actualRag}${m.severity === "material" ? ": a material understatement." : ": one band more optimistic than the evidence."}`,
    effects: [],
    consequences: m && (state.decisions?.[INSP.r1Doc] || state.decisions?.[INSP.r2Doc]) ? ["The inspection compared your reports with the project record, and the gap was raised as a finding."] : [],
    alternatives: m ? [{ text: `Report ${m.dimensionLabel.toLowerCase()} as ${m.actualRag}, with the reasons and a recovery plan.`, effects: [] }] : [],
    categories: ["risk", "stakeholders"], modules: ["module-4", "module-15", "module-21"], key: true, weight: 9,
  };
}

function act5Decisions(state: GameState): JourneyDecision[] {
  const out: JourneyDecision[] = [];
  const d = state.decisions ?? {};
  const strategy = RECOVERY_DECISION.options.find((o) => o.id === d[RECOVERY_STRATEGY_KEY]);
  if (strategy) {
    const outcome = d[RECOVERY_OUTCOME_KEY];
    out.push({
      id: "recovery_strategy", act: 5, phase: "Recovery", title: "Recovery strategy",
      situation: "A critical component failure put commissioning at risk. You chose how the programme would recover.",
      choice: `${strategy.title}: ${strategy.description}`,
      indicator: "tradeoff", assessment: strategy.tradeOff.replace(" · ", "; ") + ".",
      effects: formatEffects(strategy.effects),
      consequences: outcome ? [`Going into the readiness review, the recovery position was assessed as ${outcome === "strong" ? "strong" : outcome === "partial" ? "partial" : "not recovered"}.`] : [],
      alternatives: RECOVERY_DECISION.options.filter((o) => o.id !== strategy.id).map((o) => ({ text: `${o.title}: ${o.description}`, effects: formatEffects(o.effects), note: o.tradeOff.replace(" · ", "; ") + "." })),
      categories: ["schedule", "risk"], modules: ["module-12", "module-23"], key: true, weight: 6,
    });
  }
  const sponsor = SPONSOR_DECISION.options.find((o) => o.id === d[SPONSOR_UPDATE_KEY]);
  if (sponsor) {
    const reading: Record<string, Reading> = {
      reassure: { indicator: "improve", note: "It kept the Board calm for a day, but hid a known risk from the sponsor." },
      transparent: { indicator: "positive", note: "You were honest about the dependency and the risk to the date, and offered a plan." },
      delay: { indicator: "tradeoff", note: "It removed uncertainty, but gave up on recovery before the evidence required it." },
    };
    out.push({
      id: "sponsor_update", act: 5, phase: "Recovery", title: "Update to the sponsor",
      situation: "Mike E. called. He needed something he could take to the Board the next day.",
      choice: `${sponsor.title}: ${sponsor.description}`,
      indicator: reading[sponsor.id]?.indicator ?? "not_assessed", assessment: reading[sponsor.id]?.note,
      effects: [], consequences: [],
      alternatives: SPONSOR_DECISION.options.filter((o) => o.id !== sponsor.id).map((o) => ({ text: `${o.title}: ${o.description}`, effects: [], note: reading[o.id]?.note })),
      categories: ["stakeholders"], modules: ["module-15", "module-4"], key: true, weight: 8,
    });
  }
  const rec = READINESS_RECOMMENDATION.options.find((o) => o.id === d[READINESS_RECOMMENDATION_KEY]);
  if (rec) {
    const gaps = readinessGaps(state);
    const highRisk = metricBand(state.projectMetrics.riskExposure, false) === "red";
    const credit = recommendationCredit(state);
    const position = `${gaps.length === 0 ? "No outstanding readiness gaps" : `${gaps.length} outstanding readiness gap${gaps.length > 1 ? "s" : ""}`}${highRisk ? ", with risk exposure in the red" : ""}`;
    out.push({
      id: "readiness_recommendation", act: 5, phase: "Final readiness", title: "Commissioning recommendation",
      situation: `Your recommendation went to the Project Board. The readiness position at that point: ${position.charAt(0).toLowerCase() + position.slice(1)}.`,
      choice: `${rec.title}: ${rec.description}`,
      indicator: credit > 0 ? "positive" : credit < 0 ? "improve" : "tradeoff",
      assessment: credit > 0
        ? "The recommendation fitted the evidence available at the time."
        : credit < 0
          ? "The recommendation didn't fit the evidence: it went against the readiness position the project had in hand."
          : "A defensible call, but the evidence didn't clearly point to it over the alternatives.",
      effects: [],
      consequences: d[INSP.r1Doc] || d[INSP.r2Doc] ? ["The inspection still took place on its scheduled date. Whitfield asked you to account for this recommendation."] : [],
      alternatives: READINESS_RECOMMENDATION.options.filter((o) => o.id !== rec.id).map((o) => ({ text: `${o.title}: ${o.description}`, effects: [] })),
      categories: ["risk", "stakeholders"], modules: ["module-24", "module-22", "module-20"], key: true, weight: 10,
    });
  }
  return out;
}

function inspectionRecord(state: GameState, outcomeLabel: string): JourneyDecision | null {
  const d = state.decisions ?? {};
  if (!d[INSP.r1Doc] && !d[INSP.r2Doc]) return null;
  const docs = buildInspectionDossier(state);
  const title = (k: string) => docs.find((x) => x.id === d[k])?.title;
  const presented = [title(INSP.r1Doc), title(INSP.r2Doc)].filter(Boolean) as string[];
  return {
    id: "inspection", act: 6, phase: "Inspection", title: "Commissioning inspection",
    situation: "Inspector Whitfield reviewed the evidence in two rounds and asked you to account for the project's position.",
    choice: presented.length ? `You presented: ${presented.join(" and ")}.` : "Inspection completed.",
    indicator: "not_assessed",
    effects: [],
    consequences: [`Final determination: ${outcomeLabel}.`],
    alternatives: [],
    categories: [], modules: ["module-22", "module-21"], key: true, weight: 0,
  };
}

const ACT_LABELS: Record<number, string> = {
  1: "Act 1 — Initiation", 2: "Act 2 — Discovery", 3: "Act 3 — Planning", 4: "Act 4 — Execution", 5: "Act 5 — Recovery & readiness", 6: "Act 6 — Inspection",
};

// ---------------------------------------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------------------------------------

export function buildDecisionAnalysis(state: GameState): DecisionAnalysis {
  const det = buildDetermination(state);
  const outcome = { kind: det.kind, ...OUTCOME_COPY[det.kind] };
  const scorecard = computeProjectReflectionScorecard(state);

  // --- the journey -----------------------------------------------------------------------------------------
  const decisions: JourneyDecision[] = [];
  const keyChoiceIds = new Set<string>([...KEY_CHOICES.map((k) => k.choiceId), ...RISK_CHOICES.map((r) => r.choiceId)]);
  for (const def of KEY_CHOICES) { const j = keyDecision(def, state); if (j) decisions.push(j); }
  const rw = riskWorkshop(state); if (rw) decisions.push(rw);
  const sr = statusReporting(state); if (sr) decisions.push(sr);
  decisions.push(...act5Decisions(state));
  const insp = inspectionRecord(state, outcome.label); if (insp) decisions.push(insp);

  // Every other recorded choice: shown, not assessed (no-fail teaching prompts are left out).
  const seen = new Set<string>();
  const others: JourneyDecision[] = [];
  for (let i = (state.choiceHistory ?? []).length - 1; i >= 0; i--) {
    const h = state.choiceHistory[i];
    if (keyChoiceIds.has(h.choiceId) || seen.has(h.choiceId)) continue;
    const block = getChoiceBlock(h.choiceId);
    const opt = block?.options.find((o) => o.text === h.optionText);
    if (!block || !opt || block.options.some((o) => o.reaction)) continue;
    seen.add(h.choiceId);
    others.unshift({
      id: h.choiceId, act: actOf(h.sceneId), phase: "", title: titleOf(h.sceneId), situation: (getEvent(h.sceneId) as { description?: string } | null)?.description ?? "",
      choice: optionText(opt.text, state), indicator: "not_assessed", effects: formatEffects(opt.effects), consequences: [],
      alternatives: block.options.filter((o) => o !== opt).map((o) => ({ text: optionText(o.text, state), effects: formatEffects(o.effects) })),
      categories: [], modules: [], key: false, weight: 0,
    });
  }
  decisions.push(...others);
  const order = new Map(KEY_CHOICES.map((k, i) => [k.id, i]));
  const rank = (j: JourneyDecision) => (j.id === "risk_workshop" ? 1.5 : j.id === "status_reporting" ? 99 : order.get(j.id) ?? 200);
  const journey: ActGroup[] = [1, 2, 3, 4, 5, 6]
    .map((act) => ({
      act,
      label: ACT_LABELS[act],
      key: decisions.filter((j) => j.act === act && j.key).sort((a, b) => rank(a) - rank(b)),
      other: decisions.filter((j) => j.act === act && !j.key),
    }))
    .filter((g) => g.key.length || g.other.length);

  // --- categories --------------------------------------------------------------------------------------------
  const seenModules = new Set(state.fieldGuideSeen ?? []);
  const assessed = decisions.filter((j) => j.indicator !== "not_assessed");
  const moduleView = (id: string): ModuleView => {
    const entry = FIELD_GUIDE.find((m) => m.id === id)!;
    return {
      id, number: entry.moduleNumber, title: entry.title, summary: entry.summary.split("\n\n")[0],
      encountered: seenModules.has(id),
      appliedIn: assessed.filter((j) => j.modules.includes(id)).map((j) => ({ id: j.id, title: j.title, indicator: j.indicator })),
    };
  };
  const moduleCategory = new Map(scorecard.moduleBreakdown.map((m) => [m.id, m.categoryId]));
  const categories: CategoryReview[] = (["budget", "schedule", "stakeholders", "risk", "team"] as CategoryId[]).map((id) => {
    const cat = scorecard.categories.find((c) => c.id === id)!;
    const mine = assessed.filter((j) => j.categories.includes(id)).sort((a, b) => b.weight - a.weight);
    return {
      id, label: CATEGORY_LABEL[id], rating: cat.rating, metric: tidyMoney(cat.commentary),
      wellDone: mine.filter((j) => j.indicator === "positive"),
      improve: mine.filter((j) => j.indicator === "improve"),
      tradeoffs: mine.filter((j) => j.indicator === "tradeoff"),
      whyItMatters: CATEGORY_WHY[id],
      consequences: mine.flatMap((j) => j.consequences.filter((c) => !c.startsWith("Final determination"))),
      modules: [...moduleCategory.entries()].filter(([, c]) => c === id).map(([m]) => moduleView(m)).sort((a, b) => a.number - b.number),
      hasDecisionEvidence: mine.length > 0,
    };
  });

  const apm: ModuleGroup[] = [
    ...categories.map((c) => ({ id: c.id, label: c.label, rating: c.rating, modules: c.modules })),
    {
      id: "outcome" as const, label: "Project Lifecycle, Business Case & Benefits", rating: null,
      modules: [...moduleCategory.entries()].filter(([, c]) => c === "outcome").map(([m]) => moduleView(m)).sort((a, b) => a.number - b.number),
    },
  ].filter((g) => g.modules.length);
  const apmUncovered = FIELD_GUIDE.length - moduleCategory.size;

  // --- takeaways --------------------------------------------------------------------------------------------
  const byWeight = [...assessed].sort((a, b) => b.weight - a.weight);
  const firstPositive = byWeight.find((j) => j.indicator === "positive");
  const firstImprove = byWeight.find((j) => j.indicator === "improve") ?? byWeight.find((j) => j.indicator === "tradeoff");
  const strength: Takeaway = firstPositive
    ? { title: firstPositive.title, text: firstPositive.assessment ?? "", source: `${ACT_LABELS[firstPositive.act].split(" — ")[0]} · ${firstPositive.phase}`, general: false }
    : {
        title: "General learning point",
        text: assessed.length
          ? "None of the decisions recorded in this save stands out as clear positive practice. In project management, strengths tend to show as decisions made on evidence, recorded and communicated early."
          : "In project management, strengths tend to show as decisions made on evidence, recorded and communicated early. There aren't enough recorded decisions in this save to point to one of yours.",
        general: true,
      };
  const develop: Takeaway = firstImprove
    ? {
        title: firstImprove.title,
        text: firstImprove.indicator === "tradeoff"
          ? `${firstImprove.assessment ?? ""} Worth revisiting: the alternatives traded differently${firstImprove.alternatives[0] ? `, for example "${firstImprove.alternatives[0].text}"` : ""}.`
          : firstImprove.assessment ?? "",
        source: `${ACT_LABELS[firstImprove.act].split(" — ")[0]} · ${firstImprove.phase}`,
        general: false,
      }
    : { title: "General learning point", text: "Look for the decision where the evidence was thinnest when you made it. That's usually where the next improvement is.", general: true };

  const recCredit = state.decisions?.[READINESS_RECOMMENDATION_KEY] ? recommendationCredit(state) : null;
  const mismatch = findMostMaterialReportMismatch(state);
  const riskJ = decisions.find((j) => j.id === "risk_workshop");
  let lesson: Takeaway;
  if (recCredit !== null && recCredit > 0 && det.kind !== "satisfactory") {
    lesson = { title: "A lesson to carry forward", text: "A project's outcome and the quality of its management decisions aren't always the same thing. Your recommendation fitted the evidence, even though the facility didn't receive full clearance.", general: false };
  } else if (recCredit !== null && recCredit < 0) {
    lesson = { title: "A lesson to carry forward", text: "Readiness is decided by evidence, not by the date. Recommending to go ahead while known gaps were still open left the inspection to find them.", general: false };
  } else if (mismatch?.severity === "material") {
    lesson = { title: "A lesson to carry forward", text: "Reporting is only useful if it's true. A status report that is kinder than the project's position delays the decisions that could have helped.", general: false };
  } else if (riskJ && riskJ.indicator !== "positive" && riskJ.consequences.some((c) => c.includes("full severity"))) {
    lesson = { title: "A lesson to carry forward", text: "The risks you name early are the ones you can plan for. An informal 'keep an eye on it' left nothing in place when the risk arrived.", general: false };
  } else {
    lesson = { title: "General learning point", text: "Judge decisions by the information available when they were made, not only by how things turned out.", general: true };
  }

  // --- honest notes -------------------------------------------------------------------------------------------
  const dataNotes: string[] = [];
  const recordedActs = new Set(decisions.map((j) => j.act));
  const missingEarly = [1, 2, 3, 4].filter((a) => !recordedActs.has(a));
  if (missingEarly.length === 4) {
    dataNotes.push("This save has no recorded decisions from Acts 1–4. It may have been started part-way through the game, so the earlier part of the journey can't be analysed. Category ratings still reflect the project's final metrics.");
  } else if (missingEarly.length) {
    dataNotes.push(`No decisions are recorded for ${missingEarly.map((a) => `Act ${a}`).join(", ")} in this save.`);
  }

  return {
    outcome, categories, journey, decisionCount: decisions.length, apm, apmUncovered,
    takeaways: { strength, develop, lesson }, dataNotes,
  };
}
