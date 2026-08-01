"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-[13px]",
  md: "px-6 py-3 text-[15px]",
  lg: "px-8 py-[15px] text-[17px]",
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[image:var(--gradient-gold-bar)] text-[var(--nova-ink-900)] border-[var(--nova-gold-700)] shadow-[0_3px_0_var(--nova-gold-800)] active:shadow-none",
  secondary:
    "bg-[image:var(--gradient-berry-bar)] text-[var(--color-text-on-brand)] border-[var(--nova-berry-800)] shadow-[0_3px_0_var(--nova-berry-900)] active:shadow-none",
  ghost:
    "bg-transparent text-[var(--color-text-on-dark)] border-[var(--nova-slate-700)] shadow-none",
  danger:
    "bg-[var(--nova-danger)] text-[#fff8ef] border-[var(--nova-danger-strong)] shadow-[0_3px_0_var(--nova-danger-strong)] active:shadow-none",
};

/**
 * Design-system primitive from the "Guild of Project Masters" reskin
 * handoff (components/core/Button.jsx) — a chunky game-panel button
 * with a hard "carved" press shadow: drops 2px and loses its shadow on
 * press (active:), brightens slightly on hover, rather than the usual
 * soft web hover/darken treatment.
 */
export default function Button({
  variant = "primary",
  size = "md",
  icon,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border-2 [font-family:var(--font-display)] font-bold uppercase tracking-[var(--tracking-wide)] transition-all duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:brightness-110 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}
