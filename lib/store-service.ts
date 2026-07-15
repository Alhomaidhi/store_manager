import { sql, ensureSchema } from "./db";
import {
  PlaceDetails,
  PlaceReview,
  checkReviewsJob,
  submitReviewsJob,
} from "./outscraper";

// Abandon a tracked job after this long — Outscraper keeps results for ~2h,
// so anything older is unrecoverable and a fresh job must be submitted.
const JOB_STALE_MS = 2 * 60 * 60 * 1000;

// After submitting a job, wait this long inline so small incremental syncs
// finish within a single request instead of showing "in progress".
const INLINE_WAIT_MS = 40_000;
const INLINE_POLL_INTERVAL_MS = 5000;

export type SyncResult =
  | { status: "completed"; added: number; totalReviews: number }
  | { status: "pending" };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Rows per INSERT statement. A full history lands in a handful of queries —
// inserting row-by-row over the HTTP driver took minutes for large stores,
// which let serverless time limits interrupt ingestion partway through.
const INSERT_CHUNK = 500;

export async function upsertReviews(
  storeId: string,
  reviews: PlaceReview[]
): Promise<number> {
  await ensureSchema();
  if (reviews.length === 0) return 0;
  const now = Date.now();
  let added = 0;
  for (let i = 0; i < reviews.length; i += INSERT_CHUNK) {
    const chunk = reviews.slice(i, i + INSERT_CHUNK).map((r) => ({
      review_source_id: r.sourceId,
      // Normalized to '' so the (store, author, published_at) unique
      // constraint applies even to anonymous reviews — Postgres treats
      // NULLs as distinct, which would let duplicates through.
      author_name: r.authorName ?? "",
      author_url: r.authorUrl,
      profile_photo_url: r.profilePhotoUrl,
      rating: r.rating,
      text: r.text,
      language: r.language,
      published_at: r.publishedAt,
    }));
    // Targetless ON CONFLICT dedupes against every unique key — the
    // (store, author, published_at) constraint and the source-id index —
    // including collisions within this same statement.
    const rows = (await sql`
      INSERT INTO reviews
        (id, store_id, review_source_id, author_name, author_url,
         profile_photo_url, rating, text, language, published_at, fetched_at)
      SELECT gen_random_uuid()::text, ${storeId}, r.review_source_id,
             r.author_name, r.author_url, r.profile_photo_url, r.rating,
             r.text, r.language, r.published_at, ${now}
        FROM jsonb_to_recordset(${JSON.stringify(chunk)}::jsonb) AS r(
          review_source_id TEXT, author_name TEXT, author_url TEXT,
          profile_photo_url TEXT, rating INTEGER, text TEXT, language TEXT,
          published_at BIGINT)
      ON CONFLICT DO NOTHING
      RETURNING id
    `) as Array<{ id: string }>;
    added += rows.length;
  }
  return added;
}

export async function markJobPending(
  storeId: string,
  requestId: string,
  isFullPull: boolean
): Promise<void> {
  await sql`
    UPDATE stores
      SET pending_request_id = ${requestId},
          pending_started_at = ${Date.now()},
          pending_full = ${isFullPull}
      WHERE id = ${storeId}
  `;
}

async function clearJob(storeId: string): Promise<void> {
  await sql`
    UPDATE stores
      SET pending_request_id = NULL, pending_started_at = NULL
      WHERE id = ${storeId}
  `;
}

/**
 * Atomically take ownership of a finished job before ingesting it. The store
 * page polls while a pull runs, so several requests can see "done" at once —
 * only the one that wins this UPDATE ingests; the rest report "pending" and
 * pick up the refreshed data on their next poll.
 */
async function claimJob(storeId: string, requestId: string): Promise<boolean> {
  const rows = (await sql`
    UPDATE stores
      SET pending_request_id = NULL, pending_started_at = NULL
      WHERE id = ${storeId} AND pending_request_id = ${requestId}
      RETURNING id
  `) as unknown[];
  return rows.length > 0;
}

async function countReviews(storeId: string): Promise<number> {
  const rows = (await sql`
    SELECT COUNT(*)::int as c FROM reviews WHERE store_id = ${storeId}
  `) as Array<{ c: number }>;
  return rows[0]?.c ?? 0;
}

