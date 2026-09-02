# Demos — raw material ledger

This folder collects the **raw source material** for projects that will be demoed inside David's Internet rather than on their own deployed sites (i.e. anything that does *not* already live in `Documents/Software Projects` with its own GitHub repo + Vercel deployment).

Every `<project>_raw/` folder is an unedited dump of the files that tell the story of that project — code, notebooks, CAD, schematics, figures, reports. Nothing here is a finished demo yet; each folder is the input for a future demo page.

Gathered on 2026-08-28 by crawling `Documents/Voytek Research`, `Documents/Nocturnal Neuro`, `OneDrive/Documents/UCSD classes`, `OneDrive/Documents/{Inventor, VEXcode VR, C++ (2021), GitHub}`, `Documents/Software tutorials`, and the home-directory Java repos. `Documents/Software Projects` was deliberately skipped.

## Ground rules applied while copying

- **No `.git`, virtualenvs, `.pio`/Quartus `db/` build output, `.ipynb_checkpoints`, or IDE folders.** Only source and results.
- **Nothing over 50 MB** (repo rule). Two organoid notebooks (58 MB, 76 MB), the 138 MB Grover presentation video, the STL-10 tarball, and course textbooks/installers were left behind — see the per-project notes.
- **Secrets stripped.** Every `.env` and `secrets.h` (WiFi/MQTT credentials in hardhack2026 and ECE140) was excluded; only `env.example` templates were kept. A grep for hard-coded ssid/password literals in the copied code came back clean.
- **Third-party material is labeled** as such below (reference papers, vendored libraries, starter code) so it isn't presented as original work.

---

## Ledger

### Research (Voytek Lab, UCSD)

| Folder | What it is | Why it's included |
|---|---|---|
| `spikeparam_raw/` | Pip-installable Python package for parameterizing action-potential waveforms as sums of skewed Gaussians / polynomial splines (`spikeparam/patch/fit/fit.py` is the core `Spike` class). Includes `docs/tutorials/*.ipynb` (SkewedGaussians, SpikeGroup, PolySpikeGroup, spikes_vs_lfp), the paper-figure notebook `AP_empirical_paper1/`, fitted `params/*.npy`, and a separate Ray-parallelized MEG spectral-decomposition pipeline (`spec_decomp_and_param.py`). | Real scientific software with a clean class API, docs, and NIH attribution — the best "I write libraries, not just scripts" evidence. Lab package (Voytek Lab / Blanca Martin) that David contributed to; `.git` (1.9 GB) was not copied. **Built into `/demos/spikes` 2026-09-01** (shown as lab code; David credited as a user only, per spec 03). |
| `spike_proj_raw/` | Primate patch-clamp spike parameterization: `spike_functions.py` (NWB ingestion → per-subject dataframe → correlation heatmaps / boxplots) plus six notebooks from data download (`nwd_Download.ipynb`) through cross-subject statistics (`stats_from_allMonkeyDFs*.ipynb`). | Cleanest end-to-end data-science arc; uses `spikeparam` as a dependency so it demos the package in action. Complete copy (47 MB, no data files). **Built into `/demos/spikes` 2026-09-01** — data re-downloaded from DANDI:001776 (the Primate Cell Type Database's published home; the notebooks' local copies predate it). |
| `psychedelic_organoids_raw/` | MEA recordings of cortical organoids dosed with psychedelics, tracked D-1 → D60. MATLAB preprocessing (`*.m`: Axion raw → HDF5), Python analysis library (`General_LFP_analysis_functions.py`, 25 functions: FOOOF/specparam, spike rasters, ISI/burst detection, network events, well-plate heatmaps), and the per-plate comparison/deviation notebooks that hold the final figures. **Built into `/demos/organoids` 2026-09-01** (no lab data ships — synthetic panels + 25 extracted real figures; a collaborator path in `lfp_processing.m` is redacted in `organoids_src/`). | Most visually rich project — hundreds of rendered spectra and dose-response heatmaps, backed by a MATLAB→Python pipeline David wrote end to end (last commits are his). **Left out:** `lfp_analysis.ipynb` (76 MB) and `LFP_psych_through_FOOOF.ipynb` (58 MB), and all but one per-day notebook per plate (`PlateF-D-1`, `PlateD-D-1` kept as representatives; the other ~15 are 13–39 MB each of duplicate figures). **The code from every skipped notebook was scraped into `code_scraped_from_large_notebooks/*.py`** (code cells with markdown headers as comments, outputs dropped) — `LFP_psych_through_FOOOF.py` (38 cells) and `lfp_analysis.py` are the substantive ones; the `Plate*-D*.py` files are near-identical per-day runs of the same ~18-cell pipeline. |

