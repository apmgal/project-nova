"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import RecoveryMontage from "@/components/nova/act5/RecoveryMontage";

/**
 * Preview route — /prototype/montage. Plays the Act 5 recovery montage on its own (no save game
 * involved) for visual review; in the story it runs after Mike E.'s call. Not part of the storyline.
 * ?shot=1&t=3.5 holds that frame (for reviewing stills); without it the montage plays normally.
 * Client-only (it reads the query string), so the server and browser never disagree.
 */
function MontagePreview() {
  const [holdAt] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    return q.has("t") ? { shot: Number(q.get("shot") ?? 0), t: Number(q.get("t")) } : undefined;
  });
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
          Montage finished — play again
        </button>
      </div>
    );
  }
  return <RecoveryMontage key={run} holdAt={holdAt} onComplete={() => setDone(true)} />;
}

export default dynamic(() => Promise.resolve(MontagePreview), { ssr: false, loading: () => <div className="fixed inset-0 bg-black" /> });
