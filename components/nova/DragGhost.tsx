"use client";

import type { ReactNode } from "react";

interface DragGhostProps {
  pointer: { x: number; y: number } | null;
  className?: string;
  children: ReactNode;
}

/**
 * Floating label that follows the pointer during an active drag, shared
 * across every drag-enabled tool screen so each one only has to pass its
 * own already-styled pill/chip markup as children rather than re-build
 * the pointer-follow positioning itself. Renders nothing until pointer is
 * set — usePlacementDrag only sets it once a gesture has actually crossed
 * the drag threshold, so a plain tap never flashes a ghost.
 */
export function DragGhost({ pointer, className = "", children }: DragGhostProps) {
  if (!pointer) return null;
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 ${className}`}
      style={{ left: pointer.x, top: pointer.y }}
    >
      {children}
    </div>
  );
}
