/**
 * "No News" — the finale between Whitfield's neutral close and the formal determination (PROTOTYPE,
 * /prototype/inspection-film). Three weeks later, an ordinary working day; no news; back to work; the
 * determination arrives; the player opens it when they choose.
 *
 * State: progress lives in GameState.decisions (FINALE.*: phase, Teams messages handled, report opened,
 * determination viewed) — nothing else is written, no metrics or scored decisions change. A resume returns to
 * the same phase; once the email has arrived it waits for the player indefinitely; the result is never
 * shown before they open it.
 *
 * The determination reuses the existing ending logic: it is the Quality gate (evaluateQualityGate in
 * endings.ts — regulatory readiness, risk exposure, report honesty), which is also what decides
 * ACT6_SCENE02's batch result. The overall project ending (contract, composite) still comes afterwards,
 * in the epilogue, unchanged.
 */
import type { GameState } from "./types";
import { evaluateQualityGate } from "./endings";
import { findMostMaterialReportMismatch, hasReachedToolScreen, metricBand } from "./state";
import { INSP, buildInspectionDossier, readinessGaps } from "./inspection";

export const FINALE = {
  phase: "finale_phase", // "bau" | "inbox" | "back" | "email"
  messages: "finale_messages", // Teams messages already handled, comma-separated ("priya,daniel,marcus")
  opened: "finale_report_opened",
  viewed: "finale_determination_viewed", // the player has chosen to view the determination
} as const;
export type FinalePhase = "bau" | "inbox" | "back" | "email";

export function finalePhase(state: GameState): FinalePhase | null {
  const p = state.decisions?.[FINALE.phase];
  return p === "bau" || p === "inbox" || p === "back" || p === "email" ? p : null;
}
export const reportOpened = (state: GameState) => Boolean(state.decisions?.[FINALE.opened]);
export const determinationViewed = (state: GameState) => Boolean(state.decisions?.[FINALE.viewed]);

export const FINALE_ASSETS = {
  desk: "/assets/backgrounds/bg_player_desk.png",
  sounds: {
    office: "/assets/sfx/finale/office_bau_loop.wav", // ES Ambience Office … (supplied), 60–81.5 s, seamless loop
    ping: "/assets/sfx/finale/teams_ping.wav", // one note of the existing Teams call recording
    mail: "/assets/sfx/finale/mail_notify.wav", // two notes of the same recording
    music: "/assets/music/main_menu_theme.mp3", // existing score — reserved for the report opening
    paper: "/assets/sfx/inspection/paper_dossier.wav", // ES Paper … — the report opening
  },
} as const;

// --- the ordinary working day ---------------------------------------------------------------------

/** The document the player is working on — ordinary operations handover, nothing about the inspection. */
export const WORK_DOCUMENT = {
  title: "Operations Handover — Action Log",
  path: "Project Nova › Operations › Handover",
  rows: [
    ["Shift pattern for Line A confirmed with site services", "Priya Anand", "Done"],
    ["Spares list for filling line — second supplier quote", "Procurement", "In progress"],
    ["Cleaning schedule added to the operations calendar", "Camille Okafor", "Done"],
    ["Maintenance contract renewal — draft terms", "Daniel Atwell", "With legal"],
    ["Visitor access process for the production floor", "Vaughn Kessler", "In progress"],
  ] as [string, string, string][],
};