### Nocturnal Neuro (EEG wearable venture)

| Folder | What it is | Why it's included |
|---|---|---|
| `nocturnal_neuro_raw/kicad_ganglion_pcb/` | KiCad rework of the OpenBCI Ganglion biosignal board: `.kicad_sch` / `.kicad_pcb`, 4-copper-layer Gerbers + drill files, the OpenBCI footprint library, an annotated BOM (`Ganglion_01_BOM_CSV.csv` with per-part substitution notes) and the actual DigiKey order (`DigiKey_orderedParts.xlsx`). | Hardware range: schematic capture, DFM export, and real component sourcing. Derived from OpenBCI's open-hardware files — say so in the demo. Backups/autosaves excluded. |
| `nocturnal_neuro_raw/signal_analysis/` | `DSP.ipynb` — MNE/neurodsp/FOOOF pipeline: EDF/BrainVision loading, channel-pair coherence, filtering/resampling, Cognionics-binary → EDF conversion. Plus `example.edf` (1.6 MB). | Pairs with the PCB: design the board, then analyze the signal. Small, runnable. |
| `nocturnal_neuro_raw/eeg_recordings/` | `HELLOworld.{eeg,vhdr,vmrk}` — a real 25-channel, 500 Hz BrainVision recording from the Cognionics headset. | The only small, self-contained, shareable dataset found anywhere; makes the DSP notebook instantly runnable. |
| `nocturnal_neuro_raw/business/` | Business Model Canvas, Value Proposition Canvas, Empathy Map (Nov 2024 Basement launch program). | Product/venture framing to caption the hardware demo. Not code. |

### Hardware / embedded (UCSD)

