"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { BookOpen, Search, X } from "lucide-react";
import { FIELD_GUIDE } from "@/lib/nova/fieldGuide";

interface FieldGuidePanelProps {
  fieldGuideSeen: string[];
}

/**
 * Renders a FIELD_GUIDE summary's `**bold**` convention (see
 * fieldGuide.ts's own doc comment — not real markdown, just this one
 * marker) as actual <strong> emphasis, and its "\n\n" paragraph breaks
 * as separate <p> tags, so the now-lengthier near-verbatim source text
 * reads like the original two-paragraph spreadsheet entry rather than
 * one unbroken block.
 */
function renderBoldedText(text: string) {
  return text.split("\n\n").map((paragraph, pIdx) => (
    <p key={pIdx} className={pIdx > 0 ? "mt-2" : undefined}>
      {paragraph.split(/(\*\*[^*]+\*\*)/g).map((chunk, cIdx) => {
        if (chunk.startsWith("**") && chunk.endsWith("**")) {
          return <strong key={cIdx}>{chunk.slice(2, -2)}</strong>;
        }
        return <Fragment key={cIdx}>{chunk}</Fragment>;
      })}
    </p>
  ));
}

/**
 * Persistent APM reference panel ("APM Knowledge Library" — renamed from
 * the working title "Field Guide"; FIELD_GUIDE/fieldGuideSeen data-layer
 * names were kept as-is since they're just internal identifiers, not
 * player-facing copy) — left-edge sibling to CharacterPanel's own edge
 * tab (stacked just below it), built on the exact same overlay +
 * slide-in drawer shell. Unlike CharacterPanel, content here is always
 * readable regardless of "encountered" state: every FIELD_GUIDE entry is
 * non-spoiler reference material (same rule glossary.ts follows), so
 * "full reference hub" (confirmed design decision) means all 27 modules
 * are browsable from the start — "encountered" only changes the visual
 * treatment (muted vs normal) and drives the "lights up" badge, it
 * never hides content. Mirrors CharacterBoard's own badge-only (never
 * content-hiding) pattern for "not met" characters.
 *
 * "Lights up": the edge tab pulses with a count badge whenever
 * fieldGuideSeen contains an id the player hasn't opened the panel to
 * view yet. Opening the panel auto-expands and scrolls to the newest
 * such entry, then (after a short beat so the highlight is actually
 * visible) marks it viewed so the badge clears. viewedIds is seeded
 * from fieldGuideSeen on mount so a reloaded save doesn't treat
 * already-unlocked modules as new.
 *
 * Search bar (confirmed design decision — mockup "Option 6"): filters
 * the full list by title/summary substring match as the player types,
 * but never fully hides the roster — an empty query always shows all
 * 27 entries, same as before search existed. This is deliberately a
 * narrowing filter, not a separate search-results view.
 *
 * Edge tab: violet-tinted by default (vs. CharacterPanel's sky) so the
 * two stacked tabs read as distinct destinations, not two identical
 * grey dots — swaps to the amber pulse/badge treatment only while
 * `newIds.length > 0`, same unlock signal as before. The
 * `group`/`group-hover` tooltip is plain CSS, positioned to the right
 * since the tab sits on the left edge.
 */
