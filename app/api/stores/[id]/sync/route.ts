import { NextResponse } from "next/server";
import { syncStore } from "@/lib/store-service";

// Full review pulls run as async Outscraper jobs that can take minutes.
export const maxDuration = 300;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await syncStore(id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    console.error("[api/stores/[id]/sync]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
