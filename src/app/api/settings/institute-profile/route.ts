import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import {
  DEFAULT_INSTITUTE,
  MAX_BANK_ACCOUNTS,
  type BankAccountRecord,
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

function parseInstitute(raw: unknown): InstituteRecord {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_INSTITUTE };
  }
  const o = raw as Record<string, unknown>;
  return {
    instituteName: str(o.instituteName, 200),
    regNo: str(o.regNo, 120),
    gst: str(o.gst, 32),
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

function parseBankAccount(raw: unknown): BankAccountRecord | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = str(o.id, 64);
  if (!id) return null;
  const accountType =
    o.accountType === "Savings" ? "Savings" : "Current";
  return {
    id,
    label: str(o.label, 120),
    bankName: str(o.bankName, 120),
    accountHolderName: str(o.accountHolderName, 120),
    accountNumber: str(o.accountNumber, 40).replace(/\s+/g, ""),
    ifsc: str(o.ifsc, 20).toUpperCase(),
    branch: str(o.branch, 120),
    accountType,
    upi: str(o.upi, 120),
    isActive: o.isActive !== false,
  };
}

function parsePayload(body: unknown):
  | { ok: true; data: InstituteProfilePayload }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid JSON body." };
  }
  const b = body as Record<string, unknown>;
  const institute = parseInstitute(b.institute);
  const rawAccounts = b.bankAccounts;
  if (rawAccounts !== undefined && !Array.isArray(rawAccounts)) {
    return { ok: false, error: "bankAccounts must be an array." };
  }
  const bankAccounts: BankAccountRecord[] = [];
  const seen = new Set<string>();
  if (Array.isArray(rawAccounts)) {
    for (const row of rawAccounts) {
      const acc = parseBankAccount(row);
      if (!acc) continue;
      if (seen.has(acc.id)) continue;
      seen.add(acc.id);
      bankAccounts.push(acc);
    }
  }
  if (bankAccounts.length > MAX_BANK_ACCOUNTS) {
    return {
      ok: false,
      error: `At most ${MAX_BANK_ACCOUNTS} bank accounts allowed.`,
    };
  }
  return {
    ok: true,
    data: { institute, bankAccounts },
  };
}

function docToPayload(doc: {
  institute?: unknown;
  bankAccounts?: unknown;
}): InstituteProfilePayload {
  const institute = parseInstitute(doc.institute);
  const bankAccounts = Array.isArray(doc.bankAccounts)
    ? doc.bankAccounts
        .map((row) => parseBankAccount(row))
        .filter((x): x is BankAccountRecord => x !== null)
    : [];
  return { institute, bankAccounts };
}

export async function GET() {
  try {
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
    const { institute, bankAccounts, updatedAt } = doc as {
      institute?: InstituteRecord;
      bankAccounts?: BankAccountRecord[];
      updatedAt?: Date;
    };
    return NextResponse.json({
      ...docToPayload({ institute, bankAccounts }),
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
          bankAccounts: parsed.data.bankAccounts,
        },
        $unset: { paymentOptions: "" },
      },
      { upsert: true, new: true, runValidators: true },
    )
      .lean()
      .exec();
    if (!doc) {
      return NextResponse.json(
        { error: "Could not save institute profile." },
        { status: 500 },
      );
    }
    const { institute, bankAccounts, updatedAt } = doc as {
      institute?: InstituteRecord;
      bankAccounts?: BankAccountRecord[];
      updatedAt?: Date;
    };
    return NextResponse.json({
      ...docToPayload({ institute, bankAccounts }),
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
