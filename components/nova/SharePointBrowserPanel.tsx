"use client";

import { Fragment, useState } from "react";
import { ChevronRight, File, FileSpreadsheet, FileText, Folder, Presentation } from "lucide-react";
import type { Flags, RiskInvestigationBank, RiskInvestigationQuestion } from "@/lib/nova/types";
import DocumentDiscoveredCard from "./DocumentDiscoveredCard";
import SceneAudio from "./narrative/SceneAudio";

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

// Cosmetic-only per-row chrome (icon, colour, Modified/Modified by columns)
// matching the approved SharePoint-list mockup. Kept local rather than
// added to the content schema since nothing else reads it.
const FILE_META: Record<
  string,
  { icon: typeof File; color: string; modified: string; modifiedBy: string }
> = {
  q_drive_meeting_notes: { icon: Folder, color: "text-[#eab308]", modified: "June 2026", modifiedBy: "C. Okafor" },
  q_drive_archive: { icon: Folder, color: "text-[#eab308]", modified: "March 2026", modifiedBy: "M. Elloian" },
  q_drive_kickoff: { icon: Presentation, color: "text-[#c2410c]", modified: "April 2026", modifiedBy: "E. Grant" },
  q_drive_budget: { icon: FileSpreadsheet, color: "text-[#15803d]", modified: "May 2026", modifiedBy: "D. Atwell" },
  q_drive_raid: { icon: FileSpreadsheet, color: "text-[#15803d]", modified: "June 2026", modifiedBy: "T. Nowak" },
  q_drive_pid: { icon: FileText, color: "text-[#1d4ed8]", modified: "April 2026", modifiedBy: "E. Grant" },
};

/**
 * Bespoke chrome for risk_investigation.json banks with
 * visualStyle: "sharepoint_browser" — mirrors a real SharePoint document
 * library (banner, breadcrumb, Name/Modified/Modified by table) matching
 * the approved mockup. Field mapping: dimension is the file/folder name,
 * answerText is the one-line flavour shown when a non-document row is
 * tapped. The one row with revealsArtefactId (the PID) skips straight to
 * DocumentDiscoveredCard instead of an inline one-liner.
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
    <div className="flex flex-col gap-3 rounded-lg bg-zinc-950 p-3">
      {/* Scoped to this panel's own mount/unmount rather than routed
          through the dialogue-line ambient system in GameRoot — this loop
          only ever means one thing ("the player is browsing SharePoint
          right now"), so tying its lifecycle directly to the component
          that IS that browsing UI is simpler than threading a key through
          the scene data for a sound that's never reused elsewhere. */}
      <SceneAudio src="/assets/sfx/sharepoint_browsing.mp3" volume={0.35} fadeInMs={400} fadeOutMs={500} />
      <div className="flex max-h-[420px] flex-col overflow-hidden rounded-md border border-zinc-300 bg-[#fafafa] text-zinc-900">
        <div className="shrink-0 bg-[#0f4c81] px-4 py-3">
          <p className="mb-0.5 text-[11px] text-[#bfdbfe]">SharePoint</p>
          <p className="text-[14px] font-semibold text-white">Group Tax Innovation &amp; Change</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-zinc-200 px-4 py-2.5">
          {BREADCRUMB.map((crumb, i) => (
            <span key={crumb} className="flex items-center gap-1.5 whitespace-nowrap">
              {i > 0 && <ChevronRight size={12} className="text-zinc-400" />}
              <span
                className={`text-[12px] ${i === BREADCRUMB.length - 1 ? "font-semibold text-zinc-900" : "text-zinc-600"}`}
              >
                {crumb}
              </span>
            </span>
          ))}
        </div>
        {bank.instructions && <p className="px-4 pt-2 text-[13px] text-zinc-600">{bank.instructions}</p>}
        <div className="overflow-y-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-zinc-200">
                <td className="w-8 px-4 py-2" />
                <td className="py-2 text-[11px] text-zinc-500">Name</td>
                <td className="px-4 py-2 text-[11px] text-zinc-500">Modified</td>
                <td className="px-4 py-2 text-[11px] text-zinc-500">Modified by</td>
              </tr>
            </thead>
            <tbody>
              {bank.questions.map((question) => {
                const meta = FILE_META[question.id];
                const Icon = meta?.icon ?? File;
                const expanded = expandedId === question.id;
                const isPid = Boolean(question.revealsArtefactId);
                const read = Boolean(flags[question.flagOnAsk]);
                return (
                  <Fragment key={question.id}>
                    <tr
                      onClick={() => handleRowTap(question)}
                      className={`cursor-pointer border-b border-zinc-100 ${
                        isPid ? "bg-[#fef3c7]" : expanded ? "bg-zinc-100" : "hover:bg-zinc-100"
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <Icon size={16} className={meta?.color ?? "text-zinc-500"} />
                      </td>
                      <td className={`py-2.5 text-[13px] ${isPid ? "font-semibold" : ""}`}>
                        {question.dimension}
                        {isPid && read && (
                          <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                            Found
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-zinc-500">{meta?.modified}</td>
                      <td className="px-4 py-2.5 text-[12px] text-zinc-500">{meta?.modifiedBy}</td>
                    </tr>
                    {expanded && !isPid && (
                      <tr>
                        <td colSpan={4} className="px-4 pb-2.5 text-[12px] leading-relaxed text-zinc-500">
                          {question.answerText}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex justify-end">
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
