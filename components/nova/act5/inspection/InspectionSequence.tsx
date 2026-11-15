"use client";

import { useEffect, useRef, useState } from "react";
import type { GameState } from "@/lib/nova/types";
import { applyDecisions } from "@/lib/nova/state";
import {
  INSP,
  LINES,
  applyInspectionOutcome,
  buildInspectionDossier,
  currentStep,
  questionFor,
  type InspectionDocId,
} from "@/lib/nova/inspection";
import { MORNING_FILM_ASSETS } from "@/lib/nova/morningFilm";
import InspectionDossier, { type DossierLine } from "./InspectionDossier";

/**
 * Whitfield's inspection, Scene 2–3 (after WhitfieldOpening's Scene 1 exchange): two evidence rounds and
 * the neutral close, all inside the Inspection Dossier. Every step is recorded in GameState.decisions
 * (lib/nova/inspection.ts → INSP) the moment it happens and handed to onChange, so a refresh resumes on
 * the same step with the same evidence and answers. The hidden outcome is applied once, at the close.
 */
export default function InspectionSequence({
  state,
  muted,
  onChange,
  onComplete,
}: {
  state: GameState;
  muted: boolean;
  onChange: (next: GameState) => void;
  onComplete: (final: GameState) => void;
}) {
  const step = currentStep(state);
  const documents = buildInspectionDossier(state);
  const question = questionFor(state, step);
  const d = state.decisions ?? {};
  const [selected, setSelected] = useState<InspectionDocId | null>((d[INSP.selected] as InspectionDocId) ?? "readiness");
  const [chosen, setChosen] = useState<string | null>(null);
  const [closingIndex, setClosingIndex] = useState(0);
  const [closingOut, setClosingOut] = useState(false);
  const [black, setBlack] = useState(false);
  const [pausing, setPausing] = useState(false);

  // --- sound: the sealed room, very faint; paper when a document is put on the table ----------------
  const mutedRef = useRef(muted);
  const audio = useRef<HTMLAudioElement[]>([]);
  useEffect(() => {
    mutedRef.current = muted;
    audio.current.forEach((a) => { a.muted = muted; });
  }, [muted]);
  useEffect(() => {
    let room: HTMLAudioElement | null = null;
    try {
      room = new Audio(MORNING_FILM_ASSETS.sounds.roomLoop);
      room.loop = true;
      room.volume = 0.55;
      room.muted = mutedRef.current;
      audio.current.push(room);
      room.play().catch(() => {});
    } catch { /* silent if unavailable */ }
    const all = audio.current;
    return () => { all.forEach((a) => a.pause()); audio.current = []; };
  }, []);
  const sfx = (src: string, volume: number) => {
    try {
      const a = new Audio(src);
      a.volume = volume;
      a.muted = mutedRef.current;
      audio.current.push(a);
      a.play().catch(() => {});
    } catch { /* silent */ }
  };

  // Already finished (e.g. resumed after the close): hand straight on.
  const handedOff = useRef(false);
  useEffect(() => {
    if (step === "done" && !handedOff.current) { handedOff.current = true; onComplete(state); }
  }, [step, state, onComplete]);

  const record = (values: Record<string, string>) => onChange(applyDecisions(state, values));
  const answerText = (key: string, s: Parameters<typeof questionFor>[1]) => {
    const raw = d[key];
    if (!raw) return null;
    const optionId = raw.split(":")[1];
    return questionFor(state, s)?.options.find((o) => o.id === optionId)?.text ?? null;
  };

  // --- what's on screen for each step -------------------------------------------------------------
  let line: DossierLine | null = null;
  let echo: string | null = null;
  const presenting = step === "r1_present" || step === "r2_present";
  if (step === "r1_present") line = { who: "whitfield", text: LINES.round1 };
  else if (step === "r2_present") {
    line = { who: "whitfield", text: LINES.round2 };
    echo = answerText(INSP.r1Rec, "r1_rec");
  } else if (question) {
    line = { who: "whitfield", text: question.text };
    if (step === "r1_rec") echo = answerText(INSP.r1Answer, "r1_answer");
    if (step === "r2_authority") echo = answerText(INSP.r2Answer, "r2_answer");
  } else if (step === "closing") {
    line = LINES.closing[closingIndex];
    if (closingIndex === 0) echo = answerText(INSP.r2Authority, "r2_authority");
  }
  const presentedId =
    step === "r1_answer" || step === "r1_rec" ? (d[INSP.r1Doc] as InspectionDocId) : step === "r2_answer" || step === "r2_authority" ? (d[INSP.r2Doc] as InspectionDocId) : null;

  const select = (id: InspectionDocId) => {
    if (closingOut) return;
    setSelected(id);
    if (d[INSP.selected] !== id) record({ [INSP.selected]: id });
  };
  const present = () => {
    if (!selected || !presenting) return;
    sfx(MORNING_FILM_ASSETS.sounds.paperSettle, 0.55); // the file is set down in front of Whitfield
    setChosen(null);
    record({ [step === "r1_present" ? INSP.r1Doc : INSP.r2Doc]: selected });
  };
  const respond = () => {
    if (!question || !chosen) return;
    const key = step === "r1_answer" ? INSP.r1Answer : step === "r1_rec" ? INSP.r1Rec : step === "r2_answer" ? INSP.r2Answer : INSP.r2Authority;
    setChosen(null);
    record({ [key]: `${question.id}:${chosen}` });
  };
  const continueClosing = () => {
    if (closingIndex < LINES.closing.length - 1) {
      const nextIndex = closingIndex + 1;
      setClosingIndex(nextIndex);
      // A short pause before the last line ("You'll receive the formal outcome in due course.").
      if (nextIndex === LINES.closing.length - 1) {
        setPausing(true);
        window.setTimeout(() => setPausing(false), 1100);
      }
      return;
    }
    // The last line: the outcome is applied (once — guarded by a flag) and saved before anything else,
    // then the dialogue goes, Whitfield closes the dossier, a held beat, and the fade to black.
    const final = applyDecisions(applyInspectionOutcome(state), { [INSP.closed]: "1" });
    handedOff.current = true; // the fade below hands off; don't let the "done" step short-circuit it
    onChange(final);
    setClosingOut(true);
    window.setTimeout(() => sfx(MORNING_FILM_ASSETS.sounds.paperSettle, 0.6), 500);
    // The dossier is put away, a held beat on the empty room, then black.
    window.setTimeout(() => setBlack(true), 3000);
    window.setTimeout(() => onComplete(final), 4300);
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black">
      {/* The inspection room, as the film left it — dark, so the dossier carries the scene. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={MORNING_FILM_ASSETS.images.room}
        alt=""
        className="pointer-events-none fixed inset-0 h-full w-full object-cover"
        style={{ opacity: closingOut ? 0.55 : 0.28, transition: "opacity 1400ms ease 600ms", objectPosition: "62% 50%", transform: "scale(1.135)", transformOrigin: "72% 50%" }}
      />
      <div className="relative flex min-h-full items-start justify-center px-4 py-8 transition-opacity duration-[900ms] sm:items-center" style={{ opacity: closingOut ? 0 : 1, transitionDelay: closingOut ? "700ms" : "0ms" }}>
        <InspectionDossier
          line={pausing ? null : line}
          echo={pausing ? null : echo}
          showLine={!closingOut && !pausing}
          documents={documents}
          selectedId={selected}
          onSelect={select}
          presentedId={presentedId}
          canPresent={presenting && !closingOut}
          onPresent={present}
          options={!closingOut && question ? question.options : null}
          chosenOption={chosen}
          onChooseOption={setChosen}
          onRespond={respond}
          onContinue={step === "closing" && !closingOut && !pausing ? continueClosing : null}
          dimmed={closingOut}
        />
      </div>
      <div className="pointer-events-none fixed inset-0 bg-black transition-opacity duration-1000" style={{ opacity: black ? 1 : 0 }} />
    </div>
  );
}
