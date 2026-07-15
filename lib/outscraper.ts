const API_KEY = process.env.OUTSCRAPER_API;
const BASE = "https://api.app.outscraper.com";

// Outscraper charges per review, so the per-sync fetch size is configurable.
const DEFAULT_REVIEWS_LIMIT = 100;
const REVIEWS_LIMIT =
  Number.parseInt(process.env.OUTSCRAPER_REVIEWS_LIMIT ?? "", 10) ||
  DEFAULT_REVIEWS_LIMIT;

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90_000;

function requireKey(): string {
  if (!API_KEY) {
    throw new Error(
      "OUTSCRAPER_API is not set. Add it to .env.local — see .env.example."
    );
  }
  return API_KEY;
}

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string;
  rating?: number;
  userRatingCount?: number;
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

async function outscraperRequest(
  path: string,
  options:
    | { method: "GET"; params: Record<string, string> }
    | { method: "POST"; body: Record<string, unknown> }
): Promise<Record<string, unknown>[]> {
  const key = requireKey();
  const url = new URL(`${BASE}${path}`);
  let init: RequestInit;
  if (options.method === "GET") {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v);
    }
    url.searchParams.set("async", "false");
    init = { headers: { "X-API-KEY": key } };
  } else {
    init = {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ ...options.body, async: false }),
    };
  }

  const res = await fetch(url, init);
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

export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  // Outscraper's speed-optimized real-time search endpoint.
  const places = await outscraperRequest("/google-maps-search", {
    method: "POST",
    body: { query: [query], organizationsPerQueryLimit: 10, language: "en" },
  });

  return places
    .filter((p) => asString(p.place_id))
    .map((p) => ({
      placeId: asString(p.place_id) as string,
      name: asString(p.name) ?? "Unknown",
      address: asString(p.full_address) ?? "",
      rating: asNumber(p.rating) ?? undefined,
      userRatingCount: asNumber(p.reviews) ?? undefined,
    }));
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

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const places = await outscraperRequest("/maps/reviews-v3", {
    method: "GET",
    params: {
      query: placeId,
      reviewsLimit: String(REVIEWS_LIMIT),
      limit: "1",
      sort: "newest",
    },
  });

  const place = places[0];
  if (!place) {
    throw new Error(`Outscraper returned no data for place ${placeId}`);
  }

  const reviewsData = Array.isArray(place.reviews_data)
    ? (place.reviews_data as Record<string, unknown>[])
    : [];

  return {
    placeId: asString(place.place_id) ?? placeId,
    name: asString(place.name) ?? "Unknown",
    // The reviews endpoint returns "address" where search returns "full_address".
    address: asString(place.full_address) ?? asString(place.address) ?? "",
    rating: asNumber(place.rating),
    totalRatings: asNumber(place.reviews),
    googleUrl: asString(place.location_link),
    reviews: reviewsData.map(mapReview),
  };
}