| Folder | What it is | Why it's included |
|---|---|---|
| `hardhack2026_intrusion_system_raw/` | HardHack 2026 hackathon: home intrusion detector — HC-SR04 ultrasonic on Arduino Uno, ESP32-S3 WiFi gateway over a custom UART protocol (`comm_protocol.h`), buzzer/servo lock/LED strip, and a SwiftUI iOS app (`ContentView.swift`) to arm/disarm. Hand-written `README.md`, `WIRING_DIAGRAM.md`, `CONSOLIDATED_WIRING.md`. | Most demo-able single artifact: sensor → firmware → UART → WiFi → mobile UI, already documented; built as /demos/hardhack 2026-08-31 (whole-system TS simulation, firmware ported line for line, phone replica, three iterations). `.env` and three `secrets.h` were excluded. |
| `viterbi_decoder_fpga_raw/` | ECE 111 final project: rate-1/2, 8-state convolutional encoder → noisy channel → Viterbi decoder in SystemVerilog (`rtl/decoder.sv`, `ACS.sv`, `bmc0.sv`, `tbu.sv`, `mem_8x1024.sv`, testbench, Quartus `.qpf/.qsf`), the HW7 encoder it builds on, and David's own `Implementation-Info.md` design writeup + `E111-Final-Viterbi.pdf`. | A real communications DSP block in RTL with a written design rationale. Note: `Implementation-Info.md` says the final pass wasn't re-simulated — verify before claiming results. Course starter files are mixed in; the decoder internals are the original work. |
| `ece111_rtl_library_raw/` | The rest of ECE 111, one folder per module: 2-to-4 decoder / full adder / mux in gate, dataflow, and behavioral styles (hw1); ALU + 4-bit counter (hw2); Johnson counter (hw3); barrel shifter (hw4); LFSR (hw5, with README); Gray-to-binary, carry-lookahead adder, clock divider (hw6); convolutional encoder (hw7); **UART TX/RX** (hw8). Each with testbench and Quartus project; `db/` intermediates dropped. | "Show me you can write RTL" pieces — the UART and barrel shifter especially; hw1's three-styles-of-one-circuit is a nice teaching artifact. |
| `tinyml_esp32_raw/` | ECE 140 TA6: full TinyML pipeline — clean thermal-sensor data → feature engineering (`features.py`) → Keras training (`train.py`) → TFLite INT8 quantization + C-header export (`export.py`, `model_data.h`) → real-time inference on ESP32 (`esp32/src/main.cpp`). Includes pytest suites (`test_features.py`, `test_export.py`) and the 6 MB `thermal_dataset.csv` (three identical copies deduped to one in `tech_assignment_challenge_2/`). | "6.7 KB model running on a microcontroller" with quantization and unit tests demos very well; built as /demos/esp32 2026-08-31 (76-feature pipeline + INT8 kernels ported to TS, fixture-tested against the TFLite interpreter). |
| `esp32_iot_fastapi_raw/` | ECE 140 TA3–TA5 + labs, PlatformIO/ESP32 + Python: `ta3` AMG8833 thermal camera over MQTT with request/response; `ta4` ESP32 WiFi scanner → FastAPI network map (`wifiscrape_webserver.py`, `visualize.py`) and temperature collection server; `ta5` WebSocket dataset-collection client with browser labeling UI, plus a dataset explorer with `ANALYSIS.md` and mislabeled-sample figures; `week4` REST-controlled LED; `lab5` FastAPI + Jinja survey app. | A coherent sensor → MQTT/HTTP/WebSocket → FastAPI → live dashboard progression; TA4's WiFi net-map is the most distinctive piece; feeds /demos/esp32 (transports panel, netmap panel, ANALYSIS figures), built 2026-08-31. `.pio` builds (~27 MB of firmware.elf/map) and `.env` files excluded. |

### Denmark study abroad (DTU, fall 2025)

