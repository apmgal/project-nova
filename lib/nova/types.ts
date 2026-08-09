// Generic types for the Project NOVA narrative engine.
// These describe the shape of the JSON content in /data — nothing here is
// specific to Act 1 story content. The engine reads whatever the JSON gives it.

export type Flags = Record<string, boolean>;

export interface ProjectMetrics {
  budgetRemaining: number;
  scheduleHealth: number;
  riskExposure: number;
  regulatoryReadiness: number;
  benefitsRealisationScore: number;
  boardConfidence: number;
  stakeholderGoodwill: number;
  teamMorale: number;
  [key: string]: number;
}

export interface Relationships {
  [characterId: string]: number;
}

export interface GameState {
  currentScene: string;
  projectMetrics: ProjectMetrics;
  relationships: Relationships;
  reputation: { tags: string[] };
  flags: Flags;
  choiceHistory: ChoiceHistoryEntry[];
  /** Key into assets.json's `backgrounds` map for whatever backdrop is
   * currently in effect, carried forward across lines/scenes until a line
   * explicitly sets a new one. Persisted so a reload can show the right
   * backdrop before the resumed scene's first line even renders. */
  currentBackground: string | null;
  /** Key into assets.json's `ambientSounds` map for whatever looping
   * ambience bed is currently in effect, carried forward across
   * lines/scenes the same way currentBackground is — needed because some
   * ambience (e.g. the SharePoint browsing loop) starts in one scene and
   * is only meant to cut off on a specific line several scenes later. */
  currentAmbient: string | null;
  /** Per-tool-screen record of which card ids have been correctly placed
   * so far, keyed by toolId. An entry existing (even empty) means the
   * player has reached that tool screen's action phase. */
  toolProgress: Record<string, string[]>;
  /** Per-tool-screen record of which bucket each card currently sits in,
   * keyed by toolId then cardId. Used by "priority_assignment" tools
   * (e.g. MoSCoW) where every bucket is a valid placement and a card can
   * be moved between buckets — unlike toolProgress's simple placed/not
   * list for "sort_into_buckets" tools, this needs to remember WHICH
   * bucket, so a re-placement can refund the old bucket's cost. Also
   * doubles as "gantt_placement"'s milestoneId -> startWeek map (the
   * week number stored as a string). */
  toolPlacements: Record<string, Record<string, string>>;
  /** Per-tool-screen record of which card ids are currently "on", keyed
   * by toolId. Unlike toolProgress (append-only, once-placed-always-
   * placed) this is a live toggle set — used by "pick_n_of_m_swipeable"
   * (Team Selection) where hiring is freely reversible up until the
   * player moves on, so both the effects/flags AND this list need to be
   * able to un-apply, not just accumulate. */
  toolSelections: Record<string, string[]>;
  /** Per-tool-screen record of whether the player has tapped the explicit
   * Submit button, keyed by toolId. Deliberately separate from
   * toolProgress/toolPlacements/toolSelections (which track whether the
   * activity's completion condition is *met*) — completion alone used to
   * auto-advance the scene the instant the last card/candidate/milestone
   * was placed; this flag instead gates that advance behind a real player
   * action, so the tool screen stays up (with its Submit button visibly
   * enabled) until they choose to move on. resetTool clears this back to
   * unset alongside the rest of a tool's progress. */
  toolSubmitted: Record<string, boolean>;
  /** Documents the player has found in the world and can revisit from the
   * artefacts drawer, keyed by artefact id (see lib/nova/artefacts.ts for
   * the static registry of what each id looks like/means). The value is
   * which version of that artefact is currently on file — most artefacts
   * start "incomplete" when first found and later get overwritten with a
   * "complete" version once the in-fiction work that finishes them wraps
   * up, so re-opening the same drawer entry later shows the updated copy
   * rather than a second entry. */
  artefacts: Record<string, ArtefactStatus>;
  /** The Event Library checkpoint system's live queue — set the moment the
   * player finishes a wave-triggering scene's own dialogue (see Scene.
   * eventWaveId), computed once from every wave member's eligibility at
   * that exact moment (matching each event's own "at trigger" condition
   * semantics), then never recomputed for the rest of that wave. Null
   * whenever no wave is currently in progress. Ineligible events are
   * simply absent from this list, not skipped-at-render — the queue only
   * ever contains events the player will actually see. */
  eventQueue: string[] | null;
  /** Which entry of eventQueue is currently in play. Always 0 the instant
   * eventQueue is (re)computed; advances by one each time the player
   * finishes the event currently at this index (see
   * isActiveQueuedEventScene/advanceEventQueue in GameRoot). Meaningless
   * (and left at its default 0) whenever eventQueue is null. */
  eventQueueIndex: number;
  /** Where to send the player once eventQueue is exhausted — a snapshot of
   * whatever the wave scene's own nextScenes[0] was at the moment the
   * queue was spun up, since by the time the queue empties currentScene
   * has moved on to the last event and that original target would
   * otherwise be lost. Cleared back to null alongside eventQueue. */
  eventQueueExitScene: string | null;
  /** Categorical (non-boolean) choice outcomes — e.g. big01Response:
   * "full_replan", validationResourcing: "split_thin". Kept separate from
   * `flags` (which is genuinely boolean-only apart from one legacy
   * exception, supplier_chosen, read via getFlagString's escape hatch)
   * rather than repeating that pattern every time new content needs to
   * remember which of several named options a choice picked. */
  decisions: Record<string, string>;
  /** Every Monthly Status Report the player has submitted so far, oldest
   * first — see StatusReportRecord for what each entry holds and why it
   * keeps both the actual-state snapshot and the reported values. Empty
   * until the first report (currently ACT4_SCENE05, once step 4/5 of the
   * Act 4 report redesign wire the new report-builder UI into it) is
   * submitted. */
  statusReports: StatusReportRecord[];
  /** eventIds (see EventEntry) whose OWN scene the player has actually
   * finished — never the lead-in "revisited" beat some events have, only
   * the real event scene itself (see isActiveQueuedEventScene). Appended
   * to in GameRoot's advanceEventQueue, the single choke point every
   * queued event scene passes through on its way to whatever comes next.
   * This is what lets computeKnownReportableRisks tell "a risk the player
   * has evidence for but hasn't happened yet" apart from "a risk that has
   * now materialised into an issue" — nothing before this field existed
   * tracked which events had actually played out, only which wave they
   * belonged to and whether they were currently eligible to fire. */
  eventsResolved: string[];
}

