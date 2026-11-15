"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * The Teams message card used in the finale — the same card for the "No News" day (NoNewsSequence) and the
 * failed-inspection epilogue (FailedInspectionEpilogue): "Teams" header with a close ×, the sender's
 * initials, name and message, then any extra body (a short exchange) and the action buttons. Presentation
 * only; the host decides when it shows and what its buttons do. Position it with `className` / `style`.
 */
export default function TeamsToast({
  from,
  initials,
  colour,
  role,
  text,
  shown,
  onClose,
  actions,
  children,
  className = "absolute bottom-6 right-4 sm:right-6",
  style,
}: {
  from: string;
  initials: string;
  colour: string;
  /** Optional line under the sender's name (e.g. their role). */
  role?: string;
  /** The message; a blank line starts a new paragraph. */
  text: string;
  /** Drives the slide/fade in and out. */
  shown: boolean;
  onClose: () => void;
  /** The action buttons (bottom right of the card). */
  actions?: ReactNode;
  /** Anything shown between the message and the actions. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const paragraphs = text.split(/\n\s*\n/);
  return (
    <div
      className={`${className} w-[min(360px,calc(100vw-2rem))] rounded-md border border-zinc-200 bg-white text-zinc-900 shadow-xl transition-all duration-500`}
      style={{ opacity: shown ? 1 : 0, transform: shown ? "none" : "translateY(10px)", borderLeft: "3px solid #5b5fc7", ...style }}
      role="status"
    >
      <div className="flex items-center justify-between border-b border-[#edebe9] px-3.5 py-1.5">
        <p className="text-[11px] font-semibold text-[#5b5fc7]">Teams</p>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded px-1.5 text-[14px] leading-none text-[#605e5c] hover:bg-[#f3f2f1]">
          ×
        </button>
      </div>
      <div className="flex gap-3 p-3.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white" style={{ background: colour }}>
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-[#201f1e]">{from}</p>
          {role && <p className="text-[11px] text-[#605e5c]">{role}</p>}
          {paragraphs.map((p, i) => (
            <p key={i} className={`${i === 0 ? "mt-0.5" : "mt-2"} text-[12.5px] leading-snug text-[#323130]`}>{p}</p>
          ))}
          {children}
          {actions && <div className="mt-2.5 flex justify-end gap-1">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
