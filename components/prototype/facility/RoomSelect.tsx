"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { Check, FlaskConical, Factory, Lock, Search, Warehouse, type LucideIcon } from "lucide-react";
import type { FacilityRoom, RoomId } from "./rooms";

const ROOM_ICONS: Record<RoomId, LucideIcon> = {
  warehouse: Warehouse,
  production: Factory,
  qualityLab: FlaskConical,
};

interface RoomSelectProps {
  rooms: FacilityRoom[];
  completed: Set<RoomId>;
  canContinue: boolean;
  continueHint: string;
  onSelect: (room: RoomId) => void;
  onContinue: () => void;
}

/** "Facility Exploration" room-selection screen. Pure presentation. */
export default function RoomSelect({ rooms, completed, canContinue, continueHint, onSelect, onContinue }: RoomSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap
        .timeline()
        .fromTo("[data-intro]", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: "power3.out" })
        .fromTo("[data-card]", { opacity: 0, y: 24, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, stagger: 0.09, ease: "power3.out" }, 0.2)
        .fromTo("[data-footer]", { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.55);
    }, rootRef);
    return () => ctx.revert();
  }, []);

  const exploredCount = rooms.filter((r) => completed.has(r.id)).length;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 overflow-y-auto text-zinc-100"
      style={{
        fontFamily: "var(--font-body)",
        background:
          "radial-gradient(ellipse at 50% -10%, rgba(196,160,56,0.14), transparent 55%), linear-gradient(180deg, var(--nova-slate-900), var(--nova-slate-950))",
      }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center px-4 py-10 sm:px-8">
        <p data-intro className="text-[12px] font-bold uppercase tracking-[0.22em] text-[var(--nova-gold-400)]">
          Facility Exploration
        </p>
        <h1 data-intro className="mt-2 text-3xl leading-tight sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
          Choose where to investigate
        </h1>
        <p data-intro className="mt-2 max-w-xl text-[15px] text-zinc-400">
          Walk the site before commissioning begins. Find everything each area is hiding, in any order you like.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {rooms.map((room) => {
            const Icon = ROOM_ICONS[room.id];
            const done = completed.has(room.id);
            const disabled = !room.available;
            const found = room.requiredEvidence.length;
            return (
              <button
                key={room.id}
                type="button"
                data-card
                disabled={disabled}
                aria-disabled={disabled}
                onClick={() => onSelect(room.id)}
                className={`group relative flex min-h-[220px] flex-col overflow-hidden rounded-[var(--radius-lg)] border p-5 text-left shadow-[var(--shadow-panel-dark)] transition duration-300 ${
                  disabled
                    ? "cursor-not-allowed border-white/[0.06] bg-white/[0.02] opacity-55"
                    : done
                      ? "border-[var(--nova-lime-500)]/60 bg-[var(--nova-slate-800)]/70 hover:-translate-y-1 hover:border-[var(--nova-lime-400)] focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nova-lime-400)]"
                      : "border-[var(--nova-gold-600)]/50 bg-[var(--nova-slate-800)]/70 hover:-translate-y-1 hover:border-[var(--nova-gold-400)] hover:shadow-[var(--shadow-glow-gold)] focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nova-gold-400)]"
                }`}
              >
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] ${
                    disabled ? "bg-zinc-700" : done ? "bg-[var(--nova-lime-500)]" : "bg-[var(--nova-gold-500)]"
                  }`}
                />
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`grid h-12 w-12 place-items-center rounded-[var(--radius-md)] transition duration-300 ${
                      disabled
                        ? "bg-white/5 text-zinc-500"
                        : done
                          ? "bg-[var(--nova-lime-600)]/25 text-[var(--nova-lime-300)]"
                          : "bg-[var(--nova-gold-500)]/15 text-[var(--nova-gold-300)] group-hover:scale-105"
                    }`}
                  >
                    <Icon size={24} />
                  </span>
                  <StatusPill disabled={disabled} done={done} />
                </div>
                <h2 className="mt-5 text-lg font-extrabold">{room.name}</h2>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">{room.blurb}</p>
                <div className="mt-auto pt-5 text-[13px] font-semibold">
                  {disabled ? (
                    <span className="text-zinc-500">Not yet accessible</span>
                  ) : done ? (
                    <span className="text-[var(--nova-lime-300)]">
                      {found}/{found} evidence found · Revisit
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[var(--nova-gold-300)]">
                      <Search size={14} /> Investigate
                      <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div data-footer className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-white/[0.07] pt-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <span className="flex gap-1.5" aria-hidden="true">
              {rooms.map((r) => (
                <span
                  key={r.id}
                  className={`h-2.5 w-2.5 rounded-full ${
                    completed.has(r.id) ? "bg-[var(--nova-lime-400)]" : r.available ? "bg-[var(--nova-gold-500)]/40" : "bg-zinc-700"
                  }`}
                />
              ))}
            </span>
            <span>
              {exploredCount} of {rooms.length} areas explored
            </span>
          </div>
          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            <button
              type="button"
              onClick={onContinue}
              disabled={!canContinue}
              className="rounded-[var(--radius-sm)] border border-[var(--nova-gold-500)] bg-[var(--nova-gold-500)] px-6 py-3 text-sm font-bold text-[var(--nova-slate-950)] shadow-[var(--shadow-panel-dark)] transition hover:bg-[var(--nova-gold-400)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nova-gold-300)] disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none"
            >
              Continue to Act 5
            </button>
            {!canContinue && <span className="text-[12px] text-zinc-500">{continueHint}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ disabled, done }: { disabled: boolean; done: boolean }) {
  if (disabled) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
        <Lock size={11} /> Coming soon
      </span>
    );
  }
  if (done) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--nova-lime-600)]/25 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--nova-lime-300)]">
        <Check size={12} /> Explored
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[var(--nova-gold-500)]/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--nova-gold-300)]">
      Available
    </span>
  );
}
