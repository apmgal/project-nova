"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import MorningFilm from "@/components/nova/act5/morning/MorningFilm";
import WhitfieldOpening from "@/components/nova/act5/morning/WhitfieldOpening";
import InspectionSequence from "@/components/nova/act5/inspection/InspectionSequence";
import EndingHandoff from "@/components/nova/act5/inspection/EndingHandoff";
import NoNewsSequence from "@/components/nova/act5/finale/NoNewsSequence";
import FinalDetermination from "@/components/nova/act5/finale/FinalDetermination";
import FailedInspectionEpilogue from "@/components/nova/act5/finale/FailedInspectionEpilogue";
import ProjectReflectionEnding from "@/components/nova/ProjectReflectionEnding";
import { FINALE, buildDetermination, determinationViewed, reportOpened } from "@/lib/nova/finale";
import type { GameState } from "@/lib/nova/types";
import { applyDecisions, loadGame, newGameState } from "@/lib/nova/state";
import { READINESS_RECOMMENDATION, READINESS_RECOMMENDATION_KEY, type ReadinessRecommendationId } from "@/lib/nova/act5Recovery";
import { INSP, currentStep, getRecommendation } from "@/lib/nova/inspection";
import { CONDITIONAL_FILM, NOT_SATISFACTORY_FILM, SATISFACTORY_FILM, epilogueFilmFor, type EpilogueFilm } from "@/lib/nova/epilogueFilm";

/**
 * PROTOTYPE preview — /prototype/inspection-film. "The Morning of the Inspection" → Whitfield's
 * inspection (opening exchange, dossier rounds, neutral close) → "No News" (three weeks later) → the
 * Final Determination → that outcome's epilogue film ("Not satisfactory", "Subject to conditions" or
 * "Satisfactory"; FailedInspectionEpilogue + lib/nova/epilogueFilm.ts) → Decision Analysis. Not part of the game yet.
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

type Phase = "start" | "film" | "opening" | "inspection" | "finale" | "report" | "epilogue" | "analysis" | "ending";

function FilmPreview() {
  const holdAt = useMemo(() => {
    const q = new URLSearchParams(window.location.search);
    return q.has("t") ? Number(q.get("t")) : undefined;
  }, []);
  const save = useMemo(() => loadGame(), []);
  const savedRec = save ? getRecommendation(save) : null;
  const [working, setWorking] = useState<GameState | null>(() => readWorking());
  const [rec, setRec] = useState<ReadinessRecommendationId>(savedRec ?? "proceed_conditionally");
  const epiAt = useMemo(() => {
    const q = new URLSearchParams(window.location.search);
    return q.has("epi") ? Number(q.get("epi")) || 0 : undefined;
  }, []);
  const [film, setFilm] = useState<EpilogueFilm>(() => {
    const forced = new URLSearchParams(window.location.search).get("film");
    if (forced === "conditional") return CONDITIONAL_FILM;
    if (forced === "unsatisfactory") return NOT_SATISFACTORY_FILM;
    if (forced === "satisfactory") return SATISFACTORY_FILM;
    const s = readWorking() ?? save;
    return s ? epilogueFilmFor(buildDetermination(s).kind) : NOT_SATISFACTORY_FILM;
  });
  const analysisOnly = useMemo(() => new URLSearchParams(window.location.search).has("analysis"), []);
  const [phase, setPhase] = useState<Phase>(holdAt !== undefined ? "film" : epiAt !== undefined ? "epilogue" : analysisOnly ? "analysis" : "start");
  const [run, setRun] = useState(0);
  const [muted, setMuted] = useState(false);
  const [reportRevealed, setReportRevealed] = useState(false);

  const update = (s: GameState) => { setWorking(s); writeWorking(s); };
  const begin = () => {
    const base = save ?? newGameState();
    const withRec = savedRec ? base : applyDecisions(base, { [READINESS_RECOMMENDATION_KEY]: rec });
    update(withRec);
    setRun((n) => n + 1);
    setPhase("film");
  };
  const restart = () => { writeWorking(null); setWorking(null); setPhase("start"); };
  const resumable = working && working.decisions?.[INSP.intro];

  if (phase === "start") {
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
                onClick={() => {
                  if (currentStep(working) !== "done") return setPhase("inspection");
                  // After the inspection: back into the finale — or, once the report was opened, to the report as read.
                  if (reportOpened(working)) { setReportRevealed(true); setPhase("report"); } else setPhase("finale");
                }}
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
    <>
      {phase === "film" && <MorningFilm key={run} muted={muted} holdAt={holdAt} onComplete={() => setPhase("opening")} />}
      {phase === "opening" && working && (
        <WhitfieldOpening
          key={run}
          recommendation={getRecommendation(working)}
          muted={muted}
          onComplete={() => { update(applyDecisions(working, { [INSP.intro]: "1" })); setPhase("inspection"); }}
        />
      )}
      {phase === "inspection" && working && (
        <InspectionSequence state={working} muted={muted} onChange={update} onComplete={(final) => { update(final); setPhase("finale"); }} />
      )}
      {phase === "finale" && working && (
        <NoNewsSequence
          state={working}
          muted={muted}
          onChange={update}
          onOpenReport={() => { update(applyDecisions(working, { [FINALE.opened]: "1" })); setReportRevealed(false); setPhase("report"); }}
        />
      )}
      {phase === "report" && working && (
        <FinalDetermination
          state={working}
          muted={muted}
          resumed={reportRevealed}
          viewed={determinationViewed(working)}
          onView={() => update(applyDecisions(working, { [FINALE.viewed]: "1" }))}
          // Each determination plays its own epilogue film (the outcome the report has just shown).
          onContinue={() => { setFilm(epilogueFilmFor(buildDetermination(working).kind)); setPhase("epilogue"); }}
        />
      )}
      {phase === "epilogue" && (
        <FailedInspectionEpilogue key={film.id} film={film} muted={muted} startAt={epiAt} onComplete={() => setPhase("analysis")} />
      )}
      {phase === "analysis" && (
        // Straight into the existing Decision Analysis — the epilogue's closing card is the only completion screen.
        <div className="fixed inset-0 z-[60] flex flex-col bg-[#0b0f16] animate-[analysisIn_900ms_ease-out]">
          <ProjectReflectionEnding gameState={working ?? save ?? newGameState()} onRestart={restart} />
          <style>{`@keyframes analysisIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
        </div>
      )}
      {phase === "ending" && working && <EndingHandoff state={working} onRestart={restart} />}
      {/* Preview-only stand-in for the game's sound setting. */}
      {holdAt === undefined && phase !== "ending" && phase !== "analysis" && (
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className="fixed right-4 top-[7vh] z-[70] rounded border border-white/15 bg-black/40 px-2.5 py-1 text-[11px] text-white/60 hover:text-white"
        >
          {muted ? "Sound off" : "Sound on"}
        </button>
      )}
    </>
  );
}

export default dynamic(() => Promise.resolve(FilmPreview), { ssr: false });