/** Which version of a found document is currently on file. See the
 * `artefacts` field on GameState and lib/nova/artefacts.ts. */
export type ArtefactStatus = "incomplete" | "complete";

export interface ChoiceHistoryEntry {
  sceneId: string;
  choiceId: string;
  optionText: string;
  timestamp: string;
}

export interface Scene {
  sceneId: string;
  title: string;
  act: string;
  screenRange?: string;
  screenType?: string;
  location: string | null;
  charactersInvolved: string[];
  pmConcept?: string;
  contentSummary?: string;
  worldMemoryBeat?: string | null;
  variablesTouched?: string[];
  dialogueId: string | null;
  choicesId: string | null;
  /** References a tool_screens.json entry (e.g. PESTLE/SWOT sort screens).
   * When set, dialogueId's lines play first, then this interactive
   * ToolScreen, then (if postToolDialogueId is set) more dialogue, then
   * choices or a plain Continue button. */
  toolId?: string | null;
  /** Dialogue block shown after the tool screen completes, before this
   * scene's final action (choices/Continue). Only meaningful alongside
   * toolId — lets a reaction line follow the interactive tool instead of
   * every line being forced to play before it. */
  postToolDialogueId?: string | null;
  trigger?: { previousScene: string | null };
  nextScenes: string[];
  needsWriting?: boolean;
  flagsSet?: string[];
  note?: string;
  /** When "announcement", the scene's dialogue renders as a single
   * simultaneous title-card beat (AnnouncementCard) instead of the normal
   * one-line-at-a-time transcript — every line pops in together and the
   * scene's action (Continue/choices) is available immediately, rather
   * than being gated behind clicking through each line. Matches the
   * content's own "Title Card" screenType convention (e.g.
   * ACT3_SCENE06B). Absent/any other value renders normally. */
  displayStyle?: string;
  /** Marks this scene as the entry point for one of the Event Library's
   * checkpoint waves (see EVENT_WAVE_MEMBERS in lib/nova/state.ts) — the
   * value is the wave's own key (e.g. "MAIN_WAVE"). The instant the
   * player finishes THIS scene's own dialogue, GameRoot computes which of
   * that wave's events are eligible right now and routes into them one at
   * a time before finally continuing on to nextScenes, same as every
   * other scene — see goToScene's interception logic. Absent/undefined on
   * every scene outside Act 4's two curveball waves. */
  eventWaveId?: string;
}

