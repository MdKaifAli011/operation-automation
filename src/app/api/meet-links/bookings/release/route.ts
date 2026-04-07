import { NextResponse } from "next/server";
import { releaseMeetBookingForRow } from "@/lib/meetLinks/assignMeetLink";

export const runtime = "nodejs";

/** Release Google Meet and teacher-slot holds for this demo row (remove row, cancel, or completed). */
export async function POST(req: Request) {
  let body: { leadId?: unknown; meetRowId?: unknown };
  try {
    body = (await req.json()) as { leadId?: unknown; meetRowId?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const leadId = typeof body.leadId === "string" ? body.leadId.trim() : "";
  const meetRowId = typeof body.meetRowId === "string" ? body.meetRowId.trim() : "";
  if (!leadId || !meetRowId) {
    return NextResponse.json(
      { error: "leadId and meetRowId are required." },
      { status: 400 },
    );
  }
  await releaseMeetBookingForRow(leadId, meetRowId);
  return NextResponse.json({ ok: true });
}
