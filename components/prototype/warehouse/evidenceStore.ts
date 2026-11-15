import { useCallback, useSyncExternalStore } from "react";

/**
 * Prototype-only evidence state: an in-memory, de-duplicated record of
 * collected items. Deliberately separate from the main game's state — no UI
 * shows it as a counter. Exposed on window.__novaWarehouseEvidence for
 * inspection while testing. Resets on page reload.
 */
export interface EvidenceItem {
  id: string;
  label: string;
  title: string;
  location: string;
  detailLabel: string;
  detailValue: string;
  body: string;
  /** Optional extra line under the document name, e.g. the system it covers. */
  system?: string;
  /** Optional status list shown in the popup (tone colours the status). */
  checklist?: { label: string; status: string; tone?: "ok" | "warn" | "bad" }[];
  /** Designer note only — not shown to the player. */
  learningObjective?: string;
}
export interface CollectedEvidence extends EvidenceItem { collectedAt: string }

const items = new Map<string, CollectedEvidence>();
const listeners = new Set<() => void>();
let snapshot: CollectedEvidence[] = [];
const EMPTY: CollectedEvidence[] = [];

function emit() {
  snapshot = Array.from(items.values());
  listeners.forEach((l) => l());
}

export const evidenceStore = {
  collect(item: EvidenceItem): boolean {
    if (items.has(item.id)) return false; // never duplicate
    items.set(item.id, { ...item, collectedAt: new Date().toISOString() });
    emit();
    return true;
  },
  has: (id: string) => items.has(id),
  list: () => snapshot,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
};

if (typeof window !== "undefined") {
  (window as unknown as { __novaWarehouseEvidence?: typeof evidenceStore }).__novaWarehouseEvidence = evidenceStore;
}

export function useEvidence() {
  const list = useSyncExternalStore(evidenceStore.subscribe, evidenceStore.list, () => EMPTY);
  const has = useCallback((id: string) => list.some((i) => i.id === id), [list]);
  const collect = useCallback((item: EvidenceItem) => evidenceStore.collect(item), []);
  return { list, has, collect };
}
