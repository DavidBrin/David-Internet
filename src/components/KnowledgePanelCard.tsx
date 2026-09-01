import Link from "next/link";
import { resolveHref, isExternalUrl } from "@/lib/types";
import type { SiteManifest } from "@/lib/types";
import { hasWikiArticle, wikiUrlFor } from "@/lib/wiki";

interface KnowledgePanelCardProps {
  manifest: SiteManifest;
}

export default function KnowledgePanelCard({ manifest }: KnowledgePanelCardProps) {
  const panel = manifest.knowledgePanel;
  const type = panel?.type || "Project on David's Internet";
  const facts = Object.entries(panel?.facts ?? {});
  const visitHref = resolveHref(manifest, "/");
  const visitIsExternal = isExternalUrl(visitHref);

  return (
    <aside className="kp" aria-label={`About ${manifest.displayName}`}>
      <div className="kp-top">
        <span
          className="kp-emblem"
          style={{ background: `${manifest.accentColor}1f` }}
          aria-hidden="true"
        >
          {manifest.favicon || "🗂️"}
        </span>
        <div>
          <h2 className="kp-title">{manifest.displayName}</h2>
          <div className="kp-type">{type}</div>
        </div>
      </div>

      {manifest.description ? <p className="kp-description">{manifest.description}</p> : null}

      {facts.length ? (
        <dl className="kp-facts">
          {facts.map(([label, value]) => (
            <div className="kp-fact" key={label}>
              <dt className="kp-fact-label">{label}:</dt>
              <dd className="kp-fact-value">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {manifest.techStack.length ? (
        <>
          <div className="kp-section-label">Built with</div>
          <div className="kp-chips">
            {manifest.techStack.map((tech) => (
              <span className="kp-chip" key={tech}>
                {tech}
              </span>
            ))}
          </div>
        </>
      ) : null}

      <div className="kp-links">
        <a
          className="kp-link"
          href={visitHref}
          {...(visitIsExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {manifest.liveUrl ? "Visit site" : "Read the wiki"}
        </a>
        {hasWikiArticle(manifest.project) ? (
          <a
            className="kp-link"
            href={wikiUrlFor(manifest.project)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Wikipedia
          </a>
        ) : (
          <Link className="kp-link" href={`/sites/${manifest.project}/docs`}>
            Read the docs
          </Link>
        )}
      </div>
    </aside>
  );
}
