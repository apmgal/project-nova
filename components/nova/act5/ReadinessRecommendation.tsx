"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarCheck, Check, Hourglass, ListChecks, Volume2, VolumeX, type LucideIcon } from "lucide-react";
import { READINESS_RECOMMENDATION, type ReadinessRecommendationId } from "@/lib/nova/act5Recovery";
import SceneAudio from "@/components/nova/narrative/SceneAudio";
import { ACT5_BEDS, playCue } from "@/lib/nova/act5Sound";

const BACKGROUND = "/assets/backgrounds/bg_facility_dusk.jpg";
const OLIVE = "#B5C474";

// Timeline (ms): black → facility fades in → question → options stagger in.
const T = { reveal: 500, question: 1800, subtitle: 2300, options: 2900, stagger: 180 };
// After a choice: hold the chosen panel, then fade to black and hand back to the story.
const CHOSEN_HOLD_MS = 1500;
const EXIT_FADE_MS = 900;

const ICONS: Record<ReadinessRecommendationId, LucideIcon> = {
  proceed: CalendarCheck,
  postpone: Hourglass,
  proceed_conditionally: ListChecks,
};

/**
 * Act 5 readiness recommendation: a cinematic decision screen between the Recovery Montage and
 * ACT5_SCENE01. The facility at dusk with a slow push-in, the question, then three selection panels.
 * The same three options for every player — nothing here reveals the recovery assessment. Choosing
 * highlights the panel, fades the others, fades to black and calls onChoose exactly once.
 */
