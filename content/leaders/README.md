# Leaders

A complete 2–4 player, turn-based civilization game played from behind your leader on the ground. Build an economy, settle cities, research technology, improve land, negotiate with rivals and command formations. Travel and physical couriers make logistics part of every decision.

## Play

Create a room, share its six-character code or invitation link, and have friends join from their own browsers. The host starts once at least two players have joined. Choose 60, 120 or 180 second rounds. Everyone ending their turn, or the time limit, resolves a round. The in-game **Rules** field guide explains the complete rules, costs, counters and victory conditions. **Practice** runs the same rules with a local opponent.

Controls follow your leader: ↑/W steps forward, ↓/S steps back, ←/→ (or Q/E) turn leader and camera together, and the on-screen pad offers all six relative directions. Scroll or pinch to zoom and scroll sideways or drag to look around. Click ground to light up a Civilization-style route with its arrival estimate, then click again (or press Enter) to travel; click any unit or city to open its orders. Colored borders show each civilization's territory. Distant city and unit orders travel by messenger rather than changing their target immediately; every city keeps one messenger per level and the leader carries a personal one; messengers travel 6 terrain points a round and walk back after delivering. First-time players get a short set of in-game hints (replay them with the ? button). Browser-saved seats reconnect after reload; keep that browser's storage to retain your seat.

## Included systems

- Ground-follow 3D perspective, original procedural terrain and characters, animations, reconnaissance and fog.
- Cities, food/growth/happiness, gold, culture, iron, production, nine buildings, four trainable unit types and producible messengers that join the leader.
- Farms, mines, roads and trading posts; builder follow-leader, city-instruction and hold modes.
- Eleven technologies with prerequisites and local knowledge; city messengers physically spread discoveries.
- Local command radius, finite movement (6 for everyone, 7 for cavalry and scouts; followers march with the leader), delayed remote orders, leader respawn, capture and elimination.
- Five formations with frontal, flanking, wedge and encirclement effects; simultaneous damage and retaliation.
- Delivered and accepted diplomatic offers, trade escrow/refunds, alliances and delivered war declarations.
- Conquest, science and round-50 score victories; multiplayer room persistence and solo practice.

This is an original, compact Civilization V inspired game. It uses original graphics, not extracted Civ V assets, and does not include the full Civ V catalog, naval warfare, religion, espionage or mod compatibility. Publisher screenshots in `docs/research/evidence` document research only and are not included in the production assets.

## Develop locally

Use Node 24+ and npm. No paid services, API keys or external art tools are required for local development.

```sh
npm ci
npm run check
npm test
npm run build
npx wrangler d1 migrations apply leaders-local --local
npm run dev
```

Open http://localhost:8787 in two independent browser profiles. Production builds serve the client and authoritative API together. `npm run dev:client` provides Vite hot reload with API requests proxied to the running local Worker.

```sh
npx playwright install chromium
npm run test:e2e
```

Browser tests require the local Worker above. To test a deployed instance, set `LEADERS_TEST_URL` to its address. Tests create separate temporary matches; one verifies the real 60-second deadline.

## Durable deployment (Cloudflare Workers + D1, free tier)

The game is deployed at **https://leaders.leaders-game.workers.dev**. The `production` environment in `wrangler.jsonc` binds the `leaders` D1 database on the owner's Cloudflare account. To ship the current checkout after `npx wrangler login`:

```sh
npm run deploy
```

That builds the client and Worker, applies pending D1 migrations to the remote database, and uploads the Worker with its static assets. Match data lives in the remote D1 database and survives redeploys. No credentials are stored in the repository; the database id in the manifest is a resource identifier, not a secret.

## Share a temporary public game

After building and starting the migrated Worker above, run `npm run share:tunnel` in another terminal. It prints a public HTTPS address. In a third terminal, start the restricted game gateway with that exact address:

```sh
LEADERS_SHARE_ORIGIN=https://the-address-printed-by-cloudflare.trycloudflare.com npm run share:server
```

Share that HTTPS game address. Keep all three processes and this computer running. The link is temporary and changes when the tunnel restarts; match data persists in the local D1 database. Stop the three processes with Ctrl+C to stop sharing. The gateway exposes only the game and its room API, rather than Wrangler's developer interface. This path remains for playing a local build without deploying; the durable address above is the normal way to play.

## Architecture and hosting

React/Vite/Three.js client, pure TypeScript game engine and an authoritative Cloudflare Worker. D1 stores revisioned room documents. Conditional writes preserve concurrent orders; hashed bearer credentials identify seats, command IDs prevent duplicate execution, and the server filters hidden state. No game secrets or credentials are stored in the repository.

The Sites manifest declares the logical D1 binding `DB`. `npm run build` creates `dist/client` and `dist/server/index.js`; the Sites workflow packages the generated migration for deployment. This project targets free hosting and small sessions. Polling runs every 5 seconds when visible, 15 seconds when hidden, backs off on errors and stops at victory. Free quotas can temporarily limit access; they do not trigger a paid upgrade. Lobby retention is 24 hours, active/finished matches 30 days since their last mutation.

Research and source attribution: [research brief](docs/research/BRIEF.md). Final design: [game specification](docs/superpowers/specs/2026-10-01-leaders-design.md). Validation and release evidence: [release report](docs/RELEASE.md).