/** Teams messages during the working day — incidental, never scored. Order = arrival order. */
export type TeamsMessageId = "priya" | "daniel" | "marcus";
export interface TeamsMessage {
  id: TeamsMessageId;
  from: string;
  initials: string;
  colour: string;
  text: string;
  /** A short exchange the player can open (Priya only). */
  reply?: { player: string; them: string };
  /** The acknowledgement button. */
  ack: string;
}
export const TEAMS_MESSAGES: TeamsMessage[] = [
  {
    id: "priya",
    from: "Priya Anand",
    initials: "PA",
    colour: "#0e7490",
    text: "I've updated the resource plan. Could you take a quick look when you have a moment?",
    reply: {
      player: "Thanks, Priya. Everything looking okay?",
      them: "Yes, we're keeping the team ready. A few people are asking about next steps, but otherwise we're in good shape.",
    },
    ack: "Close",
  },
  {
    id: "daniel",
    from: "Daniel Atwell",
    initials: "DA",
    colour: "#166534",
    text: "Latest cost forecast is in the shared folder. I've flagged the assumptions we're carrying until commissioning is confirmed.",
    ack: "Got it",
  },
  {
    id: "marcus", // character id "marcus" — shown in game as Mike Elloian, the programme sponsor
    from: "Mike Elloian",
    initials: "ME",
    colour: "#7c2d12",
    text: "Thanks for pulling the inspection material together. Let me know when there's anything further.",
    ack: "Will do",
  },
];

export function messagesHandled(state: GameState): TeamsMessageId[] {
  return (state.decisions?.[FINALE.messages] ?? "").split(",").filter(Boolean) as TeamsMessageId[];
}

/** The routine inbox (No News). The only inspection mail is correspondence from before and after the visit. */
export const ROUTINE_INBOX = [
  { id: "mail_daniel_fc", from: "Daniel Atwell", date: "10:05", subject: "Cost forecast — assumptions flagged", body: "Hi,\n\nThe latest cost forecast is in the shared folder. I've flagged the assumptions we're carrying until commissioning is confirmed — mainly the validation contract and the maintenance renewal.\n\nDaniel" },
  { id: "mail_priya", from: "Priya Anand", date: "09:12", subject: "Resource plan — updated", body: "Hi,\n\nThe resource plan for the next quarter is updated in the shared folder. Two changes on Line B cover; nothing that needs a decision.\n\nPriya" },
  { id: "mail_facilities", from: "Facilities", date: "Mon", subject: "Fire alarm test — Thursday 10:00", body: "The weekly fire alarm test will take place on Thursday at 10:00. No action required." },
  { id: "mail_camille", from: "Camille Okafor", date: "Mon", subject: "Training records — filed", body: "The latest operator training records are filed in the QMS. Nothing outstanding from my side this week.\n\nCamille" },
  { id: "mail_vaughn", from: "Vaughn Kessler", date: "Fri", subject: "Production floor — visitor access", body: "The visitor access process for the production floor is drafted. I'll walk it through with site services next week.\n\nVaughn" },
  { id: "mail_insp_receipt", from: "Inspection Coordination", date: "Earlier", subject: "Commissioning inspection — evidence received", body: "Thank you for the documentation provided during the commissioning inspection of Project Nova.\n\nThe evidence is now under review. The formal determination will be issued in writing once the assessment is complete." },
  { id: "mail_insp_arrangements", from: "Inspection Coordination", date: "Earlier", subject: "Commissioning inspection — arrangements confirmed", body: "This note confirms the arrangements for the commissioning inspection of Project Nova.\n\nThe inspection team will review documentation on site. The formal outcome will be issued in writing following the inspection." },
];

export const FINAL_EMAIL = {
  from: "Inspection Coordination",
  to: "Project Nova Delivery Team",
  subject: "Commissioning Inspection — Final Determination",
  attachment: "NOVA-CI-FD-01 Final Determination.pdf",
  paragraphs: [
    "Dear Project Team,",
    "Following the commissioning inspection of the Project Nova facility, the review of the evidence submitted and the subsequent assessment have now been concluded.",
    "Please find attached the formal inspection determination, which sets out the findings of the review, the determination reached and any associated requirements or actions.",
    "Please ensure that the report is reviewed in full and that its contents are communicated to the relevant project stakeholders.",
    "Kind regards,\nInspection Coordination Team",
  ],
};

// --- the determination ----------------------------------------------------------------------------

