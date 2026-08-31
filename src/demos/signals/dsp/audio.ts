/**
 * Shared Web Audio playback for the signals panels. The AudioContext is created lazily
 * on the first play() — i.e. inside a user gesture — and one panel starting playback
 * stops whatever another panel was playing.
 */

let ctx: AudioContext | null = null;
let current: { src: AudioBufferSourceNode; onended: () => void } | null = null;

function ensureCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function stopAudio(): void {
  if (current) {
    const c = current;
    current = null;
    try {
      c.src.onended = null;
      c.src.stop();
    } catch {
      /* already stopped */
    }
    c.onended();
  }
}

/**
 * Play mono samples at the given rate. Values are clamped to ±1 after an optional gain.
 * Returns a stop function; onEnded fires once, on natural end or stop.
 */
export function playSamples(
  samples: ArrayLike<number>,
  sampleRate: number,
  opts: { gain?: number; onEnded?: () => void } = {},
): () => void {
  const audio = ensureCtx();
  stopAudio();
  // Browsers reject rates < 3000 Hz; upsample by simple repetition if needed.
  let rate = sampleRate;
  let rep = 1;
  while (rate < 3000) {
    rate *= 2;
    rep *= 2;
  }
  const buf = audio.createBuffer(1, samples.length * rep, rate);
  const ch = buf.getChannelData(0);
  const g = opts.gain ?? 1;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i] * g));
    for (let r = 0; r < rep; r++) ch[i * rep + r] = v;
  }
  const src = audio.createBufferSource();
  src.buffer = buf;
  src.connect(audio.destination);
  const entry = { src, onended: () => opts.onEnded?.() };
  current = entry;
  src.onended = () => {
    if (current === entry) current = null;
    entry.onended();
  };
  src.start();
  return () => {
    if (current === entry) stopAudio();
  };
}
