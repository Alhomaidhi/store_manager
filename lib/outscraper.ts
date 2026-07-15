const API_KEY = process.env.OUTSCRAPER_API;
const BASE = "https://api.app.outscraper.com";

// 0 = pull every review (Outscraper's "unlimited"). Set the env var to a
// positive number to cap the full-history pull and its cost.
const envLimit = Number.parseInt(process.env.OUTSCRAPER_REVIEWS_LIMIT ?? "", 10);
const REVIEWS_LIMIT = Number.isNaN(envLimit) || envLimit < 0 ? 0 : envLimit;

const POLL_INTERVAL_MS = 5000;
// Only used for the small synchronous summary fetch; big pulls are tracked
// as persistent jobs and never block a request this long.
const SYNC_POLL_TIMEOUT_MS = 60_000;

function requireKey(): string {
  if (!API_KEY) {
    throw new Error(
      "OUTSCRAPER_API is not set. Add it to .env.local — see .env.example."
    );
  }
  return API_KEY;
}

export interface PlaceReview {
  authorName: string | null;
  authorUrl: string | null;
  profilePhotoUrl: string | null;
  rating: number;
  text: string | null;
  language: string | null;
  publishedAt: number;
}

export interface PlaceDetails {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;
  totalRatings: number | null;
  googleUrl: string | null;
  reviews: PlaceReview[];
}

export type ReviewsJobResult =
  | { status: "pending" }
  | { status: "done"; place: PlaceDetails | null };

interface OutscraperResponse {
  id?: string;
  status?: string;
  data?: unknown[];
  results_location?: string;
  error?: boolean;
  errorMessage?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function outscraperFetch(
  path: string,
  params: Record<string, string>,
  asyncMode: boolean
): Promise<OutscraperResponse> {
  const key = requireKey();
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("async", asyncMode ? "true" : "false");

  const res = await fetch(url, { headers: { "X-API-KEY": key } });
  if (!res.ok && res.status !== 202) {
    const body = await res.text();
    throw new Error(`Outscraper request failed (${res.status}): ${body}`);
  }

  const payload = (await res.json()) as OutscraperResponse;
  if (payload.status === "Error" || payload.error) {
    throw new Error(
      `Outscraper request failed: ${payload.errorMessage ?? "unknown error"}`
    );
  }
  return payload;
}

async function getJobStatus(requestId: string): Promise<OutscraperResponse> {
  const key = requireKey();
  const res = await fetch(`${BASE}/requests/${encodeURIComponent(requestId)}`, {
    headers: { "X-API-KEY": key },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Outscraper job status failed (${res.status}): ${body}`);
  }
  return (await res.json()) as OutscraperResponse;
}

// data comes back as an array with one entry per query; entries may be a
// plain record or a nested array of records depending on the endpoint.
function flattenData(data: unknown[] | undefined): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const item of data ?? []) {
    if (Array.isArray(item)) {
      for (const inner of item) {
        if (inner && typeof inner === "object") {
          out.push(inner as Record<string, unknown>);
        }
      }
    } else if (item && typeof item === "object") {
      out.push(item as Record<string, unknown>);
    }
  }
  return out;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function mapReview(r: Record<string, unknown>): PlaceReview {
  // Outscraper spells the author fields "autor_*".
  const timestamp = asNumber(r.review_timestamp);
  const datetime = asString(r.review_datetime_utc);
  let publishedAt = Date.now();
  if (timestamp) {
    publishedAt = timestamp * 1000;
  } else if (datetime) {
    const parsed = new Date(datetime).getTime();
    if (!Number.isNaN(parsed)) publishedAt = parsed;
  }

  return {
    authorName: asString(r.autor_name) ?? asString(r.author_name),
    authorUrl: asString(r.autor_link) ?? asString(r.author_link),
    profilePhotoUrl: asString(r.autor_image) ?? asString(r.author_image),
    rating: asNumber(r.review_rating) ?? 0,
    text: asString(r.review_text),
    language: asString(r.review_language),
    publishedAt,
  };
}

function parsePlace(
  place: Record<string, unknown>,
  fallbackPlaceId: string
): PlaceDetails {
  const reviewsData = Array.isArray(place.reviews_data)
    ? (place.reviews_data as Record<string, unknown>[])
    : [];

  return {
    placeId: asString(place.place_id) ?? fallbackPlaceId,
    name: asString(place.name) ?? "Unknown",
    // The reviews endpoint returns "address" where search returns "full_address".
    address: asString(place.full_address) ?? asString(place.address) ?? "",
    rating: asNumber(place.rating),
    totalRatings: asNumber(place.reviews),
    googleUrl: asString(place.location_link),
    reviews: reviewsData.map(mapReview),
  };
}

function reviewParams(query: string, reviewsLimit: number): Record<string, string> {
  return {
    query,
    reviewsLimit: String(reviewsLimit),
    limit: "1",
    sort: "newest",
  };
}

/**
 * Fast synchronous lookup of a place (with at most one review) — used when
 * adding a store so it appears immediately. `query` can be a Google place_id,
 * a google_id (0x…:0x…), or a full Google Maps URL.
 */
export async function fetchPlaceSummary(query: string): Promise<PlaceDetails> {
  let payload = await outscraperFetch(
    "/maps/reviews-v3",
    reviewParams(query, 1),
    false
  );

  // Even sync requests can be answered as a queued job; wait briefly.
  if (payload.status === "Pending" && payload.id) {
    const jobId = payload.id;
    const deadline = Date.now() + SYNC_POLL_TIMEOUT_MS;
    while (payload.status === "Pending" && Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      payload = await getJobStatus(jobId);
    }
    if (payload.status === "Pending") {
      throw new Error("Outscraper is taking too long — try again in a minute.");
    }
    if (payload.status === "Error" || payload.error) {
      throw new Error(
        `Outscraper request failed: ${payload.errorMessage ?? "unknown error"}`
      );
    }
  }

  const place = flattenData(payload.data)[0];
  if (!place) {
    throw new Error(
      `Outscraper returned no data for "${query}" — check that the Google Maps link points to a place with at least one review.`
    );
  }
  return parsePlace(place, query);
}

/**
 * Submit a review pull as a persistent Outscraper job and return its request
 * id. Pass `sinceTimestamp` (ms) to only fetch reviews newer than it
 * (inclusive) via Outscraper's `cutoff`; omit it for a full-history pull.
 */
export async function submitReviewsJob(
  query: string,
  sinceTimestamp?: number
): Promise<string> {
  const params = reviewParams(query, REVIEWS_LIMIT);
  if (sinceTimestamp) {
    params.cutoff = String(Math.floor(sinceTimestamp / 1000));
  }

  const payload = await outscraperFetch("/maps/reviews-v3", params, true);
  if (!payload.id) {
    throw new Error("Outscraper did not return a job id for the review pull.");
  }
  return payload.id;
}

/**
 * Check a submitted job once. Throws if the job failed; `place` is null when
 * the job finished but found nothing (e.g. no reviews newer than the cutoff).
 */
export async function checkReviewsJob(
  requestId: string,
  fallbackPlaceId: string
): Promise<ReviewsJobResult> {
  const payload = await getJobStatus(requestId);

  if (payload.status === "Pending") return { status: "pending" };
  if (payload.status === "Error" || payload.error) {
    throw new Error(
      `Outscraper review pull failed: ${payload.errorMessage ?? "unknown error"}`
    );
  }

  const place = flattenData(payload.data)[0];
  return { status: "done", place: place ? parsePlace(place, fallbackPlaceId) : null };
}
