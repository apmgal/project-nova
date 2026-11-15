import type { Metadata } from "next";
import WarehouseExplorerLoader from "@/components/prototype/warehouse/WarehouseExplorerLoader";

export const metadata: Metadata = {
  title: "Project NOVA — Warehouse Exploration Prototype",
  description: "Standalone prototype: explore the warehouse and inspect the suspicious delivery.",
  robots: { index: false, follow: false },
};

/** Standalone prototype route — /prototype/warehouse. Not part of the main storyline. */
export default function WarehousePrototypePage() {
  return <WarehouseExplorerLoader />;
}
