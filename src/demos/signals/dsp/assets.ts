/**
 * Loaders for the committed demo assets under public/demos/signals/
 * (int16 little-endian .bin signals with scales in the JSON headers,
 * written by scripts/demos/signals_prep.py).
 */

export interface BinSignalHeader {
  file: string;
  n: number;
  fs: number;
  /** value = int16 / scale */
  scale: number;
}

export async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return (await r.json()) as T;
}

export async function fetchInt16(url: string): Promise<Int16Array> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  const buf = await r.arrayBuffer();
  return new Int16Array(buf);
}

/** Decode an int16 .bin (given its header) into Float64Array. */
export async function fetchBinSignal(baseUrl: string, h: BinSignalHeader): Promise<Float64Array> {
  const raw = await fetchInt16(`${baseUrl}/${h.file}`);
  const out = new Float64Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw[i] / h.scale;
  return out;
}
