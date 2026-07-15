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
          last_synced_at BIGINT
        )
      `;
      // Migration for databases created before custom branch names existed.
      await sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS custom_name TEXT`;
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
}

export interface Review {
  id: string;
  store_id: string;
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
  };
}

export function storeDisplayName(store: Store): string {
  return store.custom_name?.trim() || store.name;
}

export function mapReview(row: Record<string, unknown>): Review {
  return {
    id: row.id as string,
    store_id: row.store_id as string,
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
