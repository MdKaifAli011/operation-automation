import connectDB from "@/lib/mongodb";
import ExamBrochureTemplateModel from "@/models/ExamBrochureTemplate";
import {
  brochureItemsFromDoc,
  type BrochureTemplateItem,
} from "@/lib/examBrochureTemplates";
import { getAppBaseUrl } from "@/lib/email/appBaseUrl";

type LeanLeadExams = {
  targetExams?: string[];
};

function absUrl(pathOrUrl: string): string {
  const t = pathOrUrl.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  const base = getAppBaseUrl();
  if (t.startsWith("/")) return `${base}${t}`;
  return `${base}/${t}`;
}

function hrefFromBrochureItem(b: BrochureTemplateItem): string {
  const stored = b.storedFileUrl?.trim();
  const link = b.linkUrl?.trim();
  const u = stored || link;
  if (!u) return "";
  return absUrl(u);
}

/**
 * Resolves brochure row keys (`{exam}-{brochureKey}`) to openable URLs for this lead's target exams.
 * Order matches `selectionKeys` (duplicates ignored after first).
 */
export async function resolveBrochureEmailItemsOrdered(
  lead: LeanLeadExams,
  selectionKeys: string[],
): Promise<Array<{ key: string; title: string; href: string }>> {
  await connectDB();
  const docs = await ExamBrochureTemplateModel.find({}).lean();
  const exams = Array.isArray(lead.targetExams)
    ? lead.targetExams.filter((x) => typeof x === "string" && x.trim())
    : [];

  const byComposite = new Map<string, { title: string; href: string }>();

  for (const exam of exams) {
    const seen = new Set<string>();
    for (const d of docs) {
      const e = typeof d.exam === "string" ? d.exam.trim() : "";
      if (e !== exam && e.toLowerCase() !== exam.toLowerCase()) continue;
      for (const b of brochureItemsFromDoc(d)) {
        const composite = `${exam}-${b.key}`;
        if (seen.has(composite)) continue;
        seen.add(composite);
        const href = hrefFromBrochureItem(b);
        if (!href) continue;
        const baseTitle = (b.title ?? "").trim() || "Course document";
        byComposite.set(composite, {
          title: `${exam} · ${baseTitle}`,
          href,
        });
      }
    }
  }

  const out: Array<{ key: string; title: string; href: string }> = [];
  const seen = new Set<string>();
  for (const k of selectionKeys) {
    const key = String(k ?? "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const hit = byComposite.get(key);
    if (!hit) {
      throw new Error(
        `Invalid brochure selection "${key}". It may not exist for this lead's exams or has no document URL.`,
      );
    }
    out.push({ key, title: hit.title, href: hit.href });
  }
  return out;
}
