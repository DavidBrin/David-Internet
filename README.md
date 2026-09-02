# David's Internet

David's intranet of personal projects, built to look like the internet through the eyes of the most popular search engine. The landing page **is** a Google homepage (the logo just says "David"), the results page is a faithful SERP, and every search result is one of David's replica projects — a tiny parallel internet where every "website" is something I built.

## Quick start

```bash
pnpm install
pnpm sync-content   # vendor READMEs/SPECs/DECISIONS + screenshots from the source repos
pnpm dev            # http://localhost:3000
pnpm test           # vitest unit tests
pnpm e2e            # playwright end-to-end tests
pnpm build          # static export → out/ (deployable anywhere, e.g. Vercel Hobby)
```

## How it works

- **Fully static.** No backend, no DB. The search index is built at build time from the vendored content and shipped to the client; search, autocomplete, and "did you mean" all run in the browser (MiniSearch).
- **Content is vendored, not fetched.** `scripts/sync-content.ts` copies each source project's `README.md`, `SPEC.md`, `DECISIONS.md`, and `docs/screenshots/*.png` into `content/<project>/` and `public/content/<project>/screenshots/`. Builds are deterministic and offline.
- **One manifest per project** (`content/<project>/site.ts`) declares the fake domain (`youtube.davids.net`), the live deployment URL, deep links worth indexing, images/videos for the media tabs, and knowledge-panel facts.
- **Fake URLs, real links.** Results display a Google-style breadcrumb (`youtube.davids.net › watch`) but the actual `href` is the live deployment — exactly how Google shows a display URL that isn't the literal link.

## Deployment status & how to route to a newly deployed project

**Seven replicas are live** (Linear, Notion, Super Smash, fake-phone, Bet, FL Studio, Dollar Pixels), plus **Art Wall** as its own app. YouTube still needs object storage. Demo pages live at `/demos/<slug>` on this site.

To wire up a deployment:

1. Deploy the replica (Vercel: one project per replica, same Replicates repo, distinct **Root Directory**; add a free Neon Postgres for the ones with `needsDatabase: true` — linear, youtube, dollar-pixels). Art Wall is a separate repo (`ArtWall`) with its own Vercel project.
2. Edit `content/<project>/site.ts` and set:
   ```ts
   liveUrl: "https://youtube-david.vercel.app",   // was null
   ```
3. `pnpm build`. Done — search results, deep links, the knowledge panel's "Visit site", and both media tabs now point at the live app (and open in a new tab).
4. Click through from a search result to the live app to verify.

## Adding a brand-new project to the index

1. Add the project to the `SOURCES` map in `scripts/sync-content.ts` (slug → absolute path of the source repo) and run `pnpm sync-content`.
2. Create `content/<slug>/site.ts` exporting a `SiteManifest` (copy an existing one; the shape is documented in `src/lib/types.ts`). Start with `liveUrl: null` until it's deployed.
3. Register it in `src/lib/manifests.ts` (one import + one array entry).
4. Give it a wiki article slug in `src/lib/wiki.ts` (and write the article in Replicates/Wikipedia — that's where docs results route). `tests/wiki-redirects.test.ts` fails until the slug and its `vercel.json` redirect exist.
5. `pnpm dev` and search for it. That's the whole pipeline — the index, tabs, autocomplete, and decision pages all derive from the manifest.

Media tabs: **Images** come from the vendored screenshots listed in the manifest's `images` (each entry pairs a PNG with the route on the live app it depicts). **Videos** are empty for now — record short clips (10–30s, 720p H.264, 2–10MB), drop them in `public/media/`, and add `videos` entries with a `poster`; host anything large on R2/Supabase and reference by URL. Don't commit files >50MB.

## The nine sites of David's Internet

| Site | Fake domain | Needs DB | Status |
|---|---|---|---|
| Linear replica | linear.davids.net | yes (Neon) | [linear-david.vercel.app](https://linear-david.vercel.app) |
| YouTube replica | youtube.davids.net | yes (Neon + R2) | not deployed → wiki fallback |
| Super Smash | smash.davids.net | no | [smash-david.vercel.app](https://smash-david.vercel.app) |
| fake-phone | fake-phone.davids.net | no | [fake-phone-david.vercel.app](https://fake-phone-david.vercel.app) |
| Bet | bet.davids.net | no | [bet-david.vercel.app](https://bet-david.vercel.app) |
| Dollar Pixels | pixels.davids.net | yes (Neon) | [dollar-pixels-david.vercel.app](https://dollar-pixels-david.vercel.app) |
| Notion replica | notion.davids.net | no | [notion-david.vercel.app](https://notion-david.vercel.app) |
| FL Studio replica | flstudio.davids.net | no | [fl-studio-david.vercel.app](https://fl-studio-david.vercel.app) |
| Art Wall | artwall.davids.net | yes (Neon) | [art-wall-pi.vercel.app](https://art-wall-pi.vercel.app) |

## About page

`/about` contains a **preliminary bio distilled from `db_resume_2026.pdf`**.

> **TODO (David):** update the résumé source and flesh out the About page — the current description is a first pass generated from the resume; add more personality, links (GitHub, LinkedIn), and per-project commentary.

## Idea list (fun layer, not yet built)

- Easter-egg queries ("do a barrel roll", "askew")
- A "Sponsored" result that links to /about
- Doodle logo variants for holidays/milestones
- True cached-page view (rendered snapshot instead of docs)
- Proxying live apps under one domain via rewrites (`/web/youtube/*` → deployment) — the manifest already isolates the base URL, so this is a link-style flag away
