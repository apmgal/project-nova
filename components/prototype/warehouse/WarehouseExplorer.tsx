"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { RotateCcw } from "lucide-react";
import type { Application, SPEObject } from "@splinetool/runtime";
import { createOrbitCamera, PRODUCTION_INTERIOR_VIEWS, PRODUCTION_VIEW, QUALITY_LAB_INTERIOR_VIEWS, QUALITY_LAB_VIEW, siteViewFor, WAREHOUSE_INTERIOR_VIEWS, WAREHOUSE_VIEW, type OrbitCamera, type OrbitConfig } from "./orbitCamera";
import { createThirdPersonController, walkView, type ThirdPersonController } from "./thirdPersonController";
import InvestigationPopup from "./InvestigationPopup";
import EvidenceToast from "./EvidenceToast";
import { startAmbientMotion, type AmbientMotion } from "./ambientMotion";
import { playCue } from "@/lib/nova/act5Sound";
import { evidenceStore, useEvidence, type EvidenceItem } from "./evidenceStore";

/**
 * Project Nova — Warehouse Exploration Prototype (v1).
 * Standalone: not wired into GameRoot or the main storyline state.
 */

// Published code export of the warehouse scene (Spline → Export → Code).
export const SCENE_URL = "https://prod.spline.design/v9wna4nptzlyeN4d/scene.splinecode";
// Bump after republishing from Spline so browsers can't reuse an older cached copy of the scene.
const SCENE_VERSION = "2026-11-07d";

const CRATE_NAME = "Wrong_Component";
const CRATE_HIT_NAMES = new Set([CRATE_NAME, "Crate C on Pallet (Wrong_Component)"]);
const CAMERA_NAME = "Nova Camera";
const HOVER_RING_NAME = "Wrong_Component Highlight Ring"; // amber floor ring under the crate
const PLAYER_NAME = "Nova Player"; // rigged worker, shown only in walk mode

type Mode = "room" | "overview" | "walk" | "interior";
// "walk" needs the worker character; without it the room falls back to the mouse camera ("room").
let walkSupported = true;
/** Camera view used inside each room (the site overview has its own). */
const ROOM_VIEWS: Record<string, OrbitConfig> = { warehouse: WAREHOUSE_VIEW, production: PRODUCTION_VIEW, qualityLab: QUALITY_LAB_VIEW };
// Eye-level tours (Room B, then Room A — one shared system): per room, the Spline objects shown only
// while inside (walls/ceiling/lights), the floor markers (object name → viewpoint) and the cameras.
interface InteriorTour {
  shell: string;
  markers: string;
  nav: Record<string, string>;
  labels: Record<string, string>;
  views: Record<string, OrbitConfig>;
  /** Optional mood while inside: the shared scene lights are dimmed/cooled, then restored on leaving. */
  lighting?: { sun: number; ambient: number; ambientColor: string; fill?: number };
  /** Optional screen grade while inside (CSS on the 3D canvas only — UI and popups are unaffected). */
  grade?: { filter: string; vignette: string };
}
const INTERIOR_TOURS: Record<string, InteriorTour> = {
  production: {
    shell: "PF Interior Shell",
    markers: "PF Nav Markers",
    nav: { "PF Nav Entrance": "entrance", "PF Nav Filtration": "filtration", "PF Nav Planning": "planning" },
    labels: { entrance: "Entrance", filtration: "Filtration Unit", planning: "Engineering & Planning" },
    views: PRODUCTION_INTERIOR_VIEWS,
  },
  warehouse: {
    shell: "WH Interior Shell",
    markers: "WH Nav Markers",
    nav: { "WH Nav Entrance": "entrance", "WH Nav Receiving": "receiving", "WH Nav Racks": "racks" },
    labels: { entrance: "Warehouse Entrance", receiving: "Receiving Area", racks: "Storage Racks" },
    views: WAREHOUSE_INTERIOR_VIEWS,
    // Dim, cool storage hall: the overhead lamps in "WH Interior Shell" carry the light.
    lighting: { sun: 0.25, ambient: 0.3, ambientColor: "#b9c8de", fill: 0.1 },
    grade: {
      filter: "brightness(0.78) contrast(1.15) saturate(0.88)",
      vignette: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 40%, rgba(4,8,16,0.55) 100%), rgba(90,120,170,0.1)",
    },
  },
  qualityLab: {
    shell: "QL Interior Shell",
    markers: "QL Nav Markers",
    nav: { "QL Nav Entrance": "entrance", "QL Nav Testing": "testing", "QL Nav QA": "qa" },
    labels: { entrance: "Laboratory Entrance", testing: "Testing Workstation", qa: "QA Documentation Area" },
    views: QUALITY_LAB_INTERIOR_VIEWS,
    // Cool, clean and slightly softer than the Production Floor: a touch less sun, a bluer fill.
    lighting: { sun: 0.75, ambient: 0.72, ambientColor: "#dbe6ff" },
    grade: { filter: "saturate(0.93) contrast(1.03)", vignette: "rgba(150,185,255,0.07)" },
  },
};
const tourFor = (room: string): InteriorTour | null => INTERIOR_TOURS[room] ?? null;
/** Evidence indicator names: "<prefix> Evidence Icon <key>" / "<prefix> Evidence Done <key>". */
const iconPrefix = (room: string) => (room === "warehouse" ? "WH" : room === "qualityLab" ? "QL" : "PF");
const navIn = (room: string, names: Set<string>): string | null => {
  const nav = tourFor(room)?.nav ?? {};
  for (const n of names) if (nav[n]) return nav[n];
  return null;
};
const viewpointLabel = (room: string, vp: string) => tourFor(room)?.labels[vp] ?? vp;
let interiorViewpoint = "entrance";
const viewFor = (m: Mode, room = "warehouse"): OrbitConfig => {
  const tour = m === "interior" ? tourFor(room) : null;
  if (tour) return tour.views[interiorViewpoint] ?? tour.views.entrance;
  return m === "overview" ? siteViewFor(typeof window === "undefined" ? 1.6 : window.innerWidth / Math.max(1, window.innerHeight)) : m === "walk" && walkSupported ? walkView() : ROOM_VIEWS[room] ?? WAREHOUSE_VIEW;
};
// Overview: soft darkening toward the screen edges so the facility stays the focus.
const OVERVIEW_GRADE = { filter: "", vignette: "radial-gradient(ellipse 75% 70% at 50% 46%, rgba(0,0,0,0) 55%, rgba(6,8,12,0.55) 100%)" };
// Shared scene lights the Warehouse mood adjusts (originals are restored everywhere else).
const SUN_LIGHT = "Directional Light";
const AMBIENT_LIGHT = "Default Ambient Light";
const WAREHOUSE_FILL_LIGHT = "WHD Warm Fill Light";
const CLICK_MAX_MOVE_PX = 6; // more movement than this = a camera drag, not a click
const CLICK_MAX_MS = 600;
const HIT_GRACE_MS = 200; // tolerance between Spline's object hit and the DOM click
const LOAD_TIMEOUT_MS = 30000;

export const EVIDENCE_ITEM: EvidenceItem = {
  id: "flt-204b-delivery",
  label: "Evidence Discovered",
  title: "Suspicious Delivery",
  location: "Warehouse — Crate Inspection",
  detailLabel: "Delivered component",
  detailValue: "FLT-204B",
  body:
    "The filtration component delivered to the warehouse is labelled FLT-204B. Check the approved purchase order to verify whether it matches the required specification.",
};

