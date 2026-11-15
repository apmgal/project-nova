"use client";

import FacilityExploration from "../facility/FacilityExploration";

/**
 * Shown by GameRoot between the end of Act 4 and ACT5_SCENE01. Now hosts the
 * Facility Exploration flow (room selection → Warehouse → …); the name is
 * kept so GameRoot's integration stays unchanged. Purely presentational:
 * it never reads or writes GameState. onContinue hands control back to
 * GameRoot's normal transition into Act 5, Scene 1.
 */
export default function WarehouseInterlude({ onContinue, muted = false }: { onContinue: () => void; muted?: boolean }) {
  return <FacilityExploration onContinue={onContinue} muted={muted} />;
}
