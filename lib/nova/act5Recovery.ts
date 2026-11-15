import type { GameState } from "./types";
/**
 * Act 5 — Recovery Meeting → Recovery Strategy Decision → Sponsor Phone Call.
 *
 * Scene-specific content for ACT5_SCENE00_RECOVERY, rendered by
 * components/nova/act5/RecoverySequence.tsx. The meeting lines themselves live
 * in data/dialogue.json (DIALOGUE_ACT5_SCENE00_RECOVERY) like every other
 * scene; this file holds the decision options, acknowledgements and the
 * sponsor call. Choices are stored in GameState.decisions (see applyDecisions)
 * — no new scoring yet; downstream consequences come later.
 *
 * Acknowledgement and Mike E. reply lines below are first drafts: edit freely.
 */

/** Decision keys in GameState.decisions. */
export const RECOVERY_STRATEGY_KEY = "act5_recovery_strategy";
export const SPONSOR_UPDATE_KEY = "act5_sponsor_update";

/** Placeholder until a real meeting-room image is added at this path. */
export const MEETING_BACKGROUND_SRC = "/assets/backgrounds/bg_meeting_room.png";

/** Mike E.'s recorded line. Missing file = text only, no errors. */
// Voice clip for Mike's opening line (new filename so the old recording of the previous line is never played;
// until this file exists the call is text-only).
export const SPONSOR_CALL_AUDIO_SRC = "/audio/act5/mike-sponsor-checkin.mp3";
// Teams ringtone + hang-up, both cut from one file (seconds).
export const CALL_TONES_SRC = "/audio/act5/teams-call.mp3";
// Ring loop: starts at the first ring's onset (0.98 s — the file opens with ~1 s of silence, which caused
// both the late start and the pause between loops) and ends at 4.72 s, where that ring has fully decayed
// (~-68 dB) just before the file's next ring begins (~4.74 s).
export const RING_SEGMENT = { start: 0.98, end: 4.72 };
export const HANGUP_SEGMENT = { start: 33, end: 35 };

/** Short department labels shown after the speaker's name ("VAUGHN · ENGINEERING"). */
export const SPEAKER_LABELS: Record<string, { name: string; department: string }> = {
  vaughn: { name: "Vaughn", department: "Engineering" },
  camille: { name: "Camille", department: "Quality" },
  priya: { name: "Priya", department: "Operations" },
  marcus: { name: "Mike E.", department: "Project Sponsor" },
};

export interface RecoveryOption {
  id: string;
  letter: string;
  title: string;
  description: string;
  tradeOff: string;
  /** Metric effects applied once when this strategy is chosen (via applyEffects). */
  effects?: Record<string, number>;
  /** Who acknowledges / replies after the choice, and what they say. */
  reply: { speaker: string; emotion: string | null; text: string; /** Optional voice clip; when it plays, the text is hidden. */ audio?: string };
}

export const RECOVERY_DECISION = {
  title: "How will you recover the programme?",
  description:
    "The commissioning deadline is approaching. Your team needs a recovery strategy that addresses the critical dependencies.",
  options: [
    {
      id: "accelerate",
      effects: { scheduleHealth: 8, riskExposure: 6, teamMorale: -5 },
      letter: "A",
      title: "Accelerate recovery",
      description: "Expedite the replacement component and bring in additional engineering support.",
      tradeOff: "Higher cost · Potential schedule recovery",
      reply: { speaker: "vaughn", emotion: "neutral", text: "Understood. I'll get the expedite order in today and line up extra engineers for the install." },
    },
    {
      id: "replan",
      effects: { scheduleHealth: -6, riskExposure: -8 },
      letter: "B",
      title: "Replan commissioning",
      description: "Accept a possible delay and protect the full qualification process.",
      tradeOff: "Reduced execution pressure · Delayed benefits",
      reply: { speaker: "camille", emotion: "neutral", text: "Thank you. Protecting qualification now will save us far more than it costs later." },
    },
    {
      id: "targeted",
      effects: { scheduleHealth: 4, riskExposure: -4 },
      letter: "C",
      title: "Targeted recovery",
      description: "Expedite critical materials, reassign resources and parallelise independent activities.",
      tradeOff: "Balanced approach · Requires careful coordination",
      reply: { speaker: "priya", emotion: "neutral", text: "Good. I'll map out what can run in parallel, and we keep a very close eye on the hand-offs." },
    },
  ] as RecoveryOption[],
};

export const SPONSOR_CALL = {
  caller: "marcus",
  name: "Mike E.",
  role: "Project Sponsor",
  line: "Hi, how did the facility visit go? We're getting pretty close to commissioning now. Are we still on track?",
  declineTooltip: "This call is required to continue the story.",
};

