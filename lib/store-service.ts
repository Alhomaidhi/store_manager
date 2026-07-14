import { randomUUID } from "crypto";
import db from "./db";
import { PlaceReview, getPlaceDetails } from "./google-places";

export function upsertReviews(storeId: string, reviews: PlaceReview[]): number {
  const now = Date.now();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO reviews
      (id, store_id, author_name, author_url, profile_photo_url, rating, text, language, published_at, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const tx = db.transaction((items: PlaceReview[]) => {
    let added = 0;
    for (const r of items) {
      const result = insert.run(
        randomUUID(),
        storeId,
        r.authorName,
        r.authorUrl,
        r.profilePhotoUrl,
        r.rating,
        r.text,
        r.language,
        r.publishedAt,
        now
      );
      if (result.changes > 0) added += 1;
    }
    return added;
  });
  return tx(reviews);
}

export async function syncStore(storeId: string): Promise<{
  added: number;
  totalReviews: number;
}> {
  const store = db
    .prepare("SELECT place_id FROM stores WHERE id = ?")
    .get(storeId) as { place_id: string } | undefined;
  if (!store) throw new Error("Store not found");

  const details = await getPlaceDetails(store.place_id);
  const added = upsertReviews(storeId, details.reviews);

  db.prepare(
    `UPDATE stores
      SET name = ?, address = ?, rating = ?, total_ratings = ?, google_url = ?, last_synced_at = ?
      WHERE id = ?`
  ).run(
    details.name,
    details.address,
    details.rating,
    details.totalRatings,
    details.googleUrl,
    Date.now(),
    storeId
  );

  const countRow = db
    .prepare("SELECT COUNT(*) as c FROM reviews WHERE store_id = ?")
    .get(storeId) as { c: number };

  return { added, totalReviews: countRow.c };
}
