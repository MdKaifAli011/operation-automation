import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { migrateLegacyBankProfileIfNeeded } from "@/lib/migrateLegacyBankProfile";
import {
  DEFAULT_INSTITUTE,
  type InstituteProfilePayload,
  type InstituteRecord,
} from "@/lib/instituteProfileTypes";
import InstituteProfileSettingsModel from "@/models/InstituteProfileSettings";

export const runtime = "nodejs";

const SETTINGS_KEY = "default";

function str(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function parseInstitute(raw: unknown): InstituteRecord {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_INSTITUTE };
  }
  const o = raw as Record<string, unknown>;
  return {
    instituteName: str(o.instituteName, 200),
    regNo: str(o.regNo, 120),
    gst: str(o.gst, 32),
    feeGstPercent: num(o.feeGstPercent, DEFAULT_INSTITUTE.feeGstPercent, 0, 100),
    inrPerUsd: num(o.inrPerUsd, DEFAULT_INSTITUTE.inrPerUsd, 0.0001, 1_000_000),
    inrPerAed: num(o.inrPerAed, DEFAULT_INSTITUTE.inrPerAed, 0.0001, 1_000_000),
    address: str(o.address, 2000),
    city: str(o.city, 120),
    state: str(o.state, 120),
    country: str(o.country, 120),
    pincode: str(o.pincode, 24),
    phone: str(o.phone, 40),
    email: str(o.email, 200),
    website: str(o.website, 500),
  };
}

function parsePayload(body: unknown):
  | { ok: true; data: InstituteProfilePayload }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid JSON body." };
  }
  const b = body as Record<string, unknown>;
  return {
    ok: true,
    data: { institute: parseInstitute(b.institute) },
  };
}

function docToPayload(doc: { institute?: unknown }): InstituteProfilePayload {
  return { institute: parseInstitute(doc.institute) };
}

export async function GET() {
  try {
    await migrateLegacyBankProfileIfNeeded();
    await connectDB();
    const doc = await InstituteProfileSettingsModel.findOne({
      key: SETTINGS_KEY,
    })
      .lean()
      .exec();
    if (!doc) {
      return NextResponse.json({
        ...docToPayload({}),
        updatedAt: null as string | null,
      });
    }
    const { institute, updatedAt } = doc as {
      institute?: InstituteRecord;
      updatedAt?: Date;
    };
    return NextResponse.json({
      ...docToPayload({ institute }),
      updatedAt:
        updatedAt instanceof Date ? updatedAt.toISOString() : null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not load institute profile." },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = parsePayload(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    await connectDB();
    const doc = await InstituteProfileSettingsModel.findOneAndUpdate(
      { key: SETTINGS_KEY },
      {
        $set: {
          institute: parsed.data.institute,
        },
        $unset: {
          paymentOptions: "",
          bankAccounts: "",
          defaultFeeBankAccountId: "",
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    )
      .lean()
      .exec();
    if (!doc) {
      return NextResponse.json(
        { error: "Could not save institute profile." },
        { status: 500 },
      );
    }
    const { institute, updatedAt } = doc as {
      institute?: InstituteRecord;
      updatedAt?: Date;
    };
    return NextResponse.json({
      ...docToPayload({ institute }),
      updatedAt:
        updatedAt instanceof Date ? updatedAt.toISOString() : null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not save institute profile." },
      { status: 500 },
    );
  }
}
