"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { copyTextToClipboard } from "@/lib/copyToClipboard";
import { cn } from "@/lib/cn";
import { buildEmailPreviewHtml } from "@/lib/email/emailPreviewHtml";
import { getPreviewSampleVars } from "@/lib/email/previewSampleVars";
import { renderTemplate } from "@/lib/email/renderTemplate";
import {
  ensureBrochureBundleHtmlInRenderedHtml,
  ensureFeeBankDetailsInRenderedHtml,
} from "@/lib/email/templateRenderedEnsures";
import {
  EMAIL_TEMPLATE_META,
  type EmailTemplateKey,
} from "@/lib/email/templateKeys";

type TemplateRow = {
  key: EmailTemplateKey;
  name: string;
  description: string;
  subject: string;
  bodyHtml: string;
  enabled: boolean;
};

const PIPELINE_ORDER: EmailTemplateKey[] = [
  "demo_invite",
  "brochure",
  "fees",
  "enrollment",
  "schedule",
];

const PIPELINE_TOTAL = PIPELINE_ORDER.length;

function stepBadgeIndex(key: EmailTemplateKey): number {
  const i = PIPELINE_ORDER.indexOf(key);
  return i >= 0 ? i + 1 : 0;
}

function ChevronIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      className={cn(
        "h-5 w-5 shrink-0 text-[#9e9e9e] transition-transform duration-200",
        open && "rotate-180 text-[#1565c0]",
        className,
      )}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TemplatesSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading templates">
      {PIPELINE_ORDER.map((k) => (
        <div
          key={k}
          className="overflow-hidden border border-[#e0e0e0] bg-white p-4 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 animate-pulse bg-[#e8eaf0]" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="h-4 w-44 animate-pulse bg-[#e8eaf0]" />
              <div className="h-3 w-full max-w-lg animate-pulse bg-[#f0f0f0]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const btnOutline =
  "inline-flex items-center justify-center border border-[#e0e0e0] bg-white px-4 py-2 text-sm font-medium text-[#424242] transition-colors hover:bg-[#fafafa]";
const btnGreen =
  "inline-flex items-center justify-center bg-[#2e7d32] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-60";

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#757575]">
      {children}
    </h3>
  );
}

function TemplateEditorPanel({
  r,
  patchRow,
  copiedPh,
  setCopiedPh,
}: {
  r: TemplateRow;
  patchRow: (key: EmailTemplateKey, patch: Partial<TemplateRow>) => void;
  copiedPh: string | null;
  setCopiedPh: Dispatch<SetStateAction<string | null>>;
}) {
  const meta = EMAIL_TEMPLATE_META[r.key];
  const previewVars = useMemo(() => getPreviewSampleVars(r.key), [r.key]);
  const previewSubject = useMemo(
    () => renderTemplate(r.subject, previewVars),
    [r.subject, previewVars],
  );
  const previewBodyHtml = useMemo(() => {
    let html = renderTemplate(r.bodyHtml, previewVars);
    if (r.key === "fees") {
      html = ensureFeeBankDetailsInRenderedHtml(
        r.bodyHtml,
        html,
        previewVars.feeBankDetailsHtml ?? "",
      );
    }
    if (r.key === "brochure") {
      html = ensureBrochureBundleHtmlInRenderedHtml(
        r.bodyHtml,
        html,
        previewVars.brochureBundleHtml ?? "",
      );
    }
    return html;
  }, [r.bodyHtml, r.key, previewVars]);
  const iframeSrcDoc = useMemo(
    () => buildEmailPreviewHtml(previewBodyHtml),
    [previewBodyHtml],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {meta?.editorTips && meta.editorTips.length > 0 ? (
        <div className="border border-[#e1f5fe] bg-[#f1f8ff] p-4 shadow-sm">
          <SectionLabel>How this email sends</SectionLabel>
          <ul className="mt-2 list-inside list-disc space-y-1.5 text-[13px] leading-snug text-[#37474f]">
            {meta.editorTips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Delivery toggle */}
      <div className="border border-[#e0e0e0] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <SectionLabel>Delivery</SectionLabel>
            <p className="mt-1.5 text-sm leading-snug text-[#616161]">
              Disabled templates cannot be sent from a student lead until turned
              on again.
            </p>
          </div>
          <label className="flex cursor-pointer select-none items-center gap-3 border border-[#e0e0e0] bg-[#fafafa] px-4 py-3 sm:shrink-0">
            <input
              type="checkbox"
              className="h-4 w-4 rounded-none border-[#bdbdbd] text-[#1565c0] focus:ring-2 focus:ring-[#1565c0]/30"
              checked={r.enabled}
              onChange={(e) =>
                patchRow(r.key, {
                  enabled: e.target.checked,
                })
              }
            />
            <span className="text-sm font-semibold text-[#212121]">
              {r.enabled ? (
                <span className="text-[#2e7d32]">On — will send</span>
              ) : (
                <span className="text-[#9e9e9e]">Off — blocked</span>
              )}
            </span>
          </label>
        </div>
      </div>

      {/* Subject */}
      <div className="border border-[#e0e0e0] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor={`sub-${r.key}`}>
            <SectionLabel>Email subject</SectionLabel>
          </label>
          <span className="text-[10px] text-[#9e9e9e]">
            Supports {"{{placeholders}}"}
          </span>
        </div>
        <input
          id={`sub-${r.key}`}
          className="mt-2 w-full border border-[#e0e0e0] bg-white px-3 py-2.5 text-sm text-[#212121] outline-none transition-shadow placeholder:text-[#bdbdbd] focus:border-[#1565c0] focus:shadow-[inset_0_0_0_1px_#1565c0]"
          value={r.subject}
          onChange={(e) => patchRow(r.key, { subject: e.target.value })}
          autoComplete="off"
          placeholder="e.g. Welcome — {{studentName}}"
        />
      </div>

      {/* Editor | Preview */}
      <div className="overflow-hidden border border-[#e0e0e0] bg-white shadow-sm">
        <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-[#e0e0e0]">
          <div className="flex flex-col p-4 sm:p-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <SectionLabel>HTML body</SectionLabel>
              <span className="font-mono text-[10px] font-medium text-[#9e9e9e]">
                monospace
              </span>
            </div>
            <textarea
              id={`body-${r.key}`}
              className="min-h-[260px] w-full flex-1 resize-y border border-[#e0e0e0] bg-[#fafafa] px-3 py-2.5 font-mono text-[13px] leading-relaxed text-[#212121] outline-none focus:border-[#1565c0] focus:bg-white focus:shadow-[inset_0_0_0_1px_#1565c0] lg:min-h-[320px]"
              value={r.bodyHtml}
              onChange={(e) => patchRow(r.key, { bodyHtml: e.target.value })}
              spellCheck={false}
              placeholder="<p>Hello {{parentName}},</p>"
            />
            <p className="mt-3 text-[11px] leading-relaxed text-[#757575]">
              Use tags like{" "}
              <code className="bg-[#eeeeee] px-1 py-0.5 font-mono text-[11px] text-[#424242]">
                &lt;p&gt;
              </code>
              ,{" "}
              <code className="bg-[#eeeeee] px-1 py-0.5 font-mono text-[11px] text-[#424242]">
                &lt;br /&gt;
              </code>
              ,{" "}
              <code className="bg-[#eeeeee] px-1 py-0.5 font-mono text-[11px] text-[#424242]">
                &lt;a href=&quot;…&quot;&gt;
              </code>
              . The preview updates as you type.
            </p>
          </div>

          <div className="flex flex-col border-t border-[#e0e0e0] bg-[#eceff1] p-4 sm:p-5 lg:border-t-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <SectionLabel>Live preview</SectionLabel>
              <span
                className="border border-[#ffe082] bg-[#fffde7] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#f57f17]"
                title="Not real lead data"
              >
                Preview placeholders
              </span>
            </div>
            <p className="mb-3 text-[11px] leading-relaxed text-[#546e7a]">
              Sample data only. For <strong>Fee</strong> and <strong>Brochure</strong>,
              the preview matches post-send behavior (including auto-appended bank /
              document blocks when placeholders are missing).
            </p>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm border border-[#cfd8dc] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
              <div className="shrink-0 border-b border-[#e0e0e0] bg-[#fafafa] px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#9e9e9e]">
                  Subject line
                </p>
                <p className="mt-1 break-words text-sm font-semibold leading-snug text-[#212121]">
                  {previewSubject.trim() ? previewSubject : "(empty subject)"}
                </p>
              </div>
              <iframe
                title={`Email preview: ${r.name}`}
                className="block min-h-[280px] w-full flex-1 border-0 bg-white sm:min-h-[360px] lg:min-h-[320px]"
                srcDoc={iframeSrcDoc}
                sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Placeholders */}
      {meta?.placeholders?.length ? (
        <div className="border border-[#e0e0e0] bg-[#fafafa] p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <SectionLabel>Placeholders you can use</SectionLabel>
            <span className="text-[10px] text-[#9e9e9e]">Click to copy</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {meta.placeholders.map((ph) => (
              <button
                key={ph}
                type="button"
                title={`Copy ${ph}`}
                className={cn(
                  "border px-2.5 py-1.5 font-mono text-[11px] transition-colors",
                  copiedPh === ph
                    ? "border-[#2e7d32] bg-[#e8f5e9] text-[#1b5e20]"
                    : "border-[#e0e0e0] bg-white text-[#424242] shadow-sm hover:border-[#1565c0] hover:bg-[#e3f2fd]",
                )}
                onClick={() => {
                  void copyTextToClipboard(ph).then((ok) => {
                    if (!ok) {
                      window.alert(
                        `Clipboard is not available. Copy this placeholder:\n\n${ph}`,
                      );
                      return;
                    }
                    setCopiedPh(ph);
                    window.setTimeout(() => {
                      setCopiedPh((c) => (c === ph ? null : c));
                    }, 1600);
                  });
                }}
              >
                {copiedPh === ph ? "Copied ✓" : ph}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function EmailTemplatesPage() {
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<EmailTemplateKey>>(
    () => new Set(),
  );
  const [copiedPh, setCopiedPh] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/email-templates", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load templates.");
      const data = (await res.json()) as {
        templates?: TemplateRow[];
        smtpConfigured?: boolean;
      };
      if (Array.isArray(data.templates)) {
        setRows(data.templates as TemplateRow[]);
      }
      setSmtpConfigured(Boolean(data.smtpConfigured));
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedRows = useMemo(() => {
    const order = new Map(PIPELINE_ORDER.map((k, i) => [k, i]));
    return [...rows].sort(
      (a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99),
    );
  }, [rows]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      const res = await fetch("/api/email-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates: rows }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "Save failed.");
      }
      const data = (await res.json()) as {
        templates?: TemplateRow[];
        smtpConfigured?: boolean;
      };
      if (Array.isArray(data.templates)) {
        setRows(data.templates as TemplateRow[]);
      }
      setSmtpConfigured(Boolean(data.smtpConfigured));
      setSavedAt(new Date().toISOString());
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [rows]);

  const patchRow = useCallback(
    (key: EmailTemplateKey, patch: Partial<TemplateRow>) => {
      setDirty(true);
      setRows((prev) =>
        prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
      );
    },
    [],
  );

  const allExpanded =
    sortedRows.length > 0 &&
    sortedRows.every((r) => expandedKeys.has(r.key));

  const toggleExpanded = useCallback((key: EmailTemplateKey) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const expandAllTemplates = useCallback(() => {
    setExpandedKeys(new Set(sortedRows.map((r) => r.key)));
  }, [sortedRows]);

  const collapseAllTemplates = useCallback(() => {
    setExpandedKeys(new Set());
  }, []);

  return (
    <div className="space-y-8">
      {/* Title + actions */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-xl font-bold text-[#212121]">
            Email Templates Management
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#757575]">
            Pipeline mail: demo invite, Step 2 documents (brochures + optional
            report), Step 3 fees (summary + bank details), enrollment link, class
            schedule. Each expandable card explains placeholders, live preview, and
            sending rules (e.g. BCC via{" "}
            <code className="border border-[#e0e0e0] bg-[#fafafa] px-1 py-0.5 font-mono text-[12px]">
              ENROLLMENT_TEAM_BCC
            </code>
            ). Use{" "}
            <code className="border border-[#e0e0e0] bg-[#fafafa] px-1 py-0.5 font-mono text-[12px]">
              {"{{placeholders}}"}
            </code>{" "}
            like{" "}
            <code className="border border-[#e0e0e0] bg-[#fafafa] px-1 py-0.5 font-mono text-[12px]">
              {"{{brochureBundleHtml}}"}
            </code>{" "}
            or{" "}
            <code className="border border-[#e0e0e0] bg-[#fafafa] px-1 py-0.5 font-mono text-[12px]">
              {"{{feeBankDetailsHtml}}"}
            </code>
            .
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-2">
          <div className="flex flex-wrap gap-2">
            <Link href="/" className={btnOutline}>
              Leads
            </Link>
            <button
              type="button"
              disabled={loading}
              onClick={() => void load()}
              className={btnOutline}
            >
              Refresh
            </button>
            <button
              type="button"
              disabled={saving || loading || !dirty}
              onClick={() => void save()}
              className={btnGreen}
            >
              {saving ? "Saving…" : "Save all"}
            </button>
          </div>
          <div className="flex min-h-[24px] flex-wrap items-center gap-2 border-t border-[#eeeeee] pt-2 sm:border-0 sm:pt-0">
            {dirty ? (
              <span className="inline-flex items-center gap-1.5 border border-[#ffe082] bg-[#fffde7] px-2 py-1 text-[11px] font-semibold text-[#f57f17]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#f57f17]" aria-hidden />
                Unsaved changes
              </span>
            ) : null}
            {savedAt && !dirty ? (
              <span className="inline-flex items-center gap-1.5 border border-[#c8e6c9] bg-[#e8f5e9] px-2 py-1 text-[11px] font-medium text-[#2e7d32]">
                Saved {new Date(savedAt).toLocaleString()}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div
          className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
          role="alert"
        >
          {error}{" "}
          <button
            type="button"
            className="font-semibold underline underline-offset-2"
            onClick={() => void load()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* SMTP */}
      <section
        className={cn(
          "border border-[#e0e0e0] bg-white shadow-sm",
          smtpConfigured ? "border-l-4 border-l-[#2e7d32]" : "border-l-4 border-l-[#c62828]",
        )}
      >
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#212121]">
                Outbound email (SMTP)
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#757575]">
                The server sends mail using your environment variables. Templates
                below only apply after SMTP is set up.
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 border px-3 py-1 text-xs font-bold uppercase tracking-wide",
                smtpConfigured
                  ? "border-[#c8e6c9] bg-[#e8f5e9] text-[#2e7d32]"
                  : "border-[#ffcdd2] bg-[#ffebee] text-[#c62828]",
              )}
            >
              {smtpConfigured ? "Ready" : "Not set"}
            </span>
          </div>
          <div className="mt-4 border-t border-[#eeeeee] pt-4">
            {!smtpConfigured ? (
              <ul className="list-inside list-disc space-y-1.5 text-sm text-[#424242]">
                <li>
                  Add{" "}
                  <code className="bg-[#ffebee] px-1 font-mono text-[13px] text-[#b71c1c]">
                    MAIL_HOST
                  </code>
                  ,{" "}
                  <code className="bg-[#ffebee] px-1 font-mono text-[13px] text-[#b71c1c]">
                    MAIL_PORT
                  </code>
                  ,{" "}
                  <code className="bg-[#ffebee] px-1 font-mono text-[13px] text-[#b71c1c]">
                    MAIL_USERNAME
                  </code>
                  ,{" "}
                  <code className="bg-[#ffebee] px-1 font-mono text-[13px] text-[#b71c1c]">
                    MAIL_PASSWORD
                  </code>{" "}
                  (or legacy{" "}
                  <code className="bg-[#f5f5f5] px-1 font-mono text-[13px]">SMTP_*</code>) to{" "}
                  <span className="font-semibold">.env</span>
                </li>
                <li>
                  Optional:{" "}
                  <code className="bg-[#f5f5f5] px-1 font-mono text-[13px]">
                    MAIL_FROM_NAME
                  </code>
                  ,{" "}
                  <code className="bg-[#f5f5f5] px-1 font-mono text-[13px]">
                    MAIL_FROM_ADDRESS
                  </code>
                  ,{" "}
                  <code className="bg-[#f5f5f5] px-1 font-mono text-[13px]">
                    EMAIL_FROM
                  </code>
                  ,{" "}
                  <code className="bg-[#f5f5f5] px-1 font-mono text-[13px]">
                    NEXT_PUBLIC_APP_URL
                  </code>{" "}
                  for links in emails
                </li>
                <li>
                  <code className="bg-[#f5f5f5] px-1 font-mono text-[13px]">
                    ENROLLMENT_FORM_LINK
                  </code>{" "}
                  (or{" "}
                  <code className="bg-[#f5f5f5] px-1 font-mono text-[13px]">
                    ENROLLMENT_FORM_URL
                  </code>
                  ): full URL for{" "}
                  <code className="bg-[#f5f5f5] px-1 font-mono text-[13px]">
                    {"{{enrollmentLink}}"}
                  </code>{" "}
                  in enrollment emails (student and BCC see the same message). Relative paths are resolved with{" "}
                  <code className="bg-[#f5f5f5] px-1 font-mono text-[13px]">
                    NEXT_PUBLIC_APP_URL
                  </code>
                  . If unset, defaults to{" "}
                  <code className="bg-[#f5f5f5] px-1 font-mono text-[13px]">
                    /enroll-student
                  </code>{" "}
                  on your app origin.
                </li>
                <li>
                  Fee emails: include{" "}
                  <code className="bg-[#f5f5f5] px-1 font-mono text-[13px]">
                    {"{{feeSummaryHtml}}"}
                  </code>{" "}
                  and{" "}
                  <code className="bg-[#f5f5f5] px-1 font-mono text-[13px]">
                    {"{{feeBankDetailsHtml}}"}
                  </code>{" "}
                  in the Fee template body (defaults are seeded for new installs). Bank rows follow the account on the
                  lead&rsquo;s Fees step or your institute default under Bank &amp; A/c Details.
                </li>
                <li>
                  <code className="bg-[#f5f5f5] px-1 font-mono text-[13px]">
                    ENROLLMENT_TEAM_BCC
                  </code>
                  : BCC enrollment on Documents (brochure) emails, fee emails, fee+enrollment bundle, demo invites, and teacher-feedback flows. Demo invites are sent from the student&apos;s Demo step when you click <strong>Send Now</strong> (assigning a Meet link no longer sends email automatically).
                </li>
              </ul>
            ) : (
              <div className="space-y-2 text-sm text-[#424242]">
                <p className="font-medium text-[#2e7d32]">
                  SMTP is configured. Pipeline actions on a student will send using
                  the templates below.
                </p>
                <p className="leading-snug text-[#616161]">
                  If logs show &ldquo;SMTP accepted&rdquo; but nobody receives mail: check Spam/Promotions, make sure{" "}
                  <code className="rounded bg-[#f5f5f5] px-1 font-mono text-[12px]">EMAIL_FROM</code> /{" "}
                  <code className="rounded bg-[#f5f5f5] px-1 font-mono text-[12px]">MAIL_FROM_ADDRESS</code> matches
                  your provider&rsquo;s allowed sender (or enable &ldquo;Send mail as&rdquo;), and set SPF/DKIM for your
                  domain. Optional:{" "}
                  <code className="rounded bg-[#f5f5f5] px-1 font-mono text-[12px]">MAIL_REPLY_TO</code> for replies,{" "}
                  <code className="rounded bg-[#f5f5f5] px-1 font-mono text-[12px]">MAIL_SMTP_DEBUG=1</code> for raw SMTP
                  traces in the server console.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Template list header */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-[#e0e0e0] pb-3">
        <div>
          <h2 className="text-lg font-bold text-[#212121]">Templates</h2>
          <p className="mt-1 text-sm text-[#757575]">
            {PIPELINE_TOTAL} pipeline steps · expand one to edit and preview
          </p>
        </div>
        <button
          type="button"
          className={btnOutline}
          onClick={allExpanded ? collapseAllTemplates : expandAllTemplates}
        >
          {allExpanded ? "Collapse all" : "Expand all"}
        </button>
      </div>

      {loading ? (
        <TemplatesSkeleton />
      ) : sortedRows.length === 0 ? (
        <div className="border border-dashed border-[#bdbdbd] bg-[#fafafa] px-6 py-14 text-center">
          <p className="text-base font-semibold text-[#424242]">
            No templates loaded
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#757575]">
            Defaults are created automatically. Try refreshing — check MongoDB
            if this persists.
          </p>
          <button
            type="button"
            className={cn(btnGreen, "mt-6")}
            onClick={() => void load()}
          >
            Reload
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {sortedRows.map((r) => {
            const meta = EMAIL_TEMPLATE_META[r.key];
            const step = stepBadgeIndex(r.key);
            const open = expandedKeys.has(r.key);
            return (
              <li key={r.key}>
                <section
                  className={cn(
                    "overflow-hidden border bg-white shadow-sm transition-shadow",
                    open
                      ? "border-[#1565c0] shadow-[0_0_0_1px_rgba(21,101,192,0.15)]"
                      : "border-[#e0e0e0] hover:border-[#bdbdbd]",
                  )}
                >
                  <button
                    type="button"
                    id={`email-tpl-trigger-${r.key}`}
                    aria-expanded={open}
                    aria-controls={`email-tpl-panel-${r.key}`}
                    onClick={() => toggleExpanded(r.key)}
                    className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-[#fafafa] sm:px-5"
                  >
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center text-sm font-bold tabular-nums text-white",
                        r.enabled ? "bg-[#1565c0]" : "bg-[#9e9e9e]",
                      )}
                      aria-hidden
                    >
                      {step}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9e9e9e]">
                          Step {step} of {PIPELINE_TOTAL}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <span className="text-base font-bold text-[#212121]">
                          {r.name}
                        </span>
                        <span className="border border-[#bbdefb] bg-[#e3f2fd] px-2 py-0.5 font-mono text-[11px] text-[#1565c0]">
                          {r.key}
                        </span>
                        <span
                          className={cn(
                            "border px-2 py-0.5 text-xs font-semibold",
                            r.enabled
                              ? "border-[#c8e6c9] bg-[#e8f5e9] text-[#2e7d32]"
                              : "border-[#e0e0e0] bg-[#f5f5f5] text-[#757575]",
                          )}
                        >
                          {r.enabled ? "Active" : "Paused"}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-[#757575]">
                        {meta?.description ?? r.description}
                      </p>
                    </div>
                    <ChevronIcon open={open} />
                  </button>
                  {open ? (
                    <div
                      id={`email-tpl-panel-${r.key}`}
                      role="region"
                      aria-labelledby={`email-tpl-trigger-${r.key}`}
                      className="border-t border-[#e0e0e0] bg-[#fafafa] px-3 py-5 sm:px-5"
                    >
                      <TemplateEditorPanel
                        r={r}
                        patchRow={patchRow}
                        copiedPh={copiedPh}
                        setCopiedPh={setCopiedPh}
                      />
                    </div>
                  ) : null}
                </section>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