/** Clickable evidence objects. Clicking one turns it amber (via its Spline variable) and opens its popup. */
interface Hotspot {
  /** Room the hotspot belongs to (only that room's hotspots respond). */
  room: string;
  /** Spline objects (with click/hover sensors) that count as clicking this hotspot. */
  hitNames: Set<string>;
  /** Spline variable whose VariableChange event shows the amber "Investigated" look. */
  variable: string;
  /** Optional floor ring that grows in on hover. */
  ringName?: string;
  /** Hover label ("Inspect …") and the Spline icons "<PF|WH> Evidence Icon <key>" / "<PF|WH> Evidence Done <key>". */
  label?: string;
  iconKey?: string;
  /** Generous invisible click/hover zone (world-space sphere) so the object is easy to select. */
  hitSphere?: { x: number; y: number; z: number; r: number };
  item: EvidenceItem;
}

// Room B popup wording below is a first draft — edit freely.
export const HOTSPOTS: Hotspot[] = [
  {
    room: "warehouse",
    hitNames: CRATE_HIT_NAMES,
    variable: "crateInvestigated",
    label: "Delivery Crate",
    iconKey: "Crate",
    hitSphere: { x: -1800, y: 40, z: -45, r: 70 },
    item: EVIDENCE_ITEM,
  },
  {
    room: "production",
    hitNames: new Set(["Incomplete_Filtration_Unit"]),
    ringName: "PF Hover Ring Filtration",
    label: "Filtration Unit",
    iconKey: "Filtration",
    hitSphere: { x: 400, y: 90, z: 60, r: 125 },
    variable: "filtrationInvestigated",
    item: {
      id: "filtration-install-incomplete",
      label: "Evidence Discovered",
      title: "Incomplete Installation",
      location: "Production Floor — Filtration Unit",
      detailLabel: "Installation checklist",
      detailValue: "4 of 9 steps signed off",
      body:
        "Only one of three filter housings is fitted, the outlet pipework is not connected and the unit is locked out. Installation is on hold until the correct filtration component arrives.",
    },
  },
  {
    room: "production",
    hitNames: new Set(["Engineer_Workstation"]),
    ringName: "PF Hover Ring Workstation",
    label: "Engineer Workstation",
    iconKey: "Workstation",
    hitSphere: { x: -400, y: 80, z: 345, r: 105 },
    variable: "workstationInvestigated",
    item: {
      id: "specialist-engineer-unavailable",
      label: "Evidence Discovered",
      title: "Specialist Engineer Unavailable",
      location: "Production Floor — Engineer's Workstation",
      detailLabel: "Resource schedule",
      detailValue: "Unavailable · next 3 weeks",
      body:
        "The only engineer qualified to finish the filtration installation is booked at another site for the next three weeks. No backup engineer has been assigned.",
    },
  },
  {
    room: "production",
    hitNames: new Set(["Commissioning_Schedule"]),
    ringName: "PF Hover Ring Schedule",
    label: "Commissioning Schedule",
    iconKey: "Schedule",
    hitSphere: { x: -440, y: 120, z: -170, r: 105 },
    variable: "scheduleInvestigated",
    item: {
      id: "qualification-blocked",
      label: "Evidence Discovered",
      title: "Qualification Blocked",
      location: "Production Floor — Commissioning Schedule",
      detailLabel: "Dependency",
      detailValue: "IQ/OQ start after installation",
      body:
        "Qualification testing (IQ and OQ) cannot begin until the filtration installation is complete and signed off. Every week of installation delay pushes back qualification and product release.",
    },
  },
  // ---- Room C — Quality Laboratory ----
  {
    room: "qualityLab",
    hitNames: new Set(["Qualification_Workstation"]),
    variable: "qualificationInvestigated",
    ringName: "Qualification_Workstation Highlight Ring",
    label: "Qualification Workstation",
    iconKey: "Qualification",
    hitSphere: { x: 1290, y: 70, z: -16, r: 105 },
    item: {
      id: "qc-qualification-status",
      label: "Evidence Discovered",
      title: "Equipment Qualification Status",
      location: "Quality Laboratory — Qualification Workstation",
      detailLabel: "Document",
      detailValue: "Qualification Progress Report",
      system: "Filtration System FLT-204A",
      checklist: [
        { label: "Installation Qualification (IQ)", status: "Pending final installation verification", tone: "warn" },
        { label: "Operational Qualification (OQ)", status: "Not started", tone: "bad" },
        { label: "Performance Qualification (PQ)", status: "Not started", tone: "bad" },
      ],
      body:
        "The filtration system's installation qualification cannot be closed until installation is complete and verified. Operational and performance qualification activities remain outstanding.",
      learningObjective: "Understand how installation completion affects qualification and commissioning readiness.",
    },
  },
  {
    room: "qualityLab",
    hitNames: new Set(["Laboratory_Testing_Bench"]),
    variable: "testingBenchInvestigated",
    ringName: "Laboratory_Testing_Bench Highlight Ring",
    label: "Testing Bench",
    iconKey: "TestingBench",
    hitSphere: { x: 800, y: 80, z: -5, r: 120 },
    item: {
      id: "qc-testing-readiness",
      label: "Evidence Discovered",
      title: "Testing Readiness Assessment",
      location: "Quality Laboratory — Laboratory Testing Bench",
      detailLabel: "Document",
      detailValue: "Laboratory Testing Readiness Log",
      checklist: [
        { label: "Laboratory analytical equipment", status: "Ready", tone: "ok" },
        { label: "Test methods and procedures", status: "Available", tone: "ok" },
        { label: "Production-system-dependent testing", status: "On hold", tone: "warn" },
        { label: "Required qualification samples", status: "Not yet available", tone: "bad" },
      ],
      body:
        "The laboratory is prepared to support qualification activities. However, testing dependent on the filtration system cannot proceed until the equipment has been installed and the necessary prerequisites are satisfied.",
      learningObjective: "Distinguish laboratory readiness from overall production-system readiness and recognise testing dependencies.",
    },
  },
  {
    room: "qualityLab",
    hitNames: new Set(["QA_Documentation_Cabinet"]),
    variable: "qaCabinetInvestigated",
    ringName: "QA_Documentation_Cabinet Highlight Ring",
    label: "QA Documentation Cabinet",
    iconKey: "QACabinet",
    hitSphere: { x: 825, y: 100, z: 474, r: 130 },
    item: {
      id: "qc-qa-readiness-review",
      label: "Evidence Discovered",
      title: "Quality Readiness Review",
      location: "Quality Laboratory — QA Documentation Cabinet",
      detailLabel: "Document",
      detailValue: "QA Readiness Checklist",
      checklist: [
        { label: "Equipment installation verification", status: "Outstanding", tone: "warn" },
        { label: "Qualification evidence", status: "Incomplete", tone: "warn" },
        { label: "Outstanding quality actions", status: "Open", tone: "warn" },
        { label: "Final readiness approval", status: "Not issued", tone: "bad" },
      ],
      body:
        "The QA team has not issued final readiness approval. Outstanding installation verification, qualification evidence and quality actions must be reviewed and appropriately resolved before readiness can be confirmed.",
      learningObjective: "Understand the importance of quality assurance, evidence-based approval and formal readiness gates.",
    },
  },
];
const CRATE_HOTSPOT = HOTSPOTS[0];
const hotspotIn = (room: string, names: Set<string>) =>
  HOTSPOTS.find((h) => h.room === room && [...names].some((n) => h.hitNames.has(n))) ?? null;

