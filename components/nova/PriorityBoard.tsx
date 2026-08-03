"use client";

import { useState } from "react";
import { User } from "lucide-react";
import type { ToolScreenBlock } from "@/lib/nova/types";
import { useConceptHint, ConceptHintButton, ConceptHintPanel } from "./ConceptHint";
import { ResetToolButton } from "./ResetTool";
import { SubmitToolButton } from "./SubmitTool";

interface PriorityBoardProps {
  toolScreen: ToolScreenBlock;
  /** cardId -> bucket, for whichever cards have been placed so far. */
  placements: Record<string, string>;
  onPlace: (cardId: string, bucket: string) => void;
  pmConcept?: string;
  onReset: () => void;
  canSubmit: boolean;
  onSubmit: () => void;
}

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

interface MoscowQuadrantStyle {
  letter: string;
  cardBg: string;
  badgePosition: string;
  badgeBg: string;
  badgeText: string;
  chipBg: string;
  chipText: string;
}

/** Every quadrant card shares this exact padding, regardless of which
 * corner its own badge sits on — item chips should start the same
 * distance from the edge in every bucket. (Previously each bucket had
 * extra padding reserved on its own badge's two sides, which kept chips
 * clear of the badge but made Must's content sit visibly closer to the
 * card's edge than Won't's, since they were padded by different amounts.
 * The badge is small and sits mostly outside the card anyway, so it's
 * fine to let it overlap on top of content in the rare case a corner
 * fills up, rather than trade that off against consistent spacing.) */
const MOSCOW_CARD_PADDING = "p-4";

/**
 * MoSCoW's own letter/color per bucket, keyed by the exact bucket strings
 * TOOL_ACT2_SCENE02_MOSCOW carries ("Must"/"Should"/"Could"/"Won't"). Each
 * badge sits on its own card's *inward* corner — Must's bottom-right,
 * Should's bottom-left, Could's top-right, Won't's top-left — so all four
 * cluster near the grid's center (approved mockup), rather than on a
 * shared edge where two badges could collide. Colors are a distinct
 * green/blue/indigo/blue set, deliberately not reusing emerald (already
 * "correct" everywhere else) since MoSCoW has no correct answer — every
 * placement here is a valid trade-off.
 */
const MOSCOW_QUADRANT_STYLE: Record<string, MoscowQuadrantStyle> = {
  Must: {
    letter: "M",
    cardBg: "bg-emerald-400",
    badgePosition: "-bottom-[22px] -right-[22px]",
    badgeBg: "bg-emerald-500",
    badgeText: "text-emerald-950",
    chipBg: "bg-emerald-950/25",
    chipText: "text-emerald-950",
  },
  Should: {
    letter: "S",
    cardBg: "bg-sky-400",
    badgePosition: "-bottom-[22px] -left-[22px]",
    badgeBg: "bg-sky-500",
    badgeText: "text-sky-950",
    chipBg: "bg-sky-950/25",
    chipText: "text-sky-950",
  },
  Could: {
    letter: "C",
    cardBg: "bg-indigo-900",
    badgePosition: "-top-[22px] -right-[22px]",
    badgeBg: "bg-indigo-700",
    badgeText: "text-indigo-100",
    chipBg: "bg-black/25",
    chipText: "text-indigo-100",
  },
  "Won't": {
    letter: "W",
    cardBg: "bg-blue-600",
    badgePosition: "-top-[22px] -left-[22px]",
    badgeBg: "bg-blue-700",
    badgeText: "text-blue-100",
    chipBg: "bg-black/20",
    chipText: "text-blue-100",
  },
};

const FALLBACK_MOSCOW_STYLE: MoscowQuadrantStyle = {
  letter: "?",
  cardBg: "bg-zinc-700",
  badgePosition: "-bottom-[22px] -right-[22px]",
  badgeBg: "bg-zinc-500",
  badgeText: "text-zinc-950",
  chipBg: "bg-black/25",
  chipText: "text-zinc-100",
};

interface PowerInterestQuadrantStyle {
  cardBg: string;
  labelText: string;
  subtitleText: string;
  placeholderText: string;
  chipBg: string;
  chipText: string;
}

