import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { sql, ensureSchema, mapStore } from "@/lib/db";
import { getPlaceDetails } from "@/lib/google-places";
import { upsertReviews } from "@/lib/store-service";

const createSchema = z.object({
  placeId: z.string().min(1),
});

export async function GET() {
  await ensureSchema();
  const rows = (await sql`SELECT * FROM stores ORDER BY name ASC`) as Record<string, unknown>[];
  return NextResponse.json({ stores: rows.map(mapStore) });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "placeId required" }, { status: 400 });
  }
  const { placeId } = parsed.data;

  await ensureSchema();

  const existing = (await sql`
    SELECT * FROM stores WHERE place_id = ${placeId}
  `) as Record<string, unknown>[];
  if (existing.length > 0) {
    return NextResponse.json({ store: mapStore(existing[0]), alreadyExisted: true });
  }

  try {
    const details = await getPlaceDetails(placeId);
    const id = randomUUID();
    const now = Date.now();
    await sql`
      INSERT INTO stores
        (id, place_id, name, address, rating, total_ratings, google_url, created_at, last_synced_at)
      VALUES
        (${id}, ${details.placeId}, ${details.name}, ${details.address},
         ${details.rating}, ${details.totalRatings}, ${details.googleUrl}, ${now}, ${now})
    `;
    await upsertReviews(id, details.reviews);
    const inserted = (await sql`SELECT * FROM stores WHERE id = ${id}`) as Record<string, unknown>[];
    return NextResponse.json({ store: mapStore(inserted[0]) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add store" },
      { status: 500 }
    );
  }
}
