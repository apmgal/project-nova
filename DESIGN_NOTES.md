# Design notes / backlog

Running log of design or engineering questions that came up in conversation
but weren't fully resolved on the spot — parked here to revisit later
rather than lost once the chat scrolls away.

---

## HUD "current week" is a forecast, not real elapsed time

**Status:** Worst symptom patched (see "Fix shipped" below). Root cause still open.

**The issue:** `computeWeeksRemaining(scheduleHealth)` in `lib/nova/state.ts`
produces a *forecast* — "if this pace holds, the project would take about X
weeks total" — recalculated fresh every render from the player's current
`scheduleHealth` score. It is not a clock and does not track how much story
time has actually passed; it can already read a high or low number on the
very first screen the HUD ever shows, and can drift up or down later as
`scheduleHealth` changes.

This forecast number does two jobs in `HUD.tsx`, and only one of them is a
correct use of it:

1. Shown directly as "Est. Completion: Week X / 24" — correct, since it's
   genuinely meant to be a projection.
2. Reused as `currentWeek` to look up which Gantt milestone (the one the
   player built by hand in ACT3_SCENE04) is "currently active", to populate
   the "Current Objective" HUD line. This is **not** a correct use — that
   lookup was designed assuming a real, steadily-advancing elapsed-time
   counter (see the `onComplete` note on the Milestone Gantt tool in
   `data/tool_screens.json`, which says the Gantt becomes the objective
   source for "whichever milestone's bar the current week falls inside"),
   not a fluctuating forecast.

**Symptom found:** On `ACT3_SCENE06B` ("Baseline Approved", the very first
moment the HUD appears, narratively "week 1"), if the player's schedule
health had already drifted from its 100 baseline via earlier Act 2 choices,
the forecast could already read a high number (e.g. week 23) — past every
Gantt milestone the player placed — so "Current Objective" showed
"Deployment complete" directly beside "Deployment begins." on the same
screen.

**Fix shipped:** Changed the "no active/no upcoming milestone" fallback
text from "Deployment complete" to "Facility go live" — a permanent
statement of the project's aim rather than a completion claim, so it can
never contradict itself no matter when the forecast causes it to appear.
This fully resolves the specific contradiction found, with no added
threshold logic.

