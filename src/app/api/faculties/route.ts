import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import FacultyModel from "@/models/Faculty";
import { serializeFaculty } from "@/lib/serializers";

export const runtime = "nodejs";

export async function GET() {
  try {
    await connectDB();
    const docs = await FacultyModel.find({}).sort({ name: 1 }).lean();
    return NextResponse.json(
      docs.map((d) =>
        serializeFaculty(d as Parameters<typeof serializeFaculty>[0]),
      ),
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not load faculty." },
      { status: 500 },
    );
  }
}
