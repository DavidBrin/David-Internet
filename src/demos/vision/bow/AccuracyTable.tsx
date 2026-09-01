"use client";

import type { BowResults } from "./types";

export default function AccuracyTable({ data }: { data: BowResults }) {
  const best = Math.max(...data.accuracies.map((r) => r.totalAcc));
  const gallery = [
    { src: "/demos/vision/bow/face_0.webp", label: "face" },
    { src: "/demos/vision/bow/face_1.webp", label: "face" },
    { src: "/demos/vision/bow/face_2.webp", label: "face" },
    { src: "/demos/vision/bow/face_3.webp", label: "face" },
    { src: "/demos/vision/bow/nonface_0.webp", label: "non-face" },
    { src: "/demos/vision/bow/nonface_1.webp", label: "non-face" },
    { src: "/demos/vision/bow/nonface_2.webp", label: "non-face" },
    { src: "/demos/vision/bow/nonface_3.webp", label: "non-face" },
  ];
  return (
    <div className="vsBwAccWrap">
      <div className="vsBwTableScroll">
        <table className="vsBwTable">
          <thead>
            <tr>
              <th>k</th>
              <th>points</th>
              <th>features</th>
              <th>pos acc</th>
              <th>neg acc</th>
              <th>total acc</th>
            </tr>
          </thead>
          <tbody>
            {data.accuracies.map((r, i) => (
              <tr key={i} className={r.totalAcc === best ? "vsBwAccBest" : undefined}>
                <td className="vsMono">{r.k}</td>
                <td>{r.points}</td>
                <td>{r.features}</td>
                <td className="vsMono">{Math.round(r.posAcc * 100)}%</td>
                <td className="vsMono">{Math.round(r.negAcc * 100)}%</td>
                <td className="vsMono">{Math.round(r.totalAcc * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="vsBwGallery">
        {gallery.map((g, i) => (
          <figure key={i} className="vsBwGalleryItem">
            <img src={g.src} alt={g.label} width={70} height={70} />
            <figcaption>{g.label}</figcaption>
          </figure>
        ))}
      </div>
      <div className="vsNote">
        {data.note} Faces: {data.counts.face}, non-faces: {data.counts.nonface}.
      </div>
    </div>
  );
}