/**
 * Stakeholder Grid's own color per quadrant, keyed by the exact bucket
 * strings TOOL_ACT2_SCENE03_STAKEHOLDER_GRID carries ("Keep Satisfied"/
 * "Manage Closely"/"Monitor"/"Keep Informed"). Unlike MoSCoW, quadrant
 * names don't collapse to a single letter, so each box shows its full
 * name plus quadrantDefinitions' "High power, Low interest" subtitle
 * directly, rather than a corner badge. Colors are a fourth distinct
 * rose/violet/zinc/cyan set — not reused from MoSCoW's green/sky/indigo/
 * blue — since these two tools can never be on screen at the same time
 * but share the same component, and picking visually distinct palettes
 * keeps a screenshot instantly identifiable as one or the other.
 */
const POWER_INTEREST_QUADRANT_STYLE: Record<string, PowerInterestQuadrantStyle> = {
  "Keep Satisfied": {
    cardBg: "bg-rose-300",
    labelText: "text-rose-950",
    subtitleText: "text-rose-900",
    placeholderText: "text-rose-900",
    chipBg: "bg-rose-950/25",
    chipText: "text-rose-950",
  },
  "Manage Closely": {
    cardBg: "bg-violet-500",
    labelText: "text-violet-50",
    subtitleText: "text-violet-100",
    placeholderText: "text-violet-100",
    chipBg: "bg-black/25",
    chipText: "text-violet-50",
  },
  Monitor: {
    cardBg: "bg-zinc-600",
    labelText: "text-zinc-100",
    subtitleText: "text-zinc-300",
    placeholderText: "text-zinc-300",
    chipBg: "bg-black/25",
    chipText: "text-zinc-100",
  },
  "Keep Informed": {
    cardBg: "bg-cyan-400",
    labelText: "text-cyan-950",
    subtitleText: "text-cyan-900",
    placeholderText: "text-cyan-900",
    chipBg: "bg-cyan-950/25",
    chipText: "text-cyan-950",
  },
};

const FALLBACK_POWER_INTEREST_STYLE: PowerInterestQuadrantStyle = {
  cardBg: "bg-zinc-700",
  labelText: "text-zinc-100",
  subtitleText: "text-zinc-300",
  placeholderText: "text-zinc-300",
  chipBg: "bg-black/25",
  chipText: "text-zinc-100",
};

/**
 * Generic "assign every card to a bucket, optionally at a real cost"
 * interaction — covers both MoSCoW prioritisation (costed) and the
 * stakeholder power/interest grid (free placement, judgement call only).
 * Unlike ToolScreen's sort-into-buckets, every bucket is a valid
 * placement here — nothing bounces back — and a card that's already
 * placed can be reselected and moved to a different bucket, refunding
 * its old cost if it had one. Driven entirely by a tool_screens.json
 * entry; nothing here knows which specific board it's rendering — except
 * for two visual forks on toolScreen.visualStyle: "moscow_quadrant" (set
 * only on TOOL_ACT2_SCENE02_MOSCOW) swaps the plain dashed bucket grid
 * for the four-corner-badge quadrant layout, and
 * "power_interest_quadrant" (set only on
 * TOOL_ACT2_SCENE03_STAKEHOLDER_GRID) swaps it for a 2x2 grid with real
 * power (vertical)/interest (horizontal) axes and person-icon stakeholder
 * chips. Neither visualStyle set falls back to the original plain
 * dashed-bucket grid.
 */
