"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Phone, PhoneOff, RotateCcw, User, Volume2, VolumeX } from "lucide-react";
import type { GameState } from "@/lib/nova/types";
import { getDialogue } from "@/lib/nova/data";
import { createCallTones, type CallTones } from "@/lib/nova/callTones";
import SceneAudio from "@/components/nova/narrative/SceneAudio";
import { ACT5_BEDS, playCue } from "@/lib/nova/act5Sound";
import {
  CALL_TONES_SRC,
  HANGUP_SEGMENT,
  MEETING_BACKGROUND_SRC,
  RECOVERY_DECISION,
  RECOVERY_STRATEGY_KEY,
  RING_SEGMENT,
  SPEAKER_LABELS,
  SPONSOR_CALL,
  SPONSOR_CALL_AUDIO_SRC,
  SPONSOR_DECISION,
  SPONSOR_UPDATE_KEY,
  type RecoveryOption,
} from "@/lib/nova/act5Recovery";

/**
 * Act 5 — Recovery Meeting → Recovery Strategy Decision → Sponsor Phone Call
 * (scene ACT5_SCENE00_RECOVERY). Scene-specific layouts; the underlying data
 * comes from the existing systems: meeting lines from dialogue.json (shown without portraits),
 * choices stored in GameState.decisions by the caller. Sound: lib/nova/act5Sound.ts (room tone via
 * SceneAudio, ducked under the call; restrained cues on decisions). The call's ringtone, voice lines
 * and hang-up tone are unchanged.
 *
 * Resume: no strategy chosen yet → the meeting starts again from its first line;
 * strategy chosen → straight to the incoming call.
 */

// Small helpers so the audio element is only ever driven from outside React's render/hook values.
function restartAudio(a: HTMLAudioElement, muted: boolean, src: string) {
  a.pause();
  if (a.getAttribute("src") !== src) a.src = src;
  a.currentTime = 0;
  a.muted = muted;
  return a.play();
}
function setAudioMuted(a: HTMLAudioElement, muted: boolean) {
  a.muted = muted;
}
function stopAudio(a: HTMLAudioElement) {
  a.pause();
  a.removeAttribute("src");
  a.load();
}

const OLIVE = "#B5C474";
const OLIVE_TEXT = "#20252B";
const PAGE_BG = "bg-[#1d2027]";

type Phase =
  | { kind: "meeting"; line: number }
  | { kind: "strategy" }
  | { kind: "strategyReply"; option: RecoveryOption }
  | { kind: "incoming" }
  | { kind: "onCall" }
  | { kind: "sponsorChoice" }
  | { kind: "sponsorReply"; option: RecoveryOption }
  | { kind: "ended" };

interface RecoverySequenceProps {
  gameState: GameState;
  muted: boolean;
  onToggleMute: () => void;
  /** Store a categorical decision in GameState.decisions (and save). */
  onDecision: (key: string, value: string) => void;
  /** The sequence is over — continue the story (future recovery montage goes here). */
  onComplete: () => void;
}

