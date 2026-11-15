"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import InspectorArrival from "@/components/nova/act5/InspectorArrival";

/**
 * Preview route — /prototype/arrival. Plays the Act 5 inspector-arrival cinematic on its own (no save
 * game involved). ?t=5.2 freezes that moment for review. Not part of the storyline.
 */
function ArrivalPreview() {
  const holdAt = useMemo(() => {
    const q = new URLSearchParams(window.location.search);
    return q.has("t") ? Number(q.get("t")) : undefined;
  }, []);
  const [run, setRun] = useState(0);
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-black">
        <button
          type="button"
          onClick={() => { setDone(false); setRun((n) => n + 1); }}
          className="rounded-md border border-white/20 px-5 py-2.5 text-sm text-zinc-200 hover:bg-white/10"
        >
          Cinematic finished — play again
        </button>
      </div>
    );
  }
  return <InspectorArrival key={run} muted={false} holdAt={holdAt} onComplete={() => setDone(true)} />;
}

export default dynamic(() => Promise.resolve(ArrivalPreview), { ssr: false });
