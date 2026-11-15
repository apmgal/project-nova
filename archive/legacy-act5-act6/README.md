# Archived: the original Act 5 Scene 01 – Act 6 storyline

**Status:** inactive and archived, but not deleted. In the live game, the **Inspection Film** has replaced this section as the final chapter.

Archived on 2026-11-15, when the Inspection Film was integrated into the main game.

Nothing in this storyline was deleted. Its scene data, dialogue and code are all still in the repository, unchanged. They are simply no longer reachable in the active build. This folder holds:

- a record of what the storyline was;
- the exact pre-integration versions of every file the integration changed;
- a patch that reverts the integration.

## 1. What was archived

| Scene | Title | Tool / screen |
|---|---|---|
| `ACT5_SCENE01` | Commissioning & Training (Final Readiness Review) | `TOOL_ACT5_SCENE01_READINESS`: ReadinessChecklist with two readiness interventions. Preceded by the InspectorArrival cinematic. |
| `ACT5_SCENE02` | Validation & Documentation Sweep | `TOOL_ACT5_SCENE02_AUDIT_TRAIL`: AuditTrailBuilder |
| `ACT5_SCENE03` | MHRA Inspection ("Final Boss") | `TOOL_ACT5_SCENE03_EVIDENCE_EXHIBIT`: InspectionEvidenceExhibit |
| `ACT5_SCENE04` | The Waiting | dialogue |
| `ACT6_SCENE01` | "Three Weeks Later" | dialogue |
| `ACT6_SCENE02` | The Control Room / Batch Result | dialogue (batch result from `evaluateQualityGate`) |
| `ACT6_SCENE03` | Personalised Ending + Ellis Grant Epilogue | dialogue (ending family from `evaluateEnding`), then ProjectReflectionEnding, the scrolling Decision Analysis |

None of these scenes has its own choices block in `data/choices.json` or its own Event Library wave.

### Contents of this folder

| Path | What it is |
|---|---|
| `data/legacy_scenes.json` | The 7 scene definitions, copied verbatim from `data/scenes.json` |
| `data/legacy_dialogue.json` | The 7 dialogue blocks (133 lines), copied verbatim from `data/dialogue.json` |
| `data/legacy_tool_screens.json` | The 3 tool screens, copied verbatim from `data/tool_screens.json` |
| `data/endings.json` | The ending configuration as it was. It is still active: the Final Determination uses its quality-gate thresholds. |
| `pre-integration/…` | The exact versions, before the integration, of every file the integration changed |
| `integration.patch` | Unified diff of those files, from pre-integration to integrated |

The copies under `data/` are a reference snapshot. The source of truth is still `data/*.json`, which was not edited.

## 2. Files affected by the integration

### Changed

- `components/nova/GameRoot.tsx`
  - Renders the Inspection Film for the scene `ACT5_INSPECTION_FILM`.
  - Redirects the Act 5–6 hand-off into the film.
  - The warehouse-interlude check now runs before the "is this scene built?" check. Its behaviour is unchanged.
  - Migrates old saves on Continue.
  - Back to Title from the film keeps the save.
- `lib/nova/data.ts`
  - The seven scenes above were removed from `BUILT_SCENE_OVERRIDES`.
  - Adds the synthesized `ACT5_INSPECTION_FILM` scene and `INSPECTION_FILM_SCENE_ID`.
- `lib/nova/devActJump.ts`: the dev-only "Act 6" jump became "Inspection". "Act 5" still opens the facility investigation.
- `app/prototype/inspection-film/page.tsx`: the prototype now plays the same `InspectionFilm` component as the game.
- `tsconfig.json`, `eslint.config.mjs`: `archive/` is excluded from type-checking and linting.

### Added

- `components/nova/act5/InspectionFilm.tsx`: the final chapter, one component used by both the game and the prototype.
- `lib/nova/inspectionFilm.ts`: the film's scene id, its resume logic, the list of legacy scene ids, and the save migration and backup.

### Not edited

These are still in place, but no longer reached by the active game:

- `data/scenes.json`, `data/dialogue.json`, `data/choices.json`, `data/tool_screens.json`, `data/endings.json`.
- `components/nova/act5/InspectorArrival.tsx`, `lib/nova/inspectorArrival.ts`, `components/nova/act5/arrivalScene.ts`.
- `components/nova/ReadinessChecklist.tsx`, `components/nova/AuditTrailBuilder.tsx`, `components/nova/InspectionEvidenceExhibit.tsx`.
- `components/nova/ProjectReflectionEnding.tsx` and the scrolling `components/nova/analysis/DecisionAnalysis.tsx`.
- `components/nova/act5/inspection/EndingHandoff.tsx`: the prototype's old hand-off, now unused.
- The Act 5–6 branches inside `GameRoot.tsx`:
  - the InspectorArrival intercept for `ACT5_SCENE01`;
  - the readiness, audit-trail and evidence-exhibit tool handlers;
  - the `story-complete` ending path after `ACT6_SCENE03`.

## 3. How the original Act 5–6 flow worked

