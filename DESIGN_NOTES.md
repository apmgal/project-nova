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
