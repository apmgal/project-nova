"use client";

import dynamic from "next/dynamic";

// The Spline runtime needs the browser (WebGL), so skip prerendering and load it client-side only.
const WarehouseExplorer = dynamic(() => import("./WarehouseExplorer"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-[var(--nova-slate-950)]" />,
});

export default function WarehouseExplorerLoader() {
  return <WarehouseExplorer />;
}