export default function PriorityBoard({
  toolScreen,
  placements,
  onPlace,
  pmConcept,
  onReset,
  canSubmit,
  onSubmit,
}: PriorityBoardProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const hint = useConceptHint(pmConcept);

  // selectedCardId is local UI-only state — clear it alongside the
  // underlying placements so no stale selection survives a reset.
  function handleReset() {
    setSelectedCardId(null);
    onReset();
  }

  const cards = toolScreen.cards ?? [];
  const buckets = toolScreen.buckets ?? [];
  const unplacedCards = cards.filter((card) => !placements[card.id]);
  const isMoscowQuadrant = toolScreen.visualStyle === "moscow_quadrant";
  const isPowerInterestQuadrant = toolScreen.visualStyle === "power_interest_quadrant";

  function handleSelectCard(cardId: string) {
    setSelectedCardId((current) => (current === cardId ? null : cardId));
  }

  function handleAssign(bucket: string) {
    if (!selectedCardId) return;
    onPlace(selectedCardId, bucket);
    setSelectedCardId(null);
  }

  const hasCosts = cards.some((card) => card.costByBucket);
  const committed = cards.reduce((sum, card) => {
    const bucket = placements[card.id];
    if (!bucket || !card.costByBucket) return sum;
    return sum + (card.costByBucket[bucket] ?? 0);
  }, 0);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900/90 p-4">
      {(toolScreen.instructions || pmConcept) && (
        <div className="flex items-start justify-between gap-3">
          {toolScreen.instructions && (
            <p className="text-sm text-zinc-300">{toolScreen.instructions}</p>
          )}
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <ConceptHintButton entry={hint.entry} open={hint.open} onToggle={hint.toggle} />
            <ResetToolButton onReset={handleReset} />
          </div>
        </div>
      )}
      <ConceptHintPanel entry={hint.entry} open={hint.open} onClose={hint.close} />

      {isMoscowQuadrant ? (
        <div className="grid grid-cols-2 gap-x-14 gap-y-14">
          {buckets.map((bucket) => {
            const style = MOSCOW_QUADRANT_STYLE[bucket] ?? FALLBACK_MOSCOW_STYLE;
            const cardsHere = cards.filter((card) => placements[card.id] === bucket);
            return (
              <button
                key={bucket}
                onClick={() => handleAssign(bucket)}
                aria-label={bucket}
                className={`relative flex min-h-[110px] flex-col gap-1.5 rounded-2xl text-left transition-all ${MOSCOW_CARD_PADDING} ${style.cardBg} ${
                  selectedCardId ? "ring-2 ring-white/60" : ""
                }`}
              >
                {cardsHere.length === 0 ? (
                  <span className={`text-[11px] ${style.chipText} opacity-70`}>
                    Drop items here
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {cardsHere.map((card) => {
                      const isSelected = selectedCardId === card.id;
                      return (
                        <span
                          key={card.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleSelectCard(card.id);
                          }}
                          className={`cursor-pointer rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                            isSelected
                              ? "bg-white text-zinc-900 ring-2 ring-white"
                              : `${style.chipBg} ${style.chipText} hover:brightness-110`
                          }`}
                        >
                          {card.text}
                          {card.costByBucket && (
                            <span className="ml-1 opacity-70">
                              ({currencyFormatter.format(card.costByBucket[bucket] ?? 0)})
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}
                <div
                  aria-hidden="true"
                  className={`absolute z-10 flex h-11 w-11 items-center justify-center rounded-full border-4 border-zinc-900 text-lg font-bold ${style.badgePosition} ${style.badgeBg} ${style.badgeText}`}
                >
                  {style.letter}
                </div>
              </button>
            );
          })}
        </div>
      ) : isPowerInterestQuadrant ? (
        // A single L-shaped bordered box — border-left draws the power
        // stroke, border-bottom draws the interest stroke, and because
        // they're two edges of the SAME element they always meet at an
        // exact 90-degree corner with no risk of the two strokes drifting
        // apart at different widths (which is what went wrong with an
        // earlier SVG-viewBox version, and then again with a two-separate-
        // grid-cells version that left a gap at the corner). The quadrant
        // grid below is inset further than the L-box's own bounds
        // (pl-8/pb-11 vs. the box's left-6/bottom-9), so the axis still
        // never touches the grid itself — just its own corner.
        <div className="relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-9 left-6 right-2 top-2 border-b-2 border-l-2 border-zinc-400"
          />
          {/* Power arrowhead: points UP. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-6 top-2 h-0 w-0 -translate-x-1/2 -translate-y-full border-x-[5px] border-b-[7px] border-x-transparent border-b-zinc-400"
          />
          {/* Interest arrowhead: points RIGHT. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-9 right-2 h-0 w-0 -translate-y-1/2 translate-x-full border-y-[5px] border-l-[7px] border-y-transparent border-l-zinc-400"
          />
          <div className="pointer-events-none absolute bottom-9 left-0 top-2 flex w-6 items-center justify-center">
            <span className="text-[11px] font-bold tracking-wide text-zinc-400 [writing-mode:vertical-rl] rotate-180">
              POWER
            </span>
          </div>
          <div className="pointer-events-none absolute bottom-0 left-6 right-2 flex h-7 items-center justify-center">
            <span className="text-[11px] font-bold tracking-wide text-zinc-400">INTEREST</span>
          </div>

          <div className="grid grid-cols-2 gap-3 pb-11 pl-8">
            {buckets.map((bucket) => {
              const style = POWER_INTEREST_QUADRANT_STYLE[bucket] ?? FALLBACK_POWER_INTEREST_STYLE;
              const cardsHere = cards.filter((card) => placements[card.id] === bucket);
              const definition = toolScreen.quadrantDefinitions?.[bucket];
              return (
                <button
                  key={bucket}
                  onClick={() => handleAssign(bucket)}
                  aria-label={bucket}
                  className={`flex min-h-[130px] flex-col gap-1.5 rounded-2xl p-3 text-left transition-all ${style.cardBg} ${
                    selectedCardId ? "ring-2 ring-white/60" : ""
                  }`}
                >
                  <span className={`text-[11px] font-bold uppercase tracking-wide ${style.labelText}`}>
                    {bucket}
                  </span>
                  {definition && (
                    <span className={`text-[10px] ${style.subtitleText} opacity-90`}>{definition}</span>
                  )}
                  {cardsHere.length === 0 ? (
                    <span className={`mt-auto text-[11px] ${style.placeholderText} opacity-70`}>
                      Drop stakeholders here
                    </span>
                  ) : (
                    <div className="mt-auto flex flex-wrap gap-1.5">
                      {cardsHere.map((card) => {
                        const isSelected = selectedCardId === card.id;
                        return (
                          <span
                            key={card.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleSelectCard(card.id);
                            }}
                            className={`cursor-pointer rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                              isSelected
                                ? "bg-white text-zinc-900 ring-2 ring-white"
                                : `${style.chipBg} ${style.chipText} hover:brightness-110`
                            }`}
                          >
                            {card.text}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {buckets.map((bucket) => {
            const cardsHere = cards.filter((card) => placements[card.id] === bucket);
            return (
              <button
                key={bucket}
                onClick={() => handleAssign(bucket)}
                className={`flex min-h-[104px] flex-col gap-1 rounded-md border-2 border-dashed p-2 text-left text-xs transition-colors ${
                  selectedCardId
                    ? "border-emerald-600 bg-emerald-950/30 hover:bg-emerald-900/40"
                    : "border-zinc-700 bg-zinc-950/40"
                }`}
              >
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-300">
                  {bucket}
                </span>
                {cardsHere.map((card) => (
                  <span
                    key={card.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleSelectCard(card.id);
                    }}
                    className={`cursor-pointer rounded px-2 py-1 text-[11px] transition-colors ${
                      selectedCardId === card.id
                        ? "bg-emerald-500 text-white ring-2 ring-emerald-300"
                        : "bg-emerald-800/60 text-emerald-100 hover:bg-emerald-700/70"
                    }`}
                  >
                    {card.text}
                    {card.costByBucket && (
                      <span className="ml-1 text-emerald-300/80">
                        ({currencyFormatter.format(card.costByBucket[bucket] ?? 0)})
                      </span>
                    )}
                  </span>
                ))}
              </button>
            );
          })}
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wide text-zinc-500">
          <span>Unassigned ({unplacedCards.length})</span>
          {hasCosts && (
            <span className="normal-case tracking-normal text-zinc-400">
              Committed so far: {currencyFormatter.format(committed)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {unplacedCards.map((card) => {
            const isSelected = selectedCardId === card.id;
            if (isPowerInterestQuadrant) {
              // Person-icon avatar + name underneath, rather than a plain
              // text chip — stakeholders read as people to place, not
              // items to sort, matching the approved reference mockup.
              return (
                <button
                  key={card.id}
                  onClick={() => handleSelectCard(card.id)}
                  className="flex w-16 flex-col items-center gap-1 text-center"
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] transition-colors ${
                      isSelected
                        ? "border-emerald-400 bg-emerald-800 ring-2 ring-emerald-400/40"
                        : "border-zinc-600 bg-zinc-800 hover:border-zinc-500"
                    }`}
                  >
                    <User
                      className={`h-5 w-5 ${isSelected ? "text-emerald-100" : "text-zinc-400"}`}
                      aria-hidden="true"
                    />
                  </span>
                  <span
                    className={`text-[10px] leading-tight ${
                      isSelected ? "font-semibold text-white" : "text-zinc-300"
                    }`}
                  >
                    {card.text}
                  </span>
                </button>
              );
            }
            return (
              <button
                key={card.id}
                onClick={() => handleSelectCard(card.id)}
                className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                  isSelected
                    ? "border-emerald-400 bg-emerald-700/70 text-white ring-2 ring-emerald-400"
                    : "border-zinc-700 bg-zinc-800 text-zinc-200 hover:border-zinc-500"
                }`}
              >
                {card.text}
              </button>
            );
          })}
          {unplacedCards.length === 0 && (
            <div className="text-xs text-emerald-400">All cards assigned.</div>
          )}
        </div>
      </div>

      <SubmitToolButton canSubmit={canSubmit} onSubmit={onSubmit} />
    </div>
  );
}
