"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import MorningInspection from "@/components/nova/act5/morning/MorningInspection";

/**
 * PROTOTYPE preview — /prototype/inspection-morning. "The Morning of the Inspection" on its own; not part
 * of the game. ?t=5.5 freezes that moment for review. At the end it stands in for Whitfield's opening.
 */
function MorningPreview() {
  const holdAt = useMemo(() => {
    const q = new URLSearchParams(window.location.search);
    return q.has("t") ? Number(q.get("t")) : undefined;
  }, []);
  const [run, setRun] = useState(0);
  const [started, setStarted] = useState(holdAt !== undefined);
  const [done, setDone] = useState(false);
  if (!started || done) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-black text-center">
        <div>
          {done && <p className="mb-6 text-sm text-zinc-400">(In the game, Whitfield&apos;s opening dialogue starts here.)</p>}
          <button
            type="button"
            onClick={() => { setDone(false); setStarted(true); setRun((n) => n + 1); }}
            className="rounded-md border border-white/20 px-5 py-2.5 text-sm text-zinc-200 hover:bg-white/10"
          >
            {done ? "Play again" : "Play — The Morning of the Inspection"}
          </button>
        </div>
      </div>
    );
  }
  return <MorningInspection key={run} muted={false} holdAt={holdAt} onComplete={() => setDone(true)} />;
}

export default dynamic(() => Promise.resolve(MorningPreview), { ssr: false });