export default function ReadinessRecommendation({
  muted,
  onToggleMute,
  onChoose,
}: {
  muted: boolean;
  onToggleMute: () => void;
  onChoose: (id: ReadinessRecommendationId) => void;
}) {
  const [step, setStep] = useState(0); // 0 black · 1 facility · 2 question · 3 subtitle · 4 options
  const [chosen, setChosen] = useState<ReadinessRecommendationId | null>(null);
  const [exiting, setExiting] = useState(false);
  const chooseRef = useRef(onChoose);
  useEffect(() => { chooseRef.current = onChoose; });
  const doneRef = useRef(false);

  useEffect(() => {
    const ids = [
      setTimeout(() => setStep(1), T.reveal),
      setTimeout(() => setStep(2), T.question),
      setTimeout(() => setStep(3), T.subtitle),
      setTimeout(() => setStep(4), T.options),
    ];
    return () => ids.forEach(clearTimeout);
  }, []);


  const choose = useCallback((id: ReadinessRecommendationId) => {
    if (chosen || step < 4) return;
    setChosen(id);
    playCue("recommendationChosen", muted); // restrained: a sheet set down — then the held beat
    setTimeout(() => setExiting(true), CHOSEN_HOLD_MS);
    setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      chooseRef.current(id);
    }, CHOSEN_HOLD_MS + EXIT_FADE_MS + 100);
  }, [chosen, step, muted]);

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-black text-white" style={{ fontFamily: "var(--font-body)" }}>
      {/* No music: the facility's plant hum, barely there, carries on from the montage and fades with the exit. */}
      <SceneAudio src={ACT5_BEDS.readiness.src} volume={muted || exiting ? 0 : ACT5_BEDS.readiness.volume} fadeInMs={2500} fadeOutMs={900} />
      {/* The facility at dusk: fades in from black, with a slow push-in for the whole screen. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center transition-opacity ease-out"
        style={{
          backgroundImage: `url(${BACKGROUND})`,
          opacity: step >= 1 ? 1 : 0,
          transitionDuration: "1800ms",
          animation: "nova-readiness-pushin 40s ease-out forwards",
        }}
      />
      {/* Navy grade: deepen the sky and the lower third so the interface reads cleanly. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,14,28,0.55) 0%, rgba(8,14,28,0.25) 35%, rgba(8,14,28,0.55) 60%, rgba(6,10,20,0.92) 100%), radial-gradient(ellipse at 50% 40%, rgba(20,40,80,0) 0%, rgba(6,12,26,0.45) 100%)",
        }}
      />

      <div className="relative flex h-full flex-col justify-end px-4 pb-10 sm:px-10 sm:pb-14">
        <div className="mx-auto w-full max-w-[1180px]">
          <h1
            className="max-w-[760px] text-[26px] font-semibold leading-tight tracking-[0.005em] text-white transition-all duration-1000 ease-out sm:text-[34px]"
            style={{ opacity: step >= 2 && !chosen ? 1 : chosen ? 0.35 : 0, transform: step >= 2 ? "translateY(0)" : "translateY(8px)", textShadow: "0 2px 18px rgba(0,0,0,0.5)" }}
          >
            {READINESS_RECOMMENDATION.question}
          </h1>
          <p
            className="mt-2 max-w-[640px] text-[15px] text-zinc-300/85 transition-opacity duration-1000 sm:text-[17px]"
            style={{ opacity: step >= 3 && !chosen ? 1 : 0 }}
          >
            {READINESS_RECOMMENDATION.subtitle}
          </p>

          <div role="group" aria-label={READINESS_RECOMMENDATION.question} className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-3 sm:gap-4">
            {READINESS_RECOMMENDATION.options.map((o, i) => {
              const Icon = ICONS[o.id];
              const isChosen = chosen === o.id;
              const faded = chosen !== null && !isChosen;
              const shown = step >= 4;
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={!shown || chosen !== null}
                  aria-pressed={isChosen}
                  onClick={() => choose(o.id)}
                  className={`group relative flex flex-col rounded-[18px] border p-5 text-left backdrop-blur-md transition-all duration-500 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5C474]/70 sm:p-6 ${
                    isChosen
                      ? "border-[#B5C474]/80 bg-[#101c30]/85 shadow-[0_0_0_1px_rgba(181,196,116,0.35),0_18px_50px_rgba(0,0,0,0.45)]"
                      : "border-white/12 bg-[#0b1526]/65 enabled:hover:-translate-y-0.5 enabled:hover:border-white/30 enabled:hover:bg-[#0f1b31]/75"
                  }`}
                  style={{
                    opacity: !shown ? 0 : faded ? 0 : 1,
                    transform: !shown ? "translateY(14px)" : faded ? "translateY(6px) scale(0.98)" : undefined,
                    transitionDelay: shown && !chosen ? `${i * T.stagger}ms` : "0ms",
                    pointerEvents: faded ? "none" : undefined,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-colors duration-500 ${
                        isChosen ? "border-[#B5C474]/60 bg-[#B5C474]/15" : "border-white/10 bg-white/[0.06] group-hover:border-white/20"
                      }`}
                    >
                      <Icon size={19} strokeWidth={1.75} style={{ color: isChosen ? OLIVE : "rgba(228,232,240,0.85)" }} />
                    </span>
                    <span className="text-[13px] font-semibold tracking-[0.14em] text-zinc-400">{o.letter}</span>
                    <span
                      aria-hidden="true"
                      className="ml-auto grid h-6 w-6 place-items-center rounded-full transition-all duration-500"
                      style={{ opacity: isChosen ? 1 : 0, transform: isChosen ? "scale(1)" : "scale(0.6)", background: OLIVE }}
                    >
                      <Check size={14} strokeWidth={2.5} className="text-[#0b1526]" />
                    </span>
                  </div>
                  <h2 className="mt-4 text-[19px] font-semibold text-white sm:text-[20px]">{o.title}</h2>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-zinc-300/85 sm:text-[15px]">{o.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggleMute}
        aria-label={muted ? "Unmute sound" : "Mute sound"}
        className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/30 text-zinc-300/80 backdrop-blur-md transition hover:bg-black/50 hover:text-white"
      >
        {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>

      {/* Exit: fade to black before the story continues. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-black transition-opacity ease-in-out"
        style={{ opacity: exiting ? 1 : 0, transitionDuration: `${EXIT_FADE_MS}ms` }}
      />
      <style>{`@keyframes nova-readiness-pushin { from { transform: scale(1.02) translate3d(0,0,0); } to { transform: scale(1.1) translate3d(-1.2%, -0.8%, 0); } }
@media (prefers-reduced-motion: reduce) { [style*="nova-readiness-pushin"] { animation: none !important; } }`}</style>
    </div>
  );
}