export type DeterminationKind = "satisfactory" | "conditional" | "unsatisfactory";
export interface EvidenceItem {
  title: string;
  description: string;
  presented: string;
  status: "Reviewed" | "Not available" | "Not in this save";
}
export interface Finding {
  title: string;
  explanation: string;
  evidence: string;
}
export interface Determination {
  kind: DeterminationKind;
  heading: string;
  statement: string;
  nextSteps: string[];
  evidence: EvidenceItem[];
  findings: Finding[];
}

const ROUND_LABEL = ["Round 1 — readiness and verification", "Round 2 — risks, controls and accountability"];
const READINESS_TOOL = "TOOL_ACT5_SCENE01_READINESS";

function describeEvidence(doc: ReturnType<typeof buildInspectionDossier>[number]): string {
  if (!doc.available) return doc.unavailableReason === "not_reached" ? "This saved game doesn't include the part of the project that produces this record." : "No record was produced.";
  const rows = (h: string) => doc.sections.find((s) => s.heading.startsWith(h))?.rows.filter((r) => !r.label.startsWith(" ")).length ?? 0;
  if (doc.id === "readiness") {
    const parts = ["Final readiness position"];
    if (doc.sections.some((s) => s.heading === "Commissioning criteria")) parts.push("commissioning criteria for Products A and B");
    return parts.join("; ") + ".";
  }
  if (doc.id === "risks") {
    const parts: string[] = [];
    const w = rows("Identified risks"), r = rows("Risk entries"), i = rows("Issues and RAID");
    if (w) parts.push(`${w} risk${w > 1 ? "s" : ""} identified in the Act 2 risk workshop`);
    if (r) parts.push(`${r} risk entr${r > 1 ? "ies" : "y"} in the monthly status reports`);
    if (i) parts.push(`${i} RAID and issue record${i > 1 ? "s" : ""}`);
    return (parts.join("; ") || "Register entries") + ".";
  }
  if (doc.id === "quality") return "Validation resourcing decision and operator training evidence" + (doc.sections.length > 1 ? "; quality events on record." : ".");
  return `${doc.sections.length} monthly status report${doc.sections.length > 1 ? "s" : ""}, as submitted.`;
}

const PRODUCTS = (ps: string[]) => (ps.length > 1 ? "Products A and B" : `Product ${ps[0]}`);