async function ingestJobResult(
  storeId: string,
  place: PlaceDetails | null,
  wasFullPull: boolean
): Promise<SyncResult> {
  let added = 0;
  if (place) {
    added = await upsertReviews(storeId, place.reviews);
    await sql`
      UPDATE stores
        SET name = ${place.name},
            address = ${place.address},
            rating = ${place.rating},
            total_ratings = ${place.totalRatings},
            google_url = ${place.googleUrl},
            last_synced_at = ${Date.now()},
            pending_request_id = NULL,
            pending_started_at = NULL
        WHERE id = ${storeId}
    `;
  } else {
    // Job finished but found nothing (e.g. no reviews newer than the cutoff).
    await sql`
      UPDATE stores
        SET last_synced_at = ${Date.now()},
            pending_request_id = NULL,
            pending_started_at = NULL
        WHERE id = ${storeId}
    `;
  }
  if (wasFullPull) {
    // Only after a completed full pull may future syncs go incremental.
    await sql`
      UPDATE stores SET history_synced_at = ${Date.now()} WHERE id = ${storeId}
    `;
  }
  return { status: "completed", added, totalReviews: await countReviews(storeId) };
}

/**
 * Sync a store's reviews. Review pulls run as persistent Outscraper jobs
 * tracked on the store row, so they can take as long as they need without
 * being lost to a request timeout:
 *
 * - If a job is already tracked, check it — ingest when done, otherwise
 *   report "pending" (callers poll again later). No duplicate billing.
 * - Otherwise submit a new job (incremental: only reviews newer than the
 *   newest stored one) and wait a short while inline so small syncs finish
 *   in one request. If it's still running, leave it tracked and return
 *   "pending".
 */
export async function syncStore(storeId: string): Promise<SyncResult> {
  await ensureSchema();

  const storeRows = (await sql`
    SELECT place_id, pending_request_id, pending_started_at, pending_full,
           history_synced_at
      FROM stores WHERE id = ${storeId}
  `) as Array<{
    place_id: string;
    pending_request_id: string | null;
    pending_started_at: string | number | null;
    pending_full: boolean | null;
    history_synced_at: string | number | null;
  }>;
  if (storeRows.length === 0) throw new Error("Store not found");
  const { place_id, pending_request_id, pending_started_at, pending_full, history_synced_at } =
    storeRows[0];

  if (pending_request_id) {
    const startedAt = pending_started_at ? Number(pending_started_at) : 0;
    if (Date.now() - startedAt < JOB_STALE_MS) {
      let result;
      try {
        result = await checkReviewsJob(pending_request_id, place_id);
      } catch (err) {
        await clearJob(storeId);
        throw err;
      }
      if (result.status === "pending") return { status: "pending" };
      if (!(await claimJob(storeId, pending_request_id))) {
        return { status: "pending" }; // another request is ingesting it
      }
      try {
        return await ingestJobResult(storeId, result.place, !!pending_full);
      } catch (err) {
        // Put the job back so its result isn't lost to a transient failure.
        await markJobPending(storeId, pending_request_id, !!pending_full);
        throw err;
      }
    }
    // Stale job — its results have expired on Outscraper's side. Fall
    // through and submit a fresh one.
    await clearJob(storeId);
  }

  // Until a full-history pull has verifiably completed, every sync re-pulls
  // everything (dedup makes that safe) — anchoring the cutoff at the newest
  // stored review after a partial ingest would permanently skip the older
  // tail. Once complete, syncs go incremental: only reviews newer than the
  // newest stored one. That cutoff is inclusive, so the newest stored review
  // comes back too (deduped on insert) — which guarantees place info is
  // returned and the store's rating/name stay fresh.
  const isFullPull = !history_synced_at;
  let newestTs: number | undefined;
  if (!isFullPull) {
    const newestRows = (await sql`
      SELECT MAX(published_at) as ts FROM reviews WHERE store_id = ${storeId}
    `) as Array<{ ts: string | number | null }>;
    newestTs = newestRows[0]?.ts ? Number(newestRows[0].ts) : undefined;
  }

  const requestId = await submitReviewsJob(place_id, newestTs);
  await markJobPending(storeId, requestId, isFullPull);

  const deadline = Date.now() + INLINE_WAIT_MS;
  while (Date.now() < deadline) {
    await sleep(INLINE_POLL_INTERVAL_MS);
    let result;
    try {
      result = await checkReviewsJob(requestId, place_id);
    } catch (err) {
      await clearJob(storeId);
      throw err;
    }
    if (result.status === "done") {
      if (!(await claimJob(storeId, requestId))) return { status: "pending" };
      try {
        return await ingestJobResult(storeId, result.place, isFullPull);
      } catch (err) {
        await markJobPending(storeId, requestId, isFullPull);
        throw err;
      }
    }
  }

  return { status: "pending" };
}
