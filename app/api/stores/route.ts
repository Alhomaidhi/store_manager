import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import db from "@/lib/db";
import { getPlaceDetails } from "@/lib/google-places";
import { upsertReviews } from "@/lib/store-service";

const createSchema = z.object({
  placeId: z.string().min(1),
});

export async function GET() {
  const stores = db
    .prepare("SELECT * FROM stores ORDER BY name ASC")
    .all();
  return NextResponse.json({ stores });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "placeId required" }, { status: 400 });
  }
  const { placeId } = parsed.data;

  const existing = db
    .prepare("SELECT * FROM stores WHERE place_id = ?")
    .get(placeId);
  if (existing) {
    return NextResponse.json({ store: existing, alreadyExisted: true });
  }

  try {
    const details = await getPlaceDetails(placeId);
    const id = randomUUID();
    const now = Date.now();
    db.prepare(
      `INSERT INTO stores (id, place_id, name, address, rating, total_ratings, google_url, created_at, last_synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      details.placeId,
      details.name,
      details.address,
      details.rating,
      details.totalRatings,
      details.googleUrl,
      now,
      now
    );
    upsertReviews(id, details.reviews);
    const store = db.prepare("SELECT * FROM stores WHERE id = ?").get(id);
    return NextResponse.json({ store });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add store" },
      { status: 500 }
    );
  }
}
