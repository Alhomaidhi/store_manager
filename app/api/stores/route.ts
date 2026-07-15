import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { sql, ensureSchema, mapStore } from "@/lib/db";
import { getPlaceDetails } from "@/lib/outscraper";
import { isGoogleMapsUrl, resolveGoogleMapsQuery } from "@/lib/google-maps-link";
import { upsertReviews } from "@/lib/store-service";

const createSchema = z
  .object({
    placeId: z.string().min(1).optional(),
    url: z.string().min(1).optional(),
    name: z.string().max(120).optional(),
  })
  .refine((v) => v.placeId || v.url, {
    message: "A Google Maps link or placeId is required",
  });

function errorJson(err: unknown, status = 500) {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[api/stores]", err);
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    await ensureSchema();
    const rows = (await sql`
      SELECT * FROM stores ORDER BY COALESCE(custom_name, name) ASC
    `) as Record<string, unknown>[];
    return NextResponse.json({ stores: rows.map(mapStore) });
  } catch (err) {
    return errorJson(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "A Google Maps link is required" },
        { status: 400 }
      );
    }
    const { placeId, url, name } = parsed.data;
    const customName = name?.trim() || null;

    if (url && !isGoogleMapsUrl(url)) {
      return NextResponse.json(
        { error: "That doesn't look like a Google Maps link. Copy it via Share → Copy link on Google Maps." },
        { status: 400 }
      );
    }

    await ensureSchema();

    if (placeId) {
      const existing = (await sql`
        SELECT * FROM stores WHERE place_id = ${placeId}
      `) as Record<string, unknown>[];
      if (existing.length > 0) {
        return NextResponse.json({ store: mapStore(existing[0]), alreadyExisted: true });
      }
    }

    // Expand share links and extract the exact place identifier so
    // Outscraper can't mis-resolve the link as a text search.
    const query = url ? await resolveGoogleMapsQuery(url) : placeId!;
    const details = await getPlaceDetails(query);

    const existing = (await sql`
      SELECT * FROM stores WHERE place_id = ${details.placeId}
    `) as Record<string, unknown>[];
    if (existing.length > 0) {
      return NextResponse.json({ store: mapStore(existing[0]), alreadyExisted: true });
    }

    const id = randomUUID();
    const now = Date.now();
    await sql`
      INSERT INTO stores
        (id, place_id, name, custom_name, address, rating, total_ratings, google_url, created_at, last_synced_at)
      VALUES
        (${id}, ${details.placeId}, ${details.name}, ${customName}, ${details.address},
         ${details.rating}, ${details.totalRatings}, ${details.googleUrl}, ${now}, ${now})
    `;
    await upsertReviews(id, details.reviews);
    const inserted = (await sql`SELECT * FROM stores WHERE id = ${id}`) as Record<string, unknown>[];
    return NextResponse.json({ store: mapStore(inserted[0]) });
  } catch (err) {
    return errorJson(err);
  }
}
