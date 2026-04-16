import connectDB from "@/lib/mongodb";
import CurrencyFxSnapshotModel from "@/models/CurrencyFxSnapshot";
import InstituteProfileSettingsModel from "@/models/InstituteProfileSettings";
import {
  DEFAULT_INSTITUTE,
  type InstituteRecord,
} from "@/lib/instituteProfileTypes";

const SETTINGS_KEY = "default";

/** Exposed on GET /api/settings/institute-profile for UI (last CurrencyAPI sync). */
export type CurrencyFxPublic = {
  istDate: string | null;
  inrPerUsd: number | null;
  inrPerAed: number | null;
  fetchedAt: string | null;
};

/** Calendar date yyyy-MM-dd in Asia/Kolkata (IST). */
export function currentIstDateString(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

type CurrencyApiLatestResponse = {
  data?: Record<
    string,
    {
      code?: string;
      value?: number;
    }
  >;
  meta?: { last_updated_at?: string };
};

type CurrencyApiNetRatesResponse = {
  valid?: boolean;
  base?: string;
  rates?: Record<string, number | string>;
  updated?: number;
  message?: string;
};

function clampFx(n: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Fetches USD-based latest rates and derives INR per 1 USD and INR per 1 AED.
 * One HTTP call to CurrencyAPI.
 */
export async function fetchCurrencyApiUsdBasedRates(apiKey: string): Promise<{
  inrPerUsd: number;
  inrPerAed: number;
}> {
  const key = apiKey.trim().replace(/^\uFEFF/, "");
  const v3Url = new URL("https://api.currencyapi.com/v3/latest");
  v3Url.searchParams.set("base_currency", "USD");

  const v3Res = await fetch(v3Url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      apikey: key,
    },
    next: { revalidate: 0 },
  });

  const v3Raw = (await v3Res.json().catch(() => ({}))) as CurrencyApiLatestResponse & {
    message?: string;
  };

  if (v3Res.ok) {
    const data = v3Raw.data ?? {};
    const usdToInr = data.INR?.value;
    const usdToAed = data.AED?.value;

    const inrPerUsd = clampFx(
      typeof usdToInr === "number" ? usdToInr : Number(usdToInr),
      DEFAULT_INSTITUTE.inrPerUsd,
      1,
      1_000_000,
    );

    let inrPerAed: number;
    if (
      typeof usdToAed === "number" &&
      Number.isFinite(usdToAed) &&
      usdToAed > 0
    ) {
      inrPerAed = clampFx(
        inrPerUsd / usdToAed,
        DEFAULT_INSTITUTE.inrPerAed,
        0.0001,
        1_000_000,
      );
    } else {
      inrPerAed = DEFAULT_INSTITUTE.inrPerAed;
    }

    return { inrPerUsd, inrPerAed };
  }

  // Fallback: support keys that are provisioned on currencyapi.net v2.
  const netUrl = new URL("https://currencyapi.net/api/v2/rates");
  netUrl.searchParams.set("base", "USD");
  netUrl.searchParams.set("output", "json");
  netUrl.searchParams.set("key", key);

  const netRes = await fetch(netUrl.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });
  const netRaw = (await netRes.json().catch(() => ({}))) as CurrencyApiNetRatesResponse;

  if (!netRes.ok || netRaw.valid !== true) {
    const v3Msg =
      typeof v3Raw?.message === "string" && v3Raw.message
        ? v3Raw.message
        : `CurrencyAPI HTTP ${v3Res.status}`;
    const netMsg =
      typeof netRaw?.message === "string" && netRaw.message
        ? netRaw.message
        : `currencyapi.net HTTP ${netRes.status}`;
    throw new Error(`${v3Msg}; fallback failed: ${netMsg}`);
  }

  const usdToInr = Number(netRaw.rates?.INR);
  const usdToAed = Number(netRaw.rates?.AED);
  const inrPerUsd = clampFx(usdToInr, DEFAULT_INSTITUTE.inrPerUsd, 1, 1_000_000);
  const inrPerAed =
    Number.isFinite(usdToAed) && usdToAed > 0
      ? clampFx(
          inrPerUsd / usdToAed,
          DEFAULT_INSTITUTE.inrPerAed,
          0.0001,
          1_000_000,
        )
      : DEFAULT_INSTITUTE.inrPerAed;

  return { inrPerUsd, inrPerAed };
}

