import { randomUUID } from "crypto";
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

export async function upsertReviews(
  storeId: string,
  reviews: PlaceReview[]
): Promise<number> {
  await ensureSchema();
  const now = Date.now();
  let added = 0;
  for (const r of reviews) {
    const rows = (await sql`
      INSERT INTO reviews
        (id, store_id, author_name, author_url, profile_photo_url,
         rating, text, language, published_at, fetched_at)
      VALUES
        (${randomUUID()}, ${storeId}, ${r.authorName}, ${r.authorUrl},
         ${r.profilePhotoUrl}, ${r.rating}, ${r.text}, ${r.language},
         ${r.publishedAt}, ${now})
      ON CONFLICT (store_id, author_name, published_at) DO NOTHING
      RETURNING id
    `) as Array<{ id: string }>;
    if (rows.length > 0) added += 1;
  }
  return added;
}

export async function markJobPending(
  storeId: string,
  requestId: string
): Promise<void> {
  await sql`
    UPDATE stores
      SET pending_request_id = ${requestId},
          pending_started_at = ${Date.now()}
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

async function countReviews(storeId: string): Promise<number> {
  const rows = (await sql`
    SELECT COUNT(*)::int as c FROM reviews WHERE store_id = ${storeId}
  `) as Array<{ c: number }>;
  return rows[0]?.c ?? 0;
}

async function ingestJobResult(
  storeId: string,
  place: PlaceDetails | null
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
    SELECT place_id, pending_request_id, pending_started_at
      FROM stores WHERE id = ${storeId}
  `) as Array<{
    place_id: string;
    pending_request_id: string | null;
    pending_started_at: string | number | null;
  }>;
  if (storeRows.length === 0) throw new Error("Store not found");
  const { place_id, pending_request_id, pending_started_at } = storeRows[0];

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
      return ingestJobResult(storeId, result.place);
    }
    // Stale job — its results have expired on Outscraper's side. Fall
    // through and submit a fresh one.
    await clearJob(storeId);
  }

  // Incremental sync: only fetch reviews newer than the newest one stored.
  // The cutoff is inclusive, so the newest stored review comes back too
  // (deduped on insert) — which guarantees place info is returned and the
  // store's rating/name stay fresh. First sync (no reviews) pulls everything.
  const newestRows = (await sql`
    SELECT MAX(published_at) as ts FROM reviews WHERE store_id = ${storeId}
  `) as Array<{ ts: string | number | null }>;
  const newestTs = newestRows[0]?.ts ? Number(newestRows[0].ts) : undefined;

  const requestId = await submitReviewsJob(place_id, newestTs);
  await markJobPending(storeId, requestId);

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
    if (result.status === "done") return ingestJobResult(storeId, result.place);
  }

  return { status: "pending" };
}
