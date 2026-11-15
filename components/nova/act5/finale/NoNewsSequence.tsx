"use client";

import { useEffect, useRef, useState } from "react";
import TeamsToast from "./TeamsToast";
import type { GameState } from "@/lib/nova/types";
import { applyDecisions } from "@/lib/nova/state";
import EmailInboxPanel from "@/components/nova/EmailInboxPanel";
import {
  FINALE,
  FINALE_ASSETS,
  FINAL_EMAIL,
  ROUTINE_INBOX,
  TEAMS_MESSAGES,
  WORK_DOCUMENT,
  finalePhase,
  messagesHandled,
  type FinalePhase,
  type TeamsMessage,
} from "@/lib/nova/finale";

/**
 * "No News" — three weeks later, an ordinary working day (PROTOTYPE). One time card; the player's desk
 * (bg_player_desk) with the work they're doing; Teams messages from Priya, Daniel and Mike arriving one at
 * a time (never on top of each other); a look at the inbox (nothing new — the determination is still
 * pending); back to work for a while; then, unannounced, the email. The player opens the attachment when
 * they choose — nothing here times out or advances on its own past that point.
 * Progress is saved per step (lib/nova/finale.ts); no scored decisions or metrics are touched.
 */
type View = "timecard" | FinalePhase;
type MsgStage = "toast" | "open" | "typing" | "replied";

/** Gaps between the incidental messages, so they feel like a working morning, not a script. */
const FIRST_MESSAGE_MS = 2800; // after the action log is up
const BETWEEN_MESSAGES_MS = [7500, 8500];
const AFTER_LAST_MESSAGE_MS = 4000; // then a glance at the inbox
const BACK_TO_WORK_MS = 8500; // the email doesn't arrive straight after "Return to workspace"

