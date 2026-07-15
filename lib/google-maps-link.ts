const SHORT_LINK_HOST = /(^|\.)goo\.gl$/;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

export function isGoogleMapsUrl(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    // Full links (google.com/maps, maps.google.com, google.com.sa, …)
    // and share links (maps.app.goo.gl, goo.gl/maps).
    return /(^|\.)google\.[a-z.]+$/.test(host) || SHORT_LINK_HOST.test(host);
  } catch {
    return false;
  }
}

/**
 * Turn any Google Maps link into the most precise query we can hand to
 * Outscraper. Short share links (maps.app.goo.gl) must be expanded first:
 * Outscraper doesn't reliably follow them and may fall back to a text
 * search, matching a completely different place.
 *
 * Preference order: the 0x…:0x… google_id (present in every full place
 * URL), then an explicit place_id query param, then the expanded URL.
 */
export async function resolveGoogleMapsQuery(raw: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }

  if (SHORT_LINK_HOST.test(url.hostname.toLowerCase())) {
    url = await expandShortLink(url);
  }

  return extractPlaceIdentifier(url) ?? url.toString();
}

async function expandShortLink(short: URL): Promise<URL> {
  let res: Response;
  try {
    res = await fetch(short, {
      redirect: "follow",
      headers: { "User-Agent": BROWSER_UA },
    });
  } catch {
    throw new Error(
      "Couldn't expand the short Google Maps link. Open the link in a browser and paste the full google.com/maps address instead."
    );
  }

  let final: URL;
  try {
    final = new URL(res.url);
  } catch {
    return short;
  }

  // Google sometimes interposes a consent page that wraps the real URL.
  const wrapped = final.searchParams.get("continue");
  if (wrapped) {
    try {
      final = new URL(wrapped);
    } catch {
      // keep the consent URL; the identifier extraction still gets a chance
    }
  }
  return final;
}

function extractPlaceIdentifier(url: URL): string | null {
  let s = url.toString();
  try {
    s = decodeURIComponent(s);
  } catch {
    // leave encoded; the patterns below may still match
  }

  // FTID pair, e.g. 0x3e2f03890d489399:0xba974d1c98e79fd4 — embedded in the
  // data= blob of full place URLs and accepted by Outscraper as a query.
  const ftid = s.match(/0x[0-9a-f]+:0x[0-9a-f]+/i);
  if (ftid) return ftid[0];

  for (const key of ["query_place_id", "place_id", "ftid"]) {
    const v = url.searchParams.get(key);
    if (v) return v;
  }
  return null;
}
