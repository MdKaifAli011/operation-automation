import { NextResponse } from "next/server";
import {
  currentIstDateString,
  refreshDailyCurrencyFx,
} from "@/lib/currencyApiFx";

export const runtime = "nodejs";

function authorize(req: Request): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;
  const auth = req.headers.get("authorization");
  const bearer =
    auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const headerSecret = req.headers.get("x-cron-secret")?.trim() ?? "";
  const q = new URL(req.url).searchParams.get("secret")?.trim() ?? "";
  return bearer === expected || headerSecret === expected || q === expected;
}

/**
 * Daily CurrencyAPI sync (max one external request per IST calendar day).
 * Intended schedule: 6:00 AM IST = 00:30 UTC — see `docs/vps-hosting.md`.
 *
 * Secure with `CRON_SECRET` (Authorization: Bearer, x-cron-secret, or ?secret=).
 */
export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  if (!process.env.CURRENCYAPI_KEY?.trim()) {
    return NextResponse.json(
      { error: "CURRENCYAPI_KEY is not configured." },
      { status: 503 },
    );
  }
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 503 },
    );
  }
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  try {
    const result = await refreshDailyCurrencyFx({ force });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ...result,
      istNow: currentIstDateString(),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Refresh failed." },
      { status: 500 },
    );
  }
}
