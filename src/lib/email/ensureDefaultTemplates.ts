import connectDB from "@/lib/mongodb";
import EmailTemplateModel from "@/models/EmailTemplate";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/email/defaultEmailTemplates";

/** Seed missing rows once per collection; does not overwrite edited templates. */
export async function ensureDefaultTemplates(): Promise<void> {
  await connectDB();
  for (const def of DEFAULT_EMAIL_TEMPLATES) {
    const existing = await EmailTemplateModel.findOne({ key: def.key }).lean();
    if (existing) continue;
    await EmailTemplateModel.create({
      key: def.key,
      name: def.name,
      description: def.description,
      subject: def.subject,
      bodyHtml: def.bodyHtml,
      enabled: true,
      sortOrder: def.sortOrder,
    });
  }
}
