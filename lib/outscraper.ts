const API_KEY = process.env.OUTSCRAPER_API;
const BASE = "https://api.app.outscraper.com";

// 0 = pull every review (Outscraper's "unlimited"). Set the env var to a
// positive number to cap the per-request fetch and its cost.
const envLimit = Number.parseInt(process.env.OUTSCRAPER_REVIEWS_LIMIT ?? "", 10);
const REVIEWS_LIMIT = Number.isNaN(envLimit) || envLimit < 0 ? 0 : envLimit;

// Unlimited/large pulls run as async jobs on Outscraper's side (their SDK
// forces async when reviewsLimit is 0 or >499), so we submit async and poll.
const FORCE_ASYNC = REVIEWS_LIMIT === 0 || REVIEWS_LIMIT > 499;

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 270_000; // keep under the route's 300s maxDuration

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

/**
 * Outscraper may answer a request asynchronously (HTTP 202 / status "Pending")
 * even when async=false is requested. Poll the results location until the job
 * finishes or the timeout is hit.
 */
async function pollResults(
  resultsLocation: string,
  key: string
): Promise<OutscraperResponse> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const res = await fetch(resultsLocation, {
      headers: { "X-API-KEY": key },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Outscraper polling failed (${res.status}): ${body}`);
    }
    const data = (await res.json()) as OutscraperResponse;
    if (data.status && data.status !== "Pending") return data;
  }
  throw new Error("Outscraper request timed out — try again in a minute.");
}

async function outscraperGet(
  path: string,
  params: Record<string, string>,
  asyncMode: boolean
): Promise<Record<string, unknown>[]> {
  const key = requireKey();
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("async", asyncMode ? "true" : "false");

  const res = await fetch(url, { headers: { "X-API-KEY": key } });
  if (!res.ok && res.status !== 202) {
    const body = await res.text();
    throw new Error(`Outscraper request failed (${res.status}): ${body}`);
  }

  let payload = (await res.json()) as OutscraperResponse;
  if (payload.status === "Pending") {
    const location =
      payload.results_location ??
      (payload.id ? `${BASE}/requests/${payload.id}` : null);
    if (!location) {
      throw new Error("Outscraper returned a pending job without a results location.");
    }
    payload = await pollResults(location, key);
  }

  if (payload.status === "Error" || payload.error) {
    throw new Error(
      `Outscraper request failed: ${payload.errorMessage ?? "unknown error"}`
    );
  }

  // data comes back as an array with one entry per query; entries may be a
  // plain record or a nested array of records depending on the endpoint.
  const out: Record<string, unknown>[] = [];
  for (const item of payload.data ?? []) {
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

export interface GetPlaceDetailsOptions {
  /**
   * Only fetch reviews published at or after this time (ms since epoch).
   * Maps to Outscraper's `cutoff` param — used for incremental syncs so we
   * don't pay to re-download the full history every time. Returns null when
   * Outscraper finds nothing at all for the query (no place info is returned
   * without at least one matching review).
   */
  sinceTimestamp?: number;
}

/**
 * `query` can be a Google place_id, a google_id (0x…:0x…), or a full Google
 * Maps URL — Outscraper accepts all of them.
 */
export async function getPlaceDetails(
  query: string,
  opts: GetPlaceDetailsOptions = {}
): Promise<PlaceDetails | null> {
  const params: Record<string, string> = {
    query,
    reviewsLimit: String(REVIEWS_LIMIT),
    limit: "1",
    sort: "newest",
  };
  if (opts.sinceTimestamp) {
    params.cutoff = String(Math.floor(opts.sinceTimestamp / 1000));
  }

  const places = await outscraperGet("/maps/reviews-v3", params, FORCE_ASYNC);

  const place = places[0];
  if (!place) {
    if (opts.sinceTimestamp) return null;
    throw new Error(
      `Outscraper returned no data for "${query}" — check that the Google Maps link points to a place.`
    );
  }

  const reviewsData = Array.isArray(place.reviews_data)
    ? (place.reviews_data as Record<string, unknown>[])
    : [];

  return {
    placeId: asString(place.place_id) ?? query,
    name: asString(place.name) ?? "Unknown",
    // The reviews endpoint returns "address" where search returns "full_address".
    address: asString(place.full_address) ?? asString(place.address) ?? "",
    rating: asNumber(place.rating),
    totalRatings: asNumber(place.reviews),
    googleUrl: asString(place.location_link),
    reviews: reviewsData.map(mapReview),
  };
}
