"use client";

import type { DossierDocument, InspectionDocId, InspectionOption } from "@/lib/nova/inspection";

/**
 * The Inspection Dossier — presentation only, matched to the approved design: dark navy shell with an
 * "INSPECTION DOSSIER / PROJECT NOVA" header, Whitfield's line in the blue-grey panel, the four
 * documents in a 2×2 grid, the cream document preview and the black rounded "Present to Whitfield"
 * button. InspectionSequence.tsx drives it; nothing here knows about steps or scoring.
 */

const C = {
  shell: "#1b232d",
  panel: "#2a3645",
  card: "#273240",
  cardBorder: "#435062",
  cardSel: "#44566a",
  cardSelBorder: "#a7b9c9",
  muted: "#b9c6d3",
  name: "#dae5ee",
  icon: "#dbe4ee",
  paper: "#f0ede7",
  paperRule: "#c8c5bd",
  ink: "#1a232d",
  inkSub: "#47525e",
  inkMuted: "#55606a",
  inkBody: "#6a747f",
};

const ok = "#3f7a55", partial = "#9a6b1f", gap = "#9b3b33";
const TONE_COLOR = { ok, partial, gap, neutral: C.inkSub } as const;
const TONE_DOT = { ok: "#4f8f66", partial: "#c18a2c", gap: "#b4483e", neutral: "#8a939c" } as const;

function DocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.icon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="3" />
      <path d="M9 10h6M9 14h6" />
    </svg>
  );
}
function FolderOpenIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
function FileSearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.inkMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M4.268 21a2 2 0 0 0 1.727 1H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3" />
      <path d="m9 18-1.5-1.5" />
      <circle cx="5" cy="14" r="3" />
    </svg>
  );
}

export interface DossierLine {
  who: "whitfield" | "player";
  text: string;
}

