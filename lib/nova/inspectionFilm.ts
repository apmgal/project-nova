/**
 * The Inspection Film as the game's final chapter.
 *
 * In the live game the story now runs: … Act 4 → facility investigation (warehouse interlude) → Act 5 Recovery
 * Meeting → readiness recommendation → THE INSPECTION FILM (this) → Decision Analysis → title. The film replaces
 * the original ACT5_SCENE01 … ACT6_SCENE03 storyline, which is archived in archive/legacy-act5-act6/ (its data
 * and code are still in the repository, simply no longer reachable — see that README to restore it).
 *
 * The film is one scene id in the save (INSPECTION_FILM_SCENE_ID). Its progress lives in GameState.decisions,
 * exactly as in the prototype (INSP.* for the inspection, FINALE.* for "No News" and the report), plus two
 * keys of its own for the end: the player pressed Continue on the report (the epilogue plays) and the epilogue
 * finished (the Decision Analysis). filmPhase() derives where a resumed save lands from those keys.
 */
import type { GameState } from "./types";
import { INSP, INSPECTION_SCORED_FLAG, currentStep, getRecommendation } from "./inspection";
import { FINALE, reportOpened } from "./finale";

import { INSPECTION_FILM_SCENE_ID } from "./data";
export { INSPECTION_FILM_SCENE_ID };

/** The scenes of the original Act 5–6 storyline (archived). None is part of the active build any more. */
export const LEGACY_ACT5_ACT6_SCENE_IDS = [
  "ACT5_SCENE01",
  "ACT5_SCENE02",
  "ACT5_SCENE03",
  "ACT5_SCENE04",
  "ACT6_SCENE01",
  "ACT6_SCENE02",
  "ACT6_SCENE03",
] as const;
export const isLegacyAct5Act6Scene = (id: string | null | undefined) =>
  !!id && (LEGACY_ACT5_ACT6_SCENE_IDS as readonly string[]).includes(id);

/** Where the Act 4 → Act 5 transition points in the data (ACT4_SCENE06 / ACT5_SCENE00_RECOVERY nextScenes).
 *  Kept as the hand-off id so the scene data stays untouched: leaving Act 4 it opens the facility
 *  investigation, leaving the Recovery Meeting it opens the film. */
export const LEGACY_ACT5_ENTRY_SCENE_ID = "ACT5_SCENE01";

/**
 * The film's own save keys (GameState.decisions), alongside INSP.* (the inspection: answers, evidence presented,
 * the close) and FINALE.* (No News phase and messages, report opened, determination viewed). Together they are
 * the whole of the film's progress; filmPhase() reconstructs where the player is from them.
 */
export const FILM_KEYS = {
  /** The inspection session for this playthrough has begun (set the first time the player enters the film). */
  session: "film_session",
  /** "The Morning of the Inspection" has played — a resume goes to Whitfield's opening, not the film again. */
  morningDone: "film_morning_done",
  /** The determination as first shown in the report ("unsatisfactory" | "conditional" | "satisfactory"),
   *  recorded once so the ending and every resume use the same outcome. */
  outcome: "film_outcome",
  /** "Continue" pressed on the Final Determination report — the outcome's epilogue plays. */
  continued: "film_report_continued",
  /** The epilogue's "Review Your Decisions" — the Decision Analysis from now on. */
  epilogueDone: "film_epilogue_done",
} as const;

export type FilmPhase = "film" | "opening" | "inspection" | "finale" | "report" | "epilogue" | "analysis";

/** Where the film resumes for this save — the latest checkpoint the player reached:
 *  the morning film → Whitfield's opening → the inspection (to the exact question) → No News (to its phase)
 *  → the report → the ending → the Decision Analysis. A cinematic interrupted part-way replays from its start. */
export function filmPhase(state: GameState): FilmPhase {
  const d = state.decisions ?? {};
  if (d[FILM_KEYS.epilogueDone]) return "analysis";
  if (d[FILM_KEYS.continued]) return "epilogue";
  if (!d[INSP.intro]) return d[FILM_KEYS.morningDone] ? "opening" : "film";
  if (currentStep(state) !== "done") return "inspection";
  if (reportOpened(state)) return "report";
  return "finale";
}


const LEGACY_SAVE_BACKUP_KEY = "projectNova.saveGame.legacyAct5Act6Backup.v1";

/**
 * Older saves can sit inside the archived Act 5–6 storyline. They are moved onto the active path without
 * touching anything else in the save: to the Inspection Film when the readiness recommendation (which the film
 * opens from) is already recorded, otherwise back to the Recovery Meeting, which records it first. Returns null
 * when the save needs nothing.
 */
export function migrateLegacyAct5Act6Save(state: GameState): GameState | null {
  if (!isLegacyAct5Act6Scene(state.currentScene)) return null;
  return { ...state, currentScene: getRecommendation(state) ? INSPECTION_FILM_SCENE_ID : "ACT5_SCENE00_RECOVERY" };
}

/** Keeps a copy of a save exactly as it was before migrateLegacyAct5Act6Save moved it (once; never overwritten),
 *  so a restored Act 5–6 build can pick it up again — see archive/legacy-act5-act6/README.md. */
export function backupLegacyAct5Act6Save(state: GameState): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(LEGACY_SAVE_BACKUP_KEY) === null) {
      window.localStorage.setItem(LEGACY_SAVE_BACKUP_KEY, JSON.stringify(state));
    }
  } catch { /* storage unavailable: the migration still works, without the copy */ }
}

/** True when this save already holds inspection-film progress for the current playthrough. */
export function hasInspectionFilmProgress(state: GameState): boolean {
  const keys = new Set<string>([...Object.values(INSP), ...Object.values(FINALE), ...Object.values(FILM_KEYS)]);
  return Object.keys(state.decisions ?? {}).some((k) => keys.has(k));
}

/** Marks the start of the inspection session the first time the player enters the film; a save that already
 *  has a session (or any progress) is returned unchanged — it is resumed, never re-initialised. */
export function beginInspectionSession(state: GameState): GameState {
  if (hasInspectionFilmProgress(state)) return state;
  return { ...state, decisions: { ...state.decisions, [FILM_KEYS.session]: "1" } };
}

/**
 * Clears the film's progress. ONLY for a deliberate reset — a developer act jump that moves the story back
 * before the film (GameRoot's handleDevJumpToScene). Never called on resume, on Continue Mission, on mounting a
 * screen or on choosing a readiness recommendation. (A new game starts from newGameState, which has none.)
 * Only the film's own keys are removed — nothing else in the save.
 */
export function clearInspectionFilmProgress(state: GameState): GameState {
  const filmKeys = new Set<string>([...Object.values(INSP), ...Object.values(FINALE), ...Object.values(FILM_KEYS)]);
  const decisions = Object.fromEntries(Object.entries(state.decisions ?? {}).filter(([k]) => !filmKeys.has(k)));
  return { ...state, decisions, flags: { ...state.flags, [INSPECTION_SCORED_FLAG]: false } };
}
