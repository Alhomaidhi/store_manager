import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { getStoreReport } from "@/lib/reports";

function errorJson(err: unknown, status = 500) {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[api/stores/[id]]", err);
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const report = await getStoreReport(id);
    if (!report) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ report });
  } catch (err) {
    return errorJson(err);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await ensureSchema();
    const rows = (await sql`
      DELETE FROM stores WHERE id = ${id} RETURNING id
    `) as Array<{ id: string }>;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorJson(err);
  }
}
