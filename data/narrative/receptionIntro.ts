import type { NarrativeSceneScript } from "@/lib/nova/narrative/types";

// ---------------------------------------------------------------------------
// Reception Intro Scene — the game's opening beat. Plays once, before the
// player's first real decision, and exists purely to orient them: who Mike
// Smith (and now Ben) is, what the PMO does, how the Tax Towers are
// organised, the tools available (SharePoint, the tracker, the dashboard),
// and why Project Nova specifically needs them right now. Content lives
// here, separate from NarrativeScene's rendering logic, so a future scene
// (a stakeholder meeting, a boardroom moment) is just another file shaped
// like this one.
//
// Ben's expressions use his real art now. His portrait entry is otherwise
// exactly the same shape as Mike's — that's the point of the expressions
// system: a new character (or a new expression for an existing one) is
// just new image files plus a new map entry here, no component changes.
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
      name: "Mike",
      position: "right",
      expressions: {
        neutral: {
          src: "/assets/characters/mikeneutral.png",
          blinkSrc: "/assets/characters/mikeblink.png",
        },
        smile: { src: "/assets/characters/mikesmile.png" },
        serious: { src: "/assets/characters/mikeserious.png" },
      },
    },
    {
      id: "ben",
      name: "Ben",
      position: "left",
      expressions: {
        neutral: {
          src: "/assets/characters/benneutral.png",
          blinkSrc: "/assets/characters/benblink.png",
        },
        smile: { src: "/assets/characters/bensmile.png" },
      },
    },
  ],
  lines: [
    {
      speaker: "mike",
      text: "You must be the new Project Manager for Project Nova. Welcome — we've been expecting you. I'm Mike, and I lead the PMO for the Group Tax Portfolio.",
      expression: "smile",
    },
    {
      speaker: "mike",
      text: "Before you meet the wider team, let me give you a quick overview of how we work and the support available to you.",
      expression: "neutral",
    },
    {
      speaker: "mike",
      text: "Across Group Tax, the PMO helps bring visibility, governance, and collaboration across our portfolio. We're here to support teams — helping unblock decisions, manage risks and dependencies, and make sure the right conversations happen at the right time.",
    },
    {
      speaker: "mike",
      text: "Our work is organised across different Tax Towers, each with their own expertise, stakeholders, and initiatives. You'll be working across these teams as Project Nova progresses.",
    },
    {
      speaker: "mike",
      text: "We also have a few tools and resources to help you get started.",
    },
    {
      speaker: "mike",
      text: "This is our Group Tax Portfolio SharePoint page — your central hub for updates, guidance, key contacts, templates, and resources.",
      visual: {
        src: "/assets/screens/sharepoint.png",
        alt: "Group Tax Innovation & Change SharePoint hub",
        aspectRatio: 794 / 844,
        label: "Group Tax SharePoint",
      },
    },
    {
      speaker: "mike",
      text: "This is our portfolio tracker. It gives us a shared view of progress, risks, decisions, and where teams may need additional support.",
      visual: {
        src: "/assets/screens/tracker.png",
        alt: "Group Tax Innovation & Change portfolio tracker",
        aspectRatio: 1828 / 900,
        label: "Portfolio Tracker",
        large: true,
      },
    },
    {
      speaker: "mike",
      text: "And this feeds straight into our portfolio dashboard — a live view of health, progress, and benefits across every Tax Tower, built directly from what's logged in the tracker.",
      visual: {
        src: "/assets/screens/dashboard.png",
        alt: "Global Tax Innovation & Change portfolio dashboard",
        aspectRatio: 1589 / 905,
        label: "Portfolio Dashboard",
        large: true,
      },
    },
    {
      speaker: "ben",
      text: "Hi, I'm Ben. I lead Governance, Digital & Change, where Project Nova sits. Welcome aboard — we're glad to have you joining the team.",
      expression: "smile",
    },
    {
      speaker: "ben",
      text: "Governance, Digital & Change supports initiatives that help improve how we work across the organisation. For Project Nova, that means bringing together the business, Group Tax, and our delivery teams to move this initiative forward.",
      expression: "neutral",
    },
    {
      speaker: "ben",
      text: "Nova is an important project because it sits at the intersection of business needs, technology, and operational change. Getting this right will help us deliver the outcomes we've committed to.",
    },
    {
      speaker: "mike",
      text: "Thanks, Ben. Which brings us to Project Nova. Nova is an Actively Managed project — a joint initiative between the AstraZeneca business and Group Tax.",
      expression: "neutral",
    },
    {
      speaker: "mike",
      text: "The project has experienced some delays, and our focus now is creating clarity, rebuilding momentum, and making sure we deliver the value this initiative was designed to achieve.",
      expression: "serious",
    },
    {
      speaker: "mike",
      text: "You'll have the support of the PMO and the wider team around you. Your role is to bring structure, connect the right people, and help guide Nova through its next stage.",
      expression: "smile",
    },
    {
      speaker: "mike",
      text: "Ready? Let's take a look at where things stand today.",
    },
  ],
};
