"use client";

import { useState } from "react";
import { ChevronRight, File, FileSpreadsheet, Folder, Presentation } from "lucide-react";
import type { Flags, RiskInvestigationBank, RiskInvestigationQuestion } from "@/lib/nova/types";
import DocumentDiscoveredCard from "./DocumentDiscoveredCard";

interface SharePointBrowserPanelProps {
  bank: RiskInvestigationBank;
  flags: Flags;
  onAsk: (question: RiskInvestigationQuestion) => void;
  onContinue: () => void;
  /** Fired instead of a plain tap-to-reveal when the tapped row carries a
   * revealsArtefactId — the caller uses this to open the ArtefactsDrawer
   * viewer straight onto that artefact once the player picks "Open" on the
   * DocumentDiscoveredCard this panel shows first. */
  onOpenArtefact: (artefactId: string) => void;
}

const BREADCRUMB = ["Group Tax Innovation & Change", "4. Managed Projects", "11. Project NOVA"];

function iconFor(fileName: string) {
  if (!fileName.includes(".")) return Folder;
  if (fileName.endsWith(".xlsx")) return FileSpreadsheet;
  if (fileName.endsWith(".pptx")) return Presentation;
  return File;
}

/**
 * Bespoke chrome for risk_investigation.json banks with
 * visualStyle: "sharepoint_browser" — a light-touch file list mirroring a
 * real SharePoint document library breadcrumb + row layout, re-themed into
 * the game's dark palette. Field mapping: dimension is the file/folder
 * name, questionText is unused, answerText is the one-line flavour shown
 * when a non-document row is tapped. The one row with revealsArtefactId
 * (the PID) skips straight to DocumentDiscoveredCard instead of an inline
 * one-liner.
 */
export default function SharePointBrowserPanel({
  bank,
  flags,
  onAsk,
  onContinue,
  onOpenArtefact,
}: SharePointBrowserPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [revealing, setRevealing] = useState<RiskInvestigationQuestion | null>(null);

  function handleRowTap(question: RiskInvestigationQuestion) {
    if (question.revealsArtefactId) {
      setRevealing(question);
      return;
    }
    setExpandedId((current) => (current === question.id ? null : question.id));
    if (!flags[question.flagOnAsk]) onAsk(question);
  }

  function handleReadLater() {
    if (!revealing) return;
    if (!flags[revealing.flagOnAsk]) onAsk(revealing);
    setRevealing(null);
  }

  function handleOpen() {
    if (!revealing) return;
    if (!flags[revealing.flagOnAsk]) onAsk(revealing);
    onOpenArtefact(revealing.revealsArtefactId!);
    setRevealing(null);
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/90">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-zinc-800 px-4 py-2.5 text-[11px] text-zinc-500">
        {BREADCRUMB.map((crumb, i) => (
          <span key={crumb} className="flex items-center gap-1 whitespace-nowrap">
            {i > 0 && <ChevronRight size={11} className="text-zinc-700" />}
            <span className={i === BREADCRUMB.length - 1 ? "font-semibold text-zinc-300" : ""}>
              {crumb}
            </span>
          </span>
        ))}
      </div>
      {bank.instructions && <p className="px-4 pt-2 text-sm text-zinc-300">{bank.instructions}</p>}
      <ul className="flex h-72 flex-col overflow-y-auto px-2 py-2">
        {bank.questions.map((question) => {
          const Icon = iconFor(question.dimension);
          const read = Boolean(flags[question.flagOnAsk]);
          const expanded = expandedId === question.id;
          return (
            <li key={question.id} className="rounded-md">
              <button
                onClick={() => handleRowTap(question)}
                className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-zinc-800/60 ${
                  expanded ? "bg-zinc-800/60" : ""
                }`}
              >
                <Icon size={15} className="shrink-0 text-zinc-500" />
                <span className={`flex-1 truncate text-[13px] ${read ? "text-zinc-400" : "text-zinc-100"}`}>
                  {question.dimension}
                </span>
                {question.revealsArtefactId && read && (
                  <span className="rounded-full bg-emerald-900/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                    Found
                  </span>
                )}
              </button>
              {expanded && !question.revealsArtefactId && (
                <p className="px-9 pb-2.5 text-[12px] leading-relaxed text-zinc-400">
                  {question.answerText}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end border-t border-zinc-800 px-4 py-3">
        <button
          onClick={onContinue}
          className="rounded-md bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Continue ▸
        </button>
      </div>

      {revealing && revealing.revealsArtefactId && (
        <DocumentDiscoveredCard
          artefactId={revealing.revealsArtefactId}
          status={revealing.revealsArtefactStatus ?? "incomplete"}
          onOpen={handleOpen}
          onReadLater={handleReadLater}
        />
      )}
    </div>
  );
}
