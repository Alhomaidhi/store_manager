import { NextResponse } from "next/server";
import { syncStore } from "@/lib/store-service";

// Leaves headroom for the inline wait plus Outscraper round-trips; big pulls
// keep running on Outscraper's side and are picked up by later requests.
export const maxDuration = 120;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await syncStore(id);
    return NextResponse.json(result, {
      status: result.status === "pending" ? 202 : 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    console.error("[api/stores/[id]/sync]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