export default function FieldGuidePanel({
  fieldGuideSeen,
}: FieldGuidePanelProps) {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewedIds, setViewedIds] = useState<Set<string>>(
    () => new Set(fieldGuideSeen),
  );
  const [query, setQuery] = useState("");
  const entryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const seenSet = new Set(fieldGuideSeen);
  const newIds = fieldGuideSeen.filter((id) => !viewedIds.has(id));
  const newestId = newIds[newIds.length - 1] ?? null;

  const normalizedQuery = query.trim().toLowerCase();
  const visibleEntries = normalizedQuery
    ? FIELD_GUIDE.filter(
        (entry) =>
          entry.title.toLowerCase().includes(normalizedQuery) ||
          entry.summary.toLowerCase().includes(normalizedQuery),
      )
    : FIELD_GUIDE;

  useEffect(() => {
    if (!open || !newestId) return;
    const el = entryRefs.current[newestId];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setViewedIds(new Set(fieldGuideSeen)), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, newestId]);

  function handleOpen() {
    setOpen(true);
    if (newestId) setExpandedId(newestId);
  }

  function handleClose() {
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <button
        onClick={handleOpen}
        aria-label="Open the APM Knowledge Library"
        className={`group absolute left-2 top-[calc(50%+42px)] z-20 flex h-10 w-10 items-center justify-center rounded-full border bg-zinc-900/90 shadow-md transition-colors ${
          newIds.length > 0
            ? "animate-pulse border-amber-400 text-amber-300"
            : "border-violet-700/60 text-violet-300 hover:border-violet-400 hover:text-violet-200"
        }`}
      >
        <BookOpen size={18} />
        {newIds.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-zinc-900">
            {newIds.length}
          </span>
        )}
        <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-200 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
          APM Knowledge Library
        </span>
      </button>

      <div
        className={`fixed inset-0 z-50 flex bg-black/65 backdrop-blur-[2px] transition-opacity duration-200 ease-out ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={handleClose}
      >
        <div
          className={`flex h-full w-80 max-w-[85vw] flex-col overflow-hidden border-r border-zinc-500/60 bg-zinc-950 shadow-[20px_0_60px_-6px_rgba(0,0,0,0.95)] transition-transform duration-300 ease-out sm:w-96 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <span className="text-sm font-semibold text-zinc-200">
              APM Knowledge Library
            </span>
            <button
              onClick={handleClose}
              aria-label="Close the APM Knowledge Library"
              className="text-zinc-500 hover:text-zinc-300"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
            <Search size={13} className="shrink-0 text-zinc-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all 27 modules..."
              aria-label="Search the APM Knowledge Library"
              className="w-full bg-transparent text-[12px] text-zinc-200 placeholder:text-zinc-500 focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="shrink-0 text-zinc-500 hover:text-zinc-300"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {visibleEntries.length === 0 && (
              <p className="px-1 py-4 text-center text-[12px] text-zinc-500">
                No modules match &quot;{query}&quot;.
              </p>
            )}
            <div className="flex flex-col gap-2">
              {visibleEntries.map((entry) => {
                const encountered = seenSet.has(entry.id);
                const isNew = newIds.includes(entry.id);
                const isExpanded = expandedId === entry.id;
                return (
                  <div
                    key={entry.id}
                    ref={(el) => {
                      entryRefs.current[entry.id] = el;
                    }}
                    className={`rounded border px-3 py-2 transition-colors ${
                      encountered
                        ? "border-[#ddcda3] bg-[#f7f0e0] text-[#241a1e]"
                        : "border-zinc-800 bg-zinc-900/50 text-zinc-400"
                    } ${isNew ? "ring-2 ring-amber-400" : ""}`}
                    style={
                      encountered
                        ? { fontFamily: "Arial, Helvetica, sans-serif" }
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : entry.id)
                      }
                      className="flex w-full items-center justify-between gap-2 text-left"
                    >
                      <span className="text-[13px] font-semibold">
                        {entry.moduleNumber}. {entry.title}
                      </span>
                      {isNew ? (
                        <span className="shrink-0 rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-zinc-900">
                          NEW
                        </span>
                      ) : encountered ? (
                        <span
                          className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px]"
                          style={{ background: "#eaf3de", color: "#3b6d11" }}
                        >
                          Encountered
                        </span>
                      ) : (
                        <span className="shrink-0 text-[10px] uppercase text-zinc-600">
                          Reference
                        </span>
                      )}
                    </button>
                    {isExpanded && (
                      <div
                        className={`mt-2 text-[12px] leading-relaxed ${
                          encountered ? "" : "text-zinc-400"
                        }`}
                      >
                        {renderBoldedText(entry.summary)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
