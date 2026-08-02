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
      className="relative flex flex-1 items-stretch overflow-hidden"
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

      {/* Title + CTA column — upper-right, mirroring the reference's banner placement */}
      <div className="relative z-10 ml-auto flex w-full max-w-[440px] flex-col items-end gap-5 px-6 pb-8 pt-9 text-right sm:px-10 sm:pt-14">
        <h1
          className="text-[var(--nova-ink-900)]"
          style={{ fontFamily: "var(--font-poster)", lineHeight: 0.95 }}
        >
          <span
            className="block text-[clamp(1.9rem,4.6vw,3.25rem)]"
            style={{ textShadow: "2px 3px 0 var(--nova-gold-300)" }}
          >
            OPERATION
          </span>
          <span
            className="block text-[clamp(2.5rem,5.8vw,4.25rem)]"
            style={{ textShadow: "3px 4px 0 var(--nova-gold-300)" }}
          >
            NOVA
          </span>
        </h1>

        <p className="text-[length:var(--text-body-lg)] italic text-[var(--color-text-on-parchment-muted)] [font-family:var(--font-body)]">
          Your mission begins here
        </p>

        <button
          onClick={hasSave ? onContinue : onNewGame}
          className="mt-2 rounded-[var(--radius-pill)] border-[3px] border-[var(--nova-ink-900)] bg-[var(--color-brand-primary)] px-9 py-3.5 text-[17px] font-extrabold uppercase tracking-[var(--tracking-wide)] text-[var(--color-text-on-brand)] shadow-[4px_4px_0_var(--nova-ink-900)] transition-transform duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--nova-ink-900)] active:translate-y-0.5 active:shadow-[2px_2px_0_var(--nova-ink-900)] [font-family:var(--font-body)]"
        >
          {hasSave ? "Continue Mission" : "Start Mission"}
        </button>
      </div>
    </div>
  );
}
