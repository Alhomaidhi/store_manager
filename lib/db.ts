import { neon } from "@neondatabase/serverless";

const BUILD_PLACEHOLDER = "postgres://placeholder:pw@localhost:5432/db";

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  BUILD_PLACEHOLDER;

export const sql = neon(connectionString);

const usingPlaceholder = connectionString === BUILD_PLACEHOLDER;

let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (usingPlaceholder) {
    return Promise.reject(
      new Error(
        "No Postgres connection string. Set DATABASE_URL or POSTGRES_URL — see .env.example."
      )
    );
  }
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS stores (
          id TEXT PRIMARY KEY,
          place_id TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          custom_name TEXT,
          address TEXT,
          rating DOUBLE PRECISION,
          total_ratings INTEGER,
          google_url TEXT,
          created_at BIGINT NOT NULL,
          last_synced_at BIGINT,
          pending_request_id TEXT,
          pending_started_at BIGINT
        )
      `;
      // Migrations for databases created before these columns existed.
      await sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS custom_name TEXT`;
      await sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS pending_request_id TEXT`;
      await sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS pending_started_at BIGINT`;
      await sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS pending_full BOOLEAN`;
      await sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS history_synced_at BIGINT`;
      await sql`
        CREATE TABLE IF NOT EXISTS reviews (
          id TEXT PRIMARY KEY,
          store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
          author_name TEXT,
          author_url TEXT,
          profile_photo_url TEXT,
          rating INTEGER NOT NULL,
          text TEXT,
          language TEXT,
          published_at BIGINT NOT NULL,
          fetched_at BIGINT NOT NULL,
          UNIQUE(store_id, author_name, published_at)
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_reviews_store ON reviews(store_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_reviews_published ON reviews(store_id, published_at DESC)`;
      await sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_source_id TEXT`;
      // Clean up duplicates created before the dedup key was stabilized:
      // the same review ingested more than once, differing only in id and
      // published_at/fetched_at. Keeps the earliest copy. Rows with no
      // author and no text are left alone — several genuinely distinct
      // rating-only reviews can look identical.
      await sql`
        DELETE FROM reviews a
        USING reviews b
        WHERE a.store_id = b.store_id
          AND a.id <> b.id
          AND COALESCE(a.author_name, '') = COALESCE(b.author_name, '')
          AND COALESCE(a.author_url, '') = COALESCE(b.author_url, '')
          AND COALESCE(a.text, '') = COALESCE(b.text, '')
          AND a.rating = b.rating
          AND (COALESCE(a.author_name, '') <> '' OR COALESCE(a.author_url, '') <> '' OR COALESCE(a.text, '') <> '')
          AND (a.fetched_at, a.id) > (b.fetched_at, b.id)
      `;
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_source_id
          ON reviews(store_id, review_source_id)
          WHERE review_source_id IS NOT NULL
      `;
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

export interface Store {
  id: string;
  place_id: string;
  name: string;
  custom_name: string | null;
  address: string | null;
  rating: number | null;
  total_ratings: number | null;
  google_url: string | null;
  created_at: number;
  last_synced_at: number | null;
  pending_request_id: string | null;
  pending_started_at: number | null;
  /** Set once a full-history pull has completed; until then syncs re-pull everything. */
  history_synced_at: number | null;
}

export interface Review {
  id: string;
  store_id: string;
  review_source_id: string | null;
  author_name: string | null;
  author_url: string | null;
  profile_photo_url: string | null;
  rating: number;
  text: string | null;
  language: string | null;
  published_at: number;
  fetched_at: number;
}

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  if (typeof v === "bigint") return Number(v);
  return 0;
}
function toNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  return toNum(v);
}

export function mapStore(row: Record<string, unknown>): Store {
  return {
    id: row.id as string,
    place_id: row.place_id as string,
    name: row.name as string,
    custom_name: (row.custom_name as string) ?? null,
    address: (row.address as string) ?? null,
    rating: toNumOrNull(row.rating),
    total_ratings: toNumOrNull(row.total_ratings),
    google_url: (row.google_url as string) ?? null,
    created_at: toNum(row.created_at),
    last_synced_at: toNumOrNull(row.last_synced_at),
    pending_request_id: (row.pending_request_id as string) ?? null,
    pending_started_at: toNumOrNull(row.pending_started_at),
    history_synced_at: toNumOrNull(row.history_synced_at),
  };
}

export function storeDisplayName(store: Store): string {
  return store.custom_name?.trim() || store.name;
}

export function mapReview(row: Record<string, unknown>): Review {
  return {
    id: row.id as string,
    store_id: row.store_id as string,
    review_source_id: (row.review_source_id as string) ?? null,
    author_name: (row.author_name as string) ?? null,
    author_url: (row.author_url as string) ?? null,
    profile_photo_url: (row.profile_photo_url as string) ?? null,
    rating: toNum(row.rating),
    text: (row.text as string) ?? null,
    language: (row.language as string) ?? null,
    published_at: toNum(row.published_at),
    fetched_at: toNum(row.fetched_at),
  };
}
