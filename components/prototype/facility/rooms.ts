/**
 * Facility Exploration (between Act 4 and ACT5_SCENE01) — room config.
 * Single place to switch rooms on and change what Continue requires.
 */

export type RoomId = "warehouse" | "production" | "qualityLab";

export interface FacilityRoom {
  id: RoomId;
  name: string;
  /** Short description (used by the earlier card layout, RoomSelect.tsx). */
  blurb: string;
  /** false = shown as "Coming Soon" and not selectable. */
  available: boolean;
  /** Evidence ids (see evidenceStore) that complete this room. */
  requiredEvidence: string[];
  /** Spline objects (with click/hover sensors) that select this room in the site overview. */
  splineHitNames: string[];
  /** Spline status pins shown above the room in the site overview (gold / green / grey). */
  labels: { available?: string; explored?: string; locked?: string };
}

export const FACILITY_ROOMS: FacilityRoom[] = [
  {
    id: "warehouse",
    name: "Warehouse",
    blurb: "Inbound deliveries, storage racking and the inspection bay.",
    available: true,
    // The suspicious crate, Wrong_Component (evidence id from WarehouseExplorer).
    requiredEvidence: ["flt-204b-delivery"],
    splineHitNames: [
      "Warehouse Shell", "Industrial Pallet Racking", "Storage Racks", "Crate A on Pallet", "Crate B on Pallet",
      "Crate C on Pallet (Wrong_Component)", "Wrong_Component", "Inspection Table", "Pallet Jack",
      "Floor Markings", "Signage", "Site Status Warehouse Available", "Site Status Warehouse Explored",
    ],
    labels: { available: "Site Status Warehouse Available", explored: "Site Status Warehouse Explored" },
  },
  {
    id: "production",
    name: "Production Floor",
    blurb: "The new lines, mid-commissioning.",
    available: true,
    // The three Room B hotspots (evidence ids from WarehouseExplorer's HOTSPOTS).
    requiredEvidence: ["filtration-install-incomplete", "specialist-engineer-unavailable", "qualification-blocked"],
    splineHitNames: ["Site Production Floor", "Site Status Production Floor", "Site Status Production Floor Explored"],
    labels: { available: "Site Status Production Floor", explored: "Site Status Production Floor Explored" },
  },
  {
    id: "qualityLab",
    name: "Quality Laboratory",
    blurb: "Testing, records and batch release.",
    available: true,
    // The three Room C hotspots (evidence ids from WarehouseExplorer's HOTSPOTS).
    requiredEvidence: ["qc-qualification-status", "qc-testing-readiness", "qc-qa-readiness-review"],
    splineHitNames: ["Site Quality Laboratory", "Site Status Quality Laboratory", "Site Status Quality Laboratory Explored"],
    labels: { available: "Site Status Quality Laboratory", explored: "Site Status Quality Laboratory Explored" },
  },
];

/** Rooms that must be complete before the story moves on to Act 5. */
export const ROOMS_REQUIRED_FOR_CONTINUE: RoomId[] = ["warehouse", "production", "qualityLab"];

export function isRoomComplete(room: FacilityRoom, hasEvidence: (id: string) => boolean): boolean {
  return room.requiredEvidence.length > 0 && room.requiredEvidence.every(hasEvidence);
}

/** Spline object name → room id, for WarehouseExplorer's overview clicks/hover. */
export const ROOM_HIT_NAMES: Record<string, RoomId> = Object.fromEntries(
  FACILITY_ROOMS.flatMap((r) => r.splineHitNames.map((n) => [n, r.id] as const)),
);

/** Which status pins to show: all off inside a room; in the overview, each room's current status. */
export function siteLabelVisibility(inOverview: boolean, completed: Set<RoomId>): Record<string, boolean> {
  const vis: Record<string, boolean> = {};
  for (const r of FACILITY_ROOMS) {
    const { available, explored, locked } = r.labels;
    const done = completed.has(r.id);
    if (available) vis[available] = inOverview && !done;
    if (explored) vis[explored] = inOverview && done;
    if (locked) vis[locked] = inOverview;
  }
  return vis;
}
