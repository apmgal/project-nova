"use client";

import Image from "next/image";

interface TitleScreenProps {
  hasSave: boolean;
  onNewGame: () => void;
  onContinue: () => void;
}

/**
 * Title screen — "Guild of Project Masters" quest-log framing: Marcus
 * (the sponsor who chases status reports throughout the game) needling
 * the player before the mission even starts, over a deep blue radial
 * backdrop. Rebuilt from an approved external mockup; the mockup's
 * "upload background art" placeholder was a tool artifact of however it
 * was designed, not part of the actual design, so it's intentionally
 * left out here — the gradient backdrop is the real background.
 *
 * "PREPARING YOUR QUEST..." bar is flavour, not a real loader — there's
 * nothing to actually wait on (no network calls before Start Mission is
 * clickable). It's an indeterminate sweep (a segment cycling across the
 * track), not a fill animating toward 100%, so it doesn't imply progress
 * toward completion that isn't actually happening.
 */
export default function TitleScreen({ hasSave, onNewGame, onContinue }: TitleScreenProps) {
  return (
    <div className="relative flex flex-1 items-center overflow-hidden bg-[radial-gradient(circle_at_50%_40%,#2c6478_0%,#164059_32%,#0c2740_65%,#081a2c_100%)] px-6 py-10 sm:px-14">
      <div className="absolute left-6 top-6 text-xs font-semibold uppercase tracking-[0.3em] text-sky-300/80 sm:left-10 sm:top-8">
        Quest Log
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-full border-2 border-sky-200/60 shadow-lg">
            <Image
              src="/assets/characters/marcus_neutral.jpg"
              alt="Marcus"
              fill
              sizes="80px"
              className="object-cover"
            />
          </div>
          <div className="relative rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-md">
            <span
              className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 bg-stone-100"
              aria-hidden
            />
            &ldquo;Where&apos;s my status report?!&rdquo;
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.35em] text-sky-200/90">
            Guild of Project Masters
          </p>
          <h1 className="relative whitespace-nowrap font-serif text-[clamp(2rem,6.5vw,4.75rem)] font-black leading-[0.95]">
            <span className="absolute left-[3px] top-[5px] text-rose-950/70" aria-hidden>
              PROJECT NOVA
            </span>
            <span className="relative text-stone-50">PROJECT NOVA</span>
          </h1>
        </div>

        <p className="text-lg font-semibold text-stone-100/90">Your mission begins here&hellip;</p>

        <div className="flex flex-col items-start gap-2">
          <button
            onClick={onNewGame}
            className="rounded-md border-2 border-cyan-200/80 bg-rose-900 px-8 py-3 text-base font-bold uppercase tracking-wide text-stone-50 shadow-lg transition-colors hover:bg-rose-800"
          >
            Start Mission
          </button>
          {hasSave && (
            <button
              onClick={onContinue}
              className="text-xs font-medium tracking-wide text-sky-200/80 hover:text-sky-100"
            >
              Continue saved quest
            </button>
          )}
        </div>

        <div className="mt-2 max-w-xs">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-stone-200/70">
            Preparing your quest&hellip;
          </p>
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-700/60">
            <div className="absolute h-full w-1/3 animate-nova-quest-bar-sweep rounded-full bg-rose-800" />
          </div>
        </div>
      </div>
    </div>
  );
}