export interface DialogueLine {
  speaker: string;
  emotion: string | null;
  text: string;
  /** Optional display hint from the content, e.g. "header" — currently
   * only consumed by AnnouncementCard to pick the headline line out of an
   * announcement scene's lines; ignored everywhere else. */
  style?: string;
  condition?: string;
  /** Key into assets.json's `backgrounds` map. Only present on lines that
   * change the backdrop; absent lines keep whatever was last shown. */
  background?: string;
  /** Key into assets.json's `ambientSounds` map for a looping ambience
   * bed. Carries forward like `background` — absent lines keep whatever
   * ambience was last playing. "none" is an explicit, intentional value
   * (cuts the ambience to silence), distinct from omitting the field. */
  ambient?: string;
  /** Starts (true) or stops (false) a looping footstep layer on top of
   * whatever ambience is currently playing. Carries forward like
   * `background`/`ambient` — only lines that change it need to set it. */
  footsteps?: boolean;
}

export interface DialogueBlock {
  dialogueId: string;
  sourceScene: string;
  lines: DialogueLine[];
  needsWriting?: boolean;
}

export interface ChoiceOption {
  text: string;
  effects?: Record<string, number>;
  flags?: Flags;
  /** Categorical outcome(s) this option records — merged into
   * GameState.decisions on select. See GameState.decisions' own doc
   * comment for why this is a separate bag from flags. */
  decisions?: Record<string, string>;
  nextScene: string | null;
  reaction?: string;
}

export interface ChoiceBlock {
  choiceId: string;
  sourceScene: string;
  options: ChoiceOption[];
  needsWriting?: boolean;
  engineNote?: string;
  /** Exact text of the dialogue line this choice fires immediately after,
   * for scenes with more than one sequential choice (e.g. a risk workshop
   * that raises three separate concerns in turn). Absent means "fires
   * after all of this scene's dialogue" — the original, single-choice
   * behavior every other scene in the game still uses unchanged. */
  insertAfterLine?: string;
  /** References a risk_investigation.json entry. When set, an
   * investigation interstitial (pick maxQuestions of the bank's
   * questions, see each answer, then continue) plays immediately before
   * this choice's own options are presented — same anchor point, just an
   * extra step in front. Null/absent skips straight to the choice,
   * unchanged from before this mechanic existed. */
  riskInvestigationId?: string | null;
}

// ---------------------------------------------------------------------------
// Risk investigation (risk_investigation.json) — a "pick N of the bank's
// questions, see each answer" interstitial that plays in front of a
// ChoiceBlock referencing it via riskInvestigationId. Whichever questions
// aren't picked simply leave their flagOnAsk flag unset — the engine never
// branches on a specific dimension/question id, only on which flags ended
// up true, so later content (e.g. Act 4's events) can key off "was the
// Impact dimension investigated" without the engine knowing what that
// means narratively.
// ---------------------------------------------------------------------------

export interface RiskInvestigationQuestion {
  id: string;
  dimension: string;
  questionText: string;
  answerText: string;
  /** Flag set true the moment this question is asked. Never set false —
   * an unasked question just leaves it absent. */
  flagOnAsk: string;
  /** If set, asking this question reveals (or updates) an artefact on the
   * Investigation Board, e.g. finding the PID in the SharePoint browser. */
  revealsArtefactId?: string;
  /** Status to set the revealed artefact to. Defaults to "incomplete" if
   * `revealsArtefactId` is set but this is omitted. */
  revealsArtefactStatus?: ArtefactStatus;
}

export interface RiskInvestigationBank {
  riskId: string;
  sourceScene: string;
  askTarget: string;
  /** How many of `questions` the player may ask before the bank locks and
   * a Continue action appears. */
  maxQuestions: number;
  instructions?: string;
  questions: RiskInvestigationQuestion[];
  /** Opts this bank into bespoke chrome (Outlook inbox, Teams thread,
   * SharePoint file browser) instead of the default risk-investigation
   * panel UI, mirroring ToolScreenBlock's visualStyle pattern. */
  visualStyle?: "outlook_inbox" | "teams_thread" | "sharepoint_browser";
}

