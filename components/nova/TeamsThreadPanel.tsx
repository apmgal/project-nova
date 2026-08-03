"use client";

import { useEffect } from "react";
import { Bell, Calendar, ChevronLeft, ChevronRight, MessageCircle, Pencil, Phone, Search, ThumbsUp, Video } from "lucide-react";
import type { Flags, RiskInvestigationBank, RiskInvestigationQuestion } from "@/lib/nova/types";

interface TeamsThreadPanelProps {
  bank: RiskInvestigationBank;
  flags: Flags;
  onAsk: (question: RiskInvestigationQuestion) => void;
  onContinue: () => void;
}

// Cosmetic-only per-message chrome (timestamp, reaction, quoted-reply,
// end-of-thread highlight) matching the approved Teams-desktop mockup.
// Kept local rather than added to the content schema since nothing else
// reads it — the underlying bank.questions shape stays the same generic
// dimension/answerText pair used everywhere else.
const TEAMS_META: Record<
  string,
  { time: string; reaction?: number; quote?: { from: string; time: string; text: string }; highlighted?: boolean }
> = {
  q_teams_1: { time: "10:02" },
  q_teams_2: { time: "10:15", reaction: 1 },
  q_teams_3: {
    time: "14:20",
    quote: { from: "Camille Okafor", time: "10:15", text: "Can we please lock a date. Validation doesn't fix itself." },
  },
  q_teams_4: { time: "14:48", highlighted: true },
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
}

const AVATAR_COLORS: Record<string, string> = {
  "Vaughn Kessler": "bg-[#b45309]",
  "Camille Okafor": "bg-[#0e7490]",
  "Daniel Atwell": "bg-[#166534]",
};

/**
 * Bespoke chrome for risk_investigation.json banks with
 * visualStyle: "teams_thread" — mirrors the real Teams desktop app's icon
 * rail, chat list with a Favourites section, and message pane (matching
 * the approved mockup, built against a real Teams screenshot the user
 * supplied). Every message is visible at once — it's a transcript, not a
 * quiz — so all questions are marked asked on mount.
 */
export default function TeamsThreadPanel({ bank, flags, onAsk, onContinue }: TeamsThreadPanelProps) {
  useEffect(() => {
    for (const question of bank.questions) {
      if (!flags[question.flagOnAsk]) onAsk(question);
    }
    // Only needs to run once per bank mount — re-running on every flags
    // change would be a no-op anyway since onAsk already guards on flagOnAsk.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bank]);

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-zinc-950 p-3">
      <div className="flex h-[400px] flex-col overflow-hidden rounded-md border border-zinc-300 bg-white text-zinc-900">
        <div className="flex shrink-0 items-center gap-3 border-b border-zinc-200 px-3.5 py-2">
          <ChevronLeft size={14} className="text-[#a19f9d]" />
          <ChevronRight size={14} className="text-[#a19f9d]" />
          <div className="flex flex-1 items-center gap-2 rounded-md bg-[#f5f5f5] px-2.5 py-1.5">
            <Search size={13} className="text-[#8a8886]" />
            <span className="text-[12px] text-[#8a8886]">Search</span>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="flex w-11 shrink-0 flex-col items-center gap-4 border-r border-zinc-200 bg-[#f5f5f5] py-3.5">
            <Bell size={17} className="text-[#616161]" />
            <Phone size={17} className="text-[#616161]" />
            <MessageCircle size={17} className="text-[#5b5fc7]" />
            <Calendar size={17} className="text-[#616161]" />
          </div>

          <div className="w-[170px] shrink-0 overflow-y-auto border-r border-zinc-200 p-3">
            <p className="mb-2 text-[13px] font-semibold text-[#242424]">Chat</p>
            <div className="mb-3 flex gap-1.5">
              <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[10px] text-[#424242]">Unread</span>
              <span className="rounded-full bg-[#ebebf5] px-2 py-0.5 text-[10px] text-[#5b5fc7]">Chats</span>
            </div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wide text-[#8a8886]">Favourites</p>
            <div className="flex items-center gap-2 rounded-md bg-[#ebebf5] p-1.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5b5fc7] text-[10px] font-semibold text-white">
                SG
              </span>
              <span className="text-[11px] text-[#242424]">Steering Group</span>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#5b5fc7] text-[11px] font-semibold text-white">
                  SG
                </span>
                <span className="text-[13px] font-semibold text-[#242424]">
                  Project NOVA — Steering Group
                </span>
                <Pencil size={13} className="text-[#a19f9d]" />
              </div>
              <div className="flex gap-3.5">
                <Video size={15} className="text-[#616161]" />
                <Search size={15} className="text-[#616161]" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {bank.questions.map((message) => {
                const meta = TEAMS_META[message.id];
                return (
                  <div
                    key={message.id}
                    className={`mb-3.5 flex gap-2 last:mb-0 ${
                      meta?.highlighted ? "-mx-2 rounded-md bg-[#fffbe6] p-2" : ""
                    }`}
                  >
                    <span
                      className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${
                        AVATAR_COLORS[message.dimension] ?? "bg-zinc-500"
                      }`}
                    >
                      {initials(message.dimension)}
                    </span>
                    <div>
                      <p className="mb-0.5 text-[11px] font-semibold text-[#424242]">
                        {message.dimension} <span className="ml-1.5 font-normal text-[#8a8886]">{meta?.time}</span>
                      </p>
                      {meta?.quote && (
                        <div className="mb-1 rounded-md border border-l-[3px] border-zinc-200 border-l-[#a19f9d] bg-[#faf9f8] px-2.5 py-1.5">
                          <p className="text-[10px] text-[#616161]">
                            {meta.quote.from}&nbsp;&nbsp;{meta.quote.time}
                          </p>
                          <p className="text-[11px] text-[#424242]">{meta.quote.text}</p>
                        </div>
                      )}
                      <div
                        className={`inline-block rounded-lg bg-[#f5f5f5] px-3 py-2 text-[12px] text-[#242424] ${
                          meta?.highlighted ? "font-semibold" : ""
                        }`}
                      >
                        {message.answerText}
                      </div>
                      {meta?.reaction && (
                        <div className="mt-1 flex w-fit items-center gap-1 rounded-full border border-zinc-200 px-2 py-0.5">
                          <ThumbsUp size={11} className="text-[#5b5fc7]" />
                          <span className="text-[10px] text-[#616161]">{meta.reaction}</span>
                        </div>
                      )}
                      {meta?.highlighted && (
                        <p className="mt-1 text-[10px] text-[#8a8886]">Seen • No replies</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <button
          onClick={onContinue}
          className="rounded-md bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Continue ▸
        </button>
      </div>
    </div>
  );
}