export type RefreshCurrencyFxResult =
  | {
      ok: true;
      skipped: true;
      reason: "already_fetched_today_ist";
      istDate: string;
      inrPerUsd: number;
      inrPerAed: number;
      fetchedAt: string;
    }
  | {
      ok: true;
      skipped: false;
      istDate: string;
      inrPerUsd: number;
      inrPerAed: number;
      fetchedAt: string;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * At most one CurrencyAPI request per IST calendar day.
 * Persists snapshot + updates `institute_profile_settings.default.institute` FX fields
 * so Fees step, PDFs, and emails all read the same numbers.
 */
export async function refreshDailyCurrencyFx(options?: {
  force?: boolean;
}): Promise<RefreshCurrencyFxResult> {
  const apiKey = process.env.CURRENCYAPI_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "CURRENCYAPI_KEY is not configured." };
  }

  await connectDB();

  const todayIst = currentIstDateString();
  const existing = await CurrencyFxSnapshotModel.findOne({
    key: "singleton",
  })
    .lean()
    .exec();

  const snap =
    existing && typeof existing === "object"
      ? (existing as {
          istDate?: string;
          inrPerUsd?: number;
          inrPerAed?: number;
          fetchedAt?: Date;
        })
      : null;

  if (
    !options?.force &&
    snap &&
    String(snap.istDate ?? "").trim() === todayIst &&
    typeof snap.inrPerUsd === "number" &&
    Number.isFinite(snap.inrPerUsd)
  ) {
    return {
      ok: true,
      skipped: true,
      reason: "already_fetched_today_ist",
      istDate: todayIst,
      inrPerUsd: snap.inrPerUsd,
      inrPerAed:
        typeof snap.inrPerAed === "number" && Number.isFinite(snap.inrPerAed)
          ? snap.inrPerAed
          : DEFAULT_INSTITUTE.inrPerAed,
      fetchedAt:
        snap.fetchedAt instanceof Date
          ? snap.fetchedAt.toISOString()
          : new Date().toISOString(),
    };
  }

  let rates: { inrPerUsd: number; inrPerAed: number };
  try {
    rates = await fetchCurrencyApiUsdBasedRates(apiKey);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "CurrencyAPI request failed.";
    return { ok: false, error: msg };
  }

  const fetchedAt = new Date();

  await CurrencyFxSnapshotModel.findOneAndUpdate(
    { key: "singleton" },
    {
      $set: {
        istDate: todayIst,
        inrPerUsd: rates.inrPerUsd,
        inrPerAed: rates.inrPerAed,
        fetchedAt,
      },
    },
    { upsert: true, new: true, runValidators: true },
  ).exec();

  const instDoc = await InstituteProfileSettingsModel.findOne({
    key: SETTINGS_KEY,
  })
    .lean()
    .exec();
  const prevInst =
    instDoc &&
    typeof instDoc === "object" &&
    "institute" in instDoc &&
    instDoc.institute &&
    typeof instDoc.institute === "object"
      ? (instDoc.institute as Record<string, unknown>)
      : {};
  const mergedInst: InstituteRecord = {
    ...(DEFAULT_INSTITUTE as InstituteRecord),
    ...(prevInst as Partial<InstituteRecord>),
    inrPerUsd: rates.inrPerUsd,
    inrPerAed: rates.inrPerAed,
  };

  await InstituteProfileSettingsModel.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { $set: { institute: mergedInst } },
    { upsert: true, runValidators: true },
  ).exec();

  return {
    ok: true,
    skipped: false,
    istDate: todayIst,
    inrPerUsd: rates.inrPerUsd,
    inrPerAed: rates.inrPerAed,
    fetchedAt: fetchedAt.toISOString(),
  };
}

export async function getCurrencyFxSnapshotForStatus(): Promise<CurrencyFxPublic | null> {
  await connectDB();
  const doc = await CurrencyFxSnapshotModel.findOne({ key: "singleton" })
    .lean()
    .exec();
  if (!doc || typeof doc !== "object") return null;
  const d = doc as {
    istDate?: string;
    inrPerUsd?: number;
    inrPerAed?: number;
    fetchedAt?: Date;
  };
  return {
    istDate: d.istDate?.trim() || null,
    inrPerUsd:
      typeof d.inrPerUsd === "number" && Number.isFinite(d.inrPerUsd)
        ? d.inrPerUsd
        : null,
    inrPerAed:
      typeof d.inrPerAed === "number" && Number.isFinite(d.inrPerAed)
        ? d.inrPerAed
        : null,
    fetchedAt:
      d.fetchedAt instanceof Date ? d.fetchedAt.toISOString() : null,
  };
}
