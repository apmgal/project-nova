import {
  Hammer,
  Zap,
  Settings,
  ClipboardCheck,
  GraduationCap,
  FileText,
  type LucideIcon,
} from "lucide-react";

export interface WbsZoneStyle {
  Icon: LucideIcon;
  iconColor: string;
  dotColor: string;
  ring: string;
  fill: string;
}

/**
 * Shared per-zone icon/color map for the WBS's 6 warehouse zones
 * (Construction, Utilities, Equipment, Validation, Training,
 * Documentation). Used by both WBSBlueprint.tsx (the sort-into-zones
 * tree) and CBSReview.tsx (the cost-review tree, which reuses the exact
 * same zone grouping to review the same task set) — kept in one place so
 * the two trees can never visually drift apart.
 */
export const WBS_ZONE_STYLE: Record<string, WbsZoneStyle> = {
  Construction: {
    Icon: Hammer,
    iconColor: "text-orange-500",
    dotColor: "bg-orange-500",
    ring: "border-orange-500",
    fill: "bg-orange-950/60",
  },
  Utilities: {
    Icon: Zap,
    iconColor: "text-sky-500",
    dotColor: "bg-sky-500",
    ring: "border-sky-500",
    fill: "bg-sky-950/60",
  },
  Equipment: {
    Icon: Settings,
    iconColor: "text-amber-500",
    dotColor: "bg-amber-500",
    ring: "border-amber-500",
    fill: "bg-amber-950/60",
  },
  Validation: {
    Icon: ClipboardCheck,
    iconColor: "text-teal-500",
    dotColor: "bg-teal-500",
    ring: "border-teal-500",
    fill: "bg-teal-950/60",
  },
  Training: {
    Icon: GraduationCap,
    iconColor: "text-purple-500",
    dotColor: "bg-purple-500",
    ring: "border-purple-500",
    fill: "bg-purple-950/60",
  },
  Documentation: {
    Icon: FileText,
    iconColor: "text-pink-500",
    dotColor: "bg-pink-500",
    ring: "border-pink-500",
    fill: "bg-pink-950/60",
  },
};

export const FALLBACK_WBS_ZONE_STYLE: WbsZoneStyle = {
  Icon: Settings,
  iconColor: "text-zinc-500",
  dotColor: "bg-zinc-500",
  ring: "border-zinc-500",
  fill: "bg-zinc-800/60",
};
