import { getManifest } from "@/lib/manifests";
import type { ImageResult } from "@/lib/types";
import EmptyState from "./EmptyState";

interface ImagesGridProps {
  images: ImageResult[];
  query: string;
}

export default function ImagesGrid({ images, query }: ImagesGridProps) {
  if (!images.length) {
    return <EmptyState query={query} noun="image results" />;
  }

  return (
    <div className="images-grid">
      {images.map((result, index) => {
        const manifest = getManifest(result.project);
        const external = result.href.startsWith("http");
        return (
          <figure className="image-tile" key={`${result.project}-${result.image.src}-${index}`}>
            <a
              className="image-tile-link"
              href={result.href}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {/* Plain <img>: next/image is unoptimized under `output: "export"` anyway. */}
              <img
                className="image-thumb"
                src={result.image.src}
                alt={result.image.caption}
                loading="lazy"
              />
              <figcaption className="image-caption">{result.image.caption}</figcaption>
              <div className="image-source">
                <span className="image-source-favicon" aria-hidden="true">
                  {manifest?.favicon || "🔎"}
                </span>
                <span className="image-source-domain">{result.fakeDomain}</span>
              </div>
            </a>
          </figure>
        );
      })}
    </div>
  );
}
