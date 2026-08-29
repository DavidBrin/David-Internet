import csv
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

_script_dir = Path(__file__).resolve().parent
_out_dir = _script_dir.parent
_default_csv = _script_dir.parent.parent / "challenge1_collection_client" / "python" / "my_collection.csv"


def main():
    csv_path = Path(sys.argv[1]) if len(sys.argv) > 1 else _default_csv
    if not csv_path.exists():
        print("CSV not found:", csv_path)
        print("Usage: uv run python generate_analysis_figures.py [path/to/my_collection.csv]")
        return
    rows = []
    with open(csv_path, newline="") as f:
        r = csv.DictReader(f)
        for row in r:
            try:
                pixels = [float(row["p{}".format(i)]) for i in range(64)]
            except (KeyError, ValueError):
                continue
            label = row.get("label", "")
            if label not in ("empty", "present"):
                continue
            max_t = max(pixels)
            rows.append((label, max_t, pixels))

    empty_max = [max_t for label, max_t, _ in rows if label == "empty"]
    present_max = [max_t for label, max_t, _ in rows if label == "present"]

    plt.figure(figsize=(8, 5))
    if empty_max:
        plt.hist(empty_max, bins=20, alpha=0.6, label="Empty", color="green", range=(15, 45))
    if present_max:
        plt.hist(present_max, bins=20, alpha=0.6, label="Present", color="red", range=(15, 45))
    plt.xlabel("Max pixel temperature (°C)")
    plt.ylabel("Frame count")
    plt.title("Max temperature by label (ANALYSIS.md §2)")
    plt.legend()
    plt.tight_layout()
    plt.savefig(_out_dir / "histogram.png", dpi=120)
    plt.close()
    print("Saved", _out_dir / "histogram.png")

    mislabeled = [(max_t, pixels) for label, max_t, pixels in rows if label == "present" and max_t < 26][:3]
    for i, (max_t, pixels) in enumerate(mislabeled, 1):
        fig, ax = plt.subplots(figsize=(4, 4))
        arr = np.array(pixels).reshape(8, 8)
        ax.imshow(arr, cmap="hot", aspect="equal")
        ax.set_title("Present, max={:.1f}°C (likely mislabeled)".format(max_t))
        plt.tight_layout()
        plt.savefig(_out_dir / "mislabeled_{}.png".format(i), dpi=120)
        plt.close()
        print("Saved", _out_dir / "mislabeled_{}.png".format(i))


if __name__ == "__main__":
    main()