/** The formal determination — read from the post-inspection state; nothing here changes it. */
export function buildDetermination(state: GameState): Determination {
  const quality = evaluateQualityGate(state);
  const kind: DeterminationKind = quality.batchResult === "released" ? "satisfactory" : quality.family === "PYRRHIC_VICTORY" ? "conditional" : "unsatisfactory";
  const docs = buildInspectionDossier(state);
  const docById = (id?: string) => docs.find((d) => d.id === id);

  // 01 — what was actually presented (each document once, with the round it was presented in).
  const evidence: EvidenceItem[] = [];
  [state.decisions?.[INSP.r1Doc], state.decisions?.[INSP.r2Doc]].forEach((id, round) => {
    const d = docById(id);
    if (!d) return;
    const existing = evidence.find((e) => e.title === d.title);
    if (existing) { existing.presented += `; ${ROUND_LABEL[round]}`; return; }
    evidence.push({ title: d.title, description: describeEvidence(d), presented: ROUND_LABEL[round], status: d.available ? "Reviewed" : d.unavailableReason === "not_reached" ? "Not in this save" : "Not available" });
  });
  const presentedTitles = new Set(evidence.map((e) => e.title));
  const ref = (title: string) => (presentedTitles.has(title) ? title : `${title} (project record)`);

  // 02 — findings, grounded in the record.
  const findings: Finding[] = [];
  if (hasReachedToolScreen(state, READINESS_TOOL)) {
    const byLabel = new Map<string, { products: string[]; details: string[] }>();
    for (const g of readinessGaps(state)) {
      const e = byLabel.get(g.label) ?? { products: [], details: [] };
      e.products.push(g.product); e.details.push(g.detail);
      byLabel.set(g.label, e);
    }
    for (const [label, e] of byLabel) {
      const p = PRODUCTS(e.products);
      const f =
        label === "Operators trained"
          ? { title: `Operator training — not complete (${p})`, explanation: "Training was compressed under schedule pressure. Sign-off for all operators was not demonstrated in the evidence reviewed." }
          : label === "Validation complete"
            ? {
                title: `Validation — evidence outstanding (${p})`,
                explanation:
                  state.decisions?.validationResourcing === "protect_a"
                    ? `Validation resource was prioritised for Product A. Completed validation evidence for ${p} was not presented.`
                    : state.decisions?.validationResourcing === "split_thin"
                      ? `Validation resource was split across both product lines. Completed validation was not demonstrated for ${p}.`
                      : `Completed validation was not demonstrated for ${p}.`,
              }
            : label === "SOPs approved"
              ? { title: `Standard operating procedures — approval outstanding (${p})`, explanation: `The readiness assessment records SOP approval as outstanding. Approved procedures were not evidenced for ${p}.` }
              : { title: `Batch documentation — incomplete (${p})`, explanation: `Batch documentation was not complete for ${p}; budget pressure had deprioritised it.` };
      findings.push({ ...f, evidence: ref("Readiness Assessment") });
    }
  } else {
    findings.push({
      title: "Commissioning criteria — not evidenced",
      explanation: "No completed assessment of the commissioning criteria was available for review.",
      evidence: ref("Readiness Assessment"),
    });
  }
  const mismatch = findMostMaterialReportMismatch(state);
  if (mismatch) {
    findings.push({
      title: `Status reporting — ${mismatch.dimensionLabel.toLowerCase()} position understated`,
      explanation: `${mismatch.reportLabel} recorded ${mismatch.dimensionLabel.toLowerCase()} as ${mismatch.reportedRag}. The project record for the same period indicates ${mismatch.actualRag}${mismatch.actualEvidence[0] ? ` (${mismatch.actualEvidence[0]})` : ""}.`,
      evidence: ref("Project Status Reports"),
    });
  }
  if (metricBand(state.projectMetrics.riskExposure, false) === "red") {
    findings.push({ title: "Risk exposure — elevated", explanation: "Overall risk exposure at the point of inspection remained high.", evidence: ref("Risk & Issue Register") });
  }
  // A presented document the project genuinely never produced is a finding. One that simply isn't in this
  // save (a part of the game not played — e.g. a dev jump) is noted under 01 only, never held against the player.
  for (const id of [state.decisions?.[INSP.r1Doc], state.decisions?.[INSP.r2Doc]]) {
    const doc = docById(id);
    if (doc && !doc.available && doc.unavailableReason === "not_recorded" && !findings.some((f) => f.evidence === doc.title)) {
      findings.push({ title: `Evidence not available — ${doc.title}`, explanation: `The ${doc.title} presented during the inspection could not be produced from the project record.`, evidence: doc.title });
    }
  }

  const outcome =
    kind === "satisfactory"
      ? { heading: "Satisfactory", statement: "The site is considered ready for commissioning.", nextSteps: ["Commissioning may proceed.", ...(findings.length ? ["Findings are to be addressed through the site's routine quality system."] : [])] }
      : kind === "conditional"
        ? {
            heading: "Satisfactory, subject to conditions",
            statement: "The site may proceed to commissioning once the conditions below have been met and verified.",
            nextSteps: ["Each finding is to be closed and verified by Quality before batch release.", "Evidence of closure is to be submitted to Inspection Coordination.", "Commissioning may proceed once closure has been confirmed."],
          }
        : {
            heading: "Not satisfactory",
            statement: "The site is not considered ready for commissioning.",
            nextSteps: ["Commissioning may not proceed.", "Outstanding findings must be addressed.", "Re-inspection is required before batch release."],
          };
  return { kind, ...outcome, evidence, findings };
}
