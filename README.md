# Store Manager

A dashboard for pulling Google Maps reviews across the stores you manage and generating reports on ratings, review volume, keywords, and negative feedback.

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

### 3. Get a Google Places API key

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create (or select) a project
3. Enable **Places API (New)** for the project
4. Create an API key
5. (Recommended) Restrict the key to "Places API (New)" only

### 4. Configure environment variables

Local dev:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
DATABASE_URL=postgres://...
GOOGLE_PLACES_API_KEY=AIza...
```

**On Vercel:** add both `DATABASE_URL` (or use Vercel Postgres, which sets `POSTGRES_URL` automatically) and `GOOGLE_PLACES_API_KEY` under Project Settings → Environment Variables.

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000. Schema is created automatically on first request.

## How it works

1. **Add a store** — search by name and city; pick the correct Google Maps result.
2. **Sync** — pulls the 5 most recent reviews from Google Places.
3. **Reports** on each store page:
   - Google rating & total ratings
   - Rating distribution (1★–5★) across stored reviews
   - Review volume + rolling average rating by month
   - Top keywords (word frequency across review text)
   - Recent negative reviews (1★ and 2★)

## Important: about the 5-review cap

Google Places API returns **only the 5 most recent reviews** per request. This app stores every review it fetches so history accumulates over time. To build up meaningful data, click **Sync now** on each store periodically (e.g. daily).

## Deploy

Deploys to Vercel as-is once `DATABASE_URL` and `GOOGLE_PLACES_API_KEY` are set in project settings.

## Tech

- Next.js 16 (App Router) + React 19
- TypeScript
- Tailwind CSS
- Postgres via `@neondatabase/serverless` (HTTP driver, works on Vercel edge/serverless)
- Recharts for visualizations
