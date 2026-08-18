import { getManifest } from "@/lib/manifests";
import type { VideoResult } from "@/lib/types";
import { PlayIcon } from "./Icons";
import EmptyState from "./EmptyState";

interface VideoListProps {
  videos: VideoResult[];
  query: string;
}

export default function VideoList({ videos, query }: VideoListProps) {
  if (!videos.length) {
    return <EmptyState query={query} noun="video results" />;
  }

  return (
    <div className="video-list">
      {videos.map((result, index) => {
        const manifest = getManifest(result.project);
        const external = result.href.startsWith("http");
        const linkProps = external
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {};
        return (
          <div className="video-row" key={`${result.project}-${result.video.src}-${index}`}>
            <a className="video-thumb-link" href={result.href} tabIndex={-1} aria-hidden="true" {...linkProps}>
              {result.video.poster ? (
                <img
                  className="video-thumb"
                  src={result.video.poster}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <span className="video-thumb-placeholder">
                  <PlayIcon size={28} />
                </span>
              )}
              {result.video.duration ? (
                <span className="video-duration">{result.video.duration}</span>
              ) : null}
            </a>
            <div className="video-meta">
              <a className="video-title" href={result.href} {...linkProps}>
                {result.video.caption}
              </a>
              <div className="video-source">
                {result.siteName} · {result.fakeDomain}
              </div>
              {manifest?.tagline ? <div className="video-caption">{manifest.tagline}</div> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
