"""
dsp.py — the Nocturnal Neuro DSP notebook (signal_analysis/DSP.ipynb) as a script.

The notebook had three working pieces and one unfinished one:

  load_eeg_to_array          — read a recording with MNE                         (cell 1 / 5)
  compute_functional_coherence — Welch coherence between channel pairs           (cell 2)
  "Signal Filtering"         — lowpass + downsample, left commented out         (cell 4)  ← completed here
  convert_eeg_to_edf         — write the Cognionics binary as EDF+               (cell 6)

Completed 2026-08-30 for the demo page. Changes from the notebook are marked "# completed:".
The browser panel ports filter_and_downsample / compute_functional_coherence to TypeScript
(src/demos/nocturnal/eeg/filters.ts, coherence.ts) and tests them against SciPy.
"""
import numpy as np
import scipy.signal as sps

# ----------------------------------------------------------------- loading


def load_eeg_to_array(file_path, file_format="auto"):
    """
    Load raw EEG data and convert it into a 2D NumPy array.

    Returns (eeg_data [n_channels × n_samples], fs, channel_names).
    """
    import mne  # notebook dependency; only needed for this loader

    if file_format == "edf":
        raw = mne.io.read_raw_edf(file_path, preload=True)
    elif file_format == "brainvision":
        raw = mne.io.read_raw_brainvision(file_path, preload=True)
    else:
        raw = mne.io.read_raw(file_path, preload=True)
    return raw.get_data(), raw.info["sfreq"], raw.info["ch_names"]


# ----------------------------------------------------------------- filtering (the unfinished cell)


def design_fir(fs, pass_type, f_range, n_seconds):
    """
    neurodsp.filt.design_fir_filter, inlined: a Hamming-window FIR from scipy.signal.firwin,
    odd length ceil(fs * n_seconds).  pass_type ∈ {'lowpass', 'highpass', 'bandstop', 'bandpass'}.
    """
    filt_len = int(np.ceil(fs * n_seconds))
    if filt_len % 2 == 0:
        filt_len += 1
    if pass_type == "lowpass":
        return sps.firwin(filt_len, f_range, fs=fs)
    if pass_type == "highpass":
        return sps.firwin(filt_len, f_range, pass_zero=False, fs=fs)
    if pass_type == "bandstop":
        return sps.firwin(filt_len, f_range, fs=fs)
    if pass_type == "bandpass":
        return sps.firwin(filt_len, f_range, pass_zero=False, fs=fs)
    raise ValueError(pass_type)


def filter_signal(sig, fs, pass_type, f_range, n_seconds=0.2):
    """neurodsp.filt.filter_signal(..., remove_edges=False): zero-phase FIR via np.convolve 'same'."""
    return np.convolve(sig, design_fir(fs, pass_type, f_range, n_seconds), mode="same")


def filter_and_downsample(sig, og_freq, downsample_freq, n_seconds_filter=0.2):
    """
    The notebook's "Signal Filtering" cell, completed.

    og_freq          -> starting frequency (500 from the Cognionics headset)
    downsample_freq  -> new frequency

    # completed: the draft lowpassed at `downsample_freq`; the anti-alias cutoff has to be the
    # NEW Nyquist, downsample_freq / 2, or everything between fs/2 and fs folds back into the band.
    """
    sig_low = filter_signal(sig, og_freq, "lowpass", downsample_freq / 2, n_seconds=n_seconds_filter)
    n_out = int(round(len(sig_low) / og_freq * downsample_freq))
    sig_ds = sps.resample(sig_low, n_out)  # FFT resampling, as the draft intended
    times = np.arange(n_out) / downsample_freq
    return sig_ds, times


def notch_60(sig, fs, n_seconds=0.5):
    """# completed: a mains notch the draft did not have — the recording is in the US (60 Hz)."""
    return filter_signal(sig, fs, "bandstop", (58.0, 62.0), n_seconds=n_seconds)


