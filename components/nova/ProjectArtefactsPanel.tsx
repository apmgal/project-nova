"use client";

import { useEffect, useRef, useState } from "react";
import { FolderCheck, X, ChevronLeft, ChevronDown, Lock } from "lucide-react";
import type { GameState } from "@/lib/nova/types";
import {
  getProjectArtefactsByPhase,
  type ProjectArtefactEntry,
  type ProjectPhaseId,
} from "@/lib/nova/projectArtefacts";
import ToolScreen from "./ToolScreen";
import PriorityBoard from "./PriorityBoard";
import CBSReview from "./CBSReview";
import WBSBlueprint from "./WBSBlueprint";
import GanttBoard from "./GanttBoard";
import {
  StatusReportSnapshot,
  AuditTrailSnapshot,
  ReflectionScorecardView,
  RaidUpdateSnapshot,
} from "./ProjectArtefactSnapshots";

interface ProjectArtefactsPanelProps {
  gameState: GameState;
  /** Opens the shared full-size document viewer (ArtefactsDrawer) for a
   * "document" entry (PID, Benefits Register) — lifted to GameRoot since
   * that viewer is mounted separately and shared with DocumentDiscoveredCard's
   * own jump-to-viewer flow. */
  onOpenDocument: (artefactId: string) => void;
}

const NOOP = () => {};
const NOOP_STRING = () => {};
const NOOP_PLACE = () => {};
/** GanttBoard's own onPlace returns string | null (an inline placement
 * error message), unlike PriorityBoard's void-returning onPlace above —
 * readOnly GanttBoard never calls it, but the stub still has to satisfy
 * that return type. */
const NOOP_PLACE_NULLABLE = () => null;

/**
 * Persistent "Project Artefacts" panel — left-edge sibling to CharacterPanel/
 * FieldGuidePanel's edge tabs. Organised by APM lifecycle phase per direct
 * instruction (Initiation/Planning/Execution/Monitoring & Control/Closure).
 * Absorbs what used to be the separate "Investigation Board" icon — PID and
 * the Benefits Register are entries here now (Initiation and Planning
 * respectively), opened through the same full-size viewer (ArtefactsDrawer,
 * now viewer-only) via `onOpenDocument`.
 *
 * Every phase is always shown, with every entry inside it — including ones
 * the player hasn't reached yet, rendered locked/muted rather than hidden.
 * This is a structural roadmap (which artefact categories exist), not
 * story content, so showing it up front follows the same non-spoiler
 * "full reference, lit up as encountered" rule FieldGuidePanel already
 * uses for its 27 modules. The whole panel still only appears once at
 * least one entry anywhere is actually available — an all-locked panel
 * this early would just be confusing clutter.
 *
 * "New artefact" notification — exactly FieldGuidePanel's own mechanism,
 * reused rather than reinvented, and needing no new persisted GameState
 * field: every entry's own `available` flag (already sourced from
 * toolSubmitted/artefacts/statusReports/currentScene — all genuinely
 * persisted) is the "encountered" signal; `viewedIds` is local, session-
 * only state seeded from whichever entries are already available on
 * mount, so nothing is retroactively flagged new after a reload. From
 * then on, any entry that becomes available while the panel stays
 * mounted (a tool gets submitted, a report gets filed, Act 6 begins) is
 * "new" until the player opens the panel to it. Opening auto-expands and
 * scrolls to the newest such entry, then — after a beat so the highlight
 * is actually visible — marks every currently-new entry viewed, clearing
 * the badge. "Newest" is an approximation (entries have no timestamp of
 * their own): the last newly-available entry in the fixed phase/entry
 * order, which tracks real unlock order closely enough since phases
 * themselves unlock roughly in sequence.
 *
 * Tapping an available tool/status-report/audit-trail/reflection entry
 * opens a full-screen read-only snapshot; document entries route to
 * `onOpenDocument` instead, since their viewer already exists elsewhere.
 */
