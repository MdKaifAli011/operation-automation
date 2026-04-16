import mongoose, { Schema } from "mongoose";

/** Singleton row: last successful CurrencyAPI pull (one external request per IST calendar day max). */
const CurrencyFxSnapshotSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "singleton" },
    /** yyyy-MM-dd in Asia/Kolkata — the “day” this rate applies to. */
    istDate: { type: String, default: "" },
    inrPerUsd: { type: Number, required: true, min: 0.0001 },
    inrPerAed: { type: Number, required: true, min: 0.0001 },
    fetchedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

export type CurrencyFxSnapshotDocument = mongoose.InferSchemaType<
  typeof CurrencyFxSnapshotSchema
>;

const CurrencyFxSnapshotModel =
  mongoose.models.CurrencyFxSnapshot ??
  mongoose.model(
    "CurrencyFxSnapshot",
    CurrencyFxSnapshotSchema,
    "currency_fx_snapshots",
  );

export default CurrencyFxSnapshotModel;
