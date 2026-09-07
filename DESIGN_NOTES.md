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
the MoSCoW-"Won't" items — see the "CBS classification rework" entry
further down for why this dropped from "CBS cut-task/MoSCoW-'Won't'
items" to MoSCoW alone: Act 3's CBS no longer performs any actual
descoping, so it correctly has nothing left to contribute here). Earlier drafts of this formula
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

---

## Monthly Status Report — Upcoming Activities broken down into real near-term WBS tasks

**Status:** Implemented. Follow-up to the report-builder UI work above —
confirmed Upcoming Milestones was already correctly sourced from the real
Gantt chart (`toolScreen.ganttToolId` -> `state.toolPlacements`, unchanged
by this entry); the actual gap was Upcoming Activities, which had been
shipped as three static, generic, always-the-same authored bullets
regardless of what the player had actually placed on the timeline.

**The fix:** Upcoming Activities is now a genuinely finer-grained, real,
time-scoped breakdown of the same Gantt data Upcoming Milestones already
reads — deliberately not just that table's rows restated. A milestone
counts as "near future" once it's already in progress (`start <=
currentWeek`) or starts within `upcomingActivityWindowWeeks` (new
`ToolScreenBlock` field, default 4 — roughly one reporting period) of the
current week — distinct from Upcoming Milestones, which shows the FULL
remaining plan with no window at all. For each near-term milestone, its
individual WBS task cards (`toolScreen.wbsToolId` — new field, pointed at
`TOOL_ACT3_SCENE01_WBS` — matched by `milestone.wbsCategory === card
.correctBucket`) become separate checkable activity items instead of one
headline title, so the player is choosing among real, specific pieces of
work ("Install and commission the isolator line — Equipment Delivered &
Installed, Wk 8–13") rather than restating a milestone name they already
saw in the table above. `toolScreen.upcomingActivityCandidates` is kept
only as a genuine fallback (shown if no milestone is near-term yet, e.g.
before any Gantt placement exists at all) — no longer the default source.

**Verified** via a throwaway scripted check (written, run, deleted):
confirmed `wbsToolId`/`upcomingActivityWindowWeeks` wiring, and that the
near-term filter correctly excludes already-finished and too-far-out
milestones while including in-progress ones, at two different simulated
`currentWeek` values against real placed Gantt data — e.g. at week 9
(mid-Equipment), only Equipment's real WBS task cards appear; pushing to
week 14 correctly swaps the window to Validation/Training instead.

---

## Monthly Status Report — stopped reusing the HUD's flawed week forecast for `currentWeek`

**Status:** Implemented. Direct consequence of this file's own "HUD
'current week' is a forecast, not real elapsed time" entry — read that
one first, since this is exactly the failure mode it warned about,
now actually hit by a real feature.

**The bug, as reported:** report #1's "Upcoming Milestones" table showed
"None remaining" — every single Gantt milestone read as already complete,
even on the very first report, regardless of what the player had placed.
Cause: `currentWeek` reused `computeWeeksRemaining(scheduleHealth)` (the
same forecast the HUD's "Est. Completion" chip shows), clamped to 24.
That's explicitly a forecast ("if this pace holds, the project would take
about X weeks total"), not a real elapsed-time clock — it can already
read close to 24 very early in a playthrough with anything less than
excellent schedule health, which is exactly what was happening here.

**The fix — deliberately scoped to the status report only, not a general
fix for the HUD's own use of the same forecast (still open, still
tracked in the entry above):** each Monthly Status Report now represents
a real, fixed ~4 weeks of story time (`WEEKS_PER_REPORT` in
`StatusReportBuilder.tsx`) — matching the scene's own title ("Monthly
Status Reports (x3)"). `currentWeek` is now simply `(state.statusReports
.length + 1) * WEEKS_PER_REPORT`, clamped to 24: report #1 opens at week
4, #2 at week 8, #3 at week 12 — real, deterministic, and completely
independent of `scheduleHealth`/the forecast. `computeWeeksRemaining`
import removed from this file entirely; the HUD's own use of it for "Est.
Completion" and "Current Objective" is untouched.

**Verified** via a throwaway scripted check (written, run, deleted):
confirmed report #1 now opens at week 4 (not 24), and that with the same
placed Gantt data used in the Upcoming Activities check above, all 6
milestones correctly show as upcoming at that week — the reported "None
remaining" symptom is gone.

**Follow-up:** Upcoming Milestones originally filtered on `end >
currentWeek` (not yet finished), which let an already-in-progress
milestone (started before currentWeek but not yet complete) still show as
"upcoming" — reported as incorrect, since something already under way
isn't upcoming. Changed to `start > currentWeek` (genuinely hasn't
started yet). Verified via another throwaway scripted check: an
in-progress milestone (start before currentWeek, end after) is now
excluded from Upcoming Milestones. Note this leaves in-progress
milestones absent from BOTH Upcoming Milestones (correctly, they've
started) and Key Accomplishments (correctly, they're not finished) — no
"in progress" section exists in the report yet; Upcoming Activities is
the only place in-progress work is deliberately still visible (see the
entry above — its near-term window intentionally includes `start <=
currentWeek`, by design, unaffected by this change).

## Act 4 roadmap, steps 6–8 — finalized plan (not yet built)

**Status:** Design-only. Nothing in this entry has been implemented;
recorded so the agreed shape survives until each step is actually
picked up. Steps 1–5 (truth engine, report persistence, report #1 UI)
are done — see the Monthly Status Report entries above. This entry is
the settled scope for what comes after report #1, reached through a
back-and-forth design review (not a decision made unilaterally by
Claude).

**Step 6 — playtest report #1 first; it's a genuine go/no-go gate, not
"we'll definitely build reports 2 and 3."** If the report mechanic
lands, reports 2/3 should get *harder because project state is
harder*, not because the UI gains new mechanics: report 1 is mostly
straightforward interpretation, report 2 (post-BIG-01) introduces
conflicting signals, report 3 (pre-inspection) forces the player to
decide what they're willing to put formally on record. This is close
to free — `computeKnownReportableRisks` and the milestone/activity
derivation are already state-driven, so difficulty rises automatically
as more events resolve between reports. The real work is pacing: which
events land before report 2 vs. report 3, so the risk list grows
meaningfully rather than turning into clutter (e.g. not 12 reportable
risks piled up before report 2).

Between reports, add RAID-style / change-impact beats as
report-adjacent activities, not new minigames — reusing the Act 2 Risk
Workshop pattern (investigation flags → pre-discovery evidence →
reportable risk) already built for EV-02/06/10. Loop: event →
investigate → update artefact → report → consequence.

Two explicit constraints on that RAID work, both firm:

- **The status report does not own risk lifecycle.** No
  close/resolve-a-risk control on the report screen itself — that
  would let the player make a problem disappear by unticking it while
  writing the report. The RAID/change-impact activity is where a risk
  moves `risk → issue → mitigating → closed`; the status report only
  *reads* that result. A closed risk should not consume one of the
  report's 4 fixed risk-row slots — if continuity across reports
  matters, that's a small "recently closed" strip or something
  preserved in report history, not a 5th active row.
- **Don't build a pre-discovery evidence channel for every remaining
  event.** Some risk-category events are genuinely foreseeable
  (contractor instability, validation capacity, contingency pressure,
  supplier lead-time concerns — good RAID candidates). Others should
  stay real shocks with no warning (extreme weather, cyberattack unless
  a BMS vulnerability was specifically discovered, investor
  rescheduling, some regulatory changes) — foreshadowing everything
  turns Act 4 into a checklist of pre-warned risks instead of reality
  hitting the plan. Classify each of the 11 currently-undiscoverable
  events as *discoverable / weak-signal / genuine-surprise* before
  building its RAID beat, rather than defaulting to "give it a
  pre-discovery channel."

Also noted, not a blocker: `GameState.eventsResolved` currently means
"the event's own scene has been played," and `computeKnownReportableRisks`
maps that directly to `status: "issue"` — which today is semantically
correct (an issue is something that has *occurred* but isn't
necessarily *closed* yet; there is no "closed" state yet at all). Worth
being deliberate about this when the closed/mitigated lifecycle above
gets built, so "resolved" (scene played) never gets conflated with
"closed" (issue dealt with) — they need to stay three distinct
concepts: threat known, event occurred, issue closed.

**Rejected for now: "Suggested Overall Status."** Cheap to build (e.g.
2+ Red dims → suggest Red, 1 Red or 2+ Amber → suggest Amber, else
Green, derived only from the player's own selected dimension RAGs,
never hidden truth) but deliberately not building it before the report
#1 playtest — it risks quietly undermining the report's own stated
premise ("Ratings, risks, and evidence are your own call — nothing
here is pre-filled or graded for you"). Revisit only if the playtest
shows players are genuinely lost on how to arrive at an overall status,
not preemptively.

**Step 7 — Act 4 HUD raw-signal pass, only after report #1 exists.**
Sequenced last among the "cheap" items on purpose: doing it before the
report mechanic exists would just make the HUD less informative with
no payoff yet. Once the report is live, replace verdict-flavored
labels with the raw evidence behind them — e.g. `Week 38 / 24 —
OVERDUE` becomes `Forecast Completion: Week 38` / `Baseline Completion:
Week 24`. General rule for the pass: the HUD should read as evidence,
not judgement — raw budget remaining, forecast completion, risk
exposure, etc. can stay; any label that effectively answers the RAG
question for the player should be reviewed. Uses the same
`scene.act`-branching hook the HUD already has, just a second branch on
label style for Act 4+.

**Step 8 — selective character-challenge dialogue, last (most
expensive, least reusable, needs a stable report shape first).** Daniel
challenges Budget, Camille challenges Milestone (etc.), but only fire
on a mismatch or an interesting judgement call — not on every report,
or it reads as a tutorial correcting a wrong color rather than a
consequence. Three trigger categories, not just one:

- **Misrepresentation** — actual Red, reported Green.
- **Omission** — a major known/reportable risk left out of the four
  reported risk rows.
- **Defensible-but-contestable judgement** — underlying evidence is
  mixed and the player chose Amber over Red (or similar); the
  character challenges the call and the player has to talk through
  their reasoning, not necessarily be wrong. ("Validation is two weeks
  behind — talk me through why you called this Amber.") This is what
  makes the beat feel senior-PM rather than "wrong answer, NPC
  corrects you."

All three compare `StatusReportRecord.reported`/`selectedRisks`
against `actualSnapshot`, which the record already stores side by side
specifically to make this comparison possible later.

**Already satisfied, no action needed:** the risk/issue distinction is
already an explicit data field (`ReportableRisk.status: "risk" |
"issue"`), not just a display-label difference — this was raised as a
future to-do during design review but the current `computeKnownReportableRisks`
implementation already does it.

## Act 4 event redistribution — Report #1 playtested, building step 6

**Status:** Implemented. Report #1 (`ACT4_SCENE05`) was played and
approved as-is before this work started — this entry covers what
changed *around* it, not report #1 itself. Reached through several
rounds of design review, not decided unilaterally; the review process
itself is worth recording briefly because it caught a real structural
problem the file contents alone didn't make obvious: the original plan
(see the "Act 4 roadmap, steps 6–8" entry above) assumed BIG-01 sits
*between* Report 1 and Report 2. Reading `scenes.json` showed the
opposite — BIG-01 and the entire old Main Wave (13 events) already fire
*before* Report 1, and Reports 2/3 (`ACT4_SCENE05B`/`05C`) were
back-to-back placeholder "bridge" scenes still running the old
honesty-choice mechanic (`CHOICE_ACT4_SCENE05_M2`,
`hid_problem_from_marcus`) that predates the real report builder.
Decision: leave BIG-01 where it is (Report 1 already played well
downstream of it) and fix the *event distribution* instead.

**The core problem with the old structure:** one giant wave dumped
almost every risk-catalog event before Report 1, then two reports with
zero events between them. That's the opposite of a recurring
governance heartbeat — it's "one big dump, then three isolated
exercises." The fix reframes each inter-report gap as its own project
period with a narrow narrative question, not a bucket to redistribute
existing content evenly into.

**The four periods, and what question each report should capture:**

- **Group 1 — BIG-01 → Report 1.** Only `EV-NP2` (the two-product
  validation-capacity no-perfect-answer beat, gated on "fires only
  after BIG-01" — effectively guaranteed) and `EV-R2` (the deferred-
  decision payoff, explicitly about absorbing BIG-01's re-scoping) fire
  here — both are direct, immediate consequences of BIG-01 itself, not
  general Act 4 texture. Report 1's question: *"The project has just
  fundamentally changed. What do you now tell leadership?"* `EV-11`
  (MHRA guidance) and `EV-03` (resident complaints), originally slated
  for this group, moved to Group 2 — they're not BIG-01 consequences
  and diluted that question.
- **Group 2 — Report 1 → Report 2 (`MID_WAVE_1`).** The project trying
  to operate under the new reality: conflicting evidence, not just more
  bad news. Substantive pool `EV-02, EV-13, EV-04, EV-08, EV-05, EV-11,
  EV-03` (7 events), capped to 2 per playthrough; reversal pool
  `EV-R1, EV-R3, EV-R4` (the three "was that decision actually bad?"
  beats), capped to 1. `EV-02`/`EV-05` (cleanroom failure /
  contamination) are both quality-regulatory and would read as
  repetitive if drawn together, so they're explicitly mutually
  exclusive within one draw.
- **Group 3 — Report 2 → Report 3 (`MID_WAVE_2`).** Where the RAID
  lifecycle beat lives. Anchor: `EV-06` (electrical contractor — has
  Act 2 pre-discovery evidence, so it's shown as a known "risk" since
  Report 1/2 and materialises here), immediately followed by a small
  RAID mini-artefact interaction (see below) if it fires. Substantive
  pool `EV-15, EV-14, EV-10` (social-media pressure, validation
  engineer poached — continuing the EV-NP2 thread from Group 1 —,
  contingency freeze), capped to 2. A separate single-slot "final
  shock" pick, capped to 1, from `{EV-09, EV-07}` — cyberattack or key-
  engineer resignation, whichever's eligible, never both. Report 3's
  question: *"This is what the project formally says immediately
  before inspection"* — deliberately the last operational pressure
  before that report, not after it, so nothing materially important
  happens post-Report-3 that the record doesn't capture.
- **Group 4 — after Report 3.** `ACT4_SCENE06` keeps its existing
  Ellis-fragment/transition content and leads straight into Act 5 —
  it no longer carries an `eventWaveId` at all, since every event
  formerly in the old `LATE_WAVE` has been redistributed into Groups
  1–3 above. All 18 original events (13 old `MAIN_WAVE` + 5 old
  `LATE_WAVE`) are accounted for across the four groups — 2 + 10 + 6 =
  18, nothing dropped, nothing duplicated.

**Anti-starvation mechanism (the one real engineering addition here):**
capped selection from a fixed-order pool risks the same failure mode
as the old single-wave design at a smaller scale — if the first two
declared substantive events are commonly eligible, the rest could
become dead content nobody ever sees across many playthroughs.
Deliberately not solved with RNG (nothing else in this engine uses
randomness, and reproducibility matters for testing/debugging a save).
Instead: the pool is rotated by a state-derived seed before capping —
`rotationSeed = round(riskExposure) + round(budgetRemaining / 10000) +
eventsResolved.length`, `offset = rotationSeed % eligiblePool.length`.
Same save state always produces the same selection (deterministic,
testable), but different playthroughs — which necessarily have
different metric/history values by the time they reach a given gap —
rotate the starting point differently, so a later-declared event isn't
structurally disadvantaged just for being declared later. Verified via
a throwaway scripted check (written, run, deleted) that fed the
selection function a spread of different synthetic metric states and
logged how often each pool member got picked — confirmed no pool
member was ever selected in 0 of the sampled states.

**The RAID mini-artefact (`raid_update_card` tool type,
`RaidUpdateCard.tsx`):** deliberately NOT a three-button dialogue
choice — that was flagged in review as just "a RAID log wearing a
dialogue hat," which is the exact problem this whole redesign is
trying to move Act 4 away from. It's a small reusable card with real
fields: Risk name, a Status readout (`Risk → ISSUE`, shown as a state
change rather than a choice), Owner (pick), Response (pick), Escalate
(Y/N), Submit. Wired as its own queued-event scene (`EV-06-RAID`,
spliced directly after `EV-06` in the `MID_WAVE_2` queue whenever
`EV-06` itself fires — not independently eligibility-gated, since its
whole premise is "this follows the contractor risk materialising", not
an unrelated trigger condition). Technically this required teaching
`synthesizeEventScene` to pass through an event's `toolId` (previously
only `dialogueId`/`choicesId`), since queued-event scenes had never
carried a tool screen before. Follows `StatusReportBuilder`'s existing
"self-contained local state, own Submit gating, custom `onSubmit`
prop" pattern rather than the generic `toolProgress`/`computeToolComplete`
path — same reason StatusReportBuilder does: there's no single
placement-style completion condition to check. Owner/Response are
written to `GameState.decisions` (`raid_ev06_owner`, `raid_ev06_response`);
Escalate to a boolean flag (`raid_ev06_escalated`). No numeric metric
effects on submit — deliberately inert for v1, a hook for later rather
than a scored decision, so the beat stays about governance discipline
rather than becoming another effects-bearing choice to min-max.

**Technical catch fixed as part of this, not after:** `computeActiveRisks`
(the hidden truth engine's own event pool, feeding
`ActualStatusReport`/the Act 5 "what you said vs. what was true" data)
previously read `[...EVENT_WAVE_MEMBERS.MAIN_WAVE,
...EVENT_WAVE_MEMBERS.LATE_WAVE]` directly. Splitting the waves without
updating this would have silently dropped every Group 2/3 event from
the hidden truth engine. Replaced with a single derived
`ALL_ACT4_EVENT_IDS` list covering `MAIN_WAVE` plus every id across
both `GAP_WAVE_SPECS` entries (anchor + substantive + reversals +
finalShock, excluding the non-risk `EV-06-RAID` follow-up id) — one
source of list, so a future Group 5 or pool change can't drift out of
sync with the hidden truth engine again.

**Timing-phrase rule (documented, not code-enforced):** event-wave
group progression (1→2→3→4) is narrative-phase driven — which
governance period a beat lands in — not tied to the live `currentWeek`
forecast HUD value. Each report's own displayed "Week N" stays the
already-fixed `WEEKS_PER_REPORT`-derived real elapsed time. Individual
event copy should never name an exact week number relative to a fixed
anchor (e.g. "a week before commissioning") unless that number is
guaranteed consistent with whatever week the HUD is actually showing
at that point, which it generally isn't once `scheduleHealth` has
drifted. Checked all existing Act 4 dialogue for this before writing
new content — the only offending phrase was in `EV-14`'s **events.json
`description`** field (dev-facing design summary, not player-facing
`DIALOGUE_EV-14` content, which was already phase-relative with no
week reference at all) — softened to "with commissioning approaching."
No player-facing dialogue needed changing. All new dialogue written for
this feature (the two transition scenes, the RAID beat, rebuilt
05B/05C) uses phase-relative language throughout (e.g. "weeks pass",
"the picture is more visible than it was a month ago") rather than
exact week numbers, by rule, to avoid reintroducing this problem later.

**Old honesty mechanic removed, not left dangling:** `ACT4_SCENE05B`/
`05C` are now real `status_report_builder` tool screens (reusing
`StatusReportBuilder.tsx` — same component, different `tool_screens.json`
data, per the "reuse, don't rebuild" instruction). `CHOICE_ACT4_SCENE05_M2`
and the `hid_problem_from_marcus`/`honestyTone` mechanic it drove are
removed from `choices.json`/`dialogue.json` outright — redundant and
potentially contradictory now that the player is filling in real
Budget/Scope/Resource/Milestone RAGs and risk rows directly, per
explicit instruction not to run two reporting systems at once.

**Follow-ups deliberately not built now (same "don't solve a problem
you haven't observed yet" principle used elsewhere in this file):** no
metric effects on the RAID card submit; no closed/mitigated lifecycle
stage yet (still the open item from the steps 6–8 entry above — this
RAID beat only takes a risk from `risk`→`issue`, same as before, it
just does it through a real interaction now instead of an automatic
flip); Group 2/3 pool membership and caps are a first pass, not
validated by an actual full playthrough yet — that's the explicit next
step after this build, not a further design pass.

## Act 4 event presentation grammar — teaserTitle (tiny win #1 of a larger pass)

**Status:** Implemented (the small piece only — see the roadmap below for
what's deliberately not done yet). Reached through design review after
an actual Act 4 playthrough surfaced two related but distinct problems
in the same screenshot:

1. **A debug-language leak.** `synthesizeEventFrameScene` (data.ts)
   hardcoded `title: \`${event.title} — lead-in\`` — internal authoring
   language visible on a real player-facing screen.