export default function RecoverySequence({ gameState, muted, onToggleMute, onDecision, onComplete }: RecoverySequenceProps) {
  const meetingLines = useMemo(
    () => (getDialogue("DIALOGUE_ACT5_SCENE00_RECOVERY")?.lines ?? []).filter((l) => l.speaker !== "narrator"),
    [],
  );
  const [phase, setPhase] = useState<Phase>(() =>
    gameState.decisions?.[RECOVERY_STRATEGY_KEY] ? { kind: "incoming" } : { kind: "meeting", line: 0 },
  );

  // Arrival: hold on black for 1 s (the facility already faded out), then fade in over 1 s.
  // Leaving: fade to black over 1 s before handing back to the story.
  const [veil, setVeil] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => setVeil(0), 1000);
    return () => clearTimeout(t);
  }, []);
  const completeRef = useRef(onComplete);
  useEffect(() => { completeRef.current = onComplete; });
  // Resume: the sponsor's response is already saved (a reload after the call), so don't replay the call —
  // hand straight on to what follows it (the recovery montage).
  const [resumePastCall] = useState(() => !!gameState.decisions?.[SPONSOR_UPDATE_KEY]);
  useEffect(() => { if (resumePastCall) completeRef.current(); }, [resumePastCall]);
  const finishedRef = useRef(false);
  const endSequence = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const wasOnCall = phase.kind === "sponsorReply";
    setPhase({ kind: "ended" }); // the voice line was already paused when a response was chosen
    // Hang-up tone first (call scenes only), then fade out and continue.
    const leave = () => {
      setVeil(1);
      setTimeout(() => completeRef.current(), 1000);
    };
    if (wasOnCall && tonesRef.current) void tonesRef.current.playHangup().then(leave);
    else leave();
  };


  // ---------- Sponsor audio ----------
  // One element for the whole call: started by the Accept click (a user gesture, so autoplay is
  // allowed), replayable, stopped on unmount. A missing file just means "text only".
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audio, setAudio] = useState<"idle" | "playing" | "ended" | "unavailable">("idle");
  const mutedRef = useRef(muted);
  useEffect(() => {
    mutedRef.current = muted;
    if (audioRef.current) setAudioMuted(audioRef.current, muted);
  }, [muted]);
  useEffect(() => () => {
    const a = audioRef.current;
    if (a) stopAudio(a);
    audioRef.current = null;
  }, []);
  function playSponsorLine(src: string = SPONSOR_CALL_AUDIO_SRC) {
    let a = audioRef.current;
    if (!a) {
      a = new Audio(src);
      a.preload = "auto";
      a.addEventListener("ended", () => setAudio("ended"));
      a.addEventListener("error", () => setAudio("unavailable"));
      audioRef.current = a;
    }
    setAudio("playing");
    restartAudio(a, mutedRef.current, src).catch(() => setAudio((s) => (s === "playing" ? "unavailable" : s)));
  }
  const lineDone = audio === "ended" || audio === "unavailable";

  // ---------- Call tones (Teams ringtone loop + hang-up), one file via Web Audio ----------
  const tonesRef = useRef<CallTones | null>(null);
  useEffect(() => {
    const t = createCallTones(CALL_TONES_SRC, RING_SEGMENT, HANGUP_SEGMENT, mutedRef.current);
    tonesRef.current = t;
    return () => {
      t.dispose();
      if (tonesRef.current === t) tonesRef.current = null;
    };
  }, []);
  // Ring only while the incoming-call screen is up; any other phase silences it.
  useEffect(() => {
    if (phase.kind === "incoming") tonesRef.current?.startRing();
    else tonesRef.current?.stopRing();
    if (phase.kind === "ended") audioRef.current?.pause(); // hanging up cuts off any voice clip
  }, [phase.kind]);
  useEffect(() => {
    tonesRef.current?.setMuted(muted);
  }, [muted]);

  // ---------- Speaker fade between lines ----------
  const [shown, setShown] = useState(false);
  const phaseKey = phase.kind === "meeting" ? `m${phase.line}` : phase.kind;
  useEffect(() => {
    setShown(false); // eslint-disable-line react-hooks/set-state-in-effect -- restart the fade for each new line
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    return () => cancelAnimationFrame(r);
  }, [phaseKey]);

  // A decision panel appearing: papers on the table (restrained; once per panel).
  useEffect(() => {
    if (phase.kind === "strategy" || phase.kind === "sponsorChoice") playCue("optionsAppear", mutedRef.current);
  }, [phase.kind]);

  // ---------- Actions ----------
  function advanceMeeting() {
    if (phase.kind !== "meeting") return;
    playCue("dialogueAdvance", mutedRef.current);
    if (phase.line < meetingLines.length - 1) setPhase({ kind: "meeting", line: phase.line + 1 });
    else setPhase({ kind: "strategy" });
  }
  function chooseStrategy(option: RecoveryOption) {
    if (phase.kind !== "strategy") return;
    playCue("choiceMade", mutedRef.current);
    onDecision(RECOVERY_STRATEGY_KEY, option.id);
    setPhase({ kind: "strategyReply", option });
  }
  function acceptCall() {
    if (phase.kind !== "incoming") return;
    tonesRef.current?.stopRing(); // stop immediately, before the voice line starts
    setPhase({ kind: "onCall" });
    playSponsorLine();
  }
  function chooseResponse(option: RecoveryOption) {
    if (phase.kind !== "sponsorChoice") return;
    playCue("choiceMade", mutedRef.current);
    audioRef.current?.pause();
    onDecision(SPONSOR_UPDATE_KEY, option.id);
    setPhase({ kind: "sponsorReply", option });
    if (option.reply.audio) playSponsorLine(option.reply.audio);
  }

  // No character pictures in this sequence: every speaker gets the plain person icon.

  const inCall = phase.kind === "incoming" || phase.kind === "onCall" || phase.kind === "sponsorChoice" || phase.kind === "sponsorReply" || (phase.kind === "ended" && !!gameState.decisions?.[SPONSOR_UPDATE_KEY]);

  // Current meeting-room speech (meeting lines, then the strategy acknowledgement).
  const speech =
    phase.kind === "meeting"
      ? meetingLines[phase.line]
      : phase.kind === "strategyReply"
        ? phase.option.reply
        : null;

  // Keyboard, like the rest of the game's dialogue: Enter / Space / → continue the meeting.
  const continueMeeting = phase.kind === "meeting" ? advanceMeeting : phase.kind === "strategyReply" ? () => setPhase({ kind: "incoming" }) : undefined;
  const continueRef = useRef(continueMeeting);
  useEffect(() => { continueRef.current = continueMeeting; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " " && e.key !== "ArrowRight") return;
      if ((e.target as HTMLElement | null)?.closest?.("button, input, textarea")) return; // a focused button handles its own key
      if (!continueRef.current) return;
      e.preventDefault();
      continueRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The room: a quiet, occupied meeting-room tone; ducked under Mike's call; gone with the fade to black.
  const bedVolume = muted || phase.kind === "ended" ? 0 : inCall ? ACT5_BEDS.meetingDucked : ACT5_BEDS.meeting.volume;

  if (resumePastCall) return <div className="fixed inset-0 z-[60] bg-black" />;

  return (
    <div className={`fixed inset-0 z-[60] overflow-y-auto ${inCall ? "bg-[#0d1117]" : PAGE_BG} text-white`} style={{ fontFamily: "var(--font-body)" }}>
      <SceneAudio src={ACT5_BEDS.meeting.src} volume={bedVolume} fadeInMs={2200} fadeOutMs={1200} />
      {!inCall && (
        <MeetingLayout speech={speech} shown={shown} onContinue={continueMeeting} />
      )}

      {phase.kind === "strategy" && (
        <DecisionOverlay
          title={RECOVERY_DECISION.title}
          description={RECOVERY_DECISION.description}
          options={RECOVERY_DECISION.options}
          onChoose={chooseStrategy}
          showTradeOffs={false}
        />
      )}

      {inCall && (
        <CallLayout
          phase={phase.kind}
          portrait={null}
          // Mike's opening line is voiced, so it isn't shown as text — unless the clip can't play.
          text={
            phase.kind === "sponsorReply"
              ? (phase.option.reply.audio && audio !== "unavailable" ? null : phase.option.reply.text)
              : audio === "unavailable" ? SPONSOR_CALL.line : null
          }
          shown={shown}
          audio={audio}
          lineDone={lineDone}
          onAccept={acceptCall}
          onReplay={() => playSponsorLine()}
          onRespond={() => setPhase({ kind: "sponsorChoice" })}
          onEndCall={endSequence}
        />
      )}

      {phase.kind === "sponsorChoice" && (
        <DecisionOverlay
          title={SPONSOR_DECISION.title}
          description={SPONSOR_DECISION.description}
          options={SPONSOR_DECISION.options}
          onChoose={chooseResponse}
          showTradeOffs={false}
        />
      )}

      <button
        type="button"
        onClick={onToggleMute}
        aria-label={muted ? "Unmute sound" : "Mute sound"}
        title={muted ? "Unmute sound" : "Mute sound"}
        className="fixed right-4 top-4 z-[62] grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/40 text-zinc-300 backdrop-blur-md hover:bg-black/60"
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[70] bg-black transition-opacity duration-1000 ease-in-out"
        style={{ opacity: veil }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meeting room: framed background on top, speaker row + Continue below.
// ---------------------------------------------------------------------------

function MeetingBackground() {
  const [missing, setMissing] = useState(false);
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[22px] border border-white/5 bg-[#15181e]">
      {!missing ? (
        // eslint-disable-next-line @next/next/no-img-element -- static art with an onError fallback
        <img src={MEETING_BACKGROUND_SRC} alt="Corporate meeting room" className="h-full w-full object-cover" onError={() => setMissing(true)} />
      ) : (
        <div
          className="h-full w-full"
          style={{
            background:
              "radial-gradient(ellipse at 50% 38%, rgba(196,150,96,0.22) 0%, rgba(40,32,28,0.6) 38%, rgba(10,12,16,1) 78%), linear-gradient(180deg, #1c1a1a 0%, #0f1115 100%)",
          }}
        >
          <span className="absolute bottom-4 left-4 rounded-full border border-white/20 bg-black/50 px-3 py-1 text-[12px] text-zinc-300">
            Placeholder background — add {MEETING_BACKGROUND_SRC.replace(/^\//, "public/")}
          </span>
        </div>
      )}
      {/* Slight darkening for readability. */}
      <div className="pointer-events-none absolute inset-0 bg-black/15" />
    </div>
  );
}

function Avatar({ src, alt, className }: { src: string | null; alt: string; className: string }) {
  return (
    <div className={`grid shrink-0 place-items-center overflow-hidden bg-[#343a45] text-zinc-300 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- small character portrait */}
      {src ? <img src={src} alt={alt} className="h-full w-full object-cover" /> : <User size={30} strokeWidth={1.75} />}
    </div>
  );
}

/**
 * The meeting's dialogue box — the game's character dialogue (speaker name and department, the line, a
 * continue control), without portraits, in the same treatment as the inspection film's dialogue box
 * (WhitfieldOpening): a dark translucent panel with a fine border, the speaker in olive, the line in
 * white at reading size, a quiet "Continue" cue. The whole panel advances (click, Enter, Space or →).
 */
function MeetingLayout({
  speech,
  shown,
  onContinue,
}: {
  speech: { speaker: string; text: string } | null;
  shown: boolean;
  onContinue?: () => void;
}) {
  const label = speech ? SPEAKER_LABELS[speech.speaker] : null;
  return (
    <div className="mx-auto flex h-full min-h-[560px] max-w-[1240px] flex-col gap-5 px-4 py-4 sm:px-6 sm:py-5">
      <div className="relative min-h-[220px] flex-1">
        <div className="absolute inset-0">
          <MeetingBackground />
        </div>
      </div>
      <div className="min-h-[150px] shrink-0">
        {speech && (
          <button
            type="button"
            onClick={onContinue}
            disabled={!onContinue}
            aria-label={onContinue ? "Continue" : undefined}
            className={`group mx-auto block w-full max-w-4xl rounded-lg border border-white/10 bg-black/45 px-6 py-5 text-left backdrop-blur-sm transition-[opacity,transform,border-color,background-color] duration-300 ease-out hover:border-white/20 hover:bg-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default ${shown ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}
            style={{ outlineColor: OLIVE }}
          >
            <p className="mb-2 text-sm font-semibold tracking-wide sm:text-[15px]" style={{ color: OLIVE }}>
              {label ? label.name : speech.speaker}
              {label && <span className="font-normal text-white/45"> · {label.department}</span>}
            </p>
            <p className="text-base leading-relaxed text-white/90 sm:text-lg">“{speech.text}”</p>
            {onContinue && (
              <span className="mt-3 flex items-center justify-end gap-1 text-xs text-white/40 transition-colors group-hover:text-white/70">
                Continue <ChevronRight size={14} />
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Decision panel: title, description, three stacked option cards.
// ---------------------------------------------------------------------------

function DecisionOverlay({
  title,
  description,
  options,
  onChoose,
  showTradeOffs = true,
}: {
  title: string;
  description: string;
  options: RecoveryOption[];
  onChoose: (option: RecoveryOption) => void;
  /** The small trade-off line under each option (hidden on the sponsor call). */
  showTradeOffs?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const pick = (o: RecoveryOption) => {
    if (selected) return; // one choice only
    setSelected(o.id);
    setTimeout(() => onChoose(o), 450); // let the selected state register
  };
  return (
    <div className="fixed inset-0 z-[61] overflow-y-auto bg-black/60 backdrop-blur-[2px]">
      <div className="flex min-h-full items-center justify-center p-4">
        <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-[1220px] rounded-[22px] bg-[#1d2027] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.5)] sm:p-5">
          <h2 className="text-[19px] font-bold text-white sm:text-[22px]">{title}</h2>
          <p className="mt-2 text-[14px] leading-[1.55] text-zinc-300/90 sm:text-[16px]">{description}</p>
          <ul className="mt-4 space-y-3">
            {options.map((o) => {
              const isSel = selected === o.id;
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => pick(o)}
                    disabled={!!selected && !isSel}
                    aria-pressed={isSel}
                    className={`w-full rounded-[16px] border px-5 py-4 text-left transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B5C474] ${
                      isSel
                        ? "border-[#B5C474] bg-[#B5C474]/10"
                        : "border-white/20 hover:border-[#B5C474]/60 hover:bg-[#B5C474]/[0.05] disabled:opacity-50 disabled:hover:border-white/20 disabled:hover:bg-transparent"
                    }`}
                  >
                    <span className="flex items-center gap-4">
                      <span className="grid h-[46px] w-[34px] shrink-0 place-items-center rounded-[8px] bg-[#3a3e46] text-[18px] font-semibold sm:h-[54px] sm:w-[38px] sm:text-[20px]" style={{ color: OLIVE }}>
                        {o.letter}
                      </span>
                      <span className="text-[17px] font-bold text-white sm:text-[20px]">{o.title}</span>
                    </span>
                    <span className="mt-2.5 block text-[14px] leading-[1.5] text-zinc-200 sm:text-[17px]">{o.description}</span>
                    {showTradeOffs && <span className="mt-1.5 block text-[12.5px] text-[#a5a893] sm:text-[14.5px]">{o.tradeOff}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phone call: incoming (ringing) → on call (audio + text) → reply → end.
// ---------------------------------------------------------------------------

function CallLayout({
  phase,
  portrait,
  text,
  shown,
  audio,
  lineDone,
  onAccept,
  onReplay,
  onRespond,
  onEndCall,
}: {
  phase: Phase["kind"];
  portrait: string | null;
  text: string | null;
  shown: boolean;
  audio: "idle" | "playing" | "ended" | "unavailable";
  lineDone: boolean;
  onAccept: () => void;
  onReplay: () => void;
  onRespond: () => void;
  onEndCall: () => void;
}) {
  const ringing = phase === "incoming";
  const statusText = ringing ? "Incoming call" : phase === "ended" ? "Call ended" : "On call";
  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-[1240px] rounded-[22px] bg-[#141a22] px-5 pb-6 pt-5 text-center shadow-[0_24px_60px_rgba(0,0,0,0.45)] sm:pb-7">
        <p className="text-[13px] uppercase tracking-[0.06em] text-zinc-400 sm:text-[15px]">{statusText}</p>
        <div className="relative mx-auto mt-5 h-[112px] w-[112px] sm:h-[136px] sm:w-[136px]">
          {ringing && (
            <>
              <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-[#869a64]/20 [animation-duration:1.8s]" />
              <span aria-hidden="true" className="absolute -inset-2 animate-pulse rounded-full border border-[#869a64]/40" />
            </>
          )}
          <Avatar src={portrait} alt={SPONSOR_CALL.name} className="relative h-full w-full rounded-full" />
        </div>
        <p className="mt-6 text-[22px] font-bold text-white sm:text-[26px]">{SPONSOR_CALL.name}</p>
        <p className="mt-2 text-[16px] text-zinc-300 sm:text-[19px]">{SPONSOR_CALL.role}</p>

        {ringing ? (
          <>
            <div className="mt-8 flex items-center justify-center gap-8">
              <span className="group relative">
                <button
                  type="button"
                  disabled
                  aria-label="Decline call (unavailable)"
                  aria-describedby="decline-tip"
                  className="grid h-[72px] w-[72px] cursor-not-allowed place-items-center rounded-full bg-[#a0464b] text-white opacity-90 sm:h-[84px] sm:w-[84px]"
                >
                  <PhoneOff size={24} />
                </button>
                <span
                  id="decline-tip"
                  role="tooltip"
                  className="pointer-events-none absolute left-1/2 top-full mt-2 w-max max-w-[220px] -translate-x-1/2 rounded-md border border-white/10 bg-black/85 px-2.5 py-1.5 text-[12px] text-zinc-200 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  {SPONSOR_CALL.declineTooltip}
                </span>
              </span>
              <button
                type="button"
                onClick={onAccept}
                aria-label="Accept call"
                className="grid h-[72px] w-[72px] place-items-center rounded-full bg-[#869a64] text-white transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B5C474] sm:h-[84px] sm:w-[84px]"
              >
                <Phone size={24} />
              </button>
            </div>
          </>
        ) : (
          <>
            {text && <p
              aria-live="polite"
              className={`mx-auto mt-7 max-w-[760px] text-[17px] leading-[1.6] text-zinc-100 transition-all duration-300 sm:text-[20px] ${shown ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}
            >
              &quot;{text}&quot;
            </p>}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              {phase === "onCall" && audio !== "unavailable" && (
                <button
                  type="button"
                  onClick={onReplay}
                  disabled={audio === "playing"}
                  className="flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-[14px] text-zinc-300 hover:bg-white/5 disabled:opacity-40"
                >
                  <RotateCcw size={14} /> {audio === "playing" ? "Playing…" : "Replay"}
                </button>
              )}
              {phase === "onCall" && (
                <button
                  type="button"
                  onClick={onRespond}
                  disabled={!lineDone}
                  className="flex items-center gap-2 rounded-[14px] px-6 py-2.5 text-[17px] font-semibold disabled:opacity-40"
                  style={{ backgroundColor: OLIVE, color: OLIVE_TEXT }}
                >
                  Respond <ChevronRight size={18} />
                </button>
              )}
              {phase === "sponsorReply" && (
                <button
                  type="button"
                  onClick={onEndCall}
                  aria-label="End call"
                  className="grid h-[64px] w-[64px] place-items-center rounded-full bg-[#a0464b] text-white transition-[filter] hover:brightness-110 sm:h-[72px] sm:w-[72px]"
                >
                  <PhoneOff size={22} />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
