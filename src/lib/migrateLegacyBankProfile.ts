import connectDB from "@/lib/mongodb";
import BankProfileSettingsModel from "@/models/BankProfileSettings";
import InstituteProfileSettingsModel from "@/models/InstituteProfileSettings";
import { normBankAccountId } from "@/lib/instituteProfileTypes";

const SETTINGS_KEY = "default";

/**
 * One-time move: bank data used to live on `institute_profile_settings`.
 * Copy into `bank_profile_settings` and remove from the institute document.
 */
export async function migrateLegacyBankProfileIfNeeded(): Promise<void> {
  await connectDB();

  const rawInstitute = (await InstituteProfileSettingsModel.collection.findOne({
    key: SETTINGS_KEY,
  })) as Record<string, unknown> | null;

  const legacyAccounts = rawInstitute?.bankAccounts;
  const legacyDef = rawInstitute?.defaultFeeBankAccountId;
  const legacyHas =
    (Array.isArray(legacyAccounts) && legacyAccounts.length > 0) ||
    normBankAccountId(legacyDef).length > 0;

  if (!legacyHas) return;

  const existing = await BankProfileSettingsModel.findOne({
    key: SETTINGS_KEY,
  })
    .lean()
    .exec();

  const existingHas =
    existing &&
    ((Array.isArray(existing.bankAccounts) && existing.bankAccounts.length > 0) ||
      normBankAccountId(existing.defaultFeeBankAccountId).length > 0);

  if (existingHas) {
    await InstituteProfileSettingsModel.collection.updateOne(
      { key: SETTINGS_KEY },
      { $unset: { bankAccounts: "", defaultFeeBankAccountId: "" } },
    );
    return;
  }

  await BankProfileSettingsModel.findOneAndUpdate(
    { key: SETTINGS_KEY },
    {
      $set: {
        bankAccounts: Array.isArray(legacyAccounts) ? legacyAccounts : [],
        defaultFeeBankAccountId:
          legacyDef != null && String(legacyDef).trim()
            ? String(legacyDef).trim().slice(0, 64)
            : null,
      },
    },
    { upsert: true },
  );

  await InstituteProfileSettingsModel.collection.updateOne(
    { key: SETTINGS_KEY },
    { $unset: { bankAccounts: "", defaultFeeBankAccountId: "" } },
  );
}
