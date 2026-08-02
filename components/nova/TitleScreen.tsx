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
 * open space beneath it). mission_team.png is the reference photo with
 * that sticker-outline treatment applied to the three-person cutout
 * group; --nova-cream-photo matches its baked-in background exactly so
 * there's no visible seam where the image meets the page.
 *
 * Same props/behavior as before — hasSave/onNewGame/onContinue — only
 * the visual design changed. The one button does double duty per
 * direction: "Start Mission" for a fresh game, or "Continue Mission"
 * (calling onContinue instead) the moment a save exists, rather than
 * showing two separate CTAs.
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
            src="/assets/title/mission_team.png"
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
          independent alignment (OPERATION right, NOVA left, per direction —
          the reference's zigzag poster-lettering look), so each element
          below manages its own alignment instead of inheriting one. */}
      <div className="relative z-10 ml-auto flex w-full max-w-[560px] flex-col gap-4 px-6 py-8 sm:px-10 sm:py-12">
        <h1 className="text-[var(--nova-ink-900)]" style={{ fontFamily: "var(--font-poster)", lineHeight: 0.88 }}>
          <span
            className="block text-right text-[clamp(2.75rem,7.5vw,5.25rem)]"
            style={{ textShadow: "3px 4px 0 var(--nova-gold-300)" }}
          >
            OPERATION
          </span>
          <span
            className="block text-left text-[clamp(4.5rem,12vw,8.5rem)]"
            style={{ textShadow: "4px 6px 0 var(--nova-gold-300)" }}
          >
            NOVA
          </span>
        </h1>

        <p className="text-right text-[length:var(--text-body-lg)] italic text-[var(--color-text-on-parchment-muted)] [font-family:var(--font-body)]">
          Your mission begins here
        </p>

        <button
          onClick={hasSave ? onContinue : onNewGame}
          className="mt-2 self-end rounded-[var(--radius-pill)] border-[3px] border-[var(--nova-ink-900)] bg-[var(--color-brand-primary)] px-9 py-3.5 text-[17px] font-extrabold uppercase tracking-[var(--tracking-wide)] text-[var(--color-text-on-brand)] shadow-[4px_4px_0_var(--nova-ink-900)] transition-transform duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--nova-ink-900)] active:translate-y-0.5 active:shadow-[2px_2px_0_var(--nova-ink-900)] [font-family:var(--font-body)]"
        >
          {hasSave ? "Continue Mission" : "Start Mission"}
        </button>
      </div>
    </div>
  );
}