// ---------------------------------------------------------------------------
// Events (events.json) — the Act 4 Event/Curveball Library. Each entry is
// mostly design documentation (trigger prose, impact list, designTag) that
// the engine never reads; the fields below are the only ones actually
// consumed at runtime, by lib/nova/data.ts's synthesized event-scene
// helpers and state.ts's isEventEligible. See DESIGN_NOTES.md for how
// eligibility per event is derived from this design prose.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Monthly Status Report — actual-vs-reported dashboard (see
// computeActualStatusReport in state.ts for how these get derived, and
// DESIGN_NOTES.md for the reasoning behind each dimension's formula).
// ---------------------------------------------------------------------------

export type RagStatus = "green" | "amber" | "red";

/** One RAG dimension's computed truth. `reasonCodes` is the small, fixed
 * set of machine-checkable reasons behind `rag` (for later game logic —
 * dialogue conditions, Act 5 callbacks — to key off, so nothing has to
 * fuzzy-match `evidence`'s free text). `evidence` is that same reasoning
 * in player/dialogue-facing prose. */
export interface StatusReportDimension {
  rag: RagStatus;
  reasonCodes: string[];
  evidence: string[];
}

/** One entry in the report's HIDDEN TRUTH risk pool — a Main/Late Wave
 * event whose own eligibility condition (see isEventEligible in state.ts)
 * is true right now, regardless of whether the player has any in-fiction
 * evidence of it yet. This is ground truth for a future "what you said vs
 * what was true" comparison (see StatusReportRecord.actualSnapshot) —
 * NEVER what the report-builder UI's risk picker shows the player. That
 * is a completely separate, much smaller list — see ReportableRisk /
 * computeKnownReportableRisks. `rag` is a first-pass simplification
 * (every active risk currently shares one banding off riskExposure, the
 * same signal the HUD's own risk chip uses) — the obvious place to add
 * per-risk severity later if a report ever needs risks that read
 * differently from each other. */
export interface ActiveRisk {
  riskId: string;
  title: string;
  rag: RagStatus;
}

/** The project's real position at the moment a report is opened — never
 * shown directly to the player. What they see and choose to submit is a
 * separate, independent RAG per dimension (the report UI's own state,
 * not modeled here). */
export interface ActualStatusReport {
  budget: StatusReportDimension;
  scope: StatusReportDimension;
  resource: StatusReportDimension;
  milestone: StatusReportDimension;
  risks: ActiveRisk[];
}

/** One entry the player can actually SEE and pick in the report-builder's
 * risk dropdown — deliberately a completely separate model from
 * ActiveRisk/ActualStatusReport.risks (the hidden truth engine). A risk
 * only appears here once the player has real in-fiction evidence of it:
 * either they investigated/logged it in advance (status "risk", a
 * deliberately vaguer pre-materialisation label — see
 * REPORTABLE_RISK_CATALOG in state.ts) or it has actually played out as a
 * scene (status "issue", plain now-it's-history phrasing). Events with
 * neither kind of evidence yet are simply absent — this is what stops the
 * status report from reading as a menu of future plot hooks. */
export interface ReportableRisk {
  riskId: string;
  title: string;
  status: "risk" | "issue";
}

/** One risk the player chose to surface in a submitted report, and how
 * they chose to characterize it — independent of (and possibly different
 * from) that risk's entry in the same report's `actualSnapshot.risks`.
 * `mitigationText` is free text the player types in the report-builder UI
 * (not a reference into any fixed mitigation catalog — there isn't one). */
export interface SelectedRiskReport {
  riskId: string;
  reportedRag: RagStatus;
  outlook: "worsening" | "stable" | "improving";
  mitigationText?: string;
}

/** A single submitted Monthly Status Report, as stored on
 * GameState.statusReports. Deliberately keeps BOTH views rather than only
 * the current one: `actualSnapshot` is a full computeActualStatusReport()
 * capture at the moment of submission (rag + reasonCodes + evidence +
 * risks, per dimension), and `reported` is what the player independently
 * chose to submit — everything else in this shape (`selectedRisks` with
 * per-risk reported RAG/outlook/mitigation, not just risk ids;
 * `selectedAccomplishments`/`selectedUpcomingActivities`) is the rest of
 * that same submission. Keeping both means a later scene or Act 5 payoff
 * can compare "what they said" against "what was true" without having to
 * reconstruct a since-moved-on GameState. */