| Folder | What it is | Why it's included |
|---|---|---|
| `quantum_information_qutip_raw/` | Quantum Information course: the **QuTiP** notebooks (`QI-introducing_QuTiP.ipynb`, `Exercises_QI-08.ipynb` Bloch-sphere qubits, `Week 9.ipynb` / `Exercises- QI9` multi-qubit states, `Exercises- QI10.py`), `pyproject.toml`, and `grover_group_project/Report of Grover's Algorithm Analysis.pdf` (Group 9). Reference papers kept alongside: Hensen et al. loophole-free Bell test, Acín Nature review, `QAOA.pdf` — **third-party**. | Explicitly requested; built as /demos/quantum 2026-08-31 (TS state-vector simulator, four panels, NumPy-fixture tested). **Left out:** `Final_Video_Quantum_2.mp4` (138 MB presentation video) — host on YouTube/Drive and link to it. |
| `cross_teaching_segmentation_raw/` | Deep Learning final project (Group 9): U-Net vs ViT on Oxford-IIIT Pet trimap segmentation, then cross-teaching semi-supervised training where each model pseudo-labels for the other (`CrossTeachingTraining.py`, `Unet_TransferLearn.py`, `ViT_train.py`, `data_oxford_pet.py`, `Segmentation_Models_Comparison.ipynb`, `usage.md`, `requirements.txt`), the report `Project_21_Group_9.pdf`, and result image `30epoch.png`. `2207.14191v2.pdf` is the reference paper (third-party). | Research-flavored method, clean modules, and it reproduces from scratch via TFDS — genuinely runnable as a demo. Model `Checkpoints/` excluded. **Built into `/demos/crossteach` 2026-09-01** (spec 08): no retraining — the real trained checkpoints + per-epoch metrics turned out to live in the public `DavidBrin/Semi-supervised-image-model` repo (Git LFS), and the micro-CT slices in `DavidBrin/Semi-supervised-Microtomography-Segmentation`; the page runs those checkpoints' predictions, attention rollouts and activations. The repo HEAD supersedes this folder's copies (image-level gate 0.75, weight 0.05, warmup, labeled 20%) and adds the never-run `CrossDetection.py`. |
| `dtu_deep_learning_notebooks_raw/` | The DTU deep-learning course notebooks (autodiff, FFN, CNN CIFAR-10 / transfer, RNN, autoencoder, VAE, GAN) plus `ArXiv_histogram.py` and lecture diagrams. | Learning-progression context for the segmentation project; mostly course-template notebooks with David's solutions — supporting material, not a headline. **Built into `/demos/crossteach` 2026-09-01** as the "learning ladder": autodiff + half-moon FFN run live in TS, the rest are explanation/visualization cards (the notebooks ship output-stripped, so nothing pretends to be an archived run); code extracts in `demos/crossteach_src/ladder/`. |
| `arxiv_semantic_graph_raw/` | Data Science project: 50k arXiv abstracts → Universal Sentence Encoder → HNSW index → distance-threshold semantic graph → Louvain communities → retrieval (`project_demo.ipynb`, `semantic_graph_project.pdf`, `Project_Flowchart.pdf`, `Diagram.png`). Plus from-scratch algorithms: `A-priori_freqPairs.py` (frequent itemsets on `Groceries_dataset.csv`), `SocialNetworkGraphs.py` (Girvan–Newman), `Word Frequency.py`. | Best visuals of the DTU work (a graph you can render interactively) and standalone algorithm implementations. **Built into `/demos/arxiv` 2026-09-01** (spec 09): 2,500-paper live subsample + tau slider + Louvain, A-priori/Girvan-Newman/spectral cards. |
| `dtu_databases_raw/` | SQL schema design and queries (`UniversityDB.sql`, `FamilyDB.sql`, `cinema.sql`, weekly answer sets) with hand-drawn ER diagrams (`Meeting room database design.png`, `News Items database design.png`, `Data Sheet.png`). | Small "database design" card: ER diagram + matching DDL. Installers (100 MB of MariaDB/Workbench MSIs) and lecture PDFs excluded. |

### Computer vision / signals (UCSD)

| Folder | What it is | Why it's included |
|---|---|---|
| `computer_vision_cse152_raw/` | CSE 152A: `hw1` photometric stereo (`facedata.npy`), `hw2` epipolar geometry / 8-point algorithm / stereo (with `figs/` and `imgs/` dino, matrix, warrior), `hw3` face detection (200-image face/nonface set), `hw4` CNNs on FashionMNIST + STL-10; rendered `HW1–4.pdf`. `BatchGradientDescentFromScratch.ipynb` — vectorized vs loop GD with a 3D cost surface and ipywidgets. `cse152b_superpoint/` — only David's `HW1.ipynb` + README on top of the vendored pytorch-superpoint repo (not copied). | The epipolar figures and face detector are the most portfolio-friendly images in the whole crawl; the gradient-descent notebook is a self-contained interactive demo. **Clean up before publishing:** `BatchGradientDescentFromScratch.ipynb` has informal profanity in a markdown cell. STL-10 (3 GB) and FashionMNIST raw data excluded. **Built into `/demos/vision` 2026-09-01** (spec 11): live stereo+relighting, 8-point epipolar, BoW + CNN panels; the gradient-descent notebook stayed out of scope. |
| `signals_systems_matlab_raw/` | ECE 101 MATLAB Live Scripts `Lab_1–5_F23.mlx` with data (`echo_F23.mat`, `Lab_1_F23.mat`, `Lab3_F23.mat` 33 MB), `deblur.m`, and the rendered `Lab_5_F23.pdf`. | Echo cancellation and image deblurring are demonstrable audibly/visually; built as /demos/signals 2026-08-30 (all five labs ported to TypeScript, SciPy-fixture tested; blur length N=464 recovered). Textbook PDF excluded. |
| `p300_speller_bci_raw/` | P300 ERP classification (BCI Competition III) with 1D CNN and multi-CNN architectures: `README.md` (illustrated), `notebook-scripts/*.ipynb` (CNN1–3, MCNN1–3, P300speller), `images/` (architecture, speller-system, experiment), and `magician/cnn2a.py` from the companion BCI-P300-Magician repo. | A GitHub repo, but a notebook project with no deployment — so it belongs here. Ready-made README and diagrams. Dataset `.rar`s (50–97 MB each) and trained models excluded. |

