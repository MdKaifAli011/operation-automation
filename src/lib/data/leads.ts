import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import LeadModel from "@/models/Lead";
import { serializeLead } from "@/lib/serializers";
import type { Lead } from "@/lib/types";

export async function getLeadById(id: string): Promise<Lead | null> {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const doc = await LeadModel.findById(id).lean();
  if (!doc) return null;
  return serializeLead(doc as Parameters<typeof serializeLead>[0]);
}
