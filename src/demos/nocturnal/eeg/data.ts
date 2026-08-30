/** Loader for the shipped recording: public/demos/nocturnal/eeg.json + eeg.bin. */

export interface EegChannel {
  name: string;
  /** µV per int16 count. */
  scale: number;
  impedanceKohm: number | null;
  offsetMv: number | null;
}

export interface EegHeader {
  source: string;
  fs: number;
  originalFs: number;
  samples: number;
  durationS: number;
  layout: string;
  pipeline: string;
  channels: EegChannel[];
}

export interface EegData {
  header: EegHeader;
  fs: number;
  samples: number;
  names: string[];
  /** One Float32Array per channel, in µV, DC already removed. */
  channels: Float32Array[];
}

const BASE = "/demos/nocturnal";

/** Above this the header's impedance check flagged the electrode; normal contacts are 50–200 kΩ. */
export const BAD_CONTACT_KOHM = 5000;

export function isBadContact(ch: EegChannel): boolean {
  return ch.impedanceKohm !== null && ch.impedanceKohm > BAD_CONTACT_KOHM;
}

export function formatImpedance(kohm: number | null): string {
  if (kohm === null) return "n/a";
  return kohm >= 1000 ? `${(kohm / 1000).toFixed(1)} MΩ` : `${kohm} kΩ`;
}

let cached: Promise<EegData> | null = null;

export function loadEeg(): Promise<EegData> {
  if (!cached) {
    cached = (async () => {
      const [hRes, bRes] = await Promise.all([fetch(`${BASE}/eeg.json`), fetch(`${BASE}/eeg.bin`)]);
      if (!hRes.ok || !bRes.ok) throw new Error("eeg data not found (run `pnpm sync-demos nocturnal`)");
      const header = (await hRes.json()) as EegHeader;
      const buf = await bRes.arrayBuffer();
      const nCh = header.channels.length;
      const n = header.samples;
      if (buf.byteLength < nCh * n * 2) throw new Error("eeg.bin is shorter than the header says");
      const raw = new Int16Array(buf, 0, nCh * n); // little-endian on every platform the site runs on
      const channels = header.channels.map((ch, i) => {
        const out = new Float32Array(n);
        const off = i * n;
        for (let k = 0; k < n; k++) out[k] = raw[off + k] * ch.scale;
        return out;
      });
      return { header, fs: header.fs, samples: n, names: header.channels.map((c) => c.name), channels };
    })();
    cached.catch(() => {
      cached = null;
    });
  }
  return cached;
}