export interface StatusReportRecord {
  reportId: string;
  submittedAtScene: string;
  actualSnapshot: ActualStatusReport;
  reported: {
    overall: RagStatus;
    budget: RagStatus;
    scope: RagStatus;
    resource: RagStatus;
    milestone: RagStatus;
  };
  selectedRisks: SelectedRiskReport[];
  selectedAccomplishments: string[];
  selectedUpcomingActivities: string[];
}

export interface EventEntry {
  eventId: string;
  title: string;
  act: string;
  participants?: string[];
  dialogueId?: string | null;
  choicesId?: string | null;
  /** A framing/narration beat shown immediately before dialogueId, on its
   * own synthesized "lead-in" scene (see EVENT_FRAME_SUFFIX in
   * lib/nova/data.ts) — e.g. reopening an artefact/thread from an earlier
   * act before the event's own content plays. Absent for most events. */
  precedingDialogueId?: string;
  /** A tool_screens.json entry to show for this event, exactly like
   * Scene.toolId — see synthesizeEventScene in data.ts, which passes this
   * straight through so a queued event can carry a real interactive tool
   * (not just dialogue/choices). Currently only used by "EV-06-RAID", the
   * RAID mini-artefact follow-up spliced directly after EV-06 in
   * MID_WAVE_2 — see the "Act 4 event redistribution" entry in
   * DESIGN_NOTES.md. */
  toolId?: string;
}