type Status = "loading" | "ready" | "error";
interface PointerState { x: number; y: number; lastX: number; lastY: number; t: number; button: number; mode: "rotate" | "pan"; dragged: boolean }
type AppCtor = new (canvas: HTMLCanvasElement, opts?: { renderMode?: "auto" | "manual" | "continuous" }) => Application;

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

interface WarehouseExplorerProps {
  /** When provided (in-game use), shows a Continue button that hands control back to the story. */
  onContinue?: () => void;
  /** Label for that button (default "Continue"). */
  continueLabel?: string;
  /** Whether the button is offered yet (default true). It always shows if the scene fails to load. */
  continueAvailable?: boolean;
  /** Called after Collect Evidence; isNew is false when it was already collected. */
  onEvidenceCollected?: (evidenceId: string, isNew: boolean) => void;
  /** Called when an evidence popup opens or closes (lets the host hold automatic navigation). */
  onPopupChange?: (open: boolean) => void;
  /** Called when the scene finishes loading ("ready") or fails ("error"). */
  onStatusChange?: (status: "loading" | "ready" | "error") => void;
  /** "room" (default): orbit around the warehouse and click the crate. "walk": third-person —
   * steer the worker with WASD, press E near the crate. "overview": the whole-site view, where
   * clicking a room's objects calls onSelectRoom. Switching flies the camera. */
  mode?: Mode;
  /** Spline object name → room id, for overview clicks and hover. */
  roomHitNames?: Record<string, string>;
  onSelectRoom?: (roomId: string) => void;
  onHoverRoom?: (roomId: string | null) => void;
  /** Spline object name → visible. Without it, site labels ("Site Label…/Site Status…") are hidden. */
  visibleObjects?: Record<string, boolean>;
  /**
   * Overview only: HTML location markers pinned to world points (they follow rotate/zoom).
   * Clicking one selects that room exactly like clicking the building; hovering reports it via onHoverRoom.
   */
  siteMarkers?: { id: string; label: string; x: number; y: number; z: number; content: ReactNode }[];
  /** Which room is open (camera view + which hotspots respond). Default "warehouse". */
  room?: string;
  /**
   * Hands-off cinematic mode (the Act 5 recovery montage): no mouse/touch input, hover, popups or
   * investigation UI, no floor markers or evidence icons, and the room switch leaves the camera to the
   * host, which drives it (and any scene objects) through onCinematicReady. Off by default.
   */
  cinematic?: boolean;
  /** Cinematic mode: called with the loaded scene + camera control once ready (and null on unmount). */
  onCinematicReady?: (control: CinematicControl | null) => void;
  /** false = the ambient forklift loop stays off (a scripted sequence moves the forklift). Default true. */
  ambientForklift?: boolean;
  /** false = the lab's ambient dissolution-head and fume-hood-sash motion stays off (scripted instead). Default true. */
  ambientLab?: boolean;
  /**
   * Cinematic mode: a CSS background painted behind the 3D canvas (graded like the scene). It shows
   * only where the scene itself is transparent, e.g. a sky seen through an open door.
   */
  backdrop?: string;
  /** The game's sound setting: interaction and motion cues stay silent while muted. Default false. */
  muted?: boolean;
}

/** What a scripted cinematic gets: the Spline scene, and the camera (cut, or a timed glide in seconds). */
export interface CinematicControl {
  app: Application;
  setView: (view: OrbitConfig, opts?: { duration?: number }) => void;
  /** World point → canvas pixels (z < 1 = in front of the camera); null if the camera isn't reachable. */
  project: (x: number, y: number, z: number) => { x: number; y: number; z: number } | null;
}

