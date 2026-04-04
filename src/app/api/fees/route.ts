import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import FeeRecordModel from "@/models/FeeRecord";
import { serializeFeeRecord } from "@/lib/serializers";

export const runtime = "nodejs";

export async function GET() {
  try {
    await connectDB();
    const docs = await FeeRecordModel.find({}).sort({ studentName: 1 }).lean();
    return NextResponse.json(
      docs.map((d) =>
        serializeFeeRecord(d as Parameters<typeof serializeFeeRecord>[0]),
      ),
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not load fee records." },
      { status: 500 },
    );
  }
}
