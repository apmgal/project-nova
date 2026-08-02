"use client";

import { useState } from "react";
import { Check } from "lucide-react";

interface SubmitToolButtonProps {
  /** Whether the activity's own completion condition is currently met
   * (every card placed, hires locked in, critical path confirmed, ...).
   * The button stays visibly disabled until this is true — nothing here
   * knows what "complete" means for any particular tool, that's decided
   * upstream by computeToolComplete. */
  canSubmit: boolean;
  onSubmit: () => void;
}

/**
 * The explicit "I'm done" action at the end of every tool activity.
 * Previously, finishing an activity (placing the last card, hiring the
 * last candidate, ...) silently jumped straight to whatever came next —
 * this button turns that into a real, visible player action instead.
 *
 * Disabled + muted while the activity is incomplete, blue once it can be
 * submitted, and green with a checkmark for a beat right after tapping —
 * a real colour change the player can see before the screen moves on,
 * not just an instant swap.
 */
export function SubmitToolButton({ canSubmit, onSubmit }: SubmitToolButtonProps) {
  const [submitted, setSubmitted] = useState(false);

  function handleClick() {
    if (!canSubmit || submitted) return;
    setSubmitted(true);
    // Let the green "Submitted" state actually render for a beat before
    // the parent advances the scene out from under this button.
    window.setTimeout(onSubmit, 350);
  }

  return (
    <button
      onClick={handleClick}
      disabled={!canSubmit || submitted}
      aria-label={submitted ? "Submitted" : "Submit"}
      className={`w-full rounded-md px-4 py-2.5 text-sm font-semibold transition-colors duration-200 ${
        submitted
          ? "bg-emerald-500 text-white"
          : canSubmit
            ? "bg-blue-600 text-white hover:bg-blue-500"
            : "cursor-not-allowed bg-zinc-800 text-zinc-600"
      }`}
    >
      {submitted ? (
        <span className="flex items-center justify-center gap-1.5">
          <Check className="h-4 w-4" aria-hidden="true" />
          Submitted
        </span>
      ) : canSubmit ? (
        "Submit"
      ) : (
        "Complete the activity to submit"
      )}
    </button>
  );
}
