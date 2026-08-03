"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

const DRAG_THRESHOLD_PX = 8;

interface PlacementDragOptions {
  /**
   * Fires once a drag ends over a registered drop target. clientX/clientY
   * are the pointer's viewport coordinates at release — most callers only
   * need itemId/targetId, but GanttBoard needs the raw position too
   * (dropping onto a *point* along a continuous track, not just a
   * discrete bucket).
   */
  onDrop: (itemId: string, targetId: string, clientX: number, clientY: number) => void;
}

/**
 * Shared pointer-events-based drag-and-drop, layered on top of — never
 * replacing — the tap-to-select-then-tap-target flow every tool screen
 * already has. Deliberately not native HTML5 drag-and-drop: that API is
 * unreliable on touch (iOS Safari especially), so this tracks
 * pointerdown/pointermove/pointerup directly and does its own hit-testing
 * against registered drop-target elements.
 *
 * A pointerdown that never moves past DRAG_THRESHOLD_PX is left
 * completely alone — preventDefault is never called on it — so the
 * browser's normal click still fires on release and every existing
 * onClick handler (tap-to-select, tap-target-to-place) keeps working
 * exactly as it did before this hook existed. Only once the pointer
 * actually crosses the threshold does this take over as a real drag:
 * callers render their own ghost/highlight UI from the returned state
 * (draggingId/pointer/hoveredTargetId) — this hook owns no DOM itself.
 *
 * One more subtlety this guards against: after a genuine drag+drop, the
 * browser can still synthesize a trailing 'click' on whatever element now
 * sits under the pointer (mouse doesn't suppress this the way touch
 * does after a preventDefault'd move). If that element happens to be a
 * drop target with its own onClick (every bucket/zone button already has
 * one, for the tap flow), it could double-fire the placement. `wasDrag()`
 * lets a caller's onClick bail out for exactly the one click immediately
 * following a drop.
 */
export function usePlacementDrag({ onDrop }: PlacementDragOptions) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);

  const targets = useRef<Map<string, HTMLElement>>(new Map());
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const activeId = useRef<string | null>(null);
  const moved = useRef(false);
  const suppressClick = useRef(false);
  const onDropRef = useRef(onDrop);
  // Keep the ref in sync in an effect rather than mutating it inline
  // during render — refs shouldn't be written while rendering, only in
  // event handlers or effects. The internal 'up' handler always reads
  // onDropRef.current at call time, so this only needs to be current by
  // the time a real pointerup can happen, well after this effect runs.
  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  function hitTest(x: number, y: number): string | null {
    for (const [id, el] of targets.current) {
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return id;
    }
    return null;
  }

  function cleanup() {
    activeId.current = null;
    moved.current = false;
    startPos.current = null;
    setDraggingId(null);
    setPointer(null);
    setHoveredTargetId(null);
    window.removeEventListener("pointermove", handlers.current.move);
    window.removeEventListener("pointerup", handlers.current.up);
    window.removeEventListener("pointercancel", handlers.current.up);
  }

  // Defined once via a ref (not re-created each render) so the exact same
  // function identity is used to add and remove the window listeners.
  // Reads everything through refs at call time, so it never goes stale
  // even though it's only "created" on the first render.
  const handlers = useRef({
    move(event: PointerEvent) {
      if (!activeId.current || !startPos.current) return;
      const dx = event.clientX - startPos.current.x;
      const dy = event.clientY - startPos.current.y;
      if (!moved.current && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
        moved.current = true;
      }
      if (moved.current) {
        event.preventDefault();
        setPointer({ x: event.clientX, y: event.clientY });
        setHoveredTargetId(hitTest(event.clientX, event.clientY));
      }
    },
    up(event: PointerEvent) {
      if (activeId.current && moved.current) {
        const targetId = hitTest(event.clientX, event.clientY);
        if (targetId) {
          onDropRef.current(activeId.current, targetId, event.clientX, event.clientY);
        }
        suppressClick.current = true;
        window.setTimeout(() => {
          suppressClick.current = false;
        }, 0);
      }
      cleanup();
    },
  });

  useEffect(() => {
    // handlers.current is set once on the initial render and never
    // reassigned afterward (see the useRef initializer above), so it's
    // safe to capture the same object reference here for the unmount
    // cleanup — copied into a local first only to satisfy the lint rule
    // against reading a ref inside a cleanup closure.
    const stableHandlers = handlers.current;
    return () => {
      window.removeEventListener("pointermove", stableHandlers.move);
      window.removeEventListener("pointerup", stableHandlers.up);
      window.removeEventListener("pointercancel", stableHandlers.up);
    };
  }, []);

  function startDrag(itemId: string, event: ReactPointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    activeId.current = itemId;
    moved.current = false;
    startPos.current = { x: event.clientX, y: event.clientY };
    setDraggingId(itemId);
    window.addEventListener("pointermove", handlers.current.move, { passive: false });
    window.addEventListener("pointerup", handlers.current.up);
    window.addEventListener("pointercancel", handlers.current.up);
  }

  return {
    /** The item currently under the pointer (set from the very first
     * pointerdown, even before the movement threshold is crossed). */
    draggingId,
    /** True only once an in-progress gesture has actually become a drag
     * (crossed DRAG_THRESHOLD_PX) — use this to decide whether to render
     * a ghost/dim the source, not draggingId alone, or a plain tap would
     * flash a ghost for a frame. */
    isDragging: pointer !== null,
    pointer,
    hoveredTargetId,
    /** Spread onto a draggable element. touchAction: "none" is set
     * unconditionally (not just while dragging) so a touch that starts
     * here is never claimed by the browser's native scroll before our
     * own pointermove threshold check gets a chance to run. */
    dragHandleProps(itemId: string) {
      return {
        onPointerDown: (event: ReactPointerEvent) => startDrag(itemId, event),
        style: { touchAction: "none" as const },
      };
    },
    /** Ref callback to register an element as a drop target under this id. */
    dropTargetRef(targetId: string) {
      return (el: HTMLElement | null) => {
        if (el) targets.current.set(targetId, el);
        else targets.current.delete(targetId);
      };
    },
    /** Live rect of a registered target, for callers (Gantt) that need to
     * turn the drop point into a position within the target themselves. */
    getTargetRect(targetId: string): DOMRect | null {
      const el = targets.current.get(targetId);
      return el ? el.getBoundingClientRect() : null;
    },
    /** True for the one click that immediately follows a real drop — let
     * a drop target's own onClick check this and bail out so a drag
     * can't also trigger that target's tap-to-place handler a second
     * time via a browser-synthesized trailing click. */
    wasDrag(): boolean {
      return suppressClick.current;
    },
  };
}