export default function WarehouseExplorer({
  onContinue,
  continueLabel = "Continue",
  continueAvailable = true,
  onEvidenceCollected,
  onPopupChange,
  onStatusChange,
  mode = "room",
  roomHitNames,
  onSelectRoom,
  onHoverRoom,
  visibleObjects,
  siteMarkers,
  room = "warehouse",
  cinematic = false,
  onCinematicReady,
  ambientForklift = true,
  ambientLab = true,
  backdrop,
  muted = false,
}: WarehouseExplorerProps = {}) {
  // Sound (lib/nova/act5Sound.ts): read by long-lived listeners, so kept in a ref.
  const mutedRef = useRef(muted);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  // Fixed for the lifetime of a viewer (read by the scene's long-lived listeners).
  const cinematicRef = useRef(cinematic);
  const ambientForkliftRef = useRef(ambientForklift);
  const ambientLabRef = useRef(ambientLab);
  const onCinematicReadyRef = useRef(onCinematicReady);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const orbitRef = useRef<OrbitCamera | null>(null);
  const crateRef = useRef<SPEObject | null>(null);
  const ambientRef = useRef<AmbientMotion | null>(null);
  const ringRef = useRef<SPEObject | null>(null);
  const hoverNamesRef = useRef<Set<string>>(new Set()); // objects Spline reported under the pointer this move
  const hoveredRoomRef = useRef<string | null>(null);
  const playerRef = useRef<SPEObject | null>(null);
  const tpRef = useRef<ThirdPersonController | null>(null);
  const modeRef = useRef(mode);
  const roomRef = useRef(room);
  const highlightedRef = useRef<Set<string>>(new Set()); // hotspots already shown as investigated
  const hoverHotspotRef = useRef<Hotspot | null>(null);
  const roomHitNamesRef = useRef(roomHitNames);
  const onSelectRoomRef = useRef(onSelectRoom);
  const onHoverRoomRef = useRef(onHoverRoom);
  const crateHighlightedRef = useRef(false);
  const pointerRef = useRef<PointerState | null>(null);
  const popupOpenRef = useRef(false);
  // Objects Spline reported for the current press (an object + its parent groups arrive separately).
  const pressHitsRef = useRef<{ t: number; names: Set<string> }>({ t: -Infinity, names: new Set() });
  const awaitingHitRef = useRef(0);
  const rayHotspotRef = useRef<Hotspot | null>(null); // hotspot zone under the last click
  const openPopupRef = useRef<() => void>(() => {});
  const resolveClickRef = useRef<(names: Set<string>) => void>(() => {});

  const [status, setStatus] = useState<Status>("loading");
  useEffect(() => { onStatusChangeRef.current?.(status); }, [status]);
  const [errorMsg, setErrorMsg] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [popupOpen, setPopupOpen] = useState(false);
  const onPopupChangeRef = useRef(onPopupChange);
  onPopupChangeRef.current = onPopupChange;
  useEffect(() => { onPopupChangeRef.current?.(popupOpen); }, [popupOpen]);
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;
  const [viewpoint, setViewpoint] = useState("entrance");
  // Pointer-following hover label ("Inspect Filtration Unit", "Go to …").
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const hoverLabelRef = useRef<string | null>(null);
  const hoverTipRef = useRef<HTMLDivElement>(null);
  const showHoverLabel = (text: string | null) => {
    if (hoverLabelRef.current === text) return;
    hoverLabelRef.current = text;
    setHoverLabel(text);
  };
  const [activeHotspot, setActiveHotspot] = useState<Hotspot>(CRATE_HOTSPOT);
  const activeHotspotRef = useRef<Hotspot>(CRATE_HOTSPOT);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [nearCrate, setNearCrate] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [clickFx, setClickFx] = useState<{ id: number; x: number; y: number } | null>(null);
  const [walkUnavailable, setWalkUnavailable] = useState(false);
  const clickFxRef = useRef<HTMLDivElement>(null);
  const { has, collect } = useEvidence();

  // ---------- Crate highlight: amber via Spline state, enlarge via GSAP ----------
  const highlightCrate = useCallback((instant = false) => {
    if (crateHighlightedRef.current) return; // never enlarge twice
    crateHighlightedRef.current = true;
    const app = appRef.current;
    const crate = crateRef.current;
    // Fires the scene's VariableChange event: crate → "Investigated" (amber) + floor ring.
    try { app?.setVariable("crateInvestigated", true); } catch (e) { console.warn("[Nova] setVariable failed", e); }
    if (!crate) return;
    const baseY = crate.position.y;
    const lift = 25 * 0.3; // half the crate height × growth keeps its base on the pallet
    const tween = { s: crate.scale.x };
    gsap.to(tween, {
      s: 1.3,
      duration: instant ? 0 : 0.4,
      ease: "back.out(1.6)",
      onUpdate: () => {
        crate.scale.x = crate.scale.y = crate.scale.z = tween.s;
        crate.position.y = baseY + ((tween.s - 1) / 0.3) * lift;
        app?.requestRender();
      },
    });
  }, []);

  // Room B hotspots: the scene's VariableChange event turns the object amber and shows its floor ring.
  const highlightHotspot = useCallback((h: Hotspot, instant = false) => {
    if (h === CRATE_HOTSPOT) return highlightCrate(instant);
    if (highlightedRef.current.has(h.item.id)) return;
    highlightedRef.current.add(h.item.id);
    try { appRef.current?.setVariable(h.variable, true); } catch (e) { console.warn("[Nova] setVariable failed", e); }
  }, [highlightCrate]);

  // ---------- Load the Spline scene ----------
  useEffect(() => {
    let disposed = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const cinematicReady = cinematicRef.current ? onCinematicReadyRef.current : undefined;

    (async () => {
      try {
        if (!hasWebGL()) {
          throw new Error("Your browser or device does not support WebGL, which is needed to display the 3D warehouse.");
        }
        // Test hook: automated tests may inject a stand-in runtime (never set in normal use).
        const injected = (window as unknown as { __NOVA_SPLINE_MOCK__?: { Application: AppCtor } }).__NOVA_SPLINE_MOCK__;
        const { Application: SplineApp } = injected ?? ((await import("@splinetool/runtime")) as unknown as { Application: AppCtor });
        if (disposed || !canvasRef.current) return;
        const app = new SplineApp(canvasRef.current, { renderMode: "auto" });
        appRef.current = app;
        await Promise.race([
          app.load(`${SCENE_URL}?v=${SCENE_VERSION}`),
          new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error("The warehouse took too long to load.")), LOAD_TIMEOUT_MS);
          }),
        ]);
        clearTimeout(timeoutId);
        if (disposed) return;

        const camera = app.findObjectByName(CAMERA_NAME);
        if (!camera) throw new Error(`Camera "${CAMERA_NAME}" was not found in the Spline scene.`);
        crateRef.current = app.findObjectByName(CRATE_NAME) ?? null;
        ringRef.current = app.findObjectByName(HOVER_RING_NAME) ?? null;
        if (!crateRef.current) console.warn(`[Nova] Crate "${CRATE_NAME}" not found — interaction disabled.`);

        orbitRef.current = createOrbitCamera(camera, () => app.requestRender(), viewFor(modeRef.current, roomRef.current));

        // Production Floor hotspots (Room B) stay inactive until that room is playable.
        try { app.setVariable("productionFloorActive", false); } catch { /* older scene */ }
        try { app.setVariable("qualityLabActive", false); } catch { /* older scene */ }

        // Third-person walking (used in "walk" mode).
        playerRef.current = app.findObjectByName(PLAYER_NAME) ?? null;
        walkSupported = !!playerRef.current;
        if (playerRef.current) {
          console.info("[Nova] Walking ready: arrow keys to move, Enter to inspect.");
          tpRef.current = createThirdPersonController({
            player: playerRef.current,
            pivots: {
              hipL: app.findObjectByName("Nova Player Hip L"),
              hipR: app.findObjectByName("Nova Player Hip R"),
              shoulderL: app.findObjectByName("Nova Player Shoulder L"),
              shoulderR: app.findObjectByName("Nova Player Shoulder R"),
            },
            orbit: orbitRef.current,
            requestRender: () => app.requestRender(),
            onNearChange: setNearCrate,
            onInteract: () => { if (!popupOpenRef.current) openPopupRef.current(); },
            onFirstMove: () => setShowControls(false),
          });
          if (isWalking()) enterWalk();
        } else {
          console.info("[Nova] No walking character in the scene — using the mouse camera.");
          setWalkUnavailable(true);
        }

        // Spline reports which objects (with action-less sensors) received the press; the app
        // decides whether it was a click. Events can land just before or after the DOM pointer
        // events, so match by time.
        app.addEventListener("mouseDown", (e) => {
          const name = e.target?.name;
          if (!name) return;
          const now = performance.now();
          if (now - pressHitsRef.current.t > HIT_GRACE_MS) pressHitsRef.current = { t: now, names: new Set() };
          pressHitsRef.current.names.add(name);
          if (awaitingHitRef.current && now - awaitingHitRef.current < HIT_GRACE_MS) {
            awaitingHitRef.current = 0;
            // let the object's parent groups (dispatched right after) join the same press
            setTimeout(() => resolveClickRef.current(pressHitsRef.current.names), 0);
          }
        });

        // Hover: sensors report on every pointer move while an object is under the pointer
        // (plus once as it leaves), so the pointermove handler below treats "reported during
        // this move" as hovering.
        app.addEventListener("mouseHover", (e) => {
          if (e.target?.name) hoverNamesRef.current.add(e.target.name);
        });

        applyVisibility();
        if (!cinematicRef.current) for (const h of HOTSPOTS) if (has(h.item.id)) highlightHotspot(h, true);
        // Decorative motion (forklift, conveyor trays, dissolution head): only while that room or the
        // overview is on screen, never while the scene is paused for a popup.
        ambientRef.current = startAmbientMotion(
          app,
          (r) => modeRef.current === "overview" || roomRef.current === r,
          () => popupOpenRef.current || app.isStopped,
          () => (modeRef.current === "overview" ? null : roomRef.current),
          {
            forklift: ambientForkliftRef.current,
            lab: ambientLabRef.current,
            // Motion sounds follow the animation, and only inside that room (not the distant overview).
            onCue: (cue, r) => {
              if (cinematicRef.current || modeRef.current === "overview" || roomRef.current !== r) return;
              playCue(cue, mutedRef.current);
            },
          },
        );
        setStatus("ready");
        if (cinematicReady) {
          cinematicReady({
            app,
            setView: (view, opts) => orbitRef.current?.setConfig(view, opts?.duration ? { duration: opts.duration } : { jump: true }),
            // Same projection as the overview markers (the runtime's camera is an internal field).
            project: (x, y, z) => {
              type Cam = { position: { clone(): { set(x: number, y: number, z: number): { project(c: unknown): { x: number; y: number; z: number } } } }; updateMatrixWorld?: () => void };
              const cam = (app as unknown as { _camera?: Cam })._camera;
              const canvas = canvasRef.current;
              if (!cam || !canvas) return null;
              try {
                cam.updateMatrixWorld?.();
                const v = cam.position.clone().set(x, y, z).project(cam);
                return { x: ((v.x + 1) / 2) * canvas.clientWidth, y: ((1 - v.y) / 2) * canvas.clientHeight, z: v.z };
              } catch { return null; }
            },
          });
        }
      } catch (err) {
        if (disposed) return;
        console.error("[Nova] Warehouse failed to load", err);
        setErrorMsg(err instanceof Error ? err.message : "The warehouse could not be loaded.");
        setStatus("error");
      }
    })();

    return () => {
      disposed = true;
      clearTimeout(timeoutId);
      cinematicReady?.(null);
      ambientRef.current?.dispose();
      ambientRef.current = null;
      tpRef.current?.dispose();
      tpRef.current = null;
      orbitRef.current?.dispose();
      orbitRef.current = null;
      appRef.current?.dispose();
      appRef.current = null;
      crateHighlightedRef.current = false;
      highlightedRef.current = new Set();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // ---------- Click-to-walk: the floor point under the pointer ----------
  // Uses the Spline runtime's own click ray (an internal, undocumented field). If a future runtime
  // drops it, this returns null and floor clicks simply do nothing — keys and the crate still work.
  type V3 = { x: number; y: number; z: number };
  function pointerRay(e: PointerEvent): { origin: V3; direction: V3 } | null {
    type EventCtx = { updateRaycaster?: (ev: PointerEvent) => void; domRect?: DOMRect; raycaster?: { ray?: { origin: V3; direction: V3 } } };
    const ec = (appRef.current as unknown as { eventManager?: { eventContext?: EventCtx } } | null)?.eventManager?.eventContext;
    if (!ec?.updateRaycaster || !canvasRef.current) return null;
    try {
      ec.domRect = canvasRef.current.getBoundingClientRect();
      ec.updateRaycaster(e);
    } catch {
      return null;
    }
    const ray = ec.raycaster?.ray;
    return ray ? { origin: { ...ray.origin }, direction: { ...ray.direction } } : null;
  }

  // Invisible, generous click zones: the nearest hotspot whose sphere the pointer ray passes through.
  function hotspotAtRay(e: PointerEvent): Hotspot | null {
    const ray = pointerRay(e);
    if (!ray) return null;
    const { origin: o, direction: d } = ray;
    let best: Hotspot | null = null;
    let bestT = Infinity;
    for (const h of HOTSPOTS) {
      const s = h.hitSphere;
      if (!s || h.room !== roomRef.current) continue;
      const t = (s.x - o.x) * d.x + (s.y - o.y) * d.y + (s.z - o.z) * d.z;
      if (t <= 0) continue;
      const px = o.x + d.x * t - s.x, py = o.y + d.y * t - s.y, pz = o.z + d.z * t - s.z;
      if (px * px + py * py + pz * pz <= s.r * s.r && t < bestT) { best = h; bestT = t; }
    }
    return best;
  }

  function floorPointAt(e: PointerEvent): { x: number; z: number } | null {
    const ray = pointerRay(e);
    if (!ray || ray.direction.y > -0.02) return null; // pointing at or above the horizon
    const t = -ray.origin.y / ray.direction.y; // intersect the floor plane y = 0
    return { x: ray.origin.x + ray.direction.x * t, z: ray.origin.z + ray.direction.z * t };
  }

  // ---------- Overview helpers: which room an object belongs to, label visibility ----------
  function roomFor(names: Set<string>): string | null {
    const map = roomHitNamesRef.current ?? {};
    for (const n of names) if (map[n]) return map[n];
    return null;
  }

  /** True when actually walking (walk mode AND the character exists); otherwise rooms use the mouse camera. */
  function isWalking() {
    return modeRef.current === "walk" && !!tpRef.current;
  }

  function enterWalk() {
    const tp = tpRef.current;
    if (!tp) return;
    tp.reset();
    tp.setEnabled(!popupOpenRef.current);
    setShowControls(true);
  }

  function applyVisibility() {
    const app = appRef.current;
    if (!app) return;
    if (playerRef.current) playerRef.current.visible = isWalking();
    if (visibleObjectsRef.current) {
      for (const [name, v] of Object.entries(visibleObjectsRef.current)) {
        const o = app.findObjectByName(name);
        if (o) o.visible = v;
      }
    } else {
      // Standalone use: the overview-only site labels stay hidden.
      for (const o of app.getAllObjects?.() ?? []) {
        if (o.name.startsWith("Site Label ") || o.name.startsWith("Site Status ")) o.visible = false;
      }
    }
    // Eye-level tours: walls/ceiling/lights and the floor markers exist only while inside that room
    // (the marker for where you're standing is hidden).
    const inside = modeRef.current === "interior";
    for (const [r, tour] of Object.entries(INTERIOR_TOURS)) {
      const here = inside && roomRef.current === r;
      const shell = app.findObjectByName(tour.shell);
      if (shell) shell.visible = here;
      const markers = app.findObjectByName(tour.markers);
      if (markers) markers.visible = here && !cinematicRef.current;
      for (const [name, vp] of Object.entries(tour.nav)) {
        const o = app.findObjectByName(name);
        if (o) o.visible = here && vp !== interiorViewpoint && !cinematicRef.current;
      }
    }
    applyRoomLighting(inside ? tourFor(roomRef.current)?.lighting ?? null : null);
    // Evidence indicators: cyan while there's evidence to find, amber once collected (inside the room only).
    for (const h of HOTSPOTS) {
      if (!h.iconKey) continue;
      const inRoom = modeRef.current !== "overview" && roomRef.current === h.room;
      const done = evidenceStore.has(h.item.id);
      const prefix = iconPrefix(h.room);
      const icon = app.findObjectByName(`${prefix} Evidence Icon ${h.iconKey}`);
      const tick = app.findObjectByName(`${prefix} Evidence Done ${h.iconKey}`);
      if (icon) icon.visible = inRoom && !done && !cinematicRef.current;
      if (tick) tick.visible = inRoom && done && !cinematicRef.current;
    }
    app.requestRender();
  }

  // Room mood: dim/cool the shared sun, ambient and warm fill while inside a tour that asks for it
  // (the Warehouse); restore the scene's own values everywhere else, so other rooms are unaffected.
  const lightDefaultsRef = useRef<{ sun?: number; fill?: number; ambient?: number; ambientColor?: number } | null>(null);
  function applyRoomLighting(mood: InteriorTour["lighting"] | null) {
    const app = appRef.current;
    if (!app) return;
    const sun = app.findObjectByName(SUN_LIGHT);
    const fill = app.findObjectByName(WAREHOUSE_FILL_LIGHT);
    // The ambient fill is not a Spline object; reach it through the runtime's three.js scene (internal).
    type HemiLight = { intensity: number; color?: { getHex(): number; setHex(h: number): void } };
    const scene = (app as unknown as { _scene?: { getObjectByName?: (n: string) => HemiLight | undefined } })._scene;
    let ambient: HemiLight | undefined;
    try { ambient = scene?.getObjectByName?.(AMBIENT_LIGHT); } catch { ambient = undefined; }
    if (!lightDefaultsRef.current) {
      lightDefaultsRef.current = { sun: sun?.intensity, fill: fill?.intensity, ambient: ambient?.intensity, ambientColor: ambient?.color?.getHex() };
    }
    const d = lightDefaultsRef.current;
    if (sun && d.sun !== undefined) sun.intensity = mood ? mood.sun : d.sun;
    if (fill && d.fill !== undefined) fill.intensity = mood?.fill ?? d.fill;
    if (ambient && d.ambient !== undefined) {
      ambient.intensity = mood ? mood.ambient : d.ambient;
      if (ambient.color && d.ambientColor !== undefined) ambient.color.setHex(mood ? parseInt(mood.ambientColor.slice(1), 16) : d.ambientColor);
    }
  }

  function setRoomHover(roomId: string | null) {
    if (hoveredRoomRef.current === roomId) return;
    hoveredRoomRef.current = roomId;
    if (wrapRef.current) wrapRef.current.style.cursor = roomId ? "pointer" : "";
    onHoverRoomRef.current?.(roomId);
  }

  // ---------- Hotspot hover: hand cursor (+ the crate's amber floor ring) ----------
  function setHotspotHover(h: Hotspot | null) {
    if (!h) showHoverLabel(null);
    const prev = hoverHotspotRef.current;
    if (prev === h) return;
    hoverHotspotRef.current = h;
    if (wrapRef.current) wrapRef.current.style.cursor = h ? "pointer" : "";
    if (prev) setRingHover(prev, false);
    if (h) setRingHover(h, true);
  }

  // A hotspot's amber floor ring grows in while hovered (if it has one).
  function setRingHover(h: Hotspot, on: boolean) {
    const ring = h === CRATE_HOTSPOT ? ringRef.current : h.ringName ? appRef.current?.findObjectByName(h.ringName) ?? null : null;
    const done = h === CRATE_HOTSPOT ? crateHighlightedRef.current : highlightedRef.current.has(h.item.id);
    // Once investigated the ring stays on (driven by the scene), so hover leaves it alone.
    if (!ring || done) return;
    const t = { s: ring.scale.x };
    gsap.to(t, {
      s: on ? 1 : 0.01,
      duration: 0.2,
      ease: "power2.out",
      onUpdate: () => {
        ring.scale.x = ring.scale.y = ring.scale.z = t.s;
        appRef.current?.requestRender();
      },
    });
  }

  // ---------- Popup open / close ----------
  const openPopup = useCallback((h: Hotspot = CRATE_HOTSPOT) => {
    if (popupOpenRef.current) return;
    popupOpenRef.current = true;
    orbitRef.current?.setEnabled(false);
    tpRef.current?.setEnabled(false);
    highlightHotspot(h);
    activeHotspotRef.current = h;
    setActiveHotspot(h);
    setPopupOpen(true);
    playCue("evidenceOpen", mutedRef.current);
  }, [highlightHotspot]);

  useEffect(() => {
    openPopupRef.current = openPopup;
    // A confirmed click: open the crate (room mode) or pick a room (overview).
    resolveClickRef.current = (names) => {
      if (modeRef.current === "overview") {
        const room = roomFor(names);
        if (room) onSelectRoomRef.current?.(room);
      } else {
        const h = hotspotIn(roomRef.current, names);
        const nav = modeRef.current === "interior" ? navIn(roomRef.current, names) : null;
        if (!h && nav) return moveToViewpoint(nav);
        if (!h) {
          // Not on the object itself: use the generous click zone around it.
          const near = rayHotspotRef.current;
          if (near) openPopup(near);
          return;
        }
        // Walking: you have to be standing at the crate to inspect it.
        if (h === CRATE_HOTSPOT && isWalking() && !tpRef.current?.isNear()) {
          tpRef.current?.walkToInteract(() => openPopupRef.current());
        } else {
          openPopup(h);
        }
      }
    };
  });

  // Eye-level tour: glide (~1 s) to another predefined viewpoint.
  function moveToViewpoint(vp: string) {
    if (vp === interiorViewpoint) return;
    interiorViewpoint = vp;
    setViewpoint(vp);
    setHotspotHover(null);
    applyVisibility();
    orbitRef.current?.setConfig(viewFor(modeRef.current, roomRef.current), { fly: true });
  }

  // Keep the latest props reachable from the scene's long-lived listeners.
  // Overview markers: project each world anchor through the runtime's camera every frame
  // (internal field, like the click ray above; without it the markers simply stay hidden).
  const markerElsRef = useRef<Record<string, HTMLButtonElement | null>>({});
  const siteMarkersRef = useRef(siteMarkers);
  useEffect(() => { siteMarkersRef.current = siteMarkers; });
  useEffect(() => {
    if (mode !== "overview" || status !== "ready") return;
    type Projected = { x: number; y: number; z: number };
    type Cam = { position: { clone(): { set(x: number, y: number, z: number): { project(c: unknown): Projected } } }; updateMatrixWorld?: () => void };
    let raf = 0;
    const tick = () => {
      const cam = (appRef.current as unknown as { _camera?: Cam } | null)?._camera;
      const canvas = canvasRef.current;
      for (const m of siteMarkersRef.current ?? []) {
        const el = markerElsRef.current[m.id];
        if (!el) continue;
        let shown = false;
        if (cam && canvas) {
          try {
            cam.updateMatrixWorld?.();
            const v = cam.position.clone().set(m.x, m.y, m.z).project(cam);
            shown = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
            el.style.transform = `translate(${((v.x + 1) / 2) * canvas.clientWidth}px, ${((1 - v.y) / 2) * canvas.clientHeight}px) translate(-50%, -100%)`;
          } catch { shown = false; }
        }
        el.style.visibility = shown ? "visible" : "hidden";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, status]);

  const visibleObjectsRef = useRef(visibleObjects);
  useEffect(() => {
    roomHitNamesRef.current = roomHitNames;
    onSelectRoomRef.current = onSelectRoom;
    onHoverRoomRef.current = onHoverRoom;
    visibleObjectsRef.current = visibleObjects;
    if (status === "ready") applyVisibility();
  });

  // Switching between the site overview and the room flies the camera between their views.
  useEffect(() => {
    if (modeRef.current === mode && roomRef.current === room) return;
    const prev = modeRef.current;
    modeRef.current = mode;
    roomRef.current = room;
    setHotspotHover(null);
    setRoomHover(null);
    if (prev === "walk") {
      tpRef.current?.setEnabled(false);
      setNearCrate(false);
      setShowControls(false);
    }
    if (mode === "walk") enterWalk();
    // Entering or leaving the eye-level tour cuts instantly (the facility fades to black meanwhile).
    const cut = mode === "interior" || prev === "interior";
    if (mode === "interior") {
      interiorViewpoint = "entrance";
      // eslint-disable-next-line react-hooks/set-state-in-effect -- keep the on-screen label in sync with the camera
      setViewpoint("entrance");
    }
    applyVisibility();
    // Cinematic mode: the host's script owns the camera.
    if (!cinematicRef.current) orbitRef.current?.setConfig(viewFor(mode, room), cut ? { jump: true } : { fly: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, room]);

  // Floor-click feedback: a small ring that expands and fades where you clicked.
  useEffect(() => {
    if (!clickFx || !clickFxRef.current) return;
    const t = gsap.fromTo(clickFxRef.current, { scale: 0.3, opacity: 0.9 }, { scale: 1.4, opacity: 0, duration: 0.55, ease: "power2.out", onComplete: () => setClickFx(null) });
    return () => { t.kill(); };
  }, [clickFx]);

  // The controls hint fades on its own after a while, or as soon as the player moves.
  useEffect(() => {
    if (!showControls) return;
    const id = setTimeout(() => setShowControls(false), 8000);
    return () => clearTimeout(id);
  }, [showControls]);

  const closePopup = useCallback(() => {
    if (popupOpenRef.current) playCue("evidenceClose", mutedRef.current);
    popupOpenRef.current = false;
    setPopupOpen(false);
    orbitRef.current?.setEnabled(true);
    if (isWalking()) tpRef.current?.setEnabled(true);
  }, []);

  const onCollect = useCallback(() => {
    const item = activeHotspotRef.current.item;
    const added = collect(item);
    if (added) playCue("evidenceRecorded", mutedRef.current); // only a new finding is recorded
    setToast({ id: Date.now(), text: added ? "Evidence Collected" : "Already in your evidence" });
    onEvidenceCollected?.(item.id, added);
  }, [collect, onEvidenceCollected]);

  // ---------- Pointer input: rotate / pan / zoom + click-vs-drag ----------
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || status !== "ready" || cinematicRef.current) return; // cinematic: no player input

    const onDown = (e: PointerEvent) => {
      if (popupOpenRef.current) return;
      pointerRef.current = {
        x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY,
        t: performance.now(), button: e.button,
        // Walking: every drag looks around (the camera stays on the character).
        mode: !isWalking() && modeRef.current !== "interior" && (e.button === 2 || e.button === 1 || e.shiftKey) ? "pan" : "rotate",
        dragged: false,
      };
      wrap.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const p = pointerRef.current;
      if (!p || popupOpenRef.current) return;
      const dx = e.clientX - p.lastX;
      const dy = e.clientY - p.lastY;
      p.lastX = e.clientX;
      p.lastY = e.clientY;
      if (!p.dragged && Math.hypot(e.clientX - p.x, e.clientY - p.y) > CLICK_MAX_MOVE_PX) {
        p.dragged = true;
        setHotspotHover(null);
        showHoverLabel(null);
        setRoomHover(null);
      }
      if (!p.dragged) return;
      if (isWalking()) tpRef.current?.noteLook(); // a quick look; the camera eases back after
      if (p.mode === "pan") orbitRef.current?.pan(dx, dy, wrap.clientHeight);
      else orbitRef.current?.rotate(dx, dy);
    };
    const onUp = (e: PointerEvent) => {
      const p = pointerRef.current;
      pointerRef.current = null;
      if (wrap.hasPointerCapture?.(e.pointerId)) wrap.releasePointerCapture(e.pointerId);
      if (!p || popupOpenRef.current) return;
      const now = performance.now();
      const isClick = p.button === 0 && !p.dragged && now - p.t < CLICK_MAX_MS;
      if (!isClick) return;
      if (isWalking()) {
        // Walking: the crate walks over and opens it; anywhere else on the floor walks there.
        const pt = floorPointAt(e);
        const cx = e.clientX, cy = e.clientY, t0 = p.t;
        setTimeout(() => {
          const hits = pressHitsRef.current;
          const names = hits.t >= t0 - HIT_GRACE_MS ? hits.names : new Set<string>();
          if ([...names].some((n) => CRATE_HIT_NAMES.has(n))) resolveClickRef.current(names);
          else if (pt && tpRef.current) {
            tpRef.current.walkTo(pt.x, pt.z);
            setClickFx({ id: Date.now(), x: cx, y: cy });
          }
        }, 40);
        return;
      }
      rayHotspotRef.current = modeRef.current === "overview" ? null : hotspotAtRay(e);
      const hits = pressHitsRef.current;
      if (hits.t >= p.t - HIT_GRACE_MS && hits.names.size) resolveClickRef.current(hits.names);
      else {
        awaitingHitRef.current = now; // Spline's hit may still be on its way
        // Empty space (nothing Spline reports): still resolve, so the click zones work there too.
        setTimeout(() => {
          if (awaitingHitRef.current !== now) return;
          awaitingHitRef.current = 0;
          resolveClickRef.current(new Set());
        }, HIT_GRACE_MS);
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (popupOpenRef.current || isWalking() || modeRef.current === "interior") return; // fixed distance
      orbitRef.current?.zoom(e.deltaY);
    };
    const noMenu = (e: Event) => e.preventDefault();
    const onLeave = () => {
      setHotspotHover(null);
      showHoverLabel(null);
      setRoomHover(null);
    };
    // Bubbles up from the canvas after Spline's own pointermove raycast has run.
    const onHoverMove = (e: PointerEvent) => {
      if (hoverTipRef.current) hoverTipRef.current.style.transform = `translate(${e.clientX + 16}px, ${e.clientY + 18}px)`;
      const names = hoverNamesRef.current;
      hoverNamesRef.current = new Set();
      if (popupOpenRef.current || pointerRef.current?.dragged) return;
      if (modeRef.current === "overview") setRoomHover(roomFor(names));
      else {
        // Floor markers in the eye-level tour also show the hand cursor.
        const nav = modeRef.current === "interior" ? navIn(roomRef.current, names) : null;
        setHotspotHover(hotspotIn(roomRef.current, names) ?? (nav ? null : hotspotAtRay(e)));
        if (modeRef.current === "interior" && !hoverHotspotRef.current && wrapRef.current) {
          wrapRef.current.style.cursor = nav ? "pointer" : "";
        }
        const h = hoverHotspotRef.current;
        showHoverLabel(
          h?.label
            ? evidenceStore.has(h.item.id) ? `${h.label} · collected — click to review` : `Inspect ${h.label}`
            : nav ? `Go to ${viewpointLabel(roomRef.current, nav)}` : null,
        );
      }
    };

    // Capture phase so the press is recorded before the Spline canvas handles it.
    wrap.addEventListener("pointerdown", onDown, true);
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerup", onUp);
    wrap.addEventListener("pointercancel", onUp);
    wrap.addEventListener("wheel", onWheel, { passive: false });
    wrap.addEventListener("contextmenu", noMenu);
    wrap.addEventListener("pointerleave", onLeave);
    wrap.addEventListener("pointermove", onHoverMove);
    return () => {
      wrap.removeEventListener("pointerleave", onLeave);
      wrap.removeEventListener("pointermove", onHoverMove);
      wrap.removeEventListener("pointerdown", onDown, true);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerup", onUp);
      wrap.removeEventListener("pointercancel", onUp);
      wrap.removeEventListener("wheel", onWheel);
      wrap.removeEventListener("contextmenu", noMenu);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers only touch refs
  }, [status, openPopup]);

  // Pause Spline rendering/events while the popup covers the scene; resume after.
  useEffect(() => {
    const app = appRef.current;
    if (!app || status !== "ready") return;
    if (popupOpen) {
      const id = setTimeout(() => popupOpenRef.current && app.stop(), 500); // let the grow finish
      return () => clearTimeout(id);
    }
    if (app.isStopped) app.play();
  }, [popupOpen, status]);

  // Room mood grade (the Warehouse is dimmer and cooler than the bright Production Floor).
  const grade = mode === "interior" ? tourFor(room)?.grade ?? null : mode === "overview" ? OVERVIEW_GRADE : null;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#2b2f36]" style={{ fontFamily: "var(--font-body)" }}>
      <div
        ref={wrapRef}
        className={`absolute inset-0 touch-none transition-[filter,transform] duration-500 ${cinematic ? "pointer-events-none" : "cursor-grab active:cursor-grabbing"} ${
          popupOpen ? "scale-[1.01] blur-[3px] brightness-[0.55]" : ""
        }`}
      >
        {cinematic && backdrop && <div aria-hidden="true" className="absolute inset-0" style={{ background: backdrop, filter: grade?.filter }} />}
        <canvas ref={canvasRef} className="relative block h-full w-full outline-none" style={{ filter: grade?.filter }} />
        {grade && <div aria-hidden="true" className="pointer-events-none absolute inset-0 mix-blend-multiply" style={{ background: grade.vignette }} />}
      </div>

      {mode === "overview" && status === "ready" && siteMarkers?.map((m) => (
        <button
          key={m.id}
          ref={(el) => { markerElsRef.current[m.id] = el; }}
          type="button"
          aria-label={m.label}
          onClick={() => onSelectRoomRef.current?.(m.id)}
          onPointerEnter={() => setRoomHover(m.id)}
          onPointerLeave={() => setRoomHover(null)}
          style={{ visibility: "hidden" }}
          className="group absolute left-0 top-0 z-[15] cursor-pointer outline-none focus-visible:[&>*]:ring-2 focus-visible:[&>*]:ring-[var(--nova-gold-300)]"
        >
          {m.content}
        </button>
      ))}

      {onContinue && !popupOpen && (status === "error" || (status === "ready" && continueAvailable)) && (
        <button
          type="button"
          onClick={onContinue}
          className="absolute bottom-4 right-4 z-20 rounded-[var(--radius-sm)] border border-[var(--nova-gold-500)] bg-[var(--nova-gold-500)] px-5 py-2.5 text-sm font-bold text-[var(--nova-slate-950)] shadow-[var(--shadow-panel-dark)] hover:bg-[var(--nova-gold-400)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nova-gold-300)]"
        >
          {continueLabel}
        </button>
      )}

      {status === "ready" && !popupOpen && !cinematic && (
        <button
          type="button"
          onClick={() => orbitRef.current?.reset()}
          aria-label="Reset view"
          title="Reset view"
          className={`absolute bottom-4 ${onContinue ? "left-4" : "right-4"} grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-[var(--nova-slate-950)]/45 text-zinc-300/80 opacity-55 backdrop-blur-md transition hover:bg-[var(--nova-slate-950)]/75 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none`}
        >
          <RotateCcw size={17} />
        </button>
      )}

      {status === "loading" && !cinematic && (
        <div role="status" aria-live="polite" className="absolute inset-0 grid place-content-center justify-items-center gap-3.5 bg-[var(--nova-slate-950)] p-6 text-center">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[var(--nova-gold-500)]/20 border-t-[var(--nova-gold-500)]" />
          <p className="text-sm tracking-wide text-zinc-400">{mode === "overview" ? "Loading facility…" : "Loading warehouse…"}</p>
        </div>
      )}

      {status === "error" && !cinematic && (
        <div role="alert" className="absolute inset-0 grid place-content-center justify-items-center gap-3 bg-[var(--nova-slate-950)] p-6 text-center">
          <h2 className="text-xl font-bold text-zinc-100">Warehouse unavailable</h2>
          <p className="max-w-md text-zinc-400">{errorMsg}</p>
          <button
            type="button"
            onClick={() => {
              setStatus("loading");
              setAttempt((n) => n + 1);
            }}
            className="mt-1.5 rounded-[var(--radius-sm)] bg-[var(--nova-gold-500)] px-5 py-2.5 font-bold text-[var(--nova-slate-950)] hover:bg-[var(--nova-gold-400)]"
          >
            Try again
          </button>
        </div>
      )}

      {mode === "walk" && !walkUnavailable && status === "ready" && !popupOpen && showControls && (
        <div className="pointer-events-none absolute left-1/2 top-5 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-[var(--nova-slate-950)]/75 px-4 py-2 text-[13px] text-zinc-200 backdrop-blur-md">
          <Kbd>↑</Kbd> walk · <Kbd>←</Kbd><Kbd>→</Kbd> turn · <Kbd>↓</Kbd> back · <Kbd>Shift</Kbd> jog — or click the floor to walk there
        </div>
      )}

      {mode !== "overview" && (mode !== "walk" || walkUnavailable) && status === "ready" && !popupOpen && !cinematic && (
        <div className="pointer-events-none absolute left-1/2 top-5 z-20 max-w-[90vw] -translate-x-1/2 rounded-full border border-white/10 bg-[var(--nova-slate-950)]/80 px-4 py-2 text-center text-[13px] text-zinc-300 backdrop-blur-md">
          {mode === "interior"
            ? <>{viewpointLabel(room, viewpoint)} · drag to look around · click a blue marker to move · {room === "warehouse" ? "click the crate to inspect" : "click equipment to inspect"}</>
            : <>Scroll to zoom · drag to look around · {room === "warehouse" ? "click the crate to inspect" : "click equipment to inspect"}</>}
        </div>
      )}

      <div
        ref={hoverTipRef}
        aria-hidden={!hoverLabel}
        className={`pointer-events-none fixed left-0 top-0 z-30 whitespace-nowrap rounded-[var(--radius-sm)] border px-3 py-1.5 text-[13px] font-semibold shadow-[var(--shadow-panel-dark)] backdrop-blur-md transition-opacity duration-150 ${
          hoverLabel && !popupOpen ? "opacity-100" : "opacity-0"
        } ${hoverLabel?.startsWith("Go to") ? "border-sky-300/50 bg-[var(--nova-slate-950)]/85 text-sky-200" : hoverLabel?.includes("collected") ? "border-[var(--nova-gold-500)]/50 bg-[var(--nova-slate-950)]/85 text-[var(--nova-gold-300)]" : "border-cyan-300/50 bg-[var(--nova-slate-950)]/85 text-cyan-200"}`}
      >
        {hoverLabel}
      </div>

      {mode === "interior" && status === "ready" && !popupOpen && !cinematic && (
        <nav aria-label="Move to" className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 flex-wrap justify-center gap-2">
          {Object.keys(tourFor(room)?.labels ?? {}).filter((vp) => vp !== viewpoint).map((vp) => (
            <button
              key={vp}
              type="button"
              onClick={() => moveToViewpoint(vp)}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-sky-300/60 bg-[var(--nova-slate-950)]/80 px-3.5 py-2 text-[13px] font-semibold text-sky-200 shadow-[var(--shadow-panel-dark)] backdrop-blur-md hover:bg-[var(--nova-slate-900)]"
            >
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-sky-400" />
              Go to {viewpointLabel(room, vp)}
            </button>
          ))}
        </nav>
      )}

      {mode === "walk" && status === "ready" && !popupOpen && nearCrate && (
        <button
          type="button"
          onClick={() => openPopupRef.current()}
          className="absolute bottom-16 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-[var(--nova-gold-500)]/60 bg-[var(--nova-slate-950)]/85 px-4 py-2 text-sm font-semibold text-[var(--nova-gold-300)] shadow-[var(--shadow-panel-dark)] backdrop-blur-md hover:bg-[var(--nova-slate-900)]"
        >
          <Kbd gold>Enter</Kbd> Inspect crate
        </button>
      )}

      {clickFx && (
        <div
          key={clickFx.id}
          ref={clickFxRef}
          aria-hidden="true"
          className="pointer-events-none fixed z-20 h-10 w-10 rounded-full border-2 border-[var(--nova-gold-400)]"
          style={{ left: clickFx.x - 20, top: clickFx.y - 20 }}
        />
      )}

      {popupOpen && (
        <InvestigationPopup item={activeHotspot.item} collected={has(activeHotspot.item.id)} onCollect={onCollect} onClose={closePopup} />
      )}

      {toast && <EvidenceToast key={toast.id} text={toast.text} onDone={() => setToast(null)} />}
    </div>
  );
}

function Kbd({ children, gold }: { children: React.ReactNode; gold?: boolean }) {
  return (
    <kbd
      className={`mx-0.5 inline-grid min-w-[22px] place-items-center rounded-[5px] border px-1.5 py-[1px] font-mono text-[11px] font-bold ${
        gold ? "border-[var(--nova-gold-500)] bg-[var(--nova-gold-500)] text-[var(--nova-slate-950)]" : "border-white/25 bg-white/10 text-zinc-100"
      }`}
    >
      {children}
    </kbd>
  );
}
