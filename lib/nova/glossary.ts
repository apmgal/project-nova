export interface GlossaryEntry {
  /** Display name — usually identical to the lookup key, occasionally a
   * fuller version of it (e.g. "Stakeholder mapping" -> "Stakeholder
   * Power/Interest Mapping") for readability in the popover. */
  term: string;
  /** One to two plain-English sentences, grounded in the APM Body of
   * Knowledge, explaining what the concept is and why it's used — never
   * what to do on THIS screen specifically, so it can't give away the
   * puzzle. */
  definition: string;
}

/**
 * PM concept reference, keyed by the exact `pmConcept` string each scene
 * carries in data/scenes.json. Only scenes with a matching interactive
 * tool screen have an entry here for now — the ConceptHint lightbulb only
 * ever appears inside a tool screen (contextual, not a standalone browsable
 * glossary), so a definition for a purely narrative pmConcept (e.g.
 * "Political awareness in delivery") would never have anywhere to render.
 * Deliberately a plain Record rather than something more elaborate: adding
 * a new tool screen's concept later is just one more entry, and
 * ConceptHint already renders nothing for a concept with no match here, so
 * this can grow incrementally without touching any component code.
 */
export const GLOSSARY: Record<string, GlossaryEntry> = {
  "PESTLE analysis": {
    term: "PESTLE analysis",
    definition:
      "A structured scan of the external environment across six lenses — Political, Economic, Social, Technological, Legal, and Environmental — used early on to surface factors outside the project's control that could still affect it.",
  },
  "SWOT analysis": {
    term: "SWOT analysis",
    definition:
      "An internal readiness check across four quadrants — Strengths, Weaknesses, Opportunities, Threats — that complements PESTLE's external view by looking at what the organisation itself brings to, or risks in, the project.",
  },
  "MoSCoW prioritisation": {
    term: "MoSCoW prioritisation",
    definition:
      "Sorts requirements into Must have, Should have, Could have, and Won't have this time — a fast way to agree what's non-negotiable versus what can flex when budget, time, or scope come under pressure.",
  },
  "Stakeholder mapping": {
    term: "Stakeholder Power/Interest Mapping",
    definition:
      "Plots stakeholders by how much influence they have over the project and how invested they are in its outcome, so engagement effort goes where it actually matters.",
  },
  "Work Breakdown Structure": {
    term: "Work Breakdown Structure (WBS)",
    definition:
      "Breaks the project down into smaller, manageable pieces of work, organised hierarchically from the overall objective down to individual tasks. It's the foundation everything else — cost, schedule, resourcing — gets built on.",
  },
  "Cost Breakdown Structure": {
    term: "Cost Breakdown Structure (CBS)",
    definition:
      "Mirrors the WBS but attaches a cost to every piece of work, giving a bottom-up view of the total budget and making it clear exactly what a descope decision saves.",
  },
  "Resource management": {
    term: "Resource Management",
    definition:
      "Matches the right people to the work the WBS defined — who's needed, when, and at what capacity — so the plan is staffed by capability, not just headcount.",
  },
  Scheduling: {
    term: "Scheduling & Critical Path",
    definition:
      "Sequences the work into a timeline, usually with a Gantt chart, and identifies the critical path — the chain of dependent tasks that determines the earliest the project can finish.",
  },
  "Communications planning": {
    term: "Communications Planning",
    definition:
      "Agrees who needs what information, how often, and in what format — matching each stakeholder's preferred cadence so the right people stay informed without being buried.",
  },
  "Benefits management": {
    term: "Benefits Management",
    definition:
      "Identifies the outcomes a project is actually meant to deliver and how they'll be measured, then tracks them through to realisation — since on time and on budget doesn't count for much if the intended benefit never materialises.",
  },
};