### Mechanical / robotics origins

| Folder | What it is | Why it's included |
|---|---|---|
| `inventor_cad_raw/` | Autodesk Inventor originals (`models/`: Goldberg Assembly, Space Crush box crusher, Gear chain, Peg toy assembly, Glider Box, FORS phone case, ramps/dominoes, plus `.dwg` manufacturing drawings for the glider and peg toy) and `renders/` — 19 already-rendered PNGs (Goldberg, glider, gear chains, Space Crush/Launch, wing simulator). | The 3D-modeling side of the story; renders mean a CAD gallery can be built with zero tooling. No STL/STEP exports exist anywhere on the machine — re-export from Inventor if a 3D web viewer is wanted. The stock VEX parts library and `OldVersions/` were excluded. |
| `vexcode_vr_raw/` | VEXcode VR robot programs (`.vrblocks` block programs, `.vrpython` Python: maze, perimeter, sensors, 2D lists, random drive) with ~40 screenshots. | "Where robotics started" opener — intro-level but visual. |

### Early coding

| Folder | What it is | Why it's included |
|---|---|---|
| `cpp_2021_raw/` | 2021 C++ coursework: hw1–hw10 + final (`main.cpp` each), file-I/O + algorithm final over `numbers-*.txt` datasets, Doxygen configs. | C++ fundamentals timeline marker. Tiny. |
| `java_servers_raw/` | `wavelet_chat_server/ChatServer.java` (from-scratch socket HTTP chat server; note the README references `Server.java` which is missing from that copy), `doc_search_server/` (complete document-search HTTP server), `junit_lab/` (JUnit tests). | Classic systems demo (hand-rolled HTTP server) plus evidence of testing habits. Corpus data and jars excluded. |
| `misc_snippets_raw/` | `aho_corasick_string_matching.ipynb` (CSE 100, multi-pattern matching) and `CardClassifier.ipynb` (the one non-boilerplate PyTorch tutorial: a playing-card image classifier). | Small self-contained snippets that can fill out a demo page. |

---

## Looked at and deliberately not included

- `Documents/Software Projects/*` — own repos/deployments (out of scope by instruction).
- `OneDrive/Documents/GitHub/spikeparam` — duplicate of the Voytek copy (with 2.7 GB of stale git temp packs).
- `OneDrive/Documents/GitHub/fun-testing` — TA/grading artifact, no code.
- `UCSD classes/ECE108`, `ECE140/Tech Assignment 2.*`, `UCSD documents/`, `Cornell/`, `Katalyxt_documents/` — PDFs only / administrative / legal, some with PII.
- `~/cse152a_hw4`, `~/anaconda_projects`, `~/data`, `~/docs`, `~/test-fixtures`, `~/i3q6bSoc4a0`, `MyfirstRscript.R`, `firstNotebook.ipynb` — virtualenvs, scratch, or empty stubs.
- `Nocturnal Neuro/Biosensors2021 MDD.pdf`, `Digital Design and Computer Architecture (2nd Ed).pdf`, Oppenheim *Signals and Systems* — third-party textbooks/papers.

## Before turning any of these into demos

1. Scrub: profanity in `BatchGradientDescentFromScratch.ipynb`; the `xcuserdata/` folder in hardhack2026 carries a teammate's username.
2. Attribute: spikeparam (Voytek Lab), Ganglion PCB (OpenBCI-derived), DTU group projects (Group 9 / Group 21 co-authors), course starter code in ECE111/ECE140/CSE152.
3. Shrink notebooks: most figure-heavy `.ipynb` files should have figures extracted to PNG (`jupyter nbconvert --to markdown`) rather than shipped whole.
4. Host large media externally: the Grover presentation video (138 MB) and any organoid per-day notebooks beyond the two representatives.
