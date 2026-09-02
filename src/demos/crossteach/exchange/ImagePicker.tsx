"use client";

import type { ImageEntry } from "./types";

export default function ImagePicker({
  images,
  selectedId,
  onSelect,
}: {
  images: ImageEntry[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="ctXPicker" role="listbox" aria-label="Test image">
      {images.map((img) => (
        <button
          key={img.id}
          type="button"
          role="option"
          aria-selected={img.id === selectedId}
          className="ctXThumb"
          data-active={img.id === selectedId}
          onClick={() => onSelect(img.id)}
        >
          <img
            className="ctXThumbImg"
            src={`/demos/crossteach/input/${img.id}.webp`}
            alt={img.breed}
            loading="lazy"
            width={64}
            height={64}
          />
          <span className="ctXThumbLabel">{img.breed}</span>
        </button>
      ))}
    </div>
  );
}
