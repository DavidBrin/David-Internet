/**
 * Patch-recording simulation — port of spikeparam.patch.sim.sim_patch:
 * stitch spike waveforms together with exponential hyperpolarization between
 * them (drives the sandbox's mini ISI train).
 */

export function simPatch(spikes: Float64Array[], isiSamples: number[], tau: number): Float64Array {
  const nSpk = spikes.length;
  const isi = isiSamples.slice();
  while (isi.length < nSpk) {
    isi.push(Math.round(isiSamples.reduce((a, b) => a + b, 0) / Math.max(1, isiSamples.length)));
  }
  const isiInt = isi.map((v) => Math.round(v));

  // align all spikes to a common resting voltage (mean of first samples)
  const firsts = spikes.map((s) => s[0]);
  const restMv = firsts.reduce((a, b) => a + b, 0) / nSpk;
  const aligned = spikes.map((s, i) => {
    const out = new Float64Array(s.length);
    const shift = restMv - firsts[i];
    for (let j = 0; j < s.length; j++) out[j] = s[j] + shift;
    return out;
  });

  const totalSpikeSamples = aligned.reduce((a, s) => a + s.length, 0);
  const totalIsi = isiInt.slice(0, nSpk).reduce((a, b) => a + b, 0);
  const sig = new Float64Array(totalSpikeSamples + totalIsi);

  let pos = 0;
  for (let ind = 0; ind < nSpk; ind++) {
    const spike = aligned[ind];
    const interval = isiInt[ind];
    sig.set(spike, pos);
    if (interval > 0) {
      const end = ind < nSpk - 1 ? aligned[ind + 1][0] : spike[0];
      const start = spike[spike.length - 1];
      // hyperpolarization dip rising back to `end`
      const hyper = new Float64Array(interval);
      let min = Infinity;
      let max = -Infinity;
      for (let x = 0; x < interval; x++) {
        hyper[x] = -Math.exp(-x / tau);
        if (hyper[x] < min) min = hyper[x];
      }
      for (let x = 0; x < interval; x++) {
        hyper[x] -= min;
        if (hyper[x] > max) max = hyper[x];
      }
      for (let x = 0; x < interval; x++) {
        hyper[x] = (hyper[x] / (max || 1)) * Math.abs(end - start);
      }
      const shift = hyper[interval - 1] - end;
      for (let x = 0; x < interval; x++) sig[pos + spike.length + x] = hyper[x] - shift;
      pos += spike.length + interval;
    } else {
      pos += spike.length;
    }
  }
  return sig;
}
