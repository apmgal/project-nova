"use client";

import Image from "next/image";

interface TitleScreenProps {
  hasSave: boolean;
  onNewGame: () => void;
  onContinue: () => void;
}

/**
 * Title screen — restyled around a "mission team" cover-art composition,
 * studied from a cartoon game-cover reference (thick white/cream sticker
 * outlines on cutout characters anchored bottom-left, bold poster-lettered
 * title banked upper-right over a flat warm backdrop, single CTA in the
 * open space beneath it). mission_team_v2.png is the reference photo
 * (now with the AstraZeneca logo composited onto the desk) with that
 * sticker-outline treatment applied to the three-person cutout group;
 * --nova-cream-photo matches its baked-in background exactly so
 * there's no visible seam where the image meets the page. Named _v2
 * (not overwriting the original mission_team.png filename) so a
 * cached copy of the old art can never be served in its place.
 *
 * Same props as before — hasSave/onNewGame/onContinue. "Begin Mission"
 * (onNewGame) always shows; "Continue Mission" (onContinue) joins it
 * alongside, only once hasSave is true, rather than the two swapping
 * places as a single button.
 *
 * Previous "Guild of Project Masters" quest-log framing (Mike Elloian's
 * speech bubble, the "Quest Log"/"Guild of Project Masters" eyebrows,
 * MedievalSharp title lettering, the indeterminate "preparing your
 * quest" bar) is gone entirely — this screen no longer uses any "quest"
 * language, imagery, or its own now-unused marcus_fullbody.png cutout.
 */
export default function TitleScreen({ hasSave, onNewGame, onContinue }: TitleScreenProps) {
  return (
    <div
      className="relative flex flex-1 items-center overflow-hidden"
      style={{ backgroundColor: "var(--nova-cream-photo)" }}
    >
      {/* Mission team — sticker-outlined cutout, anchored bottom-left */}
      <div className="pointer-events-none absolute bottom-0 left-0 z-0 h-[62%] w-[72%] sm:h-[80%] sm:w-[48%] md:w-[42%]">
        <div className="relative h-full w-full">
          <Image
            src="/assets/title/mission_team_v2.png"
            alt="The mission team"
            fill
            sizes="620px"
            className="object-contain object-left-bottom drop-shadow-[0_16px_22px_rgba(36,26,30,0.22)]"
            priority
          />
        </div>
      </div>

      {/* Title + CTA column — upper-right, mirroring the reference's banner placement.
          Not `items-end`/`text-right` anymore: the two title lines need
          independent alignment (OPERATION left, NOVA right, per direction —
          the reference's zigzag poster-lettering look), so each element
          below manages its own alignment instead of inheriting one.

          The left-shift offsets on OPERATION/NOVA/tagline+CTAs are in vw,
          not a fixed px or cm amount — they started as literal cm values,
          but those don't scale with screen size (a physical 11cm shift on
          a phone-width screen would push OPERATION almost entirely
          off-canvas), so the whole layout could distort at other window
          sizes even though the font-size clamp()s already scale fine.
          Converted to vw (at the ~1280px width this was tuned at:
          -11cm -> -32.5vw, -2cm -> -5.9vw) so every offset scales with
          the viewport the same way the fonts already do — proportions
          hold at any screen size instead of only the one this was eyeballed
          on. */}
      <div className="relative z-10 ml-auto flex w-full max-w-[560px] flex-col gap-4 px-6 py-8 sm:px-10 sm:py-12">
        {/* Two independent boxes (not just two lines of one block) — a
            real gap between them (gap-5/sm:gap-8) plus each managing its
            own text-align, so OPERATION and NOVA can sit apart and point
            opposite directions rather than reading as one tight lockup. */}
        <h1
          className="flex flex-col gap-5 text-[var(--nova-ink-900)] sm:gap-8"
          style={{ fontFamily: "var(--font-poster)", lineHeight: 0.88 }}
        >
          <div
            className="text-left text-[clamp(4.5rem,12vw,8.5rem)]"
            style={{ textShadow: "3px 4px 0 var(--nova-gold-300)", transform: "translateX(-32.5vw)" }}
          >
            OPERATION
          </div>
          <div
            className="text-right text-[clamp(4.5rem,12vw,8.5rem)]"
            style={{ textShadow: "4px 6px 0 var(--nova-gold-300)", transform: "translateX(-5.9vw)" }}
          >
            NOVA
          </div>
        </h1>

        {/* Tagline + CTA(s), shifted left together (in step with the title
            above, same vw-based scaling) */}
        <div className="flex flex-col items-end gap-4" style={{ transform: "translateX(-5.9vw)" }}>
          <p className="text-right text-[length:var(--text-body-lg)] italic text-[var(--color-text-on-parchment-muted)] [font-family:var(--font-body)]">
            Your mission begins here
          </p>

          <div className="mt-2 flex flex-wrap items-center justify-end gap-4">
            {/* Begin Mission — always shown, always starts a fresh game. */}
            <button
              onClick={onNewGame}
              className="rounded-[var(--radius-pill)] border-[3px] border-[var(--nova-ink-900)] bg-[var(--color-brand-primary)] px-9 py-3.5 text-[17px] font-extrabold uppercase tracking-[var(--tracking-wide)] text-[var(--color-text-on-brand)] shadow-[4px_4px_0_var(--nova-ink-900)] transition-transform duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--nova-ink-900)] active:translate-y-0.5 active:shadow-[2px_2px_0_var(--nova-ink-900)] [font-family:var(--font-body)]"
            >
              Begin Mission
            </button>

            {/* Continue Mission — alongside Begin Mission, only once a save exists. */}
            {hasSave && (
              <button
                onClick={onContinue}
                className="rounded-[var(--radius-pill)] border-[3px] border-[var(--nova-ink-900)] bg-transparent px-9 py-3.5 text-[17px] font-extrabold uppercase tracking-[var(--tracking-wide)] text-[var(--nova-ink-900)] shadow-[4px_4px_0_var(--nova-ink-900)] transition-transform duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--nova-ink-900)] hover:bg-[var(--nova-parchment-100)] active:translate-y-0.5 active:shadow-[2px_2px_0_var(--nova-ink-900)] [font-family:var(--font-body)]"
              >
                Continue Mission
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