def common_average_reference(eeg_data, good_channels=None):
    """# completed: re-reference every channel to the mean of the good ones."""
    idx = np.arange(eeg_data.shape[0]) if good_channels is None else np.asarray(good_channels)
    return eeg_data - eeg_data[idx].mean(axis=0, keepdims=True)


def plot_window(sig, fs, start_time, end_time, title=""):
    """The plotting half of the cell: a window of a time series, unchanged apart from the imports."""
    import matplotlib.pyplot as plt

    times = np.arange(0, len(sig) / fs, 1 / fs)
    start_idx = np.searchsorted(times, start_time)
    end_idx = np.searchsorted(times, end_time)
    plt.plot(times[start_idx:end_idx], sig[start_idx:end_idx], "b")
    plt.xlabel("Time (s)")
    plt.ylabel("Amplitude")
    plt.title(title or f"Time series from {start_time} to {end_time} s")
    plt.show()


# ----------------------------------------------------------------- coherence (unchanged)


def compute_functional_coherence(eeg_data, fs, channel_pairs, nperseg=1024, plot=False):
    """
    Compute (and optionally plot) the magnitude-squared coherence between EEG channel pairs.

    Returns {(ch1, ch2): (f, Cxy)}.
    """
    coherence_results = {}
    for ch1, ch2 in channel_pairs:
        f, cxy = sps.coherence(eeg_data[ch1], eeg_data[ch2], fs=fs, nperseg=nperseg)
        coherence_results[(ch1, ch2)] = (f, cxy)
        if plot:
            import matplotlib.pyplot as plt

            plt.figure(figsize=(8, 4))
            plt.semilogy(f, cxy)
            plt.title(f"Coherence between channel {ch1} and channel {ch2}")
            plt.xlabel("Frequency (Hz)")
            plt.ylabel("Coherence")
            plt.grid(True)
            plt.show()
    return coherence_results


# ----------------------------------------------------------------- EDF export


def convert_eeg_to_edf(input_file, output_file, sfreq, channel_names):
    """
    Convert a raw Cognionics .eeg file to EDF+.

    # completed: the draft reshaped the float32 stream as (n_channels, n_samples); the BrainVision
    # export is MULTIPLEXED (sample-major), so the reshape is (n_samples, n_channels).T.
    """
    import pyedflib

    raw_data = np.fromfile(input_file, dtype=np.float32)
    n_channels = len(channel_names)
    n_samples = len(raw_data) // n_channels
    eeg_data = raw_data[: n_samples * n_channels].reshape(n_samples, n_channels).T

    with pyedflib.EdfWriter(output_file, n_channels, file_type=pyedflib.FILETYPE_EDFPLUS) as edf:
        channel_info = [
            {
                "label": ch,
                "dimension": "uV",
                "sample_rate": sfreq,
                "physical_min": float(np.min(eeg_data[i])),
                "physical_max": float(np.max(eeg_data[i])),
                "digital_min": -32768,
                "digital_max": 32767,
            }
            for i, ch in enumerate(channel_names)
        ]
        edf.setSignalHeaders(channel_info)
        edf.writeSamples(eeg_data)
    print(f"File successfully converted to {output_file}")


# ----------------------------------------------------------------- example


if __name__ == "__main__":
    eeg_data, fs, channel_names = load_eeg_to_array("HELLOworld.vhdr", file_format="brainvision")
    eeg = eeg_data[:20] * 1e6  # the 20 EEG channels, V → µV
    eeg = eeg - eeg.mean(axis=1, keepdims=True)

    ds = np.array([filter_and_downsample(ch, fs, 125)[0] for ch in eeg])
    ds = np.array([notch_60(ch, 125) for ch in ds])
    ds = common_average_reference(ds)

    fp2, o1 = channel_names.index("Fp2"), channel_names.index("O1")
    results = compute_functional_coherence(ds, 125, [(fp2, o1)], nperseg=256)
    f, cxy = results[(fp2, o1)]
    alpha = (f >= 8) & (f <= 13)
    print(f"peak alpha coherence Fp2↔O1: {cxy[alpha].max():.2f} at {f[alpha][cxy[alpha].argmax()]:.1f} Hz")
