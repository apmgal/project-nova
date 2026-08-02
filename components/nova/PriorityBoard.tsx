"use client";

import { useState } from "react";
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

/**
 * Generic "assign every card to a bucket, optionally at a real cost"
 * interaction — covers both MoSCoW prioritisation (costed) and the
 * stakeholder power/interest grid (free placement, judgement call only).
 * Unlike ToolScreen's sort-into-buckets, every bucket is a valid
 * placement here — nothing bounces back — and a card that's already
 * placed can be reselected and moved to a different bucket, refunding
 * its old cost if it had one. Driven entirely by a tool_screens.json
 * entry; nothing here knows which specific board it's rendering — except
 * for one visual fork: toolScreen.visualStyle === "moscow_quadrant"
 * (set only on TOOL_ACT2_SCENE02_MOSCOW) swaps the plain dashed bucket
 * grid for the four-corner-badge quadrant layout. The Stakeholder Grid
 * has no visualStyle set, so it always gets the plain grid — its bucket
 * names don't map to single letters the way Must/Should/Could/Won't do.
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