export default function NoNewsSequence({
  state,
  muted,
  onChange,
  onOpenReport,
}: {
  state: GameState;
  muted: boolean;
  onChange: (next: GameState) => void;
  onOpenReport: () => void;
}) {
  // Always write from the latest state — timers and quick clicks must never overwrite each other's progress.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const commit = (values: Record<string, string>) => {
    const next = applyDecisions(stateRef.current, values);
    stateRef.current = next;
    onChange(next);
  };

  const resumed = finalePhase(state);
  const [view, setView] = useState<View>(resumed ?? "timecard");
  const [cardIn, setCardIn] = useState(false);
  const [deskIn, setDeskIn] = useState(resumed !== null);
  const [docIn, setDocIn] = useState(resumed !== null);
  const [msg, setMsg] = useState<{ m: TeamsMessage; stage: MsgStage } | null>(null);
  const [mailToast, setMailToast] = useState(false);
  const [toastIn, setToastIn] = useState(false);
  const [emailOpen, setEmailOpen] = useState(resumed === "email");
  const [leaving, setLeaving] = useState(false);
  const opening = useRef(false);

  const go = (phase: FinalePhase) => {
    setView(phase);
    if (stateRef.current.decisions?.[FINALE.phase] !== phase) commit({ [FINALE.phase]: phase });
  };
  const later = useRef<number[]>([]);
  const after = (ms: number, fn: () => void) => { later.current.push(window.setTimeout(fn, ms)); };
  useEffect(() => () => later.current.forEach((id) => window.clearTimeout(id)), []);

  // --- sound ------------------------------------------------------------------------------------------
  const mutedRef = useRef(muted);
  const office = useRef<HTMLAudioElement | null>(null);
  const extras = useRef<HTMLAudioElement[]>([]);
  useEffect(() => {
    mutedRef.current = muted;
    [office.current, ...extras.current].forEach((a) => { if (a) a.muted = muted; });
  }, [muted]);
  const fade = (a: HTMLAudioElement | null, to: number, ms: number) => {
    if (!a) return;
    const from = a.volume, t0 = performance.now();
    const step = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - t0) / ms)); // a frame's timestamp can precede t0: never a negative volume
      try { a.volume = from + (to - from) * k; } catch { return; }
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const startOffice = () => {
    if (office.current) return;
    try {
      const a = new Audio(FINALE_ASSETS.sounds.office);
      a.loop = true; a.volume = 0; a.muted = mutedRef.current;
      office.current = a;
      a.play().catch(() => {});
      fade(a, 0.7, 1800);
    } catch { /* silent if unavailable */ }
  };
  const sfx = (src: string, volume: number) => {
    try {
      const a = new Audio(src);
      a.volume = volume; a.muted = mutedRef.current;
      extras.current.push(a);
      a.play().catch(() => {});
    } catch { /* silent */ }
  };
  useEffect(() => {
    const all = extras.current;
    return () => { office.current?.pause(); office.current = null; all.forEach((a) => a.pause()); };
  }, []);

  // --- Teams messages: one at a time, each only after the previous one is closed -----------------------
  const nextMessage = () => TEAMS_MESSAGES.find((m) => !messagesHandled(stateRef.current).includes(m.id)) ?? null;
  const showMessage = (m: TeamsMessage) => {
    setMsg({ m, stage: "toast" });
    sfx(FINALE_ASSETS.sounds.ping, 0.5);
    after(40, () => setToastIn(true));
  };
  const queueNext = (delay: number) => {
    const m = nextMessage();
    if (m) after(delay, () => showMessage(m));
    else after(AFTER_LAST_MESSAGE_MS, () => go("inbox")); // the morning's messages done — a glance at the inbox
  };
  const closeMessage = () => {
    if (!msg) return;
    const done = [...messagesHandled(stateRef.current), msg.m.id];
    commit({ [FINALE.messages]: done.join(",") });
    setToastIn(false);
    after(400, () => setMsg(null));
    queueNext(BETWEEN_MESSAGES_MS[done.length - 1] ?? 7000);
  };
  const replyToPriya = () => {
    if (!msg?.m.reply) return;
    setMsg({ m: msg.m, stage: "typing" });
    after(1700, () => { setMsg((cur) => (cur ? { ...cur, stage: "replied" } : cur)); sfx(FINALE_ASSETS.sounds.ping, 0.35); });
  };

  // --- the timeline (only the ordinary moments are timed; every player action waits) --------------------
  useEffect(() => {
    if (resumed) {
      startOffice();
      if (resumed === "bau") queueNext(2500);
      if (resumed === "back") after(5000, arriveMail);
      return;
    }
    // Scene A: black → THREE WEEKS LATER → the desk.
    after(600, () => setCardIn(true));
    after(600 + 800 + 2400, () => setCardIn(false));
    after(600 + 800 + 2400 + 900, () => {
      go("bau");
      setDeskIn(true);
      startOffice();
    });
    // Scene B: the work, then the morning's messages.
    after(5600, () => setDocIn(true));
    after(5600 + FIRST_MESSAGE_MS, () => { const m = nextMessage(); if (m) showMessage(m); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function arriveMail() {
    if (stateRef.current.decisions?.[FINALE.phase] !== "email") commit({ [FINALE.phase]: "email" });
    setView("email");
    setMailToast(true);
    sfx(FINALE_ASSETS.sounds.mail, 0.5);
    after(40, () => setToastIn(true));
  }
  const returnToWork = () => {
    go("back");
    after(BACK_TO_WORK_MS, arriveMail);
  };
  const openEmail = () => { setToastIn(false); after(350, () => { setMailToast(false); setEmailOpen(true); }); };
  const openReport = () => {
    if (opening.current) return;
    opening.current = true;
    setLeaving(true);
    fade(office.current, 0, 2200);
    after(2300, onOpenReport);
  };

  const showDoc = (view === "bau" || view === "back" || (view === "email" && !emailOpen)) && docIn;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-black text-white">
      {/* The desk — a slow push towards the laptop. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={FINALE_ASSETS.desk}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        style={{
          opacity: deskIn ? (leaving ? 0 : 1) : 0,
          filter: "brightness(1.12) saturate(0.95)",
          transform: deskIn ? "scale(1.1)" : "scale(1.03)",
          transformOrigin: "48% 52%",
          transition: `opacity ${leaving ? 1800 : 1400}ms ease, transform 90s linear`,
        }}
      />
      <div className="pointer-events-none absolute inset-0 transition-opacity duration-1000" style={{ background: "rgba(8,10,14,0.38)", opacity: view === "inbox" || emailOpen ? 1 : 0.55 }} />

      {/* Scene A — the only time card. */}
      {view === "timecard" && (
        <div className="absolute inset-0 grid place-items-center">
          <p className="text-[22px] font-light text-white/90 transition-opacity duration-[800ms] sm:text-[30px]" style={{ letterSpacing: "0.42em", paddingLeft: "0.42em", opacity: cardIn ? 1 : 0 }}>
            THREE WEEKS LATER
          </p>
        </div>
      )}

      <div className="absolute inset-0 overflow-y-auto transition-opacity duration-700" style={{ opacity: leaving ? 0 : 1 }}>
        <div className="flex min-h-full items-center justify-center px-4 py-10">
          {/* Scenes B/D — the work in progress. */}
          {showDoc && (
            <div className="w-full max-w-[720px] animate-[bauIn_900ms_ease-out] overflow-hidden rounded-lg border border-zinc-300 bg-white text-zinc-900 shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-200 bg-[#f3f2f1] px-4 py-2">
                <p className="text-[12px] font-semibold text-[#201f1e]">{WORK_DOCUMENT.title}</p>
                <p className="hidden text-[11px] text-[#605e5c] sm:block">{WORK_DOCUMENT.path}</p>
              </div>
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-zinc-200 text-[11px] uppercase tracking-wide text-[#605e5c]">
                    <th className="px-4 py-2 font-medium">Action</th>
                    <th className="px-4 py-2 font-medium">Owner</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {WORK_DOCUMENT.rows.map(([a, o, st]) => (
                    <tr key={a} className="border-b border-[#edebe9]">
                      <td className="px-4 py-2.5 text-[#201f1e]">{a}</td>
                      <td className="px-4 py-2.5 text-[#323130]">{o}</td>
                      <td className="px-4 py-2.5 text-[#605e5c]">{st}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Scene C — No News: the existing Outlook-style inbox, nothing new. */}
          {view === "inbox" && (
            <div className="w-full max-w-[880px] animate-[bauIn_600ms_ease-out]">
              <EmailInboxPanel
                bank={{
                  riskId: "finale_inbox",
                  sourceScene: "FINALE",
                  askTarget: "inbox",
                  maxQuestions: ROUTINE_INBOX.length,
                  instructions: "Inspection determination: pending · No new updates",
                  visualStyle: "outlook_inbox",
                  questions: ROUTINE_INBOX.map((m) => ({ id: m.id, dimension: m.from, questionText: m.subject, answerText: m.body, flagOnAsk: `finale_read_${m.id}` })),
                }}
                flags={{}}
                onAsk={() => {}}
                onContinue={returnToWork}
                continueLabel="Return to workspace"
                dates={Object.fromEntries(ROUTINE_INBOX.map((m) => [m.id, m.date]))}
              />
            </div>
          )}

          {/* Scene E — the email: a simplified reading pane. */}
          {emailOpen && (
            <div className="w-full max-w-[760px] animate-[bauIn_600ms_ease-out] overflow-hidden rounded-lg border border-zinc-300 bg-white text-zinc-900 shadow-2xl">
              <div className="flex items-center gap-2 border-b border-zinc-200 bg-[#f3f2f1] px-5 py-2 text-[11.5px] text-[#605e5c]">
                <span className="rounded bg-[#0078d4] px-2 py-0.5 font-semibold text-white">Inbox</span>
                <span>Project Nova</span>
              </div>
              <div className="border-b border-[#edebe9] px-6 pb-4 pt-5">
                <p className="text-[18px] font-semibold leading-snug text-[#201f1e]">{FINAL_EMAIL.subject}</p>
                <div className="mt-3 flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#1b2433] text-[11.5px] font-semibold text-white">IC</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="text-[13px] font-semibold text-[#201f1e]">{FINAL_EMAIL.from}</p>
                      <p className="text-[11.5px] text-[#605e5c]">Today</p>
                    </div>
                    <p className="text-[12px] text-[#605e5c]">To: {FINAL_EMAIL.to}</p>
                  </div>
                </div>
                <div className="mt-3 inline-flex items-center gap-2 rounded border border-[#e1dfdd] bg-[#faf9f8] px-2.5 py-1.5 text-[12px] text-[#323130]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a4262c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                  </svg>
                  {FINAL_EMAIL.attachment}
                </div>
              </div>
              <div className="px-6 py-5">
                <div className="flex flex-col gap-3 text-[13.5px] leading-relaxed text-[#323130]">
                  {FINAL_EMAIL.paragraphs.map((p) => (
                    <p key={p} className="whitespace-pre-line">{p}</p>
                  ))}
                </div>
                {/* The attachment — the approved Final Determination card. */}
                <div className="mt-6 rounded-2xl px-4 pb-4 pt-5 text-center" style={{ background: "#1b2433" }}>
                  <svg className="mx-auto" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#e6ecf3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 9.8V4a2 2 0 0 1 2-2h8.5L20 7.5V20a2 2 0 0 1-2 2H9" />
                    <path d="M14 2v6h6" />
                    <rect x="2" y="15" width="7" height="6" rx="1" />
                    <path d="M3.5 15v-1.5a2 2 0 0 1 4 0V15" />
                  </svg>
                  <p className="mt-3 text-[15px] font-medium tracking-[0.02em] text-white">FINAL DETERMINATION</p>
                  <p className="mt-2 text-[12px]" style={{ color: "#a9b6c6" }}>Project Nova · Commissioning Inspection</p>
                  <div className="my-4 h-px" style={{ background: "#3d4a5c" }} />
                  <p className="text-[13.5px]" style={{ color: "#dfe6ee" }}>The formal inspection outcome is enclosed.</p>
                  <button
                    type="button"
                    onClick={openReport}
                    disabled={leaving}
                    className="mt-4 h-11 w-full rounded-xl text-[15px] font-medium transition-colors hover:brightness-95 disabled:cursor-default"
                    style={{ background: "#e6ecf3", color: "#1b2433" }}
                  >
                    Open Final Determination
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Teams message — one at a time, bottom right; opens into a short exchange where there is one. */}
      {msg && (
        <TeamsToast
          from={msg.m.from}
          initials={msg.m.initials}
          colour={msg.m.colour}
          text={msg.m.text}
          shown={toastIn}
          onClose={closeMessage}
          actions={
            <>
              {msg.m.reply && msg.stage === "toast" && (
                <button type="button" onClick={() => setMsg({ m: msg.m, stage: "open" })} className="rounded px-3 py-1 text-[12px] font-semibold text-[#5b5fc7] hover:bg-[#f0f0fa]">
                  Open
                </button>
              )}
              {msg.m.reply && msg.stage === "open" && (
                <button type="button" onClick={replyToPriya} className="rounded border border-[#c7c9f0] px-3 py-1 text-left text-[12px] text-[#5b5fc7] hover:bg-[#f0f0fa]">
                  “{msg.m.reply.player}”
                </button>
              )}
              {(!msg.m.reply || msg.stage === "replied") && (
                <button type="button" onClick={closeMessage} className="rounded px-3 py-1 text-[12px] font-semibold text-[#5b5fc7] hover:bg-[#f0f0fa]">
                  {msg.m.ack}
                </button>
              )}
            </>
          }
        >
          {msg.m.reply && msg.stage !== "toast" && msg.stage !== "open" && (
            <div className="mt-2.5 flex flex-col gap-2">
              <p className="ml-6 rounded-md bg-[#e8ebfa] px-2.5 py-1.5 text-[12.5px] leading-snug text-[#242424]">{msg.m.reply.player}</p>
              {msg.stage === "typing" ? (
                <p className="text-[11.5px] italic text-[#605e5c]">{msg.m.from.split(" ")[0]} is typing…</p>
              ) : (
                <p className="animate-[bauIn_400ms_ease-out] rounded-md bg-[#f5f5f5] px-2.5 py-1.5 text-[12.5px] leading-snug text-[#242424]">{msg.m.reply.them}</p>
              )}
            </div>
          )}
        </TeamsToast>
      )}

      {/* The email notification — ordinary; no hint of the result. */}
      {mailToast && (
        <div
          className="absolute bottom-6 right-4 w-[min(360px,calc(100vw-2rem))] rounded-md border border-zinc-200 bg-white text-zinc-900 shadow-xl transition-all duration-500 sm:right-6"
          style={{ opacity: toastIn ? 1 : 0, transform: toastIn ? "none" : "translateY(10px)", borderLeft: "3px solid #0078d4" }}
          role="status"
        >
          <button type="button" onClick={openEmail} className="flex w-full gap-3 p-3.5 text-left hover:bg-[#f7f9fb]">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#1b2433] text-[11px] font-semibold text-white">IC</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-semibold text-[#201f1e]">{FINAL_EMAIL.from}</span>
              <span className="mt-0.5 block truncate text-[12.5px] text-[#323130]">{FINAL_EMAIL.subject}</span>
              <span className="mt-0.5 block text-[11px] text-[#605e5c]">1 attachment</span>
            </span>
          </button>
        </div>
      )}
      <style>{`@keyframes bauIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }`}</style>
    </div>
  );
}