export default function ProjectArtefactsPanel({
  gameState,
  onOpenDocument,
}: ProjectArtefactsPanelProps) {
  const [open, setOpen] = useState(false);
  const [expandedPhase, setExpandedPhase] = useState<ProjectPhaseId | null>(null);
  const [selected, setSelected] = useState<ProjectArtefactEntry | null>(null);
  const entryRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const phaseGroups = getProjectArtefactsByPhase(gameState);
  const allEntries = phaseGroups.flatMap((g) => g.entries);
  const availableIds = allEntries.filter((e) => e.available).map((e) => e.id);

  const [viewedIds, setViewedIds] = useState<Set<string>>(() => new Set(availableIds));

  const hasAnyAvailable = availableIds.length > 0;

  const newIds = availableIds.filter((id) => !viewedIds.has(id));
  const newestId = newIds[newIds.length - 1] ?? null;
  const newestEntry = newestId ? allEntries.find((e) => e.id === newestId) ?? null : null;

  useEffect(() => {
    if (!open || !newestId) return;
    const el = entryRefs.current[newestId];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setViewedIds(new Set(availableIds)), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, newestId]);

  if (!hasAnyAvailable) return null;

  function handleOpen() {
    setOpen(true);
    if (newestEntry) setExpandedPhase(newestEntry.phase);
  }

  function handleClose() {
    setOpen(false);
    setSelected(null);
  }

  function handleEntryClick(entry: ProjectArtefactEntry) {
    if (!entry.available) return;
    // Viewing an entry directly marks it (and only it) seen immediately,
    // independent of the batch clear-on-open timer above — drilling in is
    // unambiguous "seen", no need to wait out the beat.
    setViewedIds((prev) => new Set(prev).add(entry.id));
    if (entry.kind === "document") {
      onOpenDocument(entry.artefactId);
      return;
    }
    setSelected(entry);
  }

  return (
    <>
      <button
        onClick={handleOpen}
        aria-label="Open Project Artefacts"
        className={`group absolute left-2 top-[calc(50%+104px)] z-20 flex h-10 w-10 items-center justify-center rounded-full border bg-zinc-900/90 shadow-md transition-colors ${
          newIds.length > 0
            ? "animate-pulse border-amber-400 text-amber-300"
            : "border-teal-700/60 text-teal-300 hover:border-teal-400 hover:text-teal-200"
        }`}
      >
        <FolderCheck size={18} />
        {newIds.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-zinc-900">
            {newIds.length}
          </span>
        )}
        <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-200 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
          Project Artefacts
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
            <span className="text-sm font-semibold text-zinc-200">Project Artefacts</span>
            <button
              onClick={handleClose}
              aria-label="Close Project Artefacts"
              className="text-zinc-500 hover:text-zinc-300"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <div className="flex flex-col gap-2">
              {phaseGroups.map(({ phase, entries }) => {
                const expanded = expandedPhase === phase.id;
                const availableCount = entries.filter((e) => e.available).length;
                const newInPhase = entries.filter((e) => newIds.includes(e.id)).length;
                return (
                  <div key={phase.id} className="overflow-hidden rounded border border-zinc-800">
                    <button
                      onClick={() => setExpandedPhase(expanded ? null : phase.id)}
                      className="flex w-full items-center justify-between gap-2 bg-zinc-900/70 px-3 py-2.5 text-left"
                    >
                      <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-zinc-200">
                        {phase.number}. {phase.label}
                        {newInPhase > 0 && (
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
                        )}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500">
                          {availableCount}/{entries.length}
                        </span>
                        <ChevronDown
                          size={14}
                          className={`text-zinc-500 transition-transform ${expanded ? "rotate-180" : ""}`}
                        />
                      </span>
                    </button>
                    {expanded && (
                      <div className="flex flex-col gap-1.5 border-t border-zinc-800 p-2">
                        {entries.map((entry) => {
                          const isNew = newIds.includes(entry.id);
                          return (
                            <button
                              key={entry.id}
                              ref={(el) => {
                                entryRefs.current[entry.id] = el;
                              }}
                              onClick={() => handleEntryClick(entry)}
                              disabled={!entry.available}
                              className={`flex items-center justify-between gap-2 rounded px-2.5 py-2 text-left transition-colors ${
                                entry.available
                                  ? "border border-zinc-800 bg-zinc-900/50 hover:border-teal-700/60 hover:bg-zinc-900"
                                  : "cursor-default border border-transparent opacity-50"
                              } ${isNew ? "ring-2 ring-amber-400" : ""}`}
                            >
                              <span className="text-[12px] font-medium text-zinc-200">{entry.title}</span>
                              {isNew ? (
                                <span className="shrink-0 rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-zinc-900">
                                  NEW
                                </span>
                              ) : entry.available ? (
                                <span className="shrink-0 rounded-full bg-teal-950/60 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-teal-300">
                                  Available
                                </span>
                              ) : (
                                <Lock size={12} className="shrink-0 text-zinc-600" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-zinc-950">
          <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
            <button
              onClick={() => setSelected(null)}
              aria-label="Back to Project Artefacts list"
              className="text-zinc-500 hover:text-zinc-300"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-semibold text-zinc-200">{selected.title}</span>
            <button
              onClick={handleClose}
              aria-label="Close Project Artefacts"
              className="ml-auto text-zinc-500 hover:text-zinc-300"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {selected.kind === "tool" && selected.rendererKind === "sort" && (
              <ToolScreen
                toolScreen={selected.toolScreen}
                placedCardIds={gameState.toolProgress[selected.toolId] ?? []}
                onCorrectPlacement={NOOP_STRING}
                onReset={NOOP}
                canSubmit={false}
                onSubmit={NOOP}
                readOnly
              />
            )}
            {selected.kind === "tool" && selected.rendererKind === "priority" && (
              <PriorityBoard
                toolScreen={selected.toolScreen}
                placements={gameState.toolPlacements[selected.toolId] ?? {}}
                onPlace={NOOP_PLACE}
                onReset={NOOP}
                canSubmit={false}
                onSubmit={NOOP}
                readOnly
              />
            )}
            {selected.kind === "cbs" && (
              <CBSReview
                toolScreen={selected.toolScreen}
                classifications={selected.classifications}
                onClassify={NOOP}
                onReset={NOOP}
                canSubmit={false}
                onSubmit={NOOP}
                readOnly
              />
            )}
            {selected.kind === "wbs" && (
              <WBSBlueprint
                toolScreen={selected.toolScreen}
                placedCardIds={selected.placedCardIds}
                onCorrectPlacement={NOOP_STRING}
                onReset={NOOP}
                canSubmit={false}
                onSubmit={NOOP}
                readOnly
              />
            )}
            {selected.kind === "gantt" && (
              <GanttBoard
                toolScreen={selected.toolScreen}
                placements={selected.placements}
                onPlace={NOOP_PLACE_NULLABLE}
                criticalPathGuesses={gameState.toolSelections[selected.toolScreen.toolId] ?? []}
                onToggleCriticalPathGuess={NOOP_STRING}
                onConfirmCriticalPath={NOOP}
                onReset={NOOP}
                canSubmit={false}
                onSubmit={NOOP}
                readOnly
              />
            )}
            {selected.kind === "raid" && (
              <RaidUpdateSnapshot
                toolScreen={selected.toolScreen}
                owner={selected.owner}
                response={selected.response}
                escalated={selected.escalated}
              />
            )}
            {selected.kind === "status_report" && selected.report && (
              <StatusReportSnapshot record={selected.report} />
            )}
            {selected.kind === "audit_trail" && <AuditTrailSnapshot cards={selected.cards} />}
            {selected.kind === "reflection" && selected.scorecard && (
              <ReflectionScorecardView scorecard={selected.scorecard} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
