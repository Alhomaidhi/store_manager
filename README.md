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

Optional: `OUTSCRAPER_REVIEWS_LIMIT` sets how many reviews are pulled per sync (default `100`). Raise it for a one-off backfill of full history, lower it to keep per-sync cost down.

**On Vercel:** add both `DATABASE_URL` (or use Vercel Postgres, which sets `POSTGRES_URL` automatically) and `OUTSCRAPER_API` under Project Settings → Environment Variables.

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000. Schema is created automatically on first request.

## How it works

1. **Add a store** — search by name and city; pick the correct Google Maps result.
2. **Sync** — pulls the most recent reviews (newest first, `OUTSCRAPER_REVIEWS_LIMIT` per sync) from Outscraper. Already-stored reviews are deduplicated, so syncing is safe to repeat.
3. **Reports** on each store page:
   - Google rating & total ratings
   - Rating distribution (1★–5★) across stored reviews
   - Review volume + rolling average rating by month
   - Top keywords (word frequency across review text)
   - Recent negative reviews (1★ and 2★)

## Notes on syncing

- Outscraper requests can take a while for large review counts — the app polls until the job finishes (up to 90 seconds). If a sync times out, just retry.
- The default of 100 reviews per sync keeps costs predictable. For an initial backfill of a store's full history, temporarily raise `OUTSCRAPER_REVIEWS_LIMIT`, sync once, then set it back.

## Deploy

Deploys to Vercel as-is once `DATABASE_URL` and `OUTSCRAPER_API` are set in project settings.

## Tech

- Next.js 16 (App Router) + React 19
- TypeScript
- Tailwind CSS
- Postgres via `@neondatabase/serverless` (HTTP driver, works on Vercel edge/serverless)
- Recharts for visualizations
- Outscraper Google Maps API for search & reviews
