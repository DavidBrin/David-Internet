# Art Wall

A public drawing wall. Open the page, pick a surface (street, ideas, or chalkboard), and leave strokes or text. Everyone sees the same wall.

Live: [art-wall-pi.vercel.app](https://art-wall-pi.vercel.app)

## Run locally

```bash
npm install
cp .env.example .env.local   # then set DATABASE_URL
npm run db:push
npm run dev
```

Drawing is saved through `POST /api/wall/strokes` and `POST /api/wall/texts`. The homepage polls `/api/wall` so new marks show up without a refresh.

## Walls

- Landing / Street
- Ideas
- Chalkboard (photographed chalkboard texture)

## Stack

Next.js App Router, canvas drawing, Neon Postgres.