export interface Character {
  id: string;
  name: string;
  role?: string;
  portraits: Record<string, string> | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Tool screens (tool_screens.json) — generic interactive-screen shapes. The
// engine branches only on `type`, never on toolId/bucket/card names:
//   - "sort_into_buckets" (PESTLE/SWOT/Comms/WBS): each card has exactly one
//     correctBucket; wrong placements bounce back with no penalty. WBS adds
//     an optional visualStyle for a background-image presentation instead
//     of the plain card grid — same placement/completion logic underneath.
//     PESTLE sets its own visualStyle: "pestle_category_list" for a
//     collapsible per-category list (icon + name + count per row, expands
//     once a card lands there) instead of the plain dashed bucket grid —
//     same placement/completion logic underneath. SWOT sets visualStyle:
//     "swot_postit_quadrant" for a 2x2 quadrant grid where cards render as
//     post-it notes — neutrally colored (so the color itself never hints
//     the answer) while unplaced, recoloring to match their quadrant only
//     once correctly placed; a wrong-quadrant drop still just bounces the
//     neutral note back to the pool, same as the plain grid always did.
//   - "priority_assignment" (MoSCoW): every bucket is a valid placement —
//     each card has a costByBucket instead, and an optional flagsByBucket.
//     MoSCoW's own tool screen sets visualStyle: "moscow_quadrant" for a
//     2x2 corner-badge presentation (M/S/C/W) instead of the plain dashed
//     bucket grid — same placement/completion logic underneath, and the
//     Stakeholder Grid (below) still gets the plain grid since its bucket
//     names don't map to single letters.
//   - "power_interest_grid" (Stakeholder Grid): a free-placement variant of
//     priority_assignment with no cost. Sets its own
//     visualStyle: "power_interest_quadrant" for a 2x2 quadrant
//     presentation with real power/interest axes (arrows + labels) instead
//     of the plain dashed bucket grid — same placement/completion logic
//     underneath, and a third consumer of the shared visualStyle field
//     alongside WBS's warehouse_blueprint and MoSCoW's moscow_quadrant.
//   - "cost_review_with_descope" (CBS): auto-summed costs, cut one task if
//     over threshold.
//   - "pick_n_of_m_swipeable" (Team Selection): browse via swipe, toggle
//     hire/un-hire independently, capped at maxHires.
//   - "gantt_placement" (Milestone Timeline): place fixed-duration bars on
//     a week axis, subject to hard dependency rules.
//   - "proof_chain_builder" (Benefits Register): build Measure/Evidence
//     per benefit; Owner/When Measurable are dialogue-revealed, not built.
// ---------------------------------------------------------------------------

export interface ToolCard {
  id: string;
  text: string;
  /** sort_into_buckets only: the one bucket this card is correct in. */
  correctBucket?: string;
  /** priority_assignment only: cost (usually deducted from budgetVariable)
   * for placing this card in each bucket. Re-placing into a different
   * bucket refunds the old bucket's cost before charging the new one. */
  costByBucket?: Record<string, number>;
  /** priority_assignment only: flags to set (true only — never false) when
   * this card lands in a given bucket. Re-evaluated on every placement, so
   * moving a card out of a bucket doesn't retroactively unset flags it
   * already caused — only overcommitRule's flag is live/reactive. */
  flagsByBucket?: Record<string, Flags>;
  championedBy?: string;
}

/** pick_n_of_m_swipeable candidate (Team Selection). */
export interface ToolCandidate {
  id: string;
  name: string;
  role?: string;
  description?: string;
  budgetEffect?: number;
  otherEffects?: Record<string, number>;
  /** Set true while hired, unset the moment they're un-hired — this is
   * the one place in the engine where a flag IS meant to flip back off,
   * since hiring is a live, reversible choice within a single tool
   * interaction rather than a past narrative decision. */
  flagOnHire?: string;
  portrait?: string;
  portraitStatus?: string;
}

/** gantt_placement milestone (Milestone Timeline). */
export interface ToolMilestone {
  id: string;
  text: string;
  durationWeeks: number;
  wbsCategory?: string;
}

/** status_report_builder checklist entry (Key Accomplishments / Upcoming
 * Activities) — a single authored, selectable line. The Key Accomplishments
 * list the player actually sees is this authored set PLUS one synthesized
 * entry per Gantt milestone that's already complete as of the report's
 * current week (see StatusReportBuilder.tsx) — never hand-authored, since
 * that has to reflect the player's own Milestone Timeline placement. */
export interface StatusReportChecklistItem {
  id: string;
  text: string;
}

/** proof_chain_builder's embedded no-penalty choice moment (e.g. Mike E. vs
 * Camille disagreeing on how "More Patients Treated" should be measured). */
export interface BenefitTensionMoment {
  marcusLine?: string;
  camilleLine?: string;
  wrongOption: string;
  correctOption: string;
  /** Player-facing corrective line shown on the wrong pick — distinct
   * from `note`, which is internal design commentary, never displayed. */
  reaction: string;
  note?: string;
}

/** proof_chain_builder benefit entry (Benefits Register). Measure and
 * Evidence each have their own optional tension moment — a benefit can
 * have one, both, or neither, independent of its sibling field. */
export interface ToolBenefit {
  id: string;
  text: string;
  correctMeasure?: string;
  correctEvidence?: string;
  correctOwner?: string;
  correctWhen?: string;
  measureTensionMoment?: BenefitTensionMoment;
  evidenceTensionMoment?: BenefitTensionMoment;
}

export interface ToolScreenBlock {
  toolId: string;
  sourceScene: string;
  type: string;
  instructions?: string;
  // sort_into_buckets / priority_assignment / power_interest_grid
  buckets?: string[];
  cards?: ToolCard[];
  wrongPlacementBehavior?: {
    penalty?: string;
    reaction?: string;
  };
  selectionBehavior?: string;
  selectedCardStyle?: string;
  completionCondition?: string;
  /** power_interest_grid + visualStyle: "power_interest_quadrant" only —
   * the "High power, Low interest" style subtitle shown under each
   * quadrant's name, keyed by the exact bucket string. Purely descriptive;
   * placement/completion logic never reads this. */
  quadrantDefinitions?: Record<string, string>;
  /** priority_assignment only: which ProjectMetrics key placements deduct
   * from/refund to. Defaults to "budgetRemaining" if unset. */
  budgetVariable?: string;
  /** priority_assignment only: a rule the engine checks after every
   * placement — if `bucket` ends up holding `minCount` or more cards, it
   * sets `reactionFlag` true (and clears it again if the player moves
   * cards back out below the threshold), for dialogue to key a reaction
   * line off. `trigger`/`condition`/`note` are documentation only. */
  overcommitRule?: {
    condition?: string;
    bucket: string;
    minCount: number;
    trigger?: string;
    reactionFlag: string;
    note?: string;
  };
  /** An alternate presentation for the same underlying placement/
   * completion logic — never changes what counts as a valid placement or
   * when the tool is complete, only how it renders. Five known values:
   * sort_into_buckets' "warehouse_blueprint" (WBS — background image with
   * clickable zone outlines), "pestle_category_list" (PESTLE —
   * collapsible icon-per-category list), and "swot_postit_quadrant"
   * (SWOT — 2x2 quadrant grid with post-it note cards), priority_
   * assignment's "moscow_quadrant" (MoSCoW — 2x2 corner-badge grid), and
   * power_interest_grid's "power_interest_quadrant" (Stakeholder Grid —
   * 2x2 grid with real power/interest axes). Unset means the plain
   * card/dashed-bucket grid. */
  visualStyle?: string;
  /** sort_into_buckets + visualStyle only: filename hint for the
   * background image to show behind the zones, following a "bg_<assets.
   * json key>.<ext>" convention — see deriveBackgroundKeyFromAssetFilename. */
  backgroundAsset?: string;

