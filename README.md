# Store Manager

A dashboard for pulling Google Maps reviews across the stores you manage and generating reports on ratings, review volume, keywords, and negative feedback. Review data is fetched via [Outscraper](https://outscraper.com), which returns full review history rather than the 5-review cap of the official Google Places API.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Provision a Postgres database

Any Postgres works. Easiest options:

- **[Neon](https://console.neon.tech)** — free tier, HTTP-optimized, works with Vercel out of the box
- **Vercel Postgres** — provisioned via the Vercel dashboard; env vars auto-attached to the project

Grab the connection string (looks like `postgres://user:pass@host/db?sslmode=require`).

### 3. Get an Outscraper API key

1. Sign up at [outscraper.com](https://outscraper.com)
2. Copy your API key from [app.outscraper.com/profile](https://app.outscraper.com/profile)

Outscraper bills per record (place searched / review fetched) with a free monthly tier — see their [pricing](https://outscraper.com/pricing/) page.

### 4. Configure environment variables

Local dev:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
DATABASE_URL=postgres://...
OUTSCRAPER_API=your_key_here
```

Optional: `OUTSCRAPER_REVIEWS_LIMIT` caps how many reviews are pulled per request (default `0` = all). Only needed if you want to bound the cost of the initial full-history pull.

**On Vercel:** add both `DATABASE_URL` (or use Vercel Postgres, which sets `POSTGRES_URL` automatically) and `OUTSCRAPER_API` under Project Settings → Environment Variables.

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000. Schema is created automatically on first request.

## How it works

1. **Add a store** — paste the store's Google Maps link (Share → Copy link), and optionally give the branch your own name (e.g. "Olaya Branch") to show instead of the Google listing name.
2. **Sync** — the first sync (which happens automatically when a store is added) pulls the store's full review history. Later syncs are incremental: only reviews newer than the newest stored one are fetched, so repeat syncs stay cheap.
3. **Reports** on each store page:
   - Google rating & total ratings
   - Rating distribution (1★–5★) across stored reviews
   - Review volume + rolling average rating by month
   - Top keywords (word frequency across review text)
   - Recent negative reviews (1★ and 2★)

## Notes on syncing

- Full-history pulls run as async Outscraper jobs; the app polls until the job finishes (up to ~4.5 minutes, within the routes' 300s `maxDuration`). Stores with tens of thousands of reviews may exceed that — retry the sync after a few minutes, but note a retry submits a new (billed) job.
- Outscraper bills per review. The full pull happens once per store; incremental syncs only pay for new reviews.

## Deploy

Deploys to Vercel as-is once `DATABASE_URL` and `OUTSCRAPER_API` are set in project settings.

## Tech

- Next.js 16 (App Router) + React 19
- TypeScript
- Tailwind CSS
- Postgres via `@neondatabase/serverless` (HTTP driver, works on Vercel edge/serverless)
- Recharts for visualizations
- Outscraper Google Maps API for search & reviews
