import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "store-manager.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS stores (
    id TEXT PRIMARY KEY,
    place_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    address TEXT,
    rating REAL,
    total_ratings INTEGER,
    google_url TEXT,
    created_at INTEGER NOT NULL,
    last_synced_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    author_name TEXT,
    author_url TEXT,
    profile_photo_url TEXT,
    rating INTEGER NOT NULL,
    text TEXT,
    language TEXT,
    published_at INTEGER NOT NULL,
    fetched_at INTEGER NOT NULL,
    UNIQUE(store_id, author_name, published_at)
  );

  CREATE INDEX IF NOT EXISTS idx_reviews_store ON reviews(store_id);
  CREATE INDEX IF NOT EXISTS idx_reviews_published ON reviews(store_id, published_at DESC);
`);

export default db;

export interface Store {
  id: string;
  place_id: string;
  name: string;
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
