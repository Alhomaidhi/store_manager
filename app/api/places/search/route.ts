import { NextRequest, NextResponse } from "next/server";
import { searchPlaces } from "@/lib/outscraper";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  if (!query || query.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }
  try {
    const results = await searchPlaces(query);
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 }
    );
  }
}
