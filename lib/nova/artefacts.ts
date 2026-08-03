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
      // Renamed rather than overwritten per project convention.
      incomplete: "/assets/documents/pid_incomplete_v2.png",
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
