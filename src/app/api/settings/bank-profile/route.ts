import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import {
  docToBankPayload,
  parseBankPutBody,
} from "@/lib/bankProfilePayload";
import { migrateLegacyBankProfileIfNeeded } from "@/lib/migrateLegacyBankProfile";
import type { BankAccountRecord } from "@/lib/instituteProfileTypes";
import BankProfileSettingsModel from "@/models/BankProfileSettings";

export const runtime = "nodejs";

const SETTINGS_KEY = "default";

export async function GET() {
  try {
    await migrateLegacyBankProfileIfNeeded();
    await connectDB();
    const doc = await BankProfileSettingsModel.findOne({
      key: SETTINGS_KEY,
    })
      .lean()
      .exec();
    if (!doc) {
      return NextResponse.json({
        ...docToBankPayload({}),
        updatedAt: null as string | null,
      });
    }
    const { bankAccounts, defaultFeeBankAccountId, updatedAt } = doc as {
      bankAccounts?: BankAccountRecord[];
      defaultFeeBankAccountId?: string | null;
      updatedAt?: Date;
    };
    return NextResponse.json({
      ...docToBankPayload({
        bankAccounts,
        defaultFeeBankAccountId,
      }),
      updatedAt:
        updatedAt instanceof Date ? updatedAt.toISOString() : null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not load bank profile." },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = parseBankPutBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    await migrateLegacyBankProfileIfNeeded();
    await connectDB();
    const doc = await BankProfileSettingsModel.findOneAndUpdate(
      { key: SETTINGS_KEY },
      {
        $set: {
          bankAccounts: parsed.data.bankAccounts,
          defaultFeeBankAccountId: parsed.data.defaultFeeBankAccountId,
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    )
      .lean()
      .exec();
    if (!doc) {
      return NextResponse.json(
        { error: "Could not save bank profile." },
        { status: 500 },
      );
    }
    const { bankAccounts, defaultFeeBankAccountId, updatedAt } = doc as {
      bankAccounts?: BankAccountRecord[];
      defaultFeeBankAccountId?: string | null;
      updatedAt?: Date;
    };
    return NextResponse.json({
      ...docToBankPayload({
        bankAccounts,
        defaultFeeBankAccountId,
      }),
      updatedAt:
        updatedAt instanceof Date ? updatedAt.toISOString() : null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not save bank profile." },
      { status: 500 },
    );
  }
}