  // cost_review_with_descope (CBS)
  costsByTask?: Record<string, number>;
  totalIfAllIncluded?: number;
  descopeThreshold?: number;
  descopeRule?: string;

  // pick_n_of_m_swipeable (Team Selection)
  maxHires?: number;
  interactionNote?: string;
  candidates?: ToolCandidate[];
  onSkippedCandidateNote?: Record<string, string>;
  closingLine?: string;

  // gantt_placement (Milestone Timeline)
  timelineWeeks?: number;
  milestones?: ToolMilestone[];
  dependencyRules?: { rule: string }[];

  // proof_chain_builder (Benefits Register)
  benefits?: ToolBenefit[];
  fieldsPlayerBuilds?: string[];
  fieldsRevealedByDialogue?: string[];

  // status_report_builder (Monthly Status Report)
  /** toolId of the gantt_placement tool whose milestones/placements this
   * report should read for its Upcoming Milestones table and completed-
   * milestone accomplishment candidates. */
  ganttToolId?: string;
  /** toolId of the sort_into_buckets (WBS) tool whose cards this report
   * breaks Upcoming Activities down into — see upcomingActivityWindowWeeks. */
  wbsToolId?: string;
  /** How many weeks ahead of the report's current week counts as "near
   * future" for Upcoming Activities (also includes milestones already in
   * progress, not just ones yet to start). Defaults to 4 (roughly one
   * reporting period) if unset. Deliberately separate from Upcoming
   * Milestones, which shows the FULL remaining plan with no window. */
  upcomingActivityWindowWeeks?: number;
  projectManagerLabel?: string;
  projectSponsorLabel?: string;
  taxTower?: string;
  projectDescription?: string;
  accomplishmentCandidates?: StatusReportChecklistItem[];
  /** Fallback only, used when no real near-term WBS/Gantt activity data is
   * available yet (e.g. before any milestone has been placed) — see
   * StatusReportBuilder.tsx. Not the primary source once real placement
   * data exists. */
  upcomingActivityCandidates?: StatusReportChecklistItem[];
  maxRiskSlots?: number;

  // raid_update_card (RAID lifecycle mini-artefact — e.g. the EV-06
  // electrical-contractor follow-up). Deliberately tiny: one risk, a
  // status readout, and three player-made calls — the whole point is
  // being a real (if small) interaction rather than a dialogue choice
  // wearing a RAID-log hat. See RaidUpdateCard.tsx and the "Act 4 event
  // redistribution" entry in DESIGN_NOTES.md.
  /** Flag-key prefix used to persist this card's choices (e.g. "raid_ev06"
   * -> decisions.raid_ev06_owner / decisions.raid_ev06_response /
   * flags.raid_ev06_escalated). */
  raidKey?: string;
  /** The risk's pre-materialisation label, as already shown in the status
   * report's risk picker (see REPORTABLE_RISK_CATALOG) — shown struck
   * through/superseded by raidIssueLabel on submit. */
  raidRiskLabel?: string;
  /** The same risk's post-materialisation label — what it reads as an
   * Issue from this point on. */
  raidIssueLabel?: string;
  raidOwnerOptions?: string[];
  raidResponseOptions?: string[];

  onComplete: {
    nextScene: string;
  };
  engineNote?: string;
  note?: string;
}
