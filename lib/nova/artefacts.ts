// Static registry of documents the player can find and revisit from the
// artefacts drawer. Deliberately not JSON-driven (unlike scenes/tools) since
// there's currently only a handful of these and each one pairs a couple of
// fixed image assets with a couple of lines of copy — a plain TS map keeps
// that colocated and typed without inventing a schema for one consumer.
//
// To add a new artefact: drop its "incomplete"/"complete" images in
// public/assets/documents/, add an entry below, then call
// setArtefactStatus(state, "yourId", "incomplete" | "complete") from
// wherever in GameRoot.tsx it should first appear / later update.

export interface ArtefactDefinition {
  title: string;
  /** Shown under the title in the drawer list and viewer. */
  subtitle: string;
  images: {
    incomplete: string;
    complete: string;
  };
  /** Short caption shown in the viewer per status, giving the player a
   * narrative nudge about what they're looking at without restating the
   * document's own text. */
  caption: {
    incomplete: string;
    complete: string;
  };
}

export const ARTEFACT_REGISTRY: Record<string, ArtefactDefinition> = {
  pid: {
    title: "Project Initiation Document",
    subtitle: "Project NOVA",
    images: {
      // _v2: the original incomplete render had leftover placeholder text
      // from an unrelated corporate template (a tax-close-process PID, not
      // Project NOVA) still sitting in the Objectives/Scope bullets —
      // patched to read as genuinely half-finished Nova content instead.
      // _v3 (on top of _v2): fixed a text-clipping bug in the Objectives/
      // Scope bullets (an overlapping erase box was clipping the bottom of
      // the previous line's already-drawn text — fixed via an erase-then-
      // draw two-pass patch) and filled in the Stakeholders table's
      // Project Sponsor row (was blank "[Name TBC]"/"[Insert Title]") with
      // Mike Elloian / VP of Tax.
      // _v4 (on top of _v3): replaced the generic Objectives/Scope
      // placeholder bullets with real (still appropriately half-finished)
      // Project NOVA content — budget/ROI tied to the £12M figure from
      // Ellis's kickoff email and the Act 3 Benefits Register, NHS
      // contract framed around the 24-week first-production gate, and a
      // proper Scope + out-of-scope line. Steering Group row intentionally
      // left as "[Names TBC]" — the shaded table row has no vertical room
      // left between the Sponsor row and the Project Manager row (torn
      // page edge sits right below it) to fit all 6 names + titles at a
      // legible size; revisit only with a wider layout change. Renamed
      // rather than overwritten per project convention — _v2 and _v3 are
      // already live.
      incomplete: "/assets/documents/pid_incomplete_v4.png",
      complete: "/assets/documents/pid_complete.png",
    },
    caption: {
      incomplete:
        "Found in the shared drive. Ellis never finished the Benefits Plan — most of this is still template text.",
      complete:
        "Updated after the Benefits Tracker went to sign-off. Objectives, scope, and stakeholders are locked in.",
    },
  },
};

/** Small helper for components: resolves an artefact id + status to the
 * image path that should be shown. */
export function getArtefactImage(
  artefactId: string,
  status: "incomplete" | "complete"
): string | null {
  const def = ARTEFACT_REGISTRY[artefactId];
  if (!def) return null;
  return def.images[status];
}
