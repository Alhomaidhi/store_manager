const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const BASE = "https://places.googleapis.com/v1";

function requireKey(): string {
  if (!API_KEY) {
    throw new Error(
      "GOOGLE_PLACES_API_KEY is not set. Add it to .env.local — see .env.example."
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

export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  const key = requireKey();
  const res = await fetch(`${BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount",
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 10 }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Places search failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    places?: Array<{
      id: string;
      displayName?: { text: string };
      formattedAddress?: string;
      rating?: number;
      userRatingCount?: number;
    }>;
  };

  return (data.places ?? []).map((p) => ({
    placeId: p.id,
    name: p.displayName?.text ?? "Unknown",
    address: p.formattedAddress ?? "",
    rating: p.rating,
    userRatingCount: p.userRatingCount,
  }));
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const key = requireKey();
  const res = await fetch(
    `${BASE}/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,rating,userRatingCount,googleMapsUri,reviews",
      },
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Places details failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    rating?: number;
    userRatingCount?: number;
    googleMapsUri?: string;
    reviews?: Array<{
      name?: string;
      relativePublishTimeDescription?: string;
      rating?: number;
      text?: { text?: string; languageCode?: string };
      originalText?: { text?: string; languageCode?: string };
      authorAttribution?: {
        displayName?: string;
        uri?: string;
        photoUri?: string;
      };
      publishTime?: string;
    }>;
  };

  const reviews: PlaceReview[] = (data.reviews ?? []).map((r) => ({
    authorName: r.authorAttribution?.displayName ?? null,
    authorUrl: r.authorAttribution?.uri ?? null,
    profilePhotoUrl: r.authorAttribution?.photoUri ?? null,
    rating: r.rating ?? 0,
    text: r.text?.text ?? r.originalText?.text ?? null,
    language: r.text?.languageCode ?? r.originalText?.languageCode ?? null,
    publishedAt: r.publishTime ? new Date(r.publishTime).getTime() : Date.now(),
  }));

  return {
    placeId: data.id,
    name: data.displayName?.text ?? "Unknown",
    address: data.formattedAddress ?? "",
    rating: data.rating ?? null,
    totalRatings: data.userRatingCount ?? null,
    googleUrl: data.googleMapsUri ?? null,
    reviews,
  };
}
