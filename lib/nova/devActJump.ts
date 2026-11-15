// Developer-only act jumping for local playtesting (shown in DevPlaytestNav,
// which only renders when DEV_MODE — `next dev`, or a build with NEXT_PUBLIC_DEV_TOOLS=1).
// Jumping keeps the current GameState and only moves to an act's first
// scene. The real save is copied once, before the first jump, so it can be
// restored with "Restore save".
//
// To remove: delete this file and the onJumpToScene/onRestoreSave props
// (DevPlaytestNav.tsx) and their handlers (GameRoot.tsx, search "devActJump").

import { INSPECTION_FILM_SCENE_ID, isSceneAvailable } from "./data";
import { loadGame, saveGame } from "./state";

const ACT_START_SCENES = [
  { label: "Act 1", sceneId: "ACT1_SCENE01" },
  { label: "Act 2", sceneId: "ACT2_SCENE01" },
  { label: "Act 3", sceneId: "ACT3_SCENE01" },
  { label: "Act 4", sceneId: "ACT4_SCENE01" },
  // Act 5 still starts from the Act 4 → Act 5 hand-off id: GameRoot opens the
  // facility investigation, then the Recovery Meeting, then the film.
  { label: "Act 5", sceneId: "ACT5_SCENE01", always: true },
  // The final chapter (replaces the archived Act 6 jump).
  { label: "Inspection", sceneId: INSPECTION_FILM_SCENE_ID },
];

/** Only acts whose opening scene is part of this build. */
export function availableActJumps() {
  return ACT_START_SCENES.filter((a) => ("always" in a && a.always) || isSceneAvailable(a.sceneId));
}

const BACKUP_KEY = "projectNova.devJumpBackup.v1";

/** Copies the current save aside — only the first time, so the backup
 * always holds the save from before any jumping started. */
export function backupSaveBeforeFirstJump(): void {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(BACKUP_KEY)) return;
  const current = loadGame();
  if (current) window.localStorage.setItem(BACKUP_KEY, JSON.stringify(current));
}

export function hasDevJumpBackup(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(BACKUP_KEY) !== null;
}

/** Writes the pre-jump save back as the real save and clears the backup. */
export function restoreDevJumpBackup(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(BACKUP_KEY);
  if (!raw) return false;
  saveGame(JSON.parse(raw));
  window.localStorage.removeItem(BACKUP_KEY);
  return true;
}