2. **A spoiler problem, underneath the debug one.** Even with the
   suffix removed, `event.title` itself — "Electrical Contractor Goes
   Bankrupt", "Cleanroom GMP Review Failure" — is the real, revealed
   name of the event, used as the screen header for both the lead-in
   AND the actual event scene (`scene.title` renders directly as the
   visible header — confirmed in GameRoot.tsx). Fixing #1 alone
   wouldn't have fixed #2; they needed separate treatment.

**The fix:** `EventEntry.teaserTitle?: string` — a non-spoiler "what
kind of thing is this" category label (an inbox/Teams/document
category, not the event's real name), used as `scene.title` for both
`synthesizeEventScene` and `synthesizeEventFrameScene`, falling back to
`event.title` if unset. The "— lead-in" suffix is gone entirely,
independent of whether an event has a teaserTitle yet. `event.title`
itself is untouched and stays the internal/authoring-canonical name
(DESIGN_NOTES, `REPORTABLE_RISK_CATALOG.issueLabel`, etc. all still
reference it) — it's simply never rendered as a header directly once a
teaserTitle exists.

Populated for all 18 events currently reachable via
`EVENT_WAVE_MEMBERS.MAIN_WAVE`/`GAP_WAVE_SPECS` (not every event.json
entry — EV-NP1/EV-12/BIG-01 are hand-authored scenes.json scenes with
their own titles already, not synthesized from events.json, so
teaserTitle doesn't apply to them): e.g. EV-06 → "Site Communication",
EV-02 → "Quality Review", EV-09 → "System Alert". First-pass wording,
expected to be revised once paired with real delivery artefacts (see
below) rather than shown as bare narration text.

**Explicitly NOT done in this pass (see the fuller roadmap that follows
from a design review of a full Act 4 playthrough):**

- The "revisited" preamble narrations (`DIALOGUE_REVISITED_CONTRACTOR`/
  `_VALIDATION`/`_CONTINGENCY`) still say things like "not formally
  logged" / "This is happening now. You weren't ready for it." —
  flagged as too explicit/judgemental ("don't narrate state the UI can
  show" — if a RAID entry can visually show a blank mitigation field,
  the narrator doesn't need to say so in words). Rewrite is planned but
  not done — it's grouped with delivery-format work below, not a
  standalone tiny fix.
- No RAID history fields yet (`RaidUpdateCard.tsx` doesn't yet show
  "First raised: Week N / Owner: — / Mitigation: — none recorded —")
  — flagged as cheap (the underlying flags — `contractor_risk_logged`,
  `asked_contractor_impact/mitigation` — already exist; this is mostly
  a rendering change) but not yet built.
- No delivery-format variety (email/Teams/news/etc. instead of
  narrator-box + Continue for every event) and no location variety
  (every Act 4 event currently opens on the same office backdrop
  regardless of content) — both real, agreed-good ideas, explicitly
  gated behind the investigation below.
- No "interrupt" pattern (events breaking into the game directly
  instead of a lead-in scene) — explicitly deferred pending playtest
  evidence that the smaller delivery-variety win isn't already enough;
  the only genuinely expensive item in this whole list, correctly not
  worth building speculatively.

**Roadmap agreed for the rest of this pass (dependency-ordered, not
task-order):**

1. Tiny wins — `teaserTitle` + drop "— lead-in" (this entry).
2. **Audit `EmailInboxPanel`/`TeamsThreadPanel`/`SharePointBrowserPanel`/
   `DocumentDiscoveredCard` (built for the Act 1 investigation
   mechanic — Investigation Board) for Act 4 reusability.** Named as
   the single highest-leverage open question — if these generalize,
   varied delivery formats for Act 4 events becomes mostly reuse, not
   new component work; if they're deeply Act-1-coupled, it's a
   different-sized project. Investigation only, no conversion work,
   until this comes back.
3. Prototype: convert a small number of major Act 4 events (contractor
   bankruptcy is the running example) through whatever the audit found
   reusable.
4. Playtest that prototype specifically.
5. Only then decide whether the interrupt pattern and/or a
   location-per-event system are actually needed, based on whether the
   prototype already closes most of the gap.

**Step 2 (audit) result: partially reusable — components are generic,
the attachment point isn't.**

`EmailInboxPanel`/`TeamsThreadPanel`/`SharePointBrowserPanel` are all
thin renderers over one shared shape (`RiskInvestigationBank`/
`RiskInvestigationQuestion` — id/dimension/questionText/answerText/
flagOnAsk). None of them know they're Act 1 content; they just render
whatever bank they're handed. `TeamsThreadPanel` shows a full thread at
once (not click-to-reveal, auto-marks everything read on mount), which
is architecturally closer to "a message just arrived" than
`EmailInboxPanel`'s browsable-inbox pattern is.

The real constraint isn't the components, it's how a bank gets shown at
all: currently strictly via `ChoiceBlock.riskInvestigationId` — a bank
plays as an interstitial in front of a *choice's* own options
(`atInvestigation` in GameRoot.tsx gates on `pendingChoice.block
.riskInvestigationId`). There's no scene-level or event-level hook.
Several Act 4 events don't even have a `choicesId` (EV-R2, EV-R4 are
pure narration beats) so "attach a bank to the existing choice" doesn't
reach them regardless. Clean fix, not yet built: extend the same
mechanism `precedingDialogueId`/`EVENT_FRAME_SUFFIX` already uses for
lead-in scenes so an event can optionally lead in with a bank panel
instead of (or alongside) plain dialogue — same shape of change as the
`toolId` passthrough already added for the RAID card, reusing the
existing queue/scene machinery rather than adding a new one.

Two real (if small) costs, not blockers: `TeamsThreadPanel`'s
(`TEAMS_META`, `AVATAR_COLORS`) and `SharePointBrowserPanel`'s
(`FILE_META`) per-message chrome are keyed by hardcoded ids/character
names local to each component — cheap to extend (one map entry per new
message) but not zero-touch. `DocumentDiscoveredCard` is the one
genuinely NOT cheap: tied to `ARTEFACT_REGISTRY`'s pre-rendered
incomplete/complete PNG pairs, so using it for a new Act 4 "document"
means real art assets, not just JSON/data work.

**Conclusion:** reusable for single-message (email/Teams-style)
delivery once one small new engine hook exists (bank-panel lead-in).
Document-reveal specifically carries real production cost per document,
separate from the code question. Step 3 (prototype 2-3 major events)
is unblocked and cheap; not yet started, pending go-ahead.

## Act 4 event delivery — panel lead-in prototype (step 3, built)

Following the audit above, built the small event-level panel hook and
converted exactly three events through it, per direction: "let Claude
build the small event-level panel hook now, then convert exactly three
events and playtest before expanding."

**The hook.** `EventEntry.leadInPanelId?: string` — deliberately NOT
named `riskInvestigationId`, to avoid overloading a field that already
means something specific (a choice-scoped risk Q&A) with a different,
more general job (any event's delivery panel: Teams, email, social
feed, whatever). References a `risk_investigation.json` bank by id,
reusing the existing `RiskInvestigationBank`/`getRiskInvestigation`
shape and its `visualStyle` discriminator rather than inventing a
parallel data file — the underlying content shape (a list of
sender/body items) is genuinely the same thing either way; only the
*attachment field name* on the event needed to be neutral, not the
storage. Wired through the same `EVENT_FRAME_SUFFIX` synthesized
lead-in scene mechanism `precedingDialogueId` already used
(`synthesizeEventFrameScene` in data.ts now builds a panel-only frame
scene when `leadInPanelId` is set, no dialogue lines at all — the panel
IS the whole beat) — `resolveEventQueueEntryScene` (state.ts) routes
the queue into it exactly like a dialogue lead-in.

**Kept deliberately simple, per direction:** an event gets EITHER a
`precedingDialogueId` lead-in OR a `leadInPanelId` lead-in, never both —
no panel → narration → event dialogue → choice chains. `Scene` gained a
matching `leadInPanelId?: string | null` field (only ever set on a
synthesized frame scene, never in scenes.json) so GameRoot can render
the right panel component with no dialogue box above it, then Continue
goes straight to the event's own scene via the same `handleContinueScene`
every plain-continue scene already uses — no new resolved-state tracking
needed (unlike `atInvestigation`'s choice-scoped version) since a queued
event's frame scene is one-directional.

**Three events converted:**
- **EV-06** (electrical contractor bankruptcy) — Teams thread lead-in
  (`EV06_LEADIN`), one message from Vaughn: "Harcourt's office is shut
  and nobody is answering. I'm trying their site manager now." Reveals
  the situation unfolding rather than naming the event; the real
  bankruptcy is still discovered in EV-06's own dialogue that follows.
- **EV-02** (cleanroom GMP review failure) — email lead-in (`EV02_LEADIN`,
  `outlook_inbox` visualStyle), a cold official notification from a
  "GMP Compliance Team" sender ahead of Camille's own spoken reaction
  in EV-02's existing dialogue, so the beat reads as
  official-notice-then-human-reaction rather than the same news twice.
- **EV-15** (social media safety claim) — a new `social_feed` visualStyle
  and `SocialFeedPanel.tsx` component (no existing panel matched a
  social-post look), showing the actual claimed post
  (`EV15_LEADIN`) instead of narration describing it. Trimmed
  `DIALOGUE_EV-15`'s own first line ("A post is circulating — claims
  the site is unsafe...") since the panel now shows that directly —
  the remaining line ("It isn't true. It's spreading anyway.") reacts
  to the post instead of re-describing it.

**Side effect, not a separate rewrite pass:** EV-06 and EV-02 previously
used `precedingDialogueId` pointing at `DIALOGUE_REVISITED_CONTRACTOR`/
`DIALOGUE_REVISITED_VALIDATION` — the "RISK REGISTER — REVISITED... You
weren't ready for it" judgmental narration blocks flagged in the
presentation-grammar critique. Converting these two events to panel
lead-ins retired that copy for them by construction (mutual exclusivity
meant the dialogue lead-in had to go). No mechanical loss: the
`asked_contractor_likelihood`/`asked_validation_likelihood` framing-tone
line those blocks read was explicitly "no mechanical effect" per their
own engineNotes, and the risk-logged-or-not acknowledgment already
exists independently in EV-06's own dialogue (`"At least we saw it
coming"`, conditioned on `contractor_risk_logged`). Both blocks are left
in `dialogue.json`, now marked unreferenced via an `engineNote`, rather
than deleted (per the standing "don't delete orphaned content" rule) —
they're still there if a future event ever wants that framing pattern
again. This is NOT the full "revisited narration rewrite" the
presentation-grammar critique deferred — that item is about the pattern
in general, wherever else it still appears; this only retired the two
instances that happened to be directly in the way of this conversion.

**Not done:** RAID-style history fields, location-per-event variety, and
the interrupt-pattern engine are all still deferred exactly as before —
this step only touched delivery format for these three events. Group
2/3 event-pool caps are still an unvalidated first pass (per the
"Act 4 event redistribution" entry).

**Next:** playtest these three specifically (per direction — "then
convert exactly three events and playtest before expanding"). Only
after that, decide whether to convert more medium events through the
same hook, and whether `TeamsThreadPanel`/`SharePointBrowserPanel`'s
hardcoded per-message chrome maps are worth generalising yet (still "not
yet — one map entry per message is a reasonable cost" per the audit).

---

## Act 5 build — "readiness, evidence, defensibility"

**Status:** Shipped. All four scenes (ACT5_SCENE01-04) wired into
`BUILT_SCENE_OVERRIDES`, verified via `tsc`/`eslint` and a scripted
scene-chain + data-layer check, ready to commit.

**Framing, locked during brainstorm:** "Act 4 = can you run the project
under pressure? Act 5 = can you prove what you did?" Every Act 5
mechanic is a readout of decisions the player already made earlier in
the game — no new randomness, no new choices that retroactively fix
history. The three scenes with mechanics:

- **5.1 Commissioning & Training (ACT5_SCENE01)** — `computeReadinessBoard`
  derives a read-only 6-item × 2-product board from existing signals
  (`decisions.validationResourcing`, `scheduleHealth`,
  `regulatoryReadiness`, `budgetRemaining`). `ReadinessChecklist.tsx`
  renders it, then offers exactly one constrained choice —
  `computeReadinessInterventionOptions` — built only from gaps this
  specific playthrough actually left outstanding ("You have two days.
  Where do you put it?" per the locked copy direction). No gaps, no
  choice to make. `applyReadinessIntervention` reuses the original
  static `CHOICE_ACT5_SCENE01`'s two effect magnitudes
  (scheduleHealth -5/regulatoryReadiness +10 for closing a gap;
  regulatoryReadiness -10 for pushing forward instead) and sets a flag
  named after the intervention id, which `computeAuditTrailEvidence`
  later reads. `CHOICE_ACT5_SCENE01` itself was removed from
  `choices.json` — fully superseded by the tool's internal pick.

- **5.2 Validation & Documentation Sweep (ACT5_SCENE02)** —
  `computeAuditTrailEvidence(state)` is the sole truth/data layer (same
  split as the Monthly Status Report), aggregating 11 cards across four
  categories (change control, risk & issues, validation & quality,
  governance & reporting) from wherever the underlying decision already
  lives (`flags`/`decisions`/`statusReports`). Deliberately never
  invents evidence — a decision never made reads `status: "missing"` in
  the list, not absent from it, per the locked "missing evidence stays
  missing" principle. `AuditTrailBuilder.tsx` renders it as a
  click-card-then-click-folder filing exercise (not drag-and-drop, no
  correctness bounce-back) — filing every card, including the missing
  ones, is all that's required to continue; nothing here is graded.

- **5.3 MHRA Inspection (ACT5_SCENE03)** — `DIALOGUE_ACT5_SCENE03`
  rewritten as four fully dynamic questions reading straight off
  `gameState.flags`/`effectiveDialogueFlags`, no scripted branching:
  filling line change control (3-way, `filling_line_approved/deferred/
  rejected`), the stakeholder power/interest map (4-way compound,
  reusing the `daniel_power_recognized_and_camille_power_recognized`
  pattern already established for Act 3), the isolator delay response
  (2-way), and — new this build — whether any status report understated
  a problem, via `findMostMaterialReportMismatch(state)`. That function
  walks `state.statusReports[]`, diffs `report.reported[dim]` against
  `report.actualSnapshot[dim].rag` across the four shared dimensions,
  and classifies the single most material gap as `"material"` (2-band,
  e.g. green reported/red actual) or `"borderline"` (1-band) — ties
  broken toward the more recent report. This **replaces** the old
  `hid_problem_from_marcus` boolean, which was orphaned when the honesty
  mechanic was removed in an earlier session. The reputation-tag closer
  that used to end this scene was cut (nothing populates
  `gameState.reputation.tags` yet) — noted in the dialogue's own
  `engineNote`, revisit once reputation is built as the cross-game
  feature `world_memory.json` describes, not just an inspection line.
  After the four questions, a closing **evidence exhibit**
  (`InspectionEvidenceExhibit.tsx`, `computeInspectionExhibit(state)`)
  shows exactly the four things Whitfield reviewed — filling line,
  stakeholder map, isolator, and the report-mismatch verdict — reusing
  `computeAuditTrailEvidence` card lookups plus
  `findMostMaterialReportMismatch` rather than inventing a second data
  source. **Scope decision made during the build, not explicitly
  re-confirmed in chat:** this is one consolidated closing screen after
  all four questions, not four inline evidence pull-ups interleaved with
  Whitfield's individual questions. The brainstorm's "one generic
  inspection evidence viewer" didn't specify inline-vs-closing; closing
  keeps the Audit Trail Builder and this viewer independent build steps
  rather than making one a prerequisite for the other, per the build
  order's own stated rationale.

- **5.4 The Waiting (ACT5_SCENE04)** — pure scripted cinematic, no
  mechanic, deliberately withholds every variable from the player. No
  engine work needed.

**Engine additions (`lib/nova/state.ts`):** `findMostMaterialReportMismatch`
+ `reportMismatchFlags` (synthetic, never persisted) +
`reportMismatchTemplateValues` (the `{mismatchReportLabel}`/etc. tokens
DIALOGUE_ACT5_SCENE03 substitutes) + `effectiveDialogueFlags(state)` —
`{...state.flags, ...reportMismatchFlags(state)}`, now merged into all
three `computeSceneLines` call sites in `GameRoot.tsx` (both inside
`resolveInitialLineIndex`'s resume fast-forward and the main render-time
call) so resume and live-render can never disagree about visible-line
counts. Plus `computeReadinessBoard`/`computeReadinessInterventionOptions`/
`applyReadinessIntervention`, `computeAuditTrailEvidence`, and
`computeInspectionExhibit`.

**Not done / surfaced but not actioned:**
- `callback_marcus_never_surprise_me` — an Act 4 world-memory callback
  (`ACT4_SCENE05B.worldMemoryBeat`) whose payoff line ("I asked for one
  thing") was removed alongside the old honesty mechanic. Possibly wants
  the same `findMostMaterialReportMismatch`-style detection reused at
  that Act 4 call site. Flagged, no decision made yet.
- `data/world_memory.json`'s stakeholder-map and status-report Whitfield
  callbacks are confirmed-authored design intent (re-read in full this
  session after an earlier miss where a grep for "world memory" as a
  phrase failed to surface the file) — this build satisfies that intent
  functionally but doesn't read `world_memory.json` directly, since
  no engine code anywhere currently does (only
  `Scene.worldMemoryBeat?: string | null` exists as documentation).
- Whether the inspection's 4th question should ever become fully
  dynamic in a different sense (e.g. reflecting the RAID log or PESTLE
  work too) was explicitly deferred to "only after playtest" in the
  locked build order — not started.

**Verification:** `tsc --noEmit` and `eslint .` both clean. A throwaway
`scripts/verify-act5-exhibit.ts` (deleted after running) confirmed: the
scene chain resolves `ACT4_SCENE06 → ACT5_SCENE01 → ACT5_SCENE02 →
ACT5_SCENE03 → ACT5_SCENE04`, with `ACT5_SCENE04.nextScenes` correctly
pointing at the still-unbuilt `ACT6_SCENE01` (confirmed `getScene`
returns `null` there, matching the engine's existing EndOfContent
branch); all three tool screens resolve to the right `type`;
`computeInspectionExhibit` always returns exactly 4 items in the fixed
question order, reads "No decision on record."/"no discrepancy found"
correctly when nothing was decided, and reflects a synthetic material
mismatch correctly when one is injected; and the readiness → audit-trail
→ exhibit chain reads the same underlying flags consistently across all
three views (readiness board sizes, audit-trail 11-card count stable
before/after an intervention, exhibit's `stakeholder_map` item matching
the audit-trail card's detail text verbatim).

---

## Persistent character panel — "Team" side panel

**Status:** Shipped. Supersedes the earlier one-time
`TUTORIAL_CHARACTER_BOARD` scene (see that entry above). `tsc`/`eslint`
clean, verified via a scripted check, ready to commit.

**Why it changed:** a one-time gate between Reception Intro and Act 1
isn't the right shape for a reference tool players will want to check
back on mid-scene — direction after review was to make it a persistent
side panel instead, "like the ArtefactsDrawer."

**What it is:** `CharacterPanel.tsx`, mounted unconditionally in
`GameRoot` next to `ArtefactsDrawer`/`DebugDrawer`/the pause button —
same self-contained pattern (owns its own `open` state, no scene/toolId
gating), available from any scene in the game, any act, regardless of
whether the HUD is active. A small circular toggle sits at the left-edge
middle (mirroring the pause button's right-edge middle), opening a
slide-in side panel from the left edge — an actual side panel, not
`ArtefactsDrawer`'s compact dropdown-plus-modal-viewer shape, since the
carousel content (full bio paragraphs) needs more room. `CharacterBoard.tsx`
was kept as the carousel content itself, stripped of its old
`toolScreen`/`onContinue` props down to `{ characterIds, metIds }` —
pure presentation, no longer anything to do with tool-screen submission.

**"Already met" is now live, not a fixed snapshot.** The old tool-gated
version hardcoded `characterBoardMetIds: ["mike_smith", "ben"]` forever.
Since this is a real reference tool now, `GameState.charactersMet:
string[]` tracks who the player has actually encountered: `state.ts`'s
new `markCharactersMet(state, characterIds)` unions ids in
(deduplicated, no-op if nothing's new), called from `GameRoot`'s
`enterScene` with the entered scene's `Scene.charactersInvolved` on
every scene transition — the same place `applySceneFlagsSet` already
runs. Seeded with `["mike_smith", "ben"]` in `game_state.json` (met
during the Reception Intro cinematic, which isn't itself a `Scene` and
so never runs through `markCharactersMet`), with a matching backfill in
`getDefaultGameState()` for saves that predate the field.

**What was removed, cleanly:** `TUTORIAL_CHARACTER_BOARD` (scenes.json),
`DIALOGUE_TUTORIAL_CHARACTER_BOARD` (dialogue.json),
`TOOL_TUTORIAL_CHARACTER_BOARD` (tool_screens.json), the
`BUILT_SCENE_OVERRIDES` entry and its comment (data.ts),
`ToolScreenBlock.characterBoardIds`/`characterBoardMetIds` (types.ts,
now dead since the panel isn't scene-configured — the roster order lives
as a plain constant in `CharacterPanel.tsx` instead), and
`ACT1_SCENE01.trigger.previousScene` reverted from
`"TUTORIAL_CHARACTER_BOARD"` back to `null`. `game_state.json`'s
`currentScene` reverted to `"ACT1_SCENE01"`. `Character.publicBio`/
`whatMatters` and every roster correction from the original build
(Priya/Tomasz kept matching their shipped characterisation, Ben's role
elevated, `mike_smith` added, Dr Olivia never added) carried forward
unchanged — none of that was scene-specific.

**Not done / worth a future pass:** no first-time nudge pointing new
players at the toggle (flagged as an option — a coach-mark glow, same
pattern as the HUD tutorial — but not built, since nothing was
explicitly confirmed for it). No dev tool exists yet to jump straight to
"has met everyone" for testing the fully-populated panel state; the
scripted verification checks `markCharactersMet`'s mechanics directly
instead of playing through scenes.

**Fix shipped same day: met-on-entry bug.** The first version above
marked `charactersMet` from `enterScene`'s incoming scene — meaning
`ACT1_SCENE01` ("Arrival & Handover", `charactersInvolved: ["ellis",
"marcus"]`) marked Mike Elloian "already met" the instant the game
booted into it, before a single line had played. Fixed by moving the
fold onto the *outgoing* scene instead, on the exact same
`state.currentScene !== sceneId` guard `enterScene` already uses for
background/ambient carry-forward (skipped on the one-time bootstrap
call, where nothing's been left yet). A character now reads "met" once
the player has actually left the scene they appeared in, not the moment
it loads.

**Verification:** `tsc --noEmit` and `eslint .` both clean. A throwaway
scripted check (deleted after running) confirmed:
`TUTORIAL_CHARACTER_BOARD`/`TOOL_TUTORIAL_CHARACTER_BOARD` no longer
resolve at all; `ACT1_SCENE01.trigger.previousScene` is back to `null`;
`getDefaultGameState()` has `currentScene: "ACT1_SCENE01"` and
`charactersMet: ["mike_smith", "ben"]`; `markCharactersMet` is a true
no-op (same object reference) when nothing new is added, returns a new
immutable object when it unions in new ids, dedups correctly, and never
mutates the original state; and all 11 roster characters still resolve
with a role/publicBio/whatMatters.

---

## Tutorial character board — pre-Act-1 "Meet the team"

**Status:** Superseded — see the "Persistent character panel" entry
below. After playtesting the one-time gated scene, direction changed to
a persistent side panel available throughout the game instead. The
scene/dialogue/tool-screen apparatus described below was fully removed;
`Character.publicBio`/`whatMatters` and the roster reconciliation work
(Priya/Tomasz/Ben/mike_smith) carried forward unchanged into the new
design. Left in place as a record of that reasoning, not as a
description of what's currently wired.

**What it is:** a new, non-canonical engine-only scene inserted between
the Reception Intro cinematic (Ben & Mike Smith) and `ACT1_SCENE01`
("Arrival & Handover" — the scene where the player actually arrives at
NOVA and meets Mike Elloian). A read-only, browsable carousel
(`CharacterBoard.tsx`) lets the player click through the people they're
about to work with — an initials avatar (several of these characters
have no real portrait art yet, so initials read consistently across all
of them), name, role, a spoiler-free public bio paragraph, and a "What
matters" one-liner — before Act 1 begins. Back/Next, no forced gate, a
Continue button always available.

**Single source of truth, per direction during brainstorm:** the board
reads `name`/`role`/`publicBio`/`whatMatters` straight off
`characters.json` via `getCharacter`, rather than duplicating bio text
into `tool_screens.json`. `ToolScreenBlock.characterBoardIds` is
deliberately just an ordered list of ids, not inlined content — the
scene decides *who* and *in what order*, characters.json decides *what
it says about them*. `characterBoardMetIds` is scene-specific framing
(who the player has already met by this point in the story), so it
lives on the tool screen, not on `Character` itself.

**Two new fields added to `Character`:** `publicBio` (a short paragraph
safe to show before the player has met someone) and `whatMatters` (a
one-line summary), both explicitly separate from the pre-existing
`personalArc` field — `personalArc` is narrative payoff meant to be
discovered through play (Camille's old GMP warning letter, Vaughn's
daughter, Daniel's team being downsized, etc.), and handing any of that
out upfront in a tutorial would spoil it. Every board character got
both fields added this build; `personalArc`/`discoveredVia`/etc. were
left untouched.

**Roster reconciliation — the real content decision this build made:**
the bios were originally drafted with Priya labelled "Procurement Lead"
and Tomasz labelled "Technical Specialist", which directly conflicted
with their already-shipped characterisation elsewhere in the game
(Priya as Manufacturing & Operations — champions throughput/automation,
central to BIG-01; Tomasz as Supply Chain & Procurement — surfaces
supplier risk, central to the EV-R1 supplier reversal event). Confirmed
with direction: keep `characters.json`'s existing roles for both, don't
touch the shipped dialogue. Concretely: Priya's `publicBio` was
rewritten from scratch to actually describe Manufacturing/Ops (not
reused from either original draft); Tomasz's `publicBio` reuses what
was originally drafted as Priya's procurement-flavoured paragraph,
since that content was actually describing his domain, not hers, with
pronouns adjusted. Ben's `role` **was** updated, from "Colleague, Group
Tax Innovation & Change" to "Governance, Digital & Change Lead" — this
one was an intentional elevation, confirmed as not conflicting with his
existing hands-on "points the player toward the artefacts that matter"
behaviour in the Act 1 investigation feature (`professionalFunction`
left untouched). A new character, Mike Smith ("Group Tax Portfolio PMO
Lead"), was added to `characters.json` in full — same field shape as
every other character, `startingRelationship: 50` but not added to
`game_state.json`'s `relationships` object, matching the existing
precedent that Ben (also `startingRelationship: 50`) isn't in that
object either. A second proposed new character, Dr Olivia (Manufacturing
Owner), was explicitly cut — never added anywhere.

**Already-met framing:** `characterBoardMetIds` = `["mike_smith",
"ben"]` — the two people from the Reception Intro's "Ben & Mike"
cinematic (confirmed: this Mike is Mike Smith, not Mike Elloian, given
Ben and Mike Smith share the Group Tax/PMO onboarding context and Mike
Elloian is someone the player is still to meet once they arrive at
NOVA). Everyone else reads as a fresh introduction; Ellis Grant gets a
distinct "Never appears in person" badge instead, matching his existing
`portraits: null` / never-on-screen characterisation.

**Placement, architecturally:** Reception Intro runs on a separate
cinematic layer (`NarrativeScene`) that exists before any save file is
created; it hands off to the standard `GameRoot` layout only once it
completes (`handleReceptionIntroComplete` → `newGameState()` →
`enterScene`). The character board lives entirely inside that standard
layout, using the same tool-screen slot every other interactive screen
already uses — no new rendering primitive. `scene.act` is deliberately
`"Tutorial"`, not `"Act 1"`, so the header/HUD chrome never mislabels it
as part of Act 1; since `"Tutorial"` isn't in `BUILT_ACTS`, the scene is
staged in via an explicit `BUILT_SCENE_OVERRIDES` entry instead. The
actual navigational wiring is `game_state.json`'s `currentScene`, now
`"TUTORIAL_CHARACTER_BOARD"` instead of `"ACT1_SCENE01"` — that's the
one field `getDefaultGameState()` bootstraps from, so this single edit
is what makes the new scene the true first scene the engine enters.

**Verification:** `tsc --noEmit` and `eslint .` both clean. A throwaway
scripted check (deleted after running) confirmed: the scene resolves,
is `act: "Tutorial"` and in `BUILT_SCENE_IDS`, points at `ACT1_SCENE01`;
its tool screen resolves to `type: "character_board"`; every id in
`characterBoardIds` resolves to a real `characters.json` entry with a
role, `publicBio`, and `whatMatters`; Priya/Tomasz's roles match
`characters.json` exactly; Ben's role reads the updated title;
`mike_smith` exists and both `mike_smith`/`ben` are the only
already-met ids; `ACT1_SCENE01.trigger.previousScene` was updated for
documentation accuracy; and `getDefaultGameState().currentScene` is now
`TUTORIAL_CHARACTER_BOARD`.

## Four-family ending architecture (Act 6 gate model, v2)

**Problem:** `data/endings.json` (a v1 design artefact, never wired to
any code) modelled Act 6 as 8 flat, mutually-exclusive endings selected
by a single blended "Overall Verdict" composite, with END-6/END-7 as
ad-hoc overrides on top. Never implemented — `dialogue.json`'s
`ending_END-1`..`ending_END-7` condition flags were written and are
fully playable-content-ready, but nothing has ever computed them. A
single composite also has a real design flaw: it lets strong metrics on
one dimension arithmetically average away a catastrophic failure on
another (e.g. excellent stakeholder goodwill masking a regulatory
failure), which is both bad game design and a bad PM lesson — different
project dimensions aren't interchangeable.

**Direction (confirmed):** collapse to 4 player-facing outcome
*families* — Triumphant Launch, Pyrrhic Victory, Contract Lost, Batch
Rejected — evaluated via three sequential gates rather than one score,
so a catastrophic failure on one dimension can't be bought back by
strength elsewhere:

1. **Contract Gate** — did delivery happen in time to keep the NHS
   contract? Customer-facing only: `scheduleHealth` against a floor
   (with a grace override if `decisions.big01Response ===
   "phase_b_quietly"`, which explicitly protects NHS-relevant supply),
   OR `stakeholderGoodwill` collapsing past a severe floor (an external
   investigation actually delaying/preventing launch). Deliberately
   excludes `boardConfidence` — the Board liking you doesn't change
   what an external customer does; `boardConfidence` is reserved for
   Gate 3 (your personal/political outcome), a deliberate separation of
   "did the project succeed" from "did you survive it."
2. **Quality Gate** — only runs if Gate 1 = secured. `regulatoryReadiness`
   / `riskExposure` against release floors decide `batchResult`
   (released/rejected); if rejected, `findMostMaterialReportMismatch`'s
   existing severity band (material/borderline/consistent — already
   built for Whitfield's inspection, no new tracking added) is a major
   determinant of whether the rejection is *recoverable* (→ Pyrrhic
   Victory, `recoverable_quality_failure` variant, matching the
   existing END-4 beat) or not (→ Batch Rejected, matching END-5). A
   material mismatch can also block an otherwise-clean release outright
   — evaluated jointly with the metrics, not as a standalone override.
3. **Delivery composite** — only runs if Gate 1 = secured AND Gate 2 =
   released. Weighted read of budget%/benefits/goodwill/morale/
   boardConfidence/honesty (honesty = `findMostMaterialReportMismatch`
   again, not a new counter) against a threshold. **Political isolation
   is checked before this threshold, not as a fallback when the
   composite is already low** — `min(relationships.marcus,
   relationships.camille) < WARM_RELATIONSHIP_THRESHOLD` (the existing
   Cold/Cool constant, reused rather than inventing a new one) routes
   straight to Pyrrhic/`political` regardless of how strong the
   composite reads. This was a real bug caught by the archetype
   verification script, not a hypothetical: the first implementation
   checked the threshold first, which meant a cold sponsor relationship
   could be arithmetically buried under an otherwise-strong composite
   and still read as Triumphant — exactly the failure mode this whole
   redesign exists to avoid, just pointed the other direction.

END-2/END-4/END-6/END-7 are preserved, not discarded — they become
`variantSource`-tagged flavours under Pyrrhic Victory
(financial/political/scrutiny/recoverable_quality_failure) rather than
competing top-level endings, so none of the existing writing is wasted.
Batch event (`batchResult: "released" | "rejected"`) and ending family
(`endingFamily`) are kept as two separate fields on purpose — a
rejected-then-recovered batch is `batchResult: "rejected"` but
`endingFamily: "PYRRHIC_VICTORY"`, and conflating the two was flagged
explicitly as a terminology trap to avoid. Ellis's epilogue (old END-8)
is not a family — it's an overlay, gated purely on
`all_ellis_fragments_found`, layered onto whichever family/variant
resolved.

**What shipped this pass:** `data/endings.json` rewritten from the old
flat-8/single-composite v1 doc into the v2 spec — `gateThresholds`
(all three gates' inputs, floors, and weights, explicitly marked
provisional/centralised pending real playthrough calibration) +
`endingFamilies` (narrative content remapped from the old END-ids,
tagged with `sourceEndingIds` so the mapping back to already-written
`dialogue.json` content is traceable) + `epilogue`. New
`lib/nova/endings.ts`: one pure function, `evaluateEnding(state):
EndingResult`, containing all the branching logic and zero thresholds
of its own (every number lives in the JSON), returning
`{contractGateResult, batchResult, endingFamily, endingVariant,
diagnostics}` — `diagnostics` is a plain-English trace of why each gate
resolved the way it did, for the debug panel and future calibration,
not player-facing copy. Reuses `findMostMaterialReportMismatch`,
`WARM_RELATIONSHIP_THRESHOLD`, and (newly exported) `STARTING_BUDGET`
from `state.ts` rather than tracking anything new — `hid_problem_from_
marcus`/`honesty_penalty_pending` were checked and confirmed already
dead (superseded by the mismatch function per that function's own
comment) before concluding no new honesty state was needed.

**Explicitly NOT done this pass** (by design — scoped to the ending
system only, confirmed with direction before proceeding further): no
changes to `GameRoot.tsx`, `scenes.json`, or `dialogue.json`. The
existing `ending_END-1`..`ending_END-7` flags are not yet set anywhere;
`ACT6_SCENE02`'s `batch_released`/`batch_rejected` still needs wiring
to `evaluateEnding(state).batchResult`; the conditional NHS Procurement
notice (Contract Gate = lost only) doesn't exist as content yet. See
the wiring plan given alongside this entry for the intended next step.

**Verification:** `tsc --noEmit` and `eslint .` both clean. A throwaway
archetype script (deleted after running) exercised one scenario per
gate-tree leaf — clean Triumphant; financial/political/scrutiny/
recoverable-quality Pyrrhic variants; unrecoverable Batch Rejected both
via weak evidence and via a material report mismatch overriding an
otherwise-recoverable readiness band; Contract Lost via schedule floor,
via the `phase_b_quietly` grace override, and via severe goodwill
collapse — all 9 passed, including the political-ordering bug found and
fixed mid-verification (see above).

**Follow-up shipped same day: wired into GameRoot + dialogue, and one
more bug found during end-to-end playtest.** `lib/nova/endings.ts`
gained `endingConditionFlags(state)` — a synthetic, never-persisted
overlay mirroring `state.ts`'s `reportMismatchFlags` exactly. It isn't
folded into `effectiveDialogueFlags` itself (that would create a
`state.ts` <-> `endings.ts` circular import, since `evaluateEnding`
already depends on `findMostMaterialReportMismatch`/`STARTING_BUDGET`
from `state.ts`) — instead `GameRoot.tsx` gained a local
`dialogueFlagsFor(state)` wrapper merging both, used at all three of
its `effectiveDialogueFlags` call sites (live render + both branches of
`resolveInitialLineIndex`'s resume fast-forward), so live play and
resume can never disagree about how many lines a scene has.
`DIALOGUE_ACT6_SCENE02`'s `batch_released`/`batch_rejected` conditions
needed no changes (already the right names); `DIALOGUE_ACT6_SCENE03`'s
`ending_END-1`..`ending_END-7` were retagged 1:1 to the new family/
variant flag names — text untouched. A new, minimal 3-line NHS
Procurement notice was added to `DIALOGUE_ACT6_SCENE01`, gated on
`contract_lost`.

The playtest script (walking `DIALOGUE_ACT6_SCENE01` →`02`→`03` via
`getDialogue`+`isLineVisible` against real `evaluateEnding` output, one
archetype per gate-tree leaf) caught a real content gap before it ever
shipped: when Gate 1 failed, `evaluateEnding` short-circuited straight
to `CONTRACT_LOST` with `batchResult: null` — meaning
`DIALOGUE_ACT6_SCENE02`'s control-room scene would show neither "BATCH
RELEASED." nor "BATCH REJECTED.", just the atmospheric build-up lines
and then silence. This contradicts the design brief directly: "the
batch can succeed; the business outcome didn't" is exactly the
poignancy END-3 is supposed to have. Fixed: Gate 2 now always runs even
when Gate 1 has already failed, purely to populate `batchResult` for
Scene 02's conditions — its family suggestion is discarded, Contract
Lost still wins regardless of how the batch itself turns out. Re-ran
the full playtest with this fix in place: 9/9 archetypes now correctly
show gate result -> control room -> batch result -> exactly one ending
variant (with all 6 other variants' text confirmed absent, not just the
right one confirmed present) -> benefits readout -> Ellis overlay when
unlocked. `tsc --noEmit`/`eslint .` clean throughout.

**Follow-up shipped same day: Act 6 made reachable + a temporary dev
playtest nav.** `ACT6_SCENE01`–`03` were added to `BUILT_SCENE_OVERRIDES`
(no other ending-system changes) so Act 6 can now actually be played
through in the live game, not just verified by script.

## Dev playtest navigation (temporary, DEV_MODE-only)

Added a developer-only ← Previous / Next → control for stepping through
scene history with full `GameState` snapshots, so an earlier choice can
be replayed and its downstream effect on later activities/metrics/the
Act 6 ending observed directly, without restarting the whole game.

**Architecture (per the inspection done before building):** every real
scene transition already funnels through one function, `goToRealScene`,
in `GameRoot.tsx` — direct choices, tool submissions, and the Event
Library's queued-event advances all end up there exactly once. Rather
than editing that function (or `enterScene`/`goToScene`/
`advanceEventQueue`, all of which remain byte-for-byte untouched), the
new `useDevPlaytestHistory` hook (`lib/nova/devHistory.ts`) purely
*observes* `gameState.currentScene` via a `useEffect` and records a
`{sceneId, lineIndex, snapshot: gameState}` entry every time it
actually changes. Since every state-producing function elsewhere in
this codebase already returns a new `GameState` via spread rather than
mutating in place, keeping a plain object reference is already a
complete, independent snapshot — metrics, flags, relationships,
`statusReports`, `toolProgress`/`toolPlacements`/`toolSelections`,
`decisions` (supplier choice etc.), `eventsResolved`, all of it, with no
manual enumeration or cloning needed. Intra-scene updates (tool
placements, interstitial choice effects) call `setGameState` too but
don't change `currentScene`, so they don't spawn spurious history
entries — which is exactly what makes "Previous" discard everything
since scene entry without needing to hook every individual state
mutation in `GameRoot`.

History is a single array + index pointer, standard undo/redo-with-
branching: Previous/Next move the pointer and restore that entry's
`snapshot`/`lineIndex` (restoring the stored `lineIndex` — the exact
value `resolveInitialLineIndex` computed at that scene's real entry —
is what lands back at the true start of a scene's dialogue rather than
wherever the player had scrolled to). A `restoringRef` guard stops the
hook's own restore calls from being recorded as new history. Making a
*different* choice after going back drives a genuinely new transition
through the normal path, which the effect observes like any other
transition; recording truncates everything after the current pointer
first, discarding the stale future — the branch-and-discard behaviour.
Verified the truncate/restore arithmetic in isolation via a throwaway
script (linear play; two Previous; one Next/redo; back again then a
different choice correctly discards the stale future) — all passed.

**Isolation, exactly as scoped:** `DEV_MODE` is tied to `NODE_ENV !==
"production"`, so it's automatically off in any real build. Dev-nav
moves call `setGameState`/`setLineIndex` directly and never call
`saveGame` — the real localStorage save is untouched by rewinding;
history itself is in-memory only, explicitly not persisted (lost on
reload), and reset on every fresh game/continue/restart. No state-
editing controls — the `DevPlaytestNav` bar is read-only, deliberately
loud/out-of-place styling (solid amber/black, monospace, "DEV /
PLAYTEST" label) so it can't be mistaken for player UI, with a
collapsible detail panel showing current scene id, history position,
key `projectMetrics`, and a live `evaluateEnding()` projection (family/
variant/contract/batch) computed from wherever the player currently is
— not gated on having reached Act 6, since seeing that projection move
in response to an earlier replayed choice is the actual point of the
tool. Everything lives in two new files
(`lib/nova/devHistory.ts`, `components/nova/DevPlaytestNav.tsx`); the
only other changes were a dozen or so lines in `GameRoot.tsx` (one hook
call, two conditional renders, three `reset()` calls on fresh-game
paths) — removing the feature later means deleting the two files and
reverting those lines. `tsc --noEmit`/`eslint .` both clean.

**Not verified by me:** actually clicking through the live UI — this
sandbox's browser tooling can't reach the Next dev server's localhost.
The branching *logic* was verified in isolation; the actual manual
Act 6 playthrough (and dev-nav click-through) is the next step, by the
person, per their own stated intent.

**Follow-up shipped same day: political isolation threshold split from
WARM_RELATIONSHIP_THRESHOLD.** Flagged in review: reusing 65 for the
political-isolation check meant a relationship the player simply never
invested in (starts at 50, per `game_state.json`) — not damaged, just
neutral — would read as "isolated" by default, teaching "you must make
senior stakeholders like you" rather than "a genuinely damaged
relationship has consequences." Fixed by giving `deliveryComposite` its
own `politicalIsolationThreshold` (provisional: 30 — "meaningfully
below neutral, i.e. actually Cold") instead of reusing the Warm/Cool
mood-shading constant. Reverified: default (uninvested, 50/50)
relationships now resolve Triumphant when everything else is strong; a
genuinely Cold relationship (15) still correctly triggers the political
variant.

---

## CBS classification rework — Act 3's forced descope replaced with explicit Protect/Potential-lever judgement

**Status:** Implemented (`TOOL_ACT3_SCENE02_CBS`, `CBSReview.tsx`,
`lib/nova/state.ts`). Logged because the mechanic it replaces (an
unexplained forced £7.5M threshold) and the reasoning for the
replacement are both worth preserving, and because this entry is where
the resulting backlog item — the actual bridge to Act 4 — needs to be
recorded precisely rather than assumed.

**What was wrong with the old mechanic:** the CBS totalled £8.0M against
a hardcoded `descopeThreshold` of £7.5M, forcing the player to cut
exactly one task before continuing. That threshold had no narrative
rationale anywhere in the game's dialogue (searched exhaustively), it
duplicated/conflicted with the £12.0M-approved / £8.0M-baseline / £4.0M-
contingency financial model established elsewhere, and it taught a
mechanically arbitrary lesson — "the tool says you're over budget" —
rather than a real PM one. It also produced literally-unreachable
choices: three of the nine work packages cost too little to single-
handedly bring the total at or below the threshold, so the tool's own
example ("cutting `wbs_operator_training` should weaken team readiness
later") described a state the engine could never actually reach.

**What it does now:** the CBS is a fixed, non-negotiable £8.0M cost
baseline — nothing is ever cut, the total never moves. Daniel narrates
the real numbers (£8.0M baseline, £4.0M contingency, £12.0M approved,
all derived from `STARTING_BUDGET`/`totalIfAllIncluded`, never a second
hardcoded figure) and asks the player to classify each of seven eligible
packages (`classifiableTaskIds` — Foundations and Filling Equipment
deliberately excluded, see below) as **Protected** or a **Potential
lever**, via two explicit buttons per package. All seven must be
classified before Submit enables — completion is deliberately NOT
optional and NOT true-by-default, since an untouched CBS being
indistinguishable from one where the player explicitly protected
everything would defeat the point of asking. Classification is stored
in `GameState.decisions` under `cbsClassification_<taskId>` (not
`flags`, not `toolProgress`) — a categorical Act 3 *judgement*, kept
deliberately separate from any later Act 4 *event* about what actually
got reduced.

**Why forced descoping was dropped rather than fixed:** Act 4's EV-10
("Finance Freezes Part of the Contingency Budget") already teaches
"forced scope cut under real financial pressure" — and does it better,
since it fires off actual budget depletion (`budgetRemaining < 15%`)
rather than an arbitrary tool constraint, and already has softening/
mitigation infrastructure (`contingency_risk_logged`,
`asked_contingency_mitigation`) the Act 3 CBS never had. Forcing the
same lesson twice, with the worse-motivated version first, was worse
design than asking Act 3 to do only the job its own `pmConcept` already
claims: "Cost Breakdown Structure" — establish and defend a baseline,
not cut it.

**Two packages were deliberately left out of `classifiableTaskIds`:**
Foundations and Filling Equipment. Reducing either doesn't threaten
first-batch readiness the way HVAC/cleanroom/isolator/IQ-OQ/training/VMF
do — losing foundation over-spec or filling-line redundancy is a
future-capability/benefits question ("launches fine, falls short of
Business Case throughput assumptions"), not a launch-readiness one, and
the benefits-realisation system doesn't exist yet to receive that
consequence. Rather than invent a placeholder readiness consequence for
either (or expose a lever button with nothing behind it — never surface
a "pending" mechanic to the player), both stay as ordinary, non-
interactive cost lines until the benefits system exists. `costsByTask`
still includes both, so the £8.0M baseline figure is unaffected.

**`countDescopedItems` correction (Monthly Status Report Scope RAG):**
this function used to add CBS's single cut task to its "requirements
descoped under pressure" count. Since CBS no longer performs any actual
descoping, that component was removed rather than left silently
returning zero forever — see the correction note on the "Monthly Status
Report — actual-state RAG formulas" entry above. The function now counts
MoSCoW "Won't" placements only.

**Backlog — the Act 4 bridge does not exist yet, precisely stated:**
`cbsClassification_<taskId>` currently has no downstream reader
anywhere. EV-10 was investigated specifically to check whether its
existing choice architecture could consume it: `CHOICE_EV-10` is a flat,
static 3-option list in `choices.json`, and its "Descope a 'Should'
requirement" option is about Act 2's MoSCoW Should/Could/Won't
prioritization — a different mechanic, a different decision, and must
NOT be retrofitted to secretly mean "reduce a CBS package." There is no
per-item dynamic choice mechanism on EV-10 today. The future fix is not
"add a dialogue callback" — it needs an actual **new, small dynamic
CBS-lever choice mechanism**, modeled on the one precedent already in
the codebase for exactly this shape of problem:
`computeReadinessInterventionOptions` (Act 5), which builds its option
list purely from whatever gaps are actually present in that playthrough
rather than a fixed static list. EV-10 (or whichever event ends up
carrying this) needs the equivalent: a generated option per package the
player flagged `potentialLever` in Act 3, letting the player pick which
one actually gets reduced now. That actual reduction needs **its own
separate state** — provisionally `actuallyReduced_<taskId>` (naming TBD
at implementation time, but semantically distinct from
`cbsClassification_<taskId>` the same way Act 3 intent and Act 4 action
are distinct) — which is what the five previously-scoped downstream
consequence hooks (EV-02 for HVAC/cleanroom, EV-05 + Act 5 readiness for
isolator, Act 5 readiness + Audit Trail for IQ/OQ and VMF, Act 5
readiness for training and utilities) should actually read, once built.
None of those hooks should ever read `cbsClassification_*` directly —
classifying something as a lever and it actually being cut are different
facts, and conflating them would recreate the exact semantic mistake
this whole rework exists to fix.

---

## Budget reconciliation — Gate 3 financial subscore + HUD + Act 6

**Status:** Implemented (`computeBudgetReconciliation` in
`lib/nova/state.ts`, `evaluateDeliveryComposite` in `lib/nova/endings.ts`,
`HUD.tsx`, `DIALOGUE_ACT6_SCENE03`). Direct follow-on from the CBS
classification rework above — this is the reason that rework had to
happen first: Act 3's CBS is what fixes `referenceBaselineCost`, and
nothing here could be named or scored honestly until that number meant
one specific, stable thing.

**The problem:** Gate 3 (`evaluateDeliveryComposite`, the Triumphant vs.
Pyrrhic decision) scored a `budgetRemainingPct` subscore as
`budgetRemaining / STARTING_BUDGET * 100` — percent of the full £12.0M
approved figure remaining. That understates exposure: a player who has
spent exactly the £4.0M contingency (the actual amount of slack the
project ever had) still shows `budgetRemaining` at £8.0M, i.e. "66% of
budget remaining" — reads as comfortably healthy when the true position
is "0% of contingency left." The same flawed percentage also drove the
HUD's Budget chip.

**The fix — one new pure function, no schema changes:**
`computeBudgetReconciliation(state)` in `lib/nova/state.ts` returns
`{approvedBudget, referenceBaselineCost, originalContingency,
additionalSpend, forecastCostAgainstBaseline, headroom}`, all derived
fresh from `projectMetrics.budgetRemaining` and
`TOOL_ACT3_SCENE02_CBS`'s own fixed `totalIfAllIncluded` — no new
`GameState` field stores any of it, same pattern as
`reportMismatchFlags`/`effectiveDialogueFlags`. `referenceBaselineCost`
is read from the CBS tool's data rather than hardcoded a second time, so
there's exactly one place the £8.0M figure lives. `headroom` is
algebraically `budgetRemaining − referenceBaselineCost` — same
information as the old `budgetRemainingPct`, but measured against the
£4.0M contingency that's actually at risk rather than the full £12.0M
approved figure.

**Gate 3:** `budgetRemainingPct` replaced with `financialSubscore =
headroom / originalContingency * 100` (clamped 0–100 for scoring, same
treatment every other subscore already got). `benefitsRealisationScore`
was removed from the composite entirely, not just re-weighted — see the
`weightsNote` in `data/endings.json` for why (folding an unfinished
benefits system into the ending's delivery composite was scoring
something the game doesn't actually measure yet). Its former 0.15 weight
was redistributed evenly across the remaining five dimensions (+0.03
each) — a provisional, simple choice, recalibrate after playtesting like
every other number in that file. The Pyrrhic financial/scrutiny variant
comparison (`budgetPct <= goodwill`) was updated to
`financialSubscore <= goodwill` for consistency.

**HUD:** the Budget chip now shows `headroom / originalContingency * 100`
(unclamped, so a genuine overspend past contingency reads visibly
negative rather than flattening at 0% — same treatment Delivery Pace's
own +/- delta already gets). Also fixed a duplicated-constant bug found
in passing: `HUD.tsx` had its own hardcoded `STARTING_BUDGET =
12_000_000` rather than importing the one already exported from
`state.ts` — a second source of truth for the same number, now removed.
The full breakdown (baseline/additional spend/forecast/approved/
headroom, all formatted currency) is available on demand — tap the
Budget chip to toggle it — rather than shown permanently, per the
"available on demand rather than permanent" framing this was scoped
under; it doesn't compete with the existing sequential tutorial popover
(guarded to never show both at once).

**Act 6:** a new, unconditional line in `DIALOGUE_ACT6_SCENE03`
("Final cost: {forecastCostFormatted} against the
{approvedBudgetFormatted} approved — {costPerformanceLabel}"),
positioned immediately after — but deliberately NOT merged into or
offered as evidence for — the existing "£12M Investment Justified — not
yet demonstrable" ROI line. Cost performance (did the project land
inside its approved budget) and investment justification (did the spend
actually deliver value) are different questions; the ROI line stays
exactly as honestly unresolved as it already was. Template values come
from a new `budgetReconciliationTemplateValues(state)` in `state.ts`,
wired into `GameRoot.tsx`'s existing `templateValues` object the same
way `{currentWeek}` already is.

**Verification:** `tsc --noEmit`/`eslint .` both clean.
`next build` itself fails in this sandbox on Google Fonts network
access — unrelated to this change, same failure predates it.

## Benefits system rework — retire the score, split the Register into its own artefact

**Status:** built and verified.

**Investigation, before any design:** traced every touch of
`benefitsRealisationScore` (started at 0, exactly two negative-only
effects across the whole game — `CHOICE_BIG-01`'s "phase Product B
quietly" option and `CHOICE_EV-NP2`'s "delay Product B" option — no
upward path anywhere), the Act 3 Benefits Register tool
(`TOOL_ACT3_SCENE06_BENEFITS`, `proof_chain_builder` type: Measure/
Evidence/Owner/When tension moments for three benefits, purely
pedagogical, `wrongPlacementBehavior.penalty: "none"`, zero scoring
impact), the Act 6 readout (its three checkmarks were computed entirely
from Gate 1/Gate 2 results, never from the Register or the score), and
the dead `second_product_benefits_undefined` flag (rendered in HUD,
documented as a TODO in the tool's own `note` field, never actually
set). Also found the tool's `note` field had flagged two never-applied
follow-up patches — set the flag on BIG-01 completion, and patch Act 6's
world-memory reel to show the Register's real status — both resolved by
this pass.

**Decision 1 — retire the score entirely, no replacement metric.**
`benefitsRealisationScore` had no upward path, so it could only ever
drag things down, never reward good benefits management — keeping it
(even re-weighted) would still be scoring something honest play can't
improve. Removed from `ProjectMetrics` (types.ts), the default
`projectMetrics` in `game_state.json`, both choices' effects (replaced
by the flag below), the Gate 3 composite (see the budget-reconciliation
entry above — done in the same pass), the HUD's Benefits chip and its
`METRIC_HELP` entry and doc comment, `DevPlaytestNav.tsx`'s debug line,
and every stale `"Benefits Realisation Score"` reference in
`events.json`/`scenes.json` design-doc metadata. No numeric or status
chip replaces it on the HUD — the Register artefact + Act 6 review
(below) carry that job instead, more honestly than a live percentage
ever did.

**Decision 2 — Register completion defines assessment criteria, never
causes outcomes.** Completing the Act 3 tool still doesn't touch any
score (unchanged: `wrongPlacementBehavior.penalty: "none"`). What it now
does is flip the Benefits Register artefact from "incomplete" to
"complete" — a document-status change, not a game-state effect.

**Decision 3 — split the Benefits Register out of the PID into its own
artefact.** The PID's `incomplete`/`complete` captions used to describe
Ellis's unfinished "Benefits Plan" going to sign-off — the exact same
in-fiction document the Act 3 Benefits Register tool teaches. Two
different systems (project purpose/scope/stakeholders vs. benefits
measurement) were sharing one artefact identity. Resolved by:
- `lib/nova/artefacts.ts`: PID's captions reworded to drop all
  Benefits Plan/Tracker language, re-anchored to the cost baseline going
  to sign-off instead (`"Updated once the cost baseline went to sign-off
  in Act 3"`); its own `benefitsRegister` entry added, images
  `benefits_register_{incomplete,complete}.png`.
- `GameRoot.tsx`'s `enterScene`: reveals `benefitsRegister` as
  "incomplete" on entering `ACT1_SCENE05` ("The Missing Appendices" —
  the scene where the player finds Ellis's draft, in-fiction named
  `Benefits_Plan_DRAFT_v3` in that scene's own dialogue). This scene is
  pure narration with no investigation-panel structure to hang a
  `revealsArtefactId` off of (unlike `q_drive_pid` in
  `risk_investigation.json`), so the reveal is wired as an inline check
  in `enterScene` instead — the one place a scene transition is
  guaranteed to run exactly once on entry.
- `GameRoot.tsx`'s `handleSubmitTool`: the PID's completion trigger
  moved from `TOOL_ACT3_SCENE06_BENEFITS` (Benefits Register tool) to
  `TOOL_ACT3_SCENE02_CBS` (cost baseline sign-off) — matching its new
  captions. A second, new trigger completes `benefitsRegister` on
  `TOOL_ACT3_SCENE06_BENEFITS` submission, same as the PID used to.

**Decision 4 — Act 6's Benefits Review rebuilt to reuse the Register's
own Measure/Evidence structure, with honest per-benefit statuses.**
`DIALOGUE_ACT6_SCENE03`'s three benefit lines rewritten:
- NHS Contract Secured: unchanged mechanism (`contract_secured`/
  `contract_lost` from `endingConditionFlags`, Gate 1's own result),
  reworded to explicitly say "realised"/"not realised."
- More Patients Treated: **softened from a clean ✓/✗.** A released
  batch (`batch_released`) only proves manufacturing capability, not
  that a patient has actually been treated — so this now reads "⚠
  ENABLED — measurement continues post-launch," naming the real
  measure (monthly production output) nobody in the room has seen yet.
  Only `batch_rejected` (no batch, no capability, nothing to measure)
  reads a clean "✗ NOT YET ENABLED."
- £12M Investment Justified: still always renders unconditionally
  (the game's timeline never reaches the 12-month measurement point,
  same as before) — but now pulls `{roiMeasure}`/`{roiEvidence}`/
  `{roiWhen}` from a new `benefitsRegisterTemplateValues(state)` in
  `state.ts`, a pure read of `TOOL_ACT3_SCENE06_BENEFITS`'s own
  `correctMeasure`/`correctEvidence`/`correctWhen` fields for the ROI
  benefit — so this line can never drift out of sync with what the Act
  3 tool actually asked the player to prove.
- New optional line, gated on the real (non-synthetic)
  `second_product_benefits_undefined` flag: only set when
  `CHOICE_BIG-01`'s "phase Product B quietly" option is chosen — the
  only one of its three options that genuinely leaves Product B's
  benefits undefined, matching the game's own existing
  `computeScopeDimension` judgment (verified by reading all three
  options' actual effects before setting the flag).

**Verification:** `tsc --noEmit`/`eslint .` clean. Scripted checks:
`benefitsRegisterTemplateValues` values match the tool's own
`correctMeasure`/`correctEvidence`/`correctWhen` exactly; artefact
reveal → CBS-submit → Benefits-submit sequence produces
`{benefitsRegister: "complete", pid: "complete"}` as expected;
`second_product_benefits_undefined` sets/reads correctly; strong and
weak archetype `GameState`s both produce mutually-exclusive
`contract_secured`/`contract_lost` and `batch_released`/`batch_rejected`
pairs via `endingConditionFlags`.

**Artefact art:** no image-generation tool was available this session.
`scripts/gen_benefits_register.py` (Python/PIL) approximates the
existing PID art's style — torn-paper card on black for incomplete,
clean straight edges for complete, same AstraZeneca wordmark colours,
black serif headers — but this is a scripted approximation, not a
hand-tuned illustration pass like the PID's (which saw several manual
v2→v3→v4 iterations per its own doc comment). Lower fidelity by design;
revisit with a proper illustration pass if this artefact earns one.
