"use client";

interface QuestBarProps {
  value?: number;
  max?: number;
  label?: string;
  sublabel?: string;
  color?: string;
  height?: number;
  indeterminate?: boolean;
}

/**
 * Design-system primitive from the reskin handoff (components/feedback/
 * QuestBar.jsx) — an inset-glow progress bar. `indeterminate` renders a
 * sweeping segment (reuses the .animate-nova-quest-bar-sweep keyframe
 * already defined in globals.css for the title screen's flavour-only
 * loading bar) instead of a determinate fill, for cases where there's
 * nothing real to measure progress against.
 */
export default function QuestBar({
  value = 0,
  max = 100,
  label,
  sublabel,
  color = "var(--gradient-gold-bar)",
  height = 14,
  indeterminate = false,
}: QuestBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="[font-family:var(--font-body)]">
      {(label || sublabel) && (
        <div className="mb-[5px] flex justify-between">
          {label && (
            <span className="whitespace-nowrap text-[length:var(--text-label-sm)] font-bold uppercase tracking-[var(--tracking-wider)] text-[var(--color-text-on-dark-muted)]">
              {label}
            </span>
          )}
          {sublabel && (
            <span className="text-[length:var(--text-body-sm)] text-[var(--color-text-on-dark)] [font-family:var(--font-mono)]">
              {sublabel}
            </span>
          )}
        </div>
      )}
      <div
        className="relative overflow-hidden rounded-[var(--radius-pill)] bg-[var(--nova-slate-800)] shadow-[var(--shadow-inset-well)]"
        style={{ height }}
      >
        {indeterminate ? (
          <div
            className="absolute left-[-35%] top-0 h-full w-[35%] animate-nova-quest-bar-sweep rounded-[var(--radius-pill)]"
            style={{ background: color }}
          />
        ) : (
          <div
            className="h-full rounded-[var(--radius-pill)] transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-standard)]"
            style={{ width: `${pct}%`, background: color }}
          />
        )}
      </div>
    </div>
  );
}
