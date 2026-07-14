import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { getStoreReport } from "@/lib/reports";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const report = await getStoreReport(id);
  if (!report) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ report });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await ensureSchema();
  const rows = (await sql`
    DELETE FROM stores WHERE id = ${id} RETURNING id
  `) as Array<{ id: string }>;
  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