export const SPONSOR_DECISION = {
  title: "How do you respond?",
  description: "Mike needs something he can take to the Board tomorrow.",
  options: [
    {
      id: "reassure",
      letter: "A",
      title: "Reassure the sponsor",
      description: "\"We're still on track. The team has everything under control.\"",
      tradeOff: "Keeps the Board calm today · Hides a known risk",
      reply: { speaker: "marcus", emotion: "warm", text: "Good. That's exactly what I need to hear. I'll tell the Board we're on track.", audio: "/audio/act5/mike-reply-reassure.mp3" },
    },
    {
      id: "transparent",
      letter: "B",
      title: "Give a transparent update",
      description: "\"We've identified a critical dependency. We have a recovery plan, but the commissioning date remains at risk.\"",
      tradeOff: "Honest and evidence-based · Harder conversation now",
      reply: { speaker: "marcus", emotion: "neutral", text: "Not what I hoped, but thanks for being straight with me. Send me the plan tonight and I'll take it to the Board.", audio: "/audio/act5/mike-reply-transparent.mp3" },
    },
    {
      id: "delay",
      letter: "C",
      title: "Recommend announcing a delay",
      description: "\"We should announce a delay immediately.\"",
      tradeOff: "Removes uncertainty · Gives up on recovery early",
      reply: { speaker: "marcus", emotion: "concerned", text: "If that's your recommendation, I need to see the impact on the commissioning date and the recovery options we've considered before I take it to the Board.", audio: "/audio/act5/mike-reply-delay.mp3" },
    },
  ] satisfies RecoveryOption[],
};

// ---------------------------------------------------------------------------
// Recovery assessment — read by the Final Readiness Review (ACT5_SCENE01) dialogue
// ---------------------------------------------------------------------------

/** Where the classification is stored (once, right after the strategy's effects are applied). */
export const RECOVERY_OUTCOME_KEY = "act5_recovery_outcome";
export type RecoveryOutcome = "strong" | "partial" | "failed";

/** The chosen strategy's effects (empty for an unknown id). */
export function recoveryStrategyEffects(strategyId: string): Record<string, number> {
  return RECOVERY_DECISION.options.find((o) => o.id === strategyId)?.effects ?? {};
}

/** Strong / Partial / Failed from the live project metrics (Failed checked first). */
export function evaluateRecovery(state: GameState): RecoveryOutcome {
  const m = state.projectMetrics;
  if (m.regulatoryReadiness < 35 || m.riskExposure > 60 || m.scheduleHealth < 30) return "failed";
  if (m.regulatoryReadiness >= 70 && m.riskExposure <= 40 && m.scheduleHealth >= 40) return "strong";
  return "partial";
}

/**
 * Synthetic dialogue flags (never saved as flags): recovery_strong / recovery_partial / recovery_failed.
 * Uses the outcome stored when the strategy was chosen, so it can't drift as later scenes move the
 * metrics; saves from before it was stored fall back to the live metrics.
 */
export function recoveryConditionFlags(state: GameState): Record<string, boolean> {
  if (!state.decisions?.[RECOVERY_STRATEGY_KEY]) return {};
  const stored = state.decisions[RECOVERY_OUTCOME_KEY] as RecoveryOutcome | undefined;
  const outcome = stored ?? evaluateRecovery(state);
  return { recovery_strong: outcome === "strong", recovery_partial: outcome === "partial", recovery_failed: outcome === "failed" };
}

// ---------------------------------------------------------------------------
// Readiness recommendation — the cinematic decision after the Recovery Montage
// (components/nova/act5/ReadinessRecommendation.tsx). Same options for every player.
// ---------------------------------------------------------------------------

/** Where the recommendation is stored (GameState.decisions), for later consequences. */
export const READINESS_RECOMMENDATION_KEY = "act5_readiness_recommendation";
/** Set once the montage has played, so a refresh on the decision screen doesn't replay it. */
export const RECOVERY_MONTAGE_SEEN_FLAG = "act5_recovery_montage_seen";
export type ReadinessRecommendationId = "proceed" | "postpone" | "proceed_conditionally";

export const READINESS_RECOMMENDATION: {
  question: string;
  subtitle: string;
  options: { id: ReadinessRecommendationId; letter: string; title: string; description: string }[];
} = {
  question: "The commissioning date is approaching. What do you recommend?",
  subtitle: "Your recommendation goes to the Project Board.",
  options: [
    {
      id: "proceed",
      letter: "A",
      title: "Proceed as planned",
      description: "Maintain the target commissioning date, accepting the remaining readiness risks.",
    },
    {
      id: "postpone",
      letter: "B",
      title: "Delay commissioning",
      description: "Allow outstanding qualification and quality requirements to be completed before proceeding.",
    },
    {
      id: "proceed_conditionally",
      letter: "C",
      title: "Conditional readiness",
      description:
        "Continue permitted preparation activities, but make commissioning dependent on explicit quality and regulatory sign-off.",
    },
  ],
};
