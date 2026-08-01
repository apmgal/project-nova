import type { NarrativeSceneScript } from "@/lib/nova/narrative/types";

// ---------------------------------------------------------------------------
// Reception Intro Scene — the game's opening beat. Plays once, before the
// player's first real decision, and exists purely to orient them: who Mike
// Smith is, what the PMO does, how the Tax Towers are organised, how
// projects get managed here, and why Project Nova specifically needs them
// right now. Content lives here, separate from NarrativeScene's rendering
// logic, so a future scene (a stakeholder meeting, a boardroom moment) is
// just another file shaped like this one.
// ---------------------------------------------------------------------------

export const RECEPTION_INTRO_SCENE: NarrativeSceneScript = {
  id: "reception_intro",
  background: {
    // This photo now has the AstraZeneca logo baked in on the wall panel
    // behind the desk, so no separate `overlay` is needed anymore (that
    // stays available on SceneBackground/NarrativeSceneScript for a
    // future background that doesn't already include its own signage).
    src: "/assets/backgrounds/bg_reception_desk_v2.jpg",
    alt: "Group Tax reception desk",
  },
  music: {
    src: "/assets/music/reception_theme.wav",
    volume: 0.35,
    fadeInMs: 2200,
    fadeOutMs: 1400,
  },
  characters: [
    {
      id: "mike",
      name: "Mike Smith",
      portraitSrc: "/assets/characters/mike-smith.png",
      position: "right",
    },
  ],
  lines: [
    {
      speaker: "mike",
      text: "You must be joining us — good, we've been looking forward to this. Mike Smith. I run the PMO for the Group Tax Portfolio.",
    },
    {
      speaker: "mike",
      text: "Before I hand you off to the team, I want to give you the lay of the land. It'll save you a few weeks of working it out the hard way.",
    },
    {
      speaker: "mike",
      text: "The PMO exists to keep this portfolio honest. Governance and oversight — someone has to know what's really happening across every project, not just what the last status report said.",
    },
    {
      speaker: "mike",
      text: "Practically, that means we support project teams directly — unblocking decisions, not just auditing them from a distance — and we work hard to keep visibility high, so problems surface while they're still small.",
    },
    {
      speaker: "mike",
      text: "We also carry the risks and dependencies that individual teams can't always see from where they sit, and we make sure the decisions that matter get made by the right people, at the right time — not left to drift.",
    },
    {
      speaker: "mike",
      text: "And ultimately, we're accountable for outcomes: it isn't enough for a project to finish. It has to deliver the benefit it was funded for. That's the bar.",
    },
    {
      speaker: "mike",
      text: "Now — how we're organised. Group Tax's work runs across a set of Towers. Think of each one as a distinct discipline with its own remit.",
    },
    {
      speaker: "mike",
      text: "Every Tower has its own subject matter experts, its own stakeholders, and its own slate of initiatives running at any given time. You'll work across more than one before long.",
    },
    {
      speaker: "mike",
      text: "Whichever Tower a project sits in, we manage it the same disciplined way: clear objectives from day one, a scope that's actually written down, risks tracked rather than discovered, stakeholders mapped rather than assumed — and reporting and governance that hold the whole thing together.",
    },
    {
      speaker: "mike",
      text: "Which brings me to why you're here. Project Nova.",
    },
    {
      speaker: "mike",
      text: "Nova is one of our Actively Managed projects — the tier that gets the closest PMO attention, because the stakes justify it. It's a joint initiative between the AstraZeneca business and Group Tax, and it sits under Governance, Digital & Change.",
    },
    {
      speaker: "mike",
      text: "I'll be straightforward with you, because you'll see it in the numbers within your first week regardless: Nova has slipped. Not from any one bad decision — more a slow drift, the kind that happens when focus spreads too thin.",
    },
    {
      speaker: "mike",
      text: "What it needs now is exactly what you bring — sharper focus, real visibility, and the structure to keep momentum once we've got it back. Not a rescue. A reset.",
    },
    {
      speaker: "mike",
      text: "So that's the job. Bring clarity where there's noise, structure where there's drift, and momentum where things have stalled. I think you're the right person for it — let's get you started.",
    },
  ],
};
