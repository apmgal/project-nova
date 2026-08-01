"use client";

import Image from "next/image";
import Button from "./Button";
import QuestBar from "./QuestBar";

interface TitleScreenProps {
  hasSave: boolean;
  onNewGame: () => void;
  onContinue: () => void;
}

/**
 * Title screen — "Guild of Project Masters" quest-log framing: Marcus
 * (the sponsor who chases status reports throughout the game) needling
 * the player before the mission even starts, over a deep blue radial
 * backdrop. Styled to the design-system reskin handoff's token set
 * (nova-design-tokens.css) and Button/QuestBar primitives.
 *
 * Layout now matches the handoff's reference exactly: Marcus's full-
 * figure transparent cutout stands bottom-right (marcus_fullbody.png,
 * absolutely positioned, object-contain, bottom-anchored, drop-shadow +
 * slight desaturation per the handoff's filter spec), with his speech
 * bubble pinned near his head rather than beside a headshot avatar. Main
 * copy/CTA column sits on the left with enough max-width to never run
 * under him. Same props/behavior as before — hasSave/onNewGame/
 * onContinue — only the visual arrangement changed.
 *
 * "PREPARING YOUR QUEST..." bar is flavour, not a real loader — there's
 * nothing to actually wait on (no network calls before Start Mission is
 * clickable), hence QuestBar's indeterminate sweep rather than a
 * determinate fill implying real progress.
 */
export default function TitleScreen({ hasSave, onNewGame, onContinue }: TitleScreenProps) {
  return (
    <div className="relative flex flex-1 items-stretch overflow-hidden bg-[image:var(--gradient-quest-bg)] p-4 sm:p-5">
      <div className="relative flex w-full flex-1 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--nova-navy-400)]/25">
        {/* Marcus — full-figure cutout, bottom-anchored on the right */}
        <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-0 hidden w-[34%] items-end justify-center sm:flex md:w-[28%]">
          <div className="relative h-[92%] w-full">
            <Image
              src="/assets/characters/marcus_fullbody.png"
              alt="Marcus"
              fill
              sizes="400px"
              className="object-contain object-bottom drop-shadow-[0_18px_20px_rgba(0,0,0,0.45)] saturate-[.85]"
              priority
            />
          </div>
        </div>

        {/* Speech bubble — pinned near Marcus's head, clear of his hair */}
        <div className="absolute right-[2%] top-[3%] z-20 hidden max-w-[190px] sm:block">
          <div className="relative rounded-[var(--radius-lg)] bg-[var(--nova-parchment-100)] px-4 py-2.5 text-sm font-bold text-[var(--color-text-on-parchment)] shadow-[var(--shadow-panel-parchment)] [font-family:var(--font-body)]">
            &ldquo;Where&apos;s my status report?!&rdquo;
            <span
              className="absolute bottom-[-9px] left-1/2 h-0 w-0 -translate-x-1/2 border-x-[9px] border-t-[9px] border-x-transparent border-t-[var(--nova-parchment-100)]"
              aria-hidden
            />
          </div>
        </div>

        {/* Main content column */}
        <div className="relative z-10 flex w-full flex-col justify-between gap-8 px-6 py-8 sm:px-10 sm:py-10">
          <div className="text-xs uppercase tracking-[var(--tracking-widest)] text-[var(--nova-cyan-300)] [font-family:var(--font-mono)]">
            Quest Log
          </div>

          <div className="max-w-xl">
            <p className="mb-2.5 text-xs uppercase tracking-[var(--tracking-widest)] text-[var(--nova-gold-300)] [font-family:var(--font-mono)]">
              Guild of Project Masters
            </p>
            <h1 className="text-[length:var(--text-display-xl)] font-normal leading-[var(--leading-tight)] text-[var(--nova-parchment-100)] [font-family:var(--font-display)]">
              PROJECT NOVA
            </h1>
            <p className="mb-7 mt-3.5 text-[length:var(--text-body-lg)] font-semibold text-[var(--color-text-on-dark-muted)] [font-family:var(--font-body)]">
              Your mission begins here&hellip;
            </p>
            <div className="flex flex-wrap items-center gap-5">
              <Button variant="primary" size="lg" onClick={onNewGame} className="whitespace-nowrap">
                Start Mission
              </Button>
              {hasSave && (
                <button
                  onClick={onContinue}
                  className="text-[13px] font-bold text-[var(--nova-cyan-300)] hover:brightness-110 [font-family:var(--font-body)]"
                >
                  Continue saved quest
                </button>
              )}
            </div>
          </div>

          <div className="max-w-[260px]">
            <QuestBar
              label="Preparing your quest…"
              indeterminate
              color="var(--gradient-gold-bar)"
              height={6}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
