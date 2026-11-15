"use client";

import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import MorningFilm from "@/components/nova/act5/morning/MorningFilm";
import WhitfieldOpening from "@/components/nova/act5/morning/WhitfieldOpening";
import InspectionSequence from "@/components/nova/act5/inspection/InspectionSequence";
import NoNewsSequence from "@/components/nova/act5/finale/NoNewsSequence";
import FinalDetermination from "@/components/nova/act5/finale/FinalDetermination";
import FailedInspectionEpilogue from "@/components/nova/act5/finale/FailedInspectionEpilogue";
import DecisionAnalysisPaged from "@/components/nova/analysis/DecisionAnalysisPaged";
import type { GameState } from "@/lib/nova/types";
import { applyDecisions } from "@/lib/nova/state";
import { FINALE, buildDetermination, determinationViewed, type DeterminationKind } from "@/lib/nova/finale";
import { INSP, getRecommendation } from "@/lib/nova/inspection";
import { epilogueFilmFor, type EpilogueFilm } from "@/lib/nova/epilogueFilm";
import { FILM_KEYS, filmPhase, type FilmPhase } from "@/lib/nova/inspectionFilm";

/**
 * The Inspection Film — the game's final chapter, and the same component the /prototype/inspection-film
 * preview plays (one implementation, two hosts).
 *
 *   The Morning of the Inspection (MorningFilm) → Whitfield's opening (WhitfieldOpening) → the inspection
 *   (InspectionSequence) → "Three weeks later" / No News (NoNewsSequence) → the Final Determination
 *   (FinalDetermination) → the outcome's epilogue (FailedInspectionEpilogue + lib/nova/epilogueFilm.ts:
 *   Not Satisfactory / Subject to Conditions / Satisfactory) → the five-page Decision Analysis
 *   (DecisionAnalysisPaged) → onExit (Back to Title).
 *
 * Everything is read from, and written to, the GameState it is given: every step hands the updated state to
 * onChange (the host saves it), so Continue Mission or a refresh resumes at the latest checkpoint (filmPhase).
 * Nothing here ever clears progress. The outcome is
 * buildDetermination(state) — the existing quality gate on the player's real metrics and reports, after the
 * inspection's one-time adjustment — never chosen here.
 */
export default function InspectionFilm({
  state,
  onChange,
  muted,
  onToggleMute,
  onExit,
  review,
}: {
  state: GameState;
  /** Every change of progress, to be saved by the host. */
  onChange: (next: GameState) => void;
  muted: boolean;
  /** Shows the sound toggle (top right) when given. */
  onToggleMute?: () => void;
  /** Back to Title, from the last page of the Decision Analysis. */
  onExit: () => void;
  /** Review aids for the prototype route only: freeze the opening film, start the epilogue part-way or
   *  with a given film, or open a given phase. Never used by the game. */
  review?: { holdAt?: number; epilogueAt?: number; film?: EpilogueFilm; phase?: FilmPhase };
}) {
  const [phase, setPhase] = useState<FilmPhase>(() => review?.phase ?? filmPhase(state));
  // Reopened after a refresh (or from the save): the report shows as already read.
  const [reportRevealed, setReportRevealed] = useState(() => (review?.phase ?? filmPhase(state)) === "report");
  // The outcome recorded when the report was first opened (FILM_KEYS.outcome), so the ending and every resume
  // use the same one; computed from the save only if it was never recorded (e.g. a save from before this key).
  const outcomeOf = (s: GameState): DeterminationKind => {
    const saved = s.decisions?.[FILM_KEYS.outcome];
    return saved === "unsatisfactory" || saved === "conditional" || saved === "satisfactory" ? saved : buildDetermination(s).kind;
  };
  const [film, setFilm] = useState<EpilogueFilm>(() => review?.film ?? epilogueFilmFor(outcomeOf(state)));

  const set = (values: Record<string, string>) => onChange(applyDecisions(state, values));

  return (
    <>
      {phase === "film" && (
        <MorningFilm muted={muted} holdAt={review?.holdAt} onComplete={() => { set({ [FILM_KEYS.morningDone]: "1" }); setPhase("opening"); }} />
      )}
      {phase === "opening" && (
        <WhitfieldOpening
          recommendation={getRecommendation(state)}
          muted={muted}
          onComplete={() => { set({ [INSP.intro]: "1" }); setPhase("inspection"); }}
        />
      )}
      {phase === "inspection" && (
        <InspectionSequence state={state} muted={muted} onChange={onChange} onComplete={(final) => { onChange(final); setPhase("finale"); }} />
      )}
      {phase === "finale" && (
        <NoNewsSequence
          state={state}
          muted={muted}
          onChange={onChange}
          onOpenReport={() => {
            set({ [FINALE.opened]: "1", [FILM_KEYS.outcome]: outcomeOf(state) });
            setReportRevealed(false);
            setPhase("report");
          }}
        />
      )}
      {phase === "report" && (
        <FinalDetermination
          state={state}
          muted={muted}
          resumed={reportRevealed}
          viewed={determinationViewed(state)}
          onView={() => set({ [FINALE.viewed]: "1" })}
          // Each determination plays its own epilogue (the outcome the report has just shown).
          onContinue={() => {
            setFilm(review?.film ?? epilogueFilmFor(outcomeOf(state)));
            set({ [FILM_KEYS.continued]: "1" });
            setPhase("epilogue");
          }}
        />
      )}
      {phase === "epilogue" && (
        <FailedInspectionEpilogue
          key={film.id}
          film={film}
          muted={muted}
          startAt={review?.epilogueAt}
          onComplete={() => { set({ [FILM_KEYS.epilogueDone]: "1" }); setPhase("analysis"); }}
        />
      )}
      {phase === "analysis" && (
        // Straight into the Decision Analysis — the epilogue's closing card is the only completion screen.
        <div className="fixed inset-0 z-[60] flex flex-col bg-[#0a0e16] animate-[analysisIn_900ms_ease-out]">
          <DecisionAnalysisPaged gameState={state} onRestart={onExit} />
          <style>{`@keyframes analysisIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
        </div>
      )}
      {onToggleMute && review?.holdAt === undefined && phase !== "analysis" && (
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? "Unmute sound" : "Mute sound"}
          className="fixed right-4 top-4 z-[70] grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/30 text-zinc-300/80 backdrop-blur-md transition hover:bg-black/50 hover:text-white"
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      )}
    </>
  );
}
