/**
 * Phone-call tones for the Act 5 sponsor call, cut from one audio file with the Web Audio API
 * so segment boundaries are sample-accurate and the ringtone loops without gaps.
 *  - ring: [ring.start, ring.end) looped until stopRing() (a few ms fade at the seam avoids a click)
 *  - hang-up: [hangup.start, hangup.end) played once; the promise resolves when it finishes
 * Missing file / decode failure / blocked autoplay never throw — the call just stays silent.
 */
export interface Segment { start: number; end: number }

export interface CallTones {
  startRing(): void;
  stopRing(): void;
  playHangup(): Promise<void>;
  setMuted(muted: boolean): void;
  dispose(): void;
}

const VOLUME = 0.6;
const SEAM_FADE_S = 0.03;

export function createCallTones(src: string, ring: Segment, hangup: Segment, muted: boolean): CallTones {
  const Ctx: typeof AudioContext | undefined =
    typeof window === "undefined" ? undefined : window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return { startRing() {}, stopRing() {}, playHangup: () => Promise.resolve(), setMuted() {}, dispose() {} };

  const ctx = new Ctx();
  const gain = ctx.createGain();
  gain.gain.value = muted ? 0 : VOLUME;
  gain.connect(ctx.destination);

  let full: AudioBuffer | null = null;
  let ringBuf: AudioBuffer | null = null;
  let ringSrc: AudioBufferSourceNode | null = null;
  let wantRing = false;
  let disposed = false;

  // Autoplay: if the context starts suspended, resume it on the next user gesture.
  const resume = () => { if (ctx.state === "suspended") void ctx.resume().catch(() => {}); };
  window.addEventListener("pointerdown", resume, true);
  window.addEventListener("keydown", resume, true);
  resume();

  fetch(src)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then((data) => ctx.decodeAudioData(data))
    .then((buf) => {
      if (disposed) return;
      full = buf;
      ringBuf = cutSegment(ctx, buf, ring);
      if (wantRing) startRing();
    })
    .catch(() => {});

  function startRing() {
    wantRing = true;
    if (disposed || ringSrc || !ringBuf) return; // one instance only
    const s = ctx.createBufferSource();
    s.buffer = ringBuf;
    s.loop = true;
    s.loopStart = 0;
    s.loopEnd = ringBuf.duration;
    s.connect(gain);
    s.start(0, 0);
    ringSrc = s;
  }

  function stopRing() {
    wantRing = false;
    const s = ringSrc;
    ringSrc = null;
    if (!s) return;
    try { s.stop(); } catch { /* already stopped */ }
    s.disconnect();
  }

  function playHangup(): Promise<void> {
    stopRing();
    const dur = hangup.end - hangup.start;
    if (disposed || !full) return Promise.resolve();
    resume();
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      const s = ctx.createBufferSource();
      s.buffer = full;
      s.connect(gain);
      s.onended = () => { s.disconnect(); finish(); };
      s.start(0, hangup.start, dur);
      // Safety net (suspended context / browser quirks): never hold the story longer than the segment.
      setTimeout(finish, dur * 1000 + 250);
    });
  }

  function setMuted(m: boolean) {
    gain.gain.value = m ? 0 : VOLUME;
  }

  function dispose() {
    disposed = true;
    stopRing();
    window.removeEventListener("pointerdown", resume, true);
    window.removeEventListener("keydown", resume, true);
    void ctx.close().catch(() => {});
  }

  return { startRing, stopRing, playHangup, setMuted, dispose };
}

/** Copy [seg.start, seg.end) into its own buffer with a short fade-out so the loop seam doesn't click. */
function cutSegment(ctx: BaseAudioContext, buf: AudioBuffer, seg: Segment): AudioBuffer {
  const sr = buf.sampleRate;
  const from = Math.max(0, Math.round(seg.start * sr));
  const to = Math.min(buf.length, Math.round(seg.end * sr));
  const len = Math.max(1, to - from);
  const out = ctx.createBuffer(buf.numberOfChannels, len, sr);
  const fade = Math.min(len, Math.round(SEAM_FADE_S * sr));
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = out.getChannelData(c);
    d.set(buf.getChannelData(c).subarray(from, to));
    for (let i = 0; i < fade; i++) d[len - 1 - i] *= i / fade;
  }
  return out;
}