**Considered and rejected:** gating the old "Deployment complete" fallback
on `weeksRemaining >= 24` ("only show once the forecast reaches the true
end"). Rejected because it inherits the same underlying flaw: bad schedule
health can push the forecast past 24 mid-story (triggering the fallback way
too early), very good schedule health can keep it under 24 even at the real
ending (never triggering it when it should), and since the forecast isn't
monotonic, a gated fallback could flicker in and out within the same
playthrough as later choices swing schedule health up or down.

**Still open / for later:**
- The *active-milestone* name itself (e.g. "Validation Complete") can still
  occasionally mismatch where the story's dialogue actually is, since it's
  still driven by the same forecast-based `currentWeek`, not real elapsed
  time. Smaller and less jarring than the "Deployment complete" case, but
  not actually fixed by the change above.
- The real fix, if ever wanted: a genuine persisted "current story week"
  field that advances with scene/story progression (not derived from
  schedule health at all), used only for the Gantt/Current-Objective
  lookup — while the forecast stays reserved for the "Est. Completion"
  display it's actually suited to. Bigger build: needs a design decision on
  how/when that counter should advance (per scene? authored jumps at
  specific story beats?). Not scoped yet.

---

## Event Library: dynamic per-flag effect adjustments not yet implemented

**Status:** Deliberately out of scope for the Main Wave build (Task #176/177).
Eligibility (whether an event fires at all) is fully implemented; the
following is only about *how strong* three events' effects are once they do.

**The issue:** `applyEffects` (`lib/nova/state.ts`) applies a choice
option's `effects` as a static `Record<string, number>` — the same numbers
every time, regardless of game state. Three Main Wave events' own
`engineNote`s in `events.json` ask for more than that:

- **EV-02** (Cleanroom GMP Review Failure): impact should be softened if
  `validation_risk_logged` is true; option 3's effects change entirely
  depending on `asked_validation_mitigation`; an extra +5 riskExposure
  applies on top of whatever's chosen if `asked_validation_impact` is
  false/absent.
- **EV-06** (Electrical Contractor Bankrupt): same shape, keyed on
  `contractor_risk_logged` / `asked_contractor_mitigation` /
  `asked_contractor_impact`.
- **EV-10** (Finance Freezes Contingency): same shape, keyed on
  `contingency_risk_logged` / `asked_contingency_mitigation` /
  `asked_contingency_impact`.

None of this engine support exists yet. Right now these three events fire
correctly (eligibility is a straightforward numeric/flag check, unaffected
by this gap) and their choices apply exactly whatever static effects
`choices.json` lists — just without the extra softening/hardening nuance
their own engineNotes describe.

**Why parked:** this is the same underlying gap as the honesty-tracking
mechanic (Task #178) — a choice's real effects need to be computed from
live state at selection time, not read straight off a static JSON record.
Worth solving once, generally, for both rather than three one-off patches
here plus a fourth bespoke mechanism for status reports.

**EV-09's trigger has no backing flag:** its condition ("BMS flagged as a
dependency") doesn't correspond to any flag set anywhere in the codebase.
Implemented as always-eligible (same as this wave's Scheduled events)
rather than an event that could mathematically never fire. If a real
"BMS flagged" moment gets written into earlier Act content later, this
should switch to checking that flag instead.

---

## Event Library wave-membership source conflict

**Status:** Resolved by picking one of two conflicting sources; noting the
conflict here in case future content edits make it worth reconciling.

`DIALOGUE_ACT4_SCENE04`'s own `engineNote` describes Main Wave broadly as
"EV-02 through EV-11, EV-13, EV-15" — a range that overlaps four events
`DIALOGUE_ACT4_SCENE06`'s engineNote claims exclusively for Late Wave
(EV-07, EV-09, EV-10, EV-15). `EVENT_WAVE_MEMBERS` in `lib/nova/state.ts`
treats ACT4_SCENE06's shorter, more specific list as authoritative for
what's Late-only, so no event can ever fire in both waves — but the two
engineNotes themselves still disagree in the source data and neither has
been edited to match the other.

---

## Monthly Status Report — actual-state RAG formulas (Budget/Scope/Resource/Milestone)

**Status:** Implemented (`computeActualStatusReport` in `lib/nova/state.ts`,
Task #182). Logged here since the formulas were deliberately designed to
answer a narrow question each, not to "score how well the player is
doing" — worth reading this before changing any of them.

**Budget / Milestone Plan:** direct — `metricBand` on % of starting budget
remaining, and on `scheduleHealth`, same bands the HUD's own chips use.
Nothing subtle here.

**Scope:** answers "is the agreed scope under formal control", not "how
much scope was accepted". The only red trigger is `big01Response ===
"phase_b_quietly"` — scope that grew without ever going through a real
re-plan. A big, formally re-planned scope (`"full_replan"`) can reach
green; it only drops to amber if descoping is *also* under strain (2+ of
the CBS cut-task/MoSCoW-"Won't" items). Earlier drafts of this formula
scored "how much scope was accepted" instead, which penalized BIG-01's
"full re-plan" response — the most transparent, best-governed of its
three options — the same as its most-hidden one. Corrected before
implementation.

**Resource:** answers "what's the CURRENT capacity position", not "was
the EV-NP2 resourcing decision good". Only `teamMorale` (a live,
recoverable number) and whether Ravi+Elin are both hired (the two
candidates later content — EV-07/EV-14's own dialogue conditions — already
treats as consequential) drive the RAG. `validationResourcing`
("protect_a"/"split_thin"/"premium_contract") is evidence text only,
deliberately excluded from the rule itself: it's a one-time categorical
choice from EV-NP2 that can never become "current" state again the way a
metric can, so basing the RAG on it would have meant a single early
decision permanently capping Resource at red for the rest of the game
even if the player later recovered morale and hired everyone. Earlier
draft did exactly that; corrected before implementation.

**Critical-role list (`ravi`, `elin`) and every numeric threshold** live in
`CRITICAL_HIRE_IDS`/`STATUS_REPORT_THRESHOLDS` — deliberately centralized
and named rather than inlined, since these are first-pass numbers expected
to get retuned once report #1 is actually playtested (see the wider Act 4
report-redesign discussion this task came out of).

**Two small data additions this required:** `big01Response` and
`validationResourcing` are stored in a new `GameState.decisions: Record
<string, string>` bag rather than `flags` — flags stayed boolean-only
except for one pre-existing exception (`supplier_chosen`, read via
`getFlagString`'s escape hatch); rather than repeat that workaround twice
more, `decisions` is now the real home for categorical choice outcomes.
`supplier_chosen` could migrate over for consistency later; not required,
just the obvious next candidate.

**Bug found and fixed in passing:** EV-R2's eligibility depended on a
`filling_line_deferred_or_rejected` flag that nothing in the game ever
actually set — only the individual `filling_line_deferred` and
`filling_line_rejected` flags were ever set, never their combination. EV-R2
could never have fired before this fix. Resolved by evaluating `flags.
filling_line_deferred || flags.filling_line_rejected` inline instead of
depending on a derived flag that has to be kept in sync by hand.

---

## Monthly Status Report — risks array, report persistence, honesty-mechanic isolation

**Status:** Implemented (`lib/nova/state.ts`, Task #183). Continues directly
from the "actual-state RAG formulas" entry above — read that one first.

**`ActualStatusReport.risks`:** a fourth thing the truth engine returns
alongside the four RAG dimensions — the current *pool* of reportable risks,
not a verdict. `computeActiveRisks` reuses `isEventEligible` (the exact
function `computeEventQueue` uses to decide what actually fires) against
the combined Main + Late Wave event pool, so a risk enters the pool the
moment its real trigger condition is true — matching how a real PM's status
report reports on currently-live risk conditions, not just events the
player has personally already lived through as a scene. Every risk
currently shares one `rag`, banded off `riskExposure` the same way the
HUD's own risk chip is — a deliberate first pass; if a later report needs
risks that read differently from each other, that's the place to add
per-risk severity.

**`GameState.statusReports` / `submitStatusReport`:** persistence for
submitted reports, storing BOTH views rather than only the current one —
`actualSnapshot` (a full `computeActualStatusReport()` capture taken at
submission time, including `risks`) and `reported` (the player's
independently-chosen RAG per dimension + overall), plus `selectedRisks`
with per-risk detail (`riskId`, `reportedRag`, `outlook`, `mitigationId` —
not just risk ids) and `selectedAccomplishments`/`selectedUpcomingActivities`.
Kept both because by the time a later scene or Act 5 payoff wants to
compare "what they said" against "what was true", the live GameState has
moved on and the true position at submission time would otherwise be
unrecoverable. `submitStatusReport` only computes `actualSnapshot` and
appends — everything about what the player actually picked is the future
report-builder UI's own concern (step 4/5), not modeled here.

**Honesty mechanic isolation for report #1:** the OLD `applyHonestyReport`/
`applyDeferredHonestyPenalty` mechanic (CHOICE_ACT4_SCENE05_M1/M2's 3-option
`honestyTone` choice) still exists and still fully drives
ACT4_SCENE05B/05C. Once the new report-builder UI replaces ACT4_SCENE05's
own choice, calling both mechanisms for the same submission would
double-score it. `HONESTY_MECHANIC_DEPRECATED_SCENES` (currently just
`{"ACT4_SCENE05"}`) names which scenes' honestyTone scoring GameRoot's
`handleSelectChoice` should skip; the `honestyTone` string is still always
stripped out of `option.effects` before `applyEffects` runs regardless of
scene, only the actual `applyHonestyReport` *call* is skipped. Until step
4/5 actually replace ACT4_SCENE05's content, this makes its 3 tone options
cosmetically different but mechanically inert — an accepted, temporary
state. `applyDeferredHonestyPenalty` needed no matching change: it only
ever fires on entry to ACT4_SCENE05B/05C (never ACT4_SCENE05 itself), and
with report #1 no longer setting `honesty_penalty_pending`, entering
ACT4_SCENE05B simply finds nothing pending — a clean no-op, not an orphaned
penalty.

---

## Monthly Status Report — the real report-builder UI (report #1)

**Status:** Implemented (Task #184). ACT4_SCENE05 now runs the actual
`StatusReportBuilder.tsx` component instead of `CHOICE_ACT4_SCENE05_M1`'s
3-option honestyTone choice — the choice block still exists in
`choices.json` (unreferenced, kept per the project's don't-delete
convention) but `ACT4_SCENE05.choicesId` is now `null`. `DIALOGUE_ACT4_SCENE05`
gained a trailing `[Player fills out the Monthly Status Report.]` marker
line so the tool screen opens right after Marcus's "How's my project?".

**New tool type `status_report_builder`:** a new `ToolScreenBlock` field
block (`ganttToolId`, `projectManagerLabel`, `projectSponsorLabel`,
`taxTower`, `projectDescription`, `accomplishmentCandidates`,
`upcomingActivityCandidates`, `maxRiskSlots`) backs
`TOOL_ACT4_SCENE05_STATUS_REPORT` in `tool_screens.json`. Deliberately
doesn't need a `computeToolComplete`/`resetTool` case: the default
branches of both already behave harmlessly for a tool with no `cards`
(`isToolComplete(state, toolId, 0)` is trivially true), and
`StatusReportBuilder` never uses the generic canSubmit/onReset wiring
anyway — see next point.

**Deliberately NOT using `toolProgress`/`toolPlacements`/`toolSelections`:**
every other tool persists its in-progress state into `GameState` so
completion can be computed centrally and progress survives a reload
mid-activity. The report builder instead keeps its whole draft (overall
status, the four dimension RAGs, each risk slot's id/mitigation/RAG/
outlook, which accomplishments/upcoming activities are checked) in local
React state, because there's no single "correct" completion condition to
check the way placement tools have — a real status report is "done" when
the player decides it is. The only two engine calls that happen are on
submit: `submitStatusReport` (appends the record, computing a fresh
`actualSnapshot` from live state) then `submitTool` (flips the generic
`toolSubmitted` flag so `atToolBreak` clears and the scene advances,
exactly like every other tool). Trade-off accepted: navigating away
mid-fill-out (there's no way to today, but if one existed) would lose an
in-progress draft rather than resume it — acceptable since nothing else in
the engine currently allows leaving a tool screen before submitting.

**No pre-filled RAGs, anywhere:** every RAG control (the Overall Status
pill, the four dimension cells, each risk's RAG cell) starts neutral/off
and cycles off → green → amber → red on tap. This reconciles a tension
flagged during the mockup phase — the approved visual mockup showed RAG
cells pre-colored by default for demo legibility — in favor of the
earlier, more fundamental principle established for this feature: the
player must make their own independent judgement call, never be shown (or
have to guess) a hidden "correct" colour.

**Risks shown are id + title ONLY, never their real RAG:**
`computeActualStatusReport(state).risks` (`ActiveRisk[]`) backs the risk
dropdown's options, but the component only ever reads `.riskId`/`.title`
from it — `.rag` (the hidden truth) is deliberately never touched, so the
UI can't leak the answer through option ordering, styling, or any other
side channel. The player picks their own `reportedRag`/`outlook` and
types free-text `mitigationText` per risk, up to `maxRiskSlots` (4).

**`SelectedRiskReport.mitigationId` renamed to `mitigationText`:** the
field was named `mitigationId` when added in Task #183, before the mockup
had settled on a free-text mitigation input rather than a pick from some
fixed mitigation catalog (no such catalog exists). Renamed before any
other code depended on the old name.

**Upcoming Milestones / Key Accomplishments split — real Gantt data, not
authored:** `StatusReportBuilder` reads `toolScreen.ganttToolId` ->
`getToolScreen` -> that tool's real `milestones` + the player's own
`state.toolPlacements[ganttToolId]` (the exact same source HUD's Current
Objective line reads), resolves each milestone's `{start, end}` the same
way `computeCurrentObjective` does (`end = start + durationWeeks`), and
compares against `currentWeek` (`computeWeeksRemaining`, clamped 0-24,
same forecast-based value the HUD itself uses — see this file's earlier
"HUD 'current week' is a forecast, not real elapsed time" entry for the
known caveat that inherits into this feature too). A milestone with
`end > currentWeek` shows in the read-only Upcoming Milestones table; one
with `end <= currentWeek` instead becomes an extra, dynamically-labelled
Key Accomplishments checklist entry (`gantt_<milestoneId>`), appended
after the authored `accomplishmentCandidates`. Upcoming Activities has no
equivalent real-data source — it's authored narrative content only, same
as every other tool's `cards`/`candidates`.

**Visual language is deliberately NOT the dark zinc tool-screen theme:**
every other bespoke tool (WBS, CBS, Gantt, etc.) uses the
`rounded-lg border-zinc-800 bg-zinc-900/90` dark card chrome. This one
uses a white/navy/lavender corporate-report look instead, matching the
user's real pptx template screenshot pixel-for-pixel (title, meta grid,
project description band, RAG tables) — direct art direction from several
rounds of mockup review, because this screen is meant to read as a real
in-fiction document the player produces, not another game-mechanic puzzle.
It still uses the shared `ConceptHintButton`/`ConceptHintPanel` (glossary
entry added: "Status reporting / governance") for consistency with every
other tool screen's APM-concept reminder.

**Company logo asset:** the user's uploaded logo (fictional "Helix
BioPharma" mark) was resized to 300x170 and saved to
`public/assets/branding/helix_biopharma_logo.png`, referenced by a plain
`<img>` tag — not inlined as base64 in the component source (that pattern
was only ever a mockup-scratch-file convenience for `show_widget`, never
meant to ship in real committed code).

---

## Monthly Status Report — risk dropdown was leaking the event engine; replaced with evidence-gated reportable risks

**Status:** Implemented. Reverses part of the original Task #183 design —
read that entry above first, since this corrects a real conceptual error
in it, not just a UI tweak.

**The problem, as flagged in review:** `StatusReportBuilder`'s risk
dropdown originally sourced straight from `computeActualStatusReport(state)
.risks` (`computeActiveRisks` — every Main/Late Wave event whose
`isEventEligible` condition is currently true). By the time the player
reaches report #1 (ACT4_SCENE05, right after Main Wave fires at
ACT4_SCENE04), that pool held ~14 entries — including future Late Wave
events the player hadn't lived through yet (e.g. "Cyberattack Locks the
Building Management System") and purely positive reversal events ("The
Ally You Didn't Expect", "The Deferred Decision Pays Off"). That's the
event engine's own eligibility bookkeeping, not something a PM could
plausibly know to write into a report — it broke the fiction and worked
against Act 4's actual point (interpreting evidence, not reading the
engine's mind).

**The fix — two completely separate risk models now exist, on purpose:**

1. `computeActiveRisks`/`ActualStatusReport.risks` (unchanged) — the
   hidden TRUTH engine, still exactly what it always was: every currently-
   eligible event, never shown to the player, preserved as
   `StatusReportRecord.actualSnapshot` for a possible future Act 5 "what
   you said vs what was true" payoff.
2. `computeKnownReportableRisks(state): ReportableRisk[]` (new) — the
   ONLY thing `StatusReportBuilder.tsx` is allowed to read. Built around a
   three-stage lifecycle per event: hidden (no evidence yet) -> "risk"
   (player has real in-fiction evidence, shown with a deliberately vaguer
   pre-materialisation label) -> "issue" (the event has actually played
   out as a scene, shown with a plain, specific, no-longer-a-spoiler
   label). A closed/mitigated fourth stage is deliberately not built yet —
   nothing today ever un-resolves an event or offers a "closed" label;
   logged here as a follow-up, not half-built.

**`GameState.eventsResolved: string[]`** (new field) — the missing piece
that made "has this event actually happened yet" answerable at all.
Nothing tracked this before; `eventQueue`/`eventQueueIndex` only describe
the *currently in-progress* wave and get cleared back to null once it
finishes. Appended to in `GameRoot.tsx`'s `advanceEventQueue` — the single
choke point every queued event's own scene (never its `precedingDialogueId`
lead-in beat) passes through on its way to whatever comes next, so this
needed no new call sites, just one field push at an existing one.

**`REPORTABLE_RISK_CATALOG`** (new, `lib/nova/state.ts`) — a hand-curated
map, NOT auto-derived from `events.json`, covering only the 14 actual
"risk"-category Main/Late Wave events (`EVENT_WAVE_MEMBERS` minus the four
EV-R reversal events, which are absent from this catalog entirely and can
therefore never appear, full stop — they're retrospective
recontextualisations of a past decision, not something a player could ever
be "reporting on" in the RAID sense, and at least two are explicitly good
news). Only three entries (EV-02, EV-06, EV-10) currently have a
`preDiscovery` block, because those are the only three events with a real
built-in early-evidence channel today — the Act 2 Risk Workshop's three
`risk_investigation.json` banks (contractor/validation/contingency) and
their paired `_risk_logged` choice, all from Task #178's honesty-mechanic
work. The other 11 events (EV-NP2, EV-03/04/05/08/11/13, EV-07/09/14/15)
have no early-evidence channel built yet, so they can only ever appear
post-materialisation, as an issue — a real scope limit, not an oversight;
worth building dedicated discovery beats for the higher-profile ones
(EV-09's cyberattack especially) later, exactly as the review suggested
("surfaced via email/Teams/news/site evidence").

**Example, matching the review's own worked case:** EV-06 (Electrical
Contractor Goes Bankrupt) — before it fires, if the player asked Vaughn
about impact/mitigation or formally logged the risk in Act 2, the
dropdown shows "Electrical contractor financial instability" (status
`"risk"`). With zero evidence, EV-06 is invisible even though
`isEventEligible("EV-06", state)` is unconditionally `true` — this is the
core behavioural change; the old code showed it regardless. Once the
event has actually played out (`state.eventsResolved` includes `"EV-06"`),
it flips to "Electrical contractor insolvency — replacement required"
(status `"issue"`), regardless of whether it was ever investigated in
advance.

**Eligibility is still checked, on top of discovery/materialisation:** a
risk the player investigated but that can literally never fire this
playthrough (e.g. EV-02's `regulatoryReadiness < 60` never actually
crosses) stays hidden — "still relevant" is part of the review's own
definition of reportable, not just "known".

**Verified** via a throwaway scripted check (written, run, deleted per
convention): fresh state shows zero reportable risks despite several
always-eligible events existing; EV-R1–4 never appear under any
flags/resolved combination; EV-06 surfaces with the vague pre-discovery
label once evidenced, stays hidden with zero evidence despite being
always-eligible, and flips to the specific issue label once resolved;
EV-02 stays hidden while ineligible even with evidence logged, and
surfaces once both eligible and evidenced.
