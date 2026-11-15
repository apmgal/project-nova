"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import InspectionFilm from "@/components/nova/act5/InspectionFilm";
import type { GameState } from "@/lib/nova/types";
import { applyDecisions, loadGame, newGameState } from "@/lib/nova/state";
import { READINESS_RECOMMENDATION, READINESS_RECOMMENDATION_KEY, type ReadinessRecommendationId } from "@/lib/nova/act5Recovery";
import { INSP, getRecommendation } from "@/lib/nova/inspection";
import { buildDetermination } from "@/lib/nova/finale";
import { CONDITIONAL_FILM, NOT_SATISFACTORY_FILM, SATISFACTORY_FILM, epilogueFilmFor, type EpilogueFilm } from "@/lib/nova/epilogueFilm";

/**
 * PROTOTYPE preview — /prototype/inspection-film. Plays the SAME component the game now uses as its final
 * chapter (components/nova/act5/InspectionFilm.tsx), on a working copy of the save. "The Morning of the Inspection" → Whitfield's
 * inspection (opening exchange, dossier rounds, neutral close) → "No News" (three weeks later) → the
 * Final Determination → that outcome's epilogue film ("Not satisfactory", "Subject to conditions" or
 * "Satisfactory"; FailedInspectionEpilogue + lib/nova/epilogueFilm.ts) → the five-page Decision Analysis.
 *
 * Reads the real save (localStorage) READ-ONLY: the inspection runs on a working copy kept under its own
 * key, so playing the prototype never alters the actual playthrough, and a refresh resumes the inspection
 * where it was. With no saved recommendation, pick one to preview (applied to the working copy only).
 * ?t=5.5 freezes the film at that moment. ?epi=40 plays the epilogue from 40 s in (review aid; the film
 * follows the working copy's determination, or the save's; &film=unsatisfactory | conditional | satisfactory forces one). ?analysis opens the Decision Analysis directly.
 */
const WORKING_KEY = "projectNova.inspectionPrototype.v1";

function readWorking(): GameState | null {
  try {
    const raw = window.localStorage.getItem(WORKING_KEY);
    return raw ? (JSON.parse(raw) as GameState) : null;
  } catch { return null; }
}
function writeWorking(s: GameState | null) {
  try {
    if (s) window.localStorage.setItem(WORKING_KEY, JSON.stringify(s));
    else window.localStorage.removeItem(WORKING_KEY);
  } catch { /* storage unavailable: no resume, otherwise fine */ }
}

function FilmPreview() {
  const save = useMemo(() => loadGame(), []);
  const savedRec = save ? getRecommendation(save) : null;
  const [working, setWorking] = useState<GameState | null>(() => readWorking());
  const [rec, setRec] = useState<ReadinessRecommendationId>(savedRec ?? "proceed_conditionally");
  // Review aids: ?epi=N (epilogue from N s; &film= forces one), ?analysis, ?t=N (freeze the opening film).
  const [review] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.has("t")) return { holdAt: Number(q.get("t")), phase: "film" as const };
    if (q.has("epi")) {
      const forced = q.get("film");
      const s = readWorking() ?? save;
      const film: EpilogueFilm =
        forced === "conditional" ? CONDITIONAL_FILM
        : forced === "unsatisfactory" ? NOT_SATISFACTORY_FILM
        : forced === "satisfactory" ? SATISFACTORY_FILM
        : s ? epilogueFilmFor(buildDetermination(s).kind) : NOT_SATISFACTORY_FILM;
      return { epilogueAt: Number(q.get("epi")) || 0, film, phase: "epilogue" as const };
    }
    if (q.has("analysis")) return { phase: "analysis" as const };
    return undefined;
  });
  const [playing, setPlaying] = useState(review !== undefined);
  const [run, setRun] = useState(0);
  const [muted, setMuted] = useState(false);

  const update = (s: GameState) => { setWorking(s); writeWorking(s); };
  const begin = () => {
    const base = save ?? newGameState();
    const withRec = savedRec ? base : applyDecisions(base, { [READINESS_RECOMMENDATION_KEY]: rec });
    update(withRec);
    setRun((n) => n + 1);
    setPlaying(true);
  };
  const restart = () => { writeWorking(null); setWorking(null); setPlaying(false); };
  const resumable = working && working.decisions?.[INSP.intro];

  if (!playing) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-black px-4 text-center text-zinc-200">
        <div className="max-w-md">
          <p className="mb-4 text-xs text-zinc-500">
            {save ? `Using your saved game (scene ${save.currentScene}) — read-only.` : "No saved game found: documents the project never produced will show as unavailable."}
          </p>
          {savedRec ? (
            <p className="mb-6 text-xs text-zinc-400">
              Saved readiness recommendation: {READINESS_RECOMMENDATION.options.find((o) => o.id === savedRec)?.letter} ·{" "}
              {READINESS_RECOMMENDATION.options.find((o) => o.id === savedRec)?.title}
            </p>
          ) : (
            <>
              <p className="mb-3 text-xs uppercase tracking-widest text-zinc-500">No saved recommendation — preview as</p>
              <div className="mb-6 flex flex-wrap justify-center gap-2">
                {READINESS_RECOMMENDATION.options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setRec(o.id)}
                    className={`rounded-md border px-3 py-1.5 text-xs ${rec === o.id ? "border-[#B5C474] text-[#B5C474]" : "border-white/15 text-zinc-400 hover:bg-white/5"}`}
                  >
                    {o.letter} · {o.title}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="flex flex-col items-center gap-2">
            <button type="button" onClick={begin} className="rounded-md border border-white/20 px-5 py-2.5 text-sm hover:bg-white/10">
              Play — The Morning of the Inspection
            </button>
            {resumable && (
              <button
                type="button"
                onClick={() => { setRun((n) => n + 1); setPlaying(true); }}
                className="text-xs text-zinc-400 underline-offset-4 hover:underline"
              >
                Resume the inspection where you left it
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <InspectionFilm
      key={run}
      state={working ?? save ?? newGameState()}
      onChange={update}
      muted={muted}
      onToggleMute={() => setMuted((m) => !m)}
      onExit={restart}
      review={run === 0 ? review : undefined}
    />
  );
}

export default dynamic(() => Promise.resolve(FilmPreview), { ssr: false });
