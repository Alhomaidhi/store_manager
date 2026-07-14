import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const CANDIDATE_ENV_VARS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_PRISMA_URL",
];

function summarizeUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}${u.pathname}`;
  } catch {
    return "unparseable";
  }
}

export async function GET() {
  const envPresence: Record<string, boolean> = {};
  for (const name of CANDIDATE_ENV_VARS) {
    envPresence[name] = !!process.env[name];
  }

  const allEnvKeys = Object.keys(process.env);
  const postgresLikeKeys = allEnvKeys.filter((k) =>
    /postgres|database|neon|pg_/i.test(k)
  );

  const hasGoogleKey = !!process.env.GOOGLE_PLACES_API_KEY;

  const chosenUrl =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING;

  const info: {
    envPresence: Record<string, boolean>;
    postgresLikeEnvKeys: string[];
    hasGoogleKey: boolean;
    chosenConnection: string | null;
    dbPing: { ok: boolean; error?: string; result?: unknown };
    region: string | null;
  } = {
    envPresence,
    postgresLikeEnvKeys: postgresLikeKeys,
    hasGoogleKey,
    chosenConnection: summarizeUrl(chosenUrl),
    dbPing: { ok: false },
    region: process.env.VERCEL_REGION ?? null,
  };

  try {
    const rows = (await sql`SELECT 1 as ok`) as Array<{ ok: number }>;
    info.dbPing = { ok: true, result: rows[0]?.ok };
  } catch (err) {
    info.dbPing = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return NextResponse.json(info, { status: info.dbPing.ok ? 200 : 500 });
}