1. Act 4 ends (`ACT4_SCENE06`, `nextScenes: ["ACT5_SCENE01"]`). GameRoot intercepts that transition and shows the **warehouse interlude** (facility investigation). Its Continue opens the **Recovery Meeting** (`ACT5_SCENE00_RECOVERY`):
   - recovery strategy;
   - Mike E.'s sponsor call;
   - the recovery montage;
   - the **readiness recommendation** (`act5_readiness_recommendation`).

   *This part is still active.*
2. The Recovery Meeting's `nextScenes` was `ACT5_SCENE01`, which opened like this:
   - **InspectorArrival** cinematic, played once and recorded by the flag `act5_inspector_arrival_seen`;
   - the Final Readiness Review dialogue;
   - **ReadinessChecklist**, with two intervention slots handled by `applyReadinessIntervention` in `lib/nova/state.ts`.
3. `ACT5_SCENE02`: **AuditTrailBuilder**, read by `computeAuditTrailEvidence`.
4. `ACT5_SCENE03`: the MHRA inspection dialogue and the **InspectionEvidenceExhibit**.
5. `ACT5_SCENE04` → `ACT6_SCENE01` → `ACT6_SCENE02` → `ACT6_SCENE03`: dialogue filtered by `endingConditionFlags`, using `evaluateEnding` and `evaluateQualityGate` in `lib/nova/endings.ts`.
6. Leaving `ACT6_SCENE03` (empty `nextScenes`) set `endInfo.reason = "story-complete"`, which showed **ProjectReflectionEnding** (the scrolling Decision Analysis). Its Restart cleared the save.

### Metric effects that existed only in this storyline

The readiness interventions in `ACT5_SCENE01` were the only metric changes inside the archived scenes. Each of the two slots gave:

- **closing a gap:** `regulatoryReadiness +15` and `scheduleHealth −5`;
- **moving on past an available gap:** `regulatoryReadiness −10`.

The Inspection Film does not run that review. Its determination reads the metrics as they stand after the Recovery Meeting, plus the inspection's own bounded adjustment (`applyInspectionOutcome`: readiness ±6, board confidence ±4). The quality-gate thresholds are unchanged:

- **Satisfactory:** readiness ≥ 70, risk ≤ 40, and no material report mismatch;
- **Subject to Conditions:** readiness ≥ 50 and no material mismatch.

## 4. Restoring the original Act 5–6 storyline

**Option A: revert the integration exactly.** From the repository root:

```bash
git apply -R archive/legacy-act5-act6/integration.patch
```

This restores the six changed files to their pre-integration state, which was checked byte for byte. The two added files (`components/nova/act5/InspectionFilm.tsx`, `lib/nova/inspectionFilm.ts`) and this archive can stay; nothing imports them once reverted. Or copy the files in `pre-integration/` back over their counterparts.

**Option B: keep the film, make the old scenes reachable again.**

1. Re-add the seven scene ids to `BUILT_SCENE_OVERRIDES` in `lib/nova/data.ts`.
2. In `GameRoot.tsx`'s `goToRealScene`, remove or condition the line that redirects legacy scene ids to `INSPECTION_FILM_SCENE_ID`.
3. Point the hand-off where you want it, for example by sending `ACT5_SCENE04` → `ACT6…` → the film.

The data needs no changes; it was never edited.

### Saves

- On Continue, a save whose `currentScene` is one of the seven archived scenes moves to:
  - the film, if the readiness recommendation is recorded;
  - otherwise the Recovery Meeting, which records it.

  Nothing else in the save changes.
- Before that move, the save is copied once, never overwritten, to `localStorage["projectNova.saveGame.legacyAct5Act6Backup.v1"]`. After restoring the storyline, copy that value back to `projectNova.saveGame.v1` to resume exactly where the player was.
- The film's progress keys are:
  - `insp_*`, `finale_*`, `film_report_continued`, `film_epilogue_done` in `decisions`;
  - the flag `inspection_scored`.

  The archived scenes ignore them.

## 5. Dependencies on shared code and state

These still serve the active game, so they stay where they are:

- `lib/nova/endings.ts`:
  - `evaluateQualityGate` decides the film's determination (`buildDetermination`).
  - `evaluateEnding` and `endingConditionFlags` are Act 6 only, but `endingConditionFlags` is still mixed into GameRoot's dialogue flags. That is harmless.
- `lib/nova/state.ts`:
  - `computeReadinessBoard`, `computeAuditTrailEvidence` and `findMostMaterialReportMismatch` also feed the film's inspection dossier and the Decision Analysis;
  - `applyReadinessIntervention` is legacy-only.
- `lib/nova/act5Recovery.ts`: the Recovery Meeting and readiness recommendation, which are active.
- `data/tool_screens.json`: `TOOL_ACT5_SCENE01_READINESS` is still read by the dossier, through `hasReachedToolScreen`, to show the commissioning criteria when a save contains that review.
- `GameState` fields used by both paths:
  - `projectMetrics`, `decisions`, `flags`, `statusReports`;
  - `choiceHistory`, `eventsResolved`, `toolProgress`.
