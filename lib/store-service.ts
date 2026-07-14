import { randomUUID } from "crypto";
import { sql, ensureSchema } from "./db";
import { PlaceReview, getPlaceDetails } from "./google-places";

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

export async function syncStore(storeId: string): Promise<{
  added: number;
  totalReviews: number;
}> {
  await ensureSchema();

  const storeRows = (await sql`
    SELECT place_id FROM stores WHERE id = ${storeId}
  `) as Array<{ place_id: string }>;
  if (storeRows.length === 0) throw new Error("Store not found");

  const details = await getPlaceDetails(storeRows[0].place_id);
  const added = await upsertReviews(storeId, details.reviews);

  await sql`
    UPDATE stores
      SET name = ${details.name},
          address = ${details.address},
          rating = ${details.rating},
          total_ratings = ${details.totalRatings},
          google_url = ${details.googleUrl},
          last_synced_at = ${Date.now()}
      WHERE id = ${storeId}
  `;

  const countRows = (await sql`
    SELECT COUNT(*)::int as c FROM reviews WHERE store_id = ${storeId}
  `) as Array<{ c: number }>;

  return { added, totalReviews: countRows[0]?.c ?? 0 };
}
