# Store Manager

A dashboard for pulling Google Maps reviews across the stores you manage and generating reports on ratings, review volume, keywords, and negative feedback.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Get a Google Places API key

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create (or select) a project
3. Enable **Places API (New)** for the project
4. Create an API key
5. (Recommended) Restrict the key to "Places API (New)" only

### 3. Configure the environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and paste your API key:

```
GOOGLE_PLACES_API_KEY=AIza...
```

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000

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

Google Places API returns **only the 5 most recent reviews** per request. This app stores every review it fetches so that history accumulates over time. To build up meaningful data, click **Sync now** on each store periodically (e.g. daily).

## Data

Reviews and store metadata are stored locally in `data/store-manager.db` (SQLite). The `data/` folder is git-ignored.

## Tech

- Next.js 15 (App Router) + React 19
- TypeScript
- Tailwind CSS
- SQLite via `better-sqlite3`
- Recharts for visualizations
