import db, { Review, Store } from "./db";

export interface StoreReport {
  store: Store;
  reviewCount: number;
  avgRating: number | null;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
  monthlyVolume: Array<{ month: string; count: number; avgRating: number }>;
  topKeywords: Array<{ word: string; count: number }>;
  recentNegative: Review[];
}

const STOPWORDS = new Set([
  "the","a","an","and","or","but","if","then","else","when","at","by","for","in","of","on","to","up","as","is","it","its","was","were","been","be","are","this","that","these","those","i","we","you","he","she","they","them","his","her","their","my","our","your","me","us","have","has","had","do","does","did","will","would","should","could","can","just","not","no","yes","so","too","very","really","much","more","most","some","any","all","one","also","from","with","about","into","only","out","over","after","before","again","just","now","here","there","what","which","who","whom","how","why","get","got","go","went","went","us","my","being","dont","doesnt","didnt","cant","couldnt","wouldnt","wasnt","werent","arent","isnt","havent","hasnt","hadnt","were","them","their","because","while","during","between","through","against","above","below","under","than","other","such","own","same","few","every","said","say","says","went","goes","going","gone","came","come","comes","coming","see","saw","seen","seeing","made","make","makes","making","take","takes","took","taken","taking","think","thought","thinks","thinking","know","knew","knows","known","knowing","want","wants","wanted","wanting","need","needs","needed","needing","try","tried","tries","trying","let","lets","letting","tell","told","tells","telling","give","gave","given","gives","giving","find","found","finds","finding","use","used","uses","using","work","works","worked","working","call","called","calls","calling","first","last","long","great","good","bad","big","small","new","old","high","low","right","wrong","different","late","early","hard","easy","best","better","worse","worst","actually","however","though","although","even","still","yet","already","almost","enough","quite","rather","either","neither","both","each","other","another","around","along","across","behind","near","upon","without","within","among","toward","towards"
]);

export function getStoreReport(storeId: string): StoreReport | null {
  const store = db.prepare("SELECT * FROM stores WHERE id = ?").get(storeId) as Store | undefined;
  if (!store) return null;

  const reviews = db
    .prepare("SELECT * FROM reviews WHERE store_id = ? ORDER BY published_at DESC")
    .all(storeId) as Review[];

  const reviewCount = reviews.length;
  const avgRating =
    reviewCount === 0
      ? null
      : reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount;

  const ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
  };
  for (const r of reviews) {
    const k = r.rating as 1 | 2 | 3 | 4 | 5;
    if (k >= 1 && k <= 5) ratingDistribution[k]++;
  }

  const monthlyMap = new Map<string, { total: number; sum: number }>();
  for (const r of reviews) {
    const d = new Date(r.published_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = monthlyMap.get(key) ?? { total: 0, sum: 0 };
    bucket.total += 1;
    bucket.sum += r.rating;
    monthlyMap.set(key, bucket);
  }
  const monthlyVolume = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { total, sum }]) => ({
      month,
      count: total,
      avgRating: Number((sum / total).toFixed(2)),
    }));

  const keywordCounts = new Map<string, number>();
  for (const r of reviews) {
    if (!r.text) continue;
    const words = r.text
      .toLowerCase()
      .replace(/[^\p{L}\s']/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
    const seen = new Set<string>();
    for (const w of words) {
      if (seen.has(w)) continue;
      seen.add(w);
      keywordCounts.set(w, (keywordCounts.get(w) ?? 0) + 1);
    }
  }
  const topKeywords = Array.from(keywordCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([word, count]) => ({ word, count }));

  const recentNegative = reviews.filter((r) => r.rating <= 2).slice(0, 20);

  return {
    store,
    reviewCount,
    avgRating,
    ratingDistribution,
    monthlyVolume,
    topKeywords,
    recentNegative,
  };
}

export interface DashboardSummary {
  totalStores: number;
  totalReviews: number;
  avgRating: number | null;
  storesByRating: Array<{
    id: string;
    name: string;
    avgRating: number | null;
    reviewCount: number;
    lastSyncedAt: number | null;
  }>;
}

export function getDashboardSummary(): DashboardSummary {
  const stores = db.prepare("SELECT * FROM stores ORDER BY name ASC").all() as Store[];
  const totalReviewsRow = db.prepare("SELECT COUNT(*) as c FROM reviews").get() as { c: number };
  const avgRow = db.prepare("SELECT AVG(rating) as a FROM reviews").get() as { a: number | null };

  const storesByRating = stores.map((s) => {
    const row = db
      .prepare(
        "SELECT COUNT(*) as c, AVG(rating) as a FROM reviews WHERE store_id = ?"
      )
      .get(s.id) as { c: number; a: number | null };
    return {
      id: s.id,
      name: s.name,
      avgRating: row.a,
      reviewCount: row.c,
      lastSyncedAt: s.last_synced_at,
    };
  });

  return {
    totalStores: stores.length,
    totalReviews: totalReviewsRow.c,
    avgRating: avgRow.a,
    storesByRating,
  };
}
