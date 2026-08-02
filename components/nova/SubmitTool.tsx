"use client";

import { useState } from "react";
import { SendHorizontal, Check } from "lucide-react";

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
 * A small round paper-plane icon, bottom-right of the card — not a
 * full-width labelled bar — muted while the activity is incomplete, blue
 * once it can be submitted, and green with a checkmark for a beat right
 * after tapping, a real colour change the player can see before the
 * screen moves on rather than an instant swap. Sized to match
 * ConceptHintButton/ResetToolButton (h-6 w-6, icon h-3.5 w-3.5) so all
 * three small action icons read as one family.
 */
export function SubmitToolButton({ canSubmit, onSubmit }: SubmitToolButtonProps) {
  const [submitted, setSubmitted] = useState(false);

  function handleClick() {
    if (!canSubmit || submitted) return;
    setSubmitted(true);
    // Let the green "submitted" state actually render for a beat before
    // the parent advances the scene out from under this button.
    window.setTimeout(onSubmit, 350);
  }

  return (
    <div className="flex justify-end">
      <button
        onClick={handleClick}
        disabled={!canSubmit || submitted}
        aria-label={submitted ? "Submitted" : canSubmit ? "Submit" : "Complete the activity to submit"}
        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
          submitted
            ? "border-emerald-400 bg-emerald-500 text-white"
            : canSubmit
              ? "border-blue-500 bg-blue-600 text-white hover:bg-blue-500"
              : "cursor-not-allowed border-zinc-800 bg-zinc-900 text-zinc-600"
        }`}
      >
        {submitted ? (
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <SendHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