export default function InspectionDossier({
  line,
  echo,
  showLine = true,
  documents,
  selectedId,
  onSelect,
  presentedId,
  canPresent,
  onPresent,
  options,
  chosenOption,
  onChooseOption,
  onRespond,
  onContinue,
  dimmed = false,
}: {
  /** What's said in the top panel (Whitfield, or the player during the closing). */
  line: DossierLine | null;
  /** The player's last answer, shown small above Whitfield's next line for continuity. */
  echo?: string | null;
  showLine?: boolean;
  documents: DossierDocument[];
  selectedId: InspectionDocId | null;
  onSelect: (id: InspectionDocId) => void;
  /** Already presented in this round (marked in the preview). */
  presentedId?: InspectionDocId | null;
  canPresent: boolean;
  onPresent: () => void;
  options?: InspectionOption[] | null;
  chosenOption?: string | null;
  onChooseOption?: (id: string) => void;
  onRespond?: () => void;
  onContinue?: (() => void) | null;
  dimmed?: boolean;
}) {
  const doc = documents.find((d) => d.id === selectedId) ?? null;
  return (
    <div className="mx-auto w-full max-w-[760px] rounded-2xl p-3 text-white sm:p-3.5" style={{ background: C.shell, fontFamily: "var(--font-body, ui-sans-serif, system-ui, sans-serif)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 pb-4 pt-1.5">
        <p className="text-[11px] uppercase tracking-[0.08em]" style={{ color: C.muted }}>
          Inspection Dossier / Project Nova
        </p>
        <FolderOpenIcon />
      </div>

      {/* Whitfield's panel */}
      <div className="rounded-xl px-3.5 py-4 transition-opacity duration-500" style={{ background: C.panel, opacity: showLine && line ? 1 : 0, minHeight: 84 }} aria-live="polite">
        {echo && (
          <p className="mb-2 text-[12px] italic leading-snug" style={{ color: C.muted }}>
            You: &quot;{echo}&quot;
          </p>
        )}
        {line && (
          <div key={line.text} className="animate-[dossierFade_400ms_ease-out]">
            <p className="text-[17px]" style={{ color: line.who === "whitfield" ? C.name : C.muted }}>
              {line.who === "whitfield" ? "Whitfield" : "You"}
            </p>
            <p className="mt-2.5 text-[17px] leading-snug" style={{ color: "#ffffff" }}>
              &quot;{line.text}&quot;
            </p>
          </div>
        )}
        {onContinue && (
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={onContinue} className="rounded-full px-3 py-1 text-[12px] transition-colors hover:bg-white/10" style={{ color: C.muted }}>
              Continue
            </button>
          </div>
        )}
      </div>

      {/* The player's answers — same visual language as the document cards */}
      {options && options.length > 0 && (
        <div className="mt-3 flex flex-col gap-2 animate-[dossierFade_400ms_ease-out]">
          {options.map((o) => {
            const sel = chosenOption === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onChooseOption?.(o.id)}
                className="rounded-xl px-3.5 py-3 text-left text-[14px] leading-snug transition-colors duration-200"
                style={{ background: sel ? C.cardSel : C.card, border: `1px solid ${sel ? C.cardSelBorder : C.cardBorder}`, color: "#ffffff" }}
              >
                &quot;{o.text}&quot;
              </button>
            );
          })}
          <button
            type="button"
            disabled={!chosenOption}
            onClick={onRespond}
            className="mt-1 h-9 w-full rounded-full text-[14px] text-white transition-opacity disabled:opacity-40"
            style={{ background: "#0d0d0d" }}
          >
            Respond
          </button>
        </div>
      )}

      <div className="transition-opacity duration-700" style={{ opacity: dimmed ? 0.55 : 1 }}>
        {/* The four documents */}
        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {documents.map((d) => {
            const sel = d.id === selectedId;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onSelect(d.id)}
                aria-pressed={sel}
                className="rounded-xl px-3 pb-3 pt-3.5 text-left transition-colors duration-200"
                style={{ background: sel ? C.cardSel : C.card, border: `1px solid ${sel ? C.cardSelBorder : C.cardBorder}` }}
              >
                <DocIcon />
                <p className="mt-3.5 text-[14.5px]" style={{ color: "#ffffff" }}>{d.title}</p>
                <p className="mt-2 text-[10.5px] tracking-[0.03em]" style={{ color: C.muted }}>{d.subtitle}</p>
              </button>
            );
          })}
        </div>

        {/* Document preview */}
        <div className="mt-3 rounded-xl px-3 pb-3 pt-4" style={{ background: C.paper }}>
          <div className="flex items-center justify-between">
            <p className="text-[11.5px] uppercase tracking-[0.04em]" style={{ color: C.inkMuted }}>Document preview</p>
            <FileSearchIcon />
          </div>
          {doc ? (
            <div key={doc.id} className="animate-[dossierFade_300ms_ease-out]">
              <div className="mt-3.5 flex items-baseline justify-between gap-3">
                <p className="text-[16px] font-bold" style={{ color: C.ink }}>{doc.title}</p>
                {presentedId === doc.id && <p className="text-[10.5px] uppercase tracking-[0.06em]" style={{ color: C.inkMuted }}>Presented</p>}
              </div>
              <div className="mt-4 h-px" style={{ background: C.paperRule }} />
              <p className="mt-4 text-[14px]" style={{ color: C.inkSub }}>{doc.subtitle}</p>
              <div className="mt-2.5 max-h-[34vh] overflow-y-auto pr-1 text-[11.5px] leading-relaxed" style={{ color: C.inkBody }}>
                {!doc.available ? (
                  <p>
                    <span className="font-semibold" style={{ color: C.inkSub }}>Evidence unavailable.</span>{" "}
                    {doc.unavailableReason === "not_reached"
                      ? "This saved game doesn't include the part of the project that produces this record, so there is nothing in this file to show."
                      : "No record of this kind was created during the project, so there is nothing in this file to show."}
                  </p>
                ) : (
                  doc.sections.map((s) => (
                    <div key={s.heading} className="mb-3">
                      <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.05em]" style={{ color: C.inkSub }}>{s.heading}</p>
                      {s.rows.map((r, i) => (
                        <div key={`${r.label}-${i}`} className="flex gap-2 border-b py-1" style={{ borderColor: "#dedad2" }}>
                          <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TONE_DOT[r.tone] }} />
                          <span className="w-[42%] shrink-0" style={{ color: C.inkSub }}>{r.label}</span>
                          <span style={{ color: TONE_COLOR[r.tone] }}>{r.value}</span>
                        </div>
                      ))}
                      {s.note && <p className="mt-1 italic">{s.note}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-[12px]" style={{ color: C.inkBody }}>Select a document to review it.</p>
          )}
          <button
            type="button"
            disabled={!canPresent || !doc}
            onClick={onPresent}
            className="mt-3 h-9 w-full rounded-full text-[14px] text-white transition-opacity duration-300 disabled:cursor-default disabled:opacity-0"
            style={{ background: "#0d0d0d" }}
            aria-hidden={!canPresent}
          >
            Present to Whitfield
          </button>
        </div>
      </div>
      <style>{`@keyframes dossierFade { from { opacity: 0; transform: translateY(3px) } to { opacity: 1; transform: none } }`}</style>
    </div>
  );
}

