"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { cn } from "@/lib/cn";
import { buildEmailPreviewHtml } from "@/lib/email/emailPreviewHtml";
import { getPreviewSampleVars } from "@/lib/email/previewSampleVars";
import { renderTemplate } from "@/lib/email/renderTemplate";
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

function stepBadgeIndex(key: EmailTemplateKey): number {
  const i = PIPELINE_ORDER.indexOf(key);
  return i >= 0 ? i + 1 : 0;
}

function ChevronIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      className={cn(
        "h-5 w-5 shrink-0 text-[#757575] transition-transform duration-200",
        open && "rotate-180",
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
          className="overflow-hidden rounded-none border border-[#e0e0e0] bg-white p-4"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-none bg-[#e0e0e0]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-40 animate-pulse rounded-none bg-[#e0e0e0]" />
              <div className="h-3 w-full max-w-md animate-pulse rounded-none bg-[#f0f0f0]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const btnOutline =
  "rounded-none border border-[#e0e0e0] bg-white px-4 py-2 text-sm font-medium text-[#424242]";
const btnGreen =
  "rounded-none bg-[#2e7d32] px-4 py-2 text-sm font-medium text-white disabled:opacity-60";

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
  const previewBodyHtml = useMemo(
    () => renderTemplate(r.bodyHtml, previewVars),
    [r.bodyHtml, previewVars],
  );
  const iframeSrcDoc = useMemo(
    () => buildEmailPreviewHtml(previewBodyHtml),
    [previewBodyHtml],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <label className="flex cursor-pointer select-none items-center gap-3 rounded-none border border-[#e0e0e0] bg-white px-3 py-2">
        <input
          type="checkbox"
          className="h-4 w-4 rounded-none border-[#e0e0e0] text-[#1565c0] focus:ring-[#1565c0]"
          checked={r.enabled}
          onChange={(e) =>
            patchRow(r.key, {
              enabled: e.target.checked,
            })
          }
        />
        <span className="text-sm text-[#424242]">
          <span className="font-medium">Enabled</span>
          <span className="ml-1.5 text-[#757575]">
            — when off, sends using this template are blocked.
          </span>
        </span>
      </label>

      <div>
        <label
          htmlFor={`sub-${r.key}`}
          className="text-xs font-bold uppercase tracking-wide text-[#757575]"
        >
          Email subject
        </label>
        <input
          id={`sub-${r.key}`}
          className="mt-1 w-full rounded-none border border-[#e0e0e0] bg-white px-2 py-2 text-sm text-[#212121] outline-none focus:border-[#1565c0] focus:ring-1 focus:ring-[#1565c0]"
          value={r.subject}
          onChange={(e) => patchRow(r.key, { subject: e.target.value })}
          autoComplete="off"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div>
          <label
            htmlFor={`body-${r.key}`}
            className="text-xs font-bold uppercase tracking-wide text-[#757575]"
          >
            HTML body
          </label>
          <textarea
            id={`body-${r.key}`}
            className="mt-1 min-h-[240px] w-full resize-y rounded-none border border-[#e0e0e0] bg-white px-2 py-2 font-mono text-[13px] leading-relaxed text-[#212121] outline-none focus:border-[#1565c0] focus:ring-1 focus:ring-[#1565c0] lg:min-h-[320px]"
            value={r.bodyHtml}
            onChange={(e) => patchRow(r.key, { bodyHtml: e.target.value })}
            spellCheck={false}
          />
          <p className="mt-1.5 text-[11px] text-[#757575]">
            Use HTML tags (e.g.{" "}
            <code className="rounded-none bg-[#eeeeee] px-1">&lt;p&gt;</code>,{" "}
            <code className="rounded-none bg-[#eeeeee] px-1">&lt;br /&gt;</code>
            ,{" "}
            <code className="rounded-none bg-[#eeeeee] px-1">
              &lt;a href=&quot;…&quot;&gt;
            </code>
            ). Preview updates as you type.
          </p>
        </div>

        <aside className="space-y-2 lg:sticky lg:top-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#757575]">
            Live preview
          </p>
          <p className="text-[11px] leading-snug text-[#757575]">
            Sample student/parent data — real sends use each lead&apos;s fields.
          </p>
          <div className="overflow-hidden rounded-none border border-[#e0e0e0] bg-white shadow-sm">
            <div className="border-b border-[#e0e0e0] bg-[#f5f5f5] px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#757575]">
                Subject line
              </p>
              <p className="mt-1 break-words text-sm font-semibold text-[#212121]">
                {previewSubject || "(empty subject)"}
              </p>
            </div>
            <iframe
              title={`Email preview: ${r.name}`}
              className="block h-[min(420px,50vh)] w-full border-0 bg-[#eceff1] lg:h-[min(480px,55vh)]"
              srcDoc={iframeSrcDoc}
              sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            />
          </div>
        </aside>
      </div>

      {meta?.placeholders?.length ? (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#757575]">
            Placeholders
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {meta.placeholders.map((ph) => (
              <button
                key={ph}
                type="button"
                title="Copy to clipboard"
                className={cn(
                  "rounded-none border px-2 py-1 font-mono text-[11px] transition-colors",
                  copiedPh === ph
                    ? "border-[#2e7d32] bg-[#e8f5e9] text-[#2e7d32]"
                    : "border-[#e0e0e0] bg-white text-[#424242] hover:bg-[#f5f5f5]",
                )}
                onClick={() => {
                  void navigator.clipboard.writeText(ph);
                  setCopiedPh(ph);
                  window.setTimeout(() => {
                    setCopiedPh((c) => (c === ph ? null : c));
                  }, 1600);
                }}
              >
                {copiedPh === ph ? "Copied!" : ph}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-[#757575]">
            Click a placeholder to copy.
          </p>
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#212121]">
            Email Templates Management
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#757575]">
            Edit subjects and HTML for pipeline emails (demo, brochure, fees,
            enrollment, schedule). These send from the student workspace. Use
            placeholders like{" "}
            <code className="rounded-none bg-[#f5f5f5] px-1 py-0.5 font-mono text-[13px] text-[#424242]">
              {"{{studentName}}"}
            </code>{" "}
            — values are filled from each lead when you send.
          </p>
        </div>
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
      </div>

      {dirty ? (
        <p className="text-xs text-[#f57f17]">Unsaved changes.</p>
      ) : null}
      {savedAt && !dirty ? (
        <p className="text-xs text-[#2e7d32]">
          Saved {new Date(savedAt).toLocaleString()}.
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-rose-700" role="alert">
          {error}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void load()}
          >
            Retry
          </button>
        </p>
      ) : null}

      <section className="space-y-3 rounded-none border border-[#e0e0e0] bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold text-[#212121]">SMTP status</h2>
        <p className="text-sm text-[#757575]">
          Outbound email uses environment variables on the server. Without SMTP,
          you can still edit templates; sends from a lead will fail until
          configured.
        </p>
        {!smtpConfigured ? (
          <p className="text-sm text-[#c62828]">
            Not configured — add{" "}
            <code className="rounded-none bg-[#ffebee] px-1 font-mono text-[13px]">
              SMTP_HOST
            </code>
            ,{" "}
            <code className="rounded-none bg-[#ffebee] px-1 font-mono text-[13px]">
              SMTP_PORT
            </code>
            ,{" "}
            <code className="rounded-none bg-[#ffebee] px-1 font-mono text-[13px]">
              SMTP_USER
            </code>
            ,{" "}
            <code className="rounded-none bg-[#ffebee] px-1 font-mono text-[13px]">
              SMTP_PASS
            </code>{" "}
            (and optionally{" "}
            <code className="rounded-none bg-[#ffebee] px-1 font-mono text-[13px]">
              EMAIL_FROM
            </code>
            ) in <span className="font-medium">.env</span>.
          </p>
        ) : (
          <p className="text-sm font-medium text-[#2e7d32]">
            SMTP detected — sends from the student detail page will use these
            templates.
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e0e0e0] pb-2">
        <h2 className="text-lg font-bold text-[#212121]">
          Templates ({sortedRows.length})
        </h2>
        <button
          type="button"
          className="text-sm text-[#1565c0] underline"
          onClick={allExpanded ? collapseAllTemplates : expandAllTemplates}
        >
          {allExpanded ? "Collapse all" : "Expand all"}
        </button>
      </div>

      {loading ? (
        <TemplatesSkeleton />
      ) : sortedRows.length === 0 ? (
        <div className="rounded-none border border-dashed border-[#e0e0e0] bg-[#fafafa] px-6 py-12 text-center">
          <p className="text-sm font-medium text-[#212121]">
            No templates found
          </p>
          <p className="mt-1 text-sm text-[#757575]">
            Defaults are created on first load — try refreshing.
          </p>
          <button
            type="button"
            className={cn(btnGreen, "mt-4")}
            onClick={() => void load()}
          >
            Reload
          </button>
        </div>
      ) : (
        <ul className="space-y-4">
          {sortedRows.map((r) => {
            const meta = EMAIL_TEMPLATE_META[r.key];
            const step = stepBadgeIndex(r.key);
            const open = expandedKeys.has(r.key);
            return (
              <li key={r.key}>
                <section
                  className={cn(
                    "overflow-hidden rounded-none border bg-white shadow-sm",
                    open
                      ? "border-[#1565c0]"
                      : "border-[#e0e0e0] hover:border-[#bdbdbd]",
                  )}
                >
                  <button
                    type="button"
                    id={`email-tpl-trigger-${r.key}`}
                    aria-expanded={open}
                    aria-controls={`email-tpl-panel-${r.key}`}
                    onClick={() => toggleExpanded(r.key)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#fafafa] md:gap-4 md:px-4 md:py-3"
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-none text-sm font-bold tabular-nums text-white",
                        r.enabled ? "bg-[#1565c0]" : "bg-[#9e9e9e]",
                      )}
                      aria-hidden
                    >
                      {step}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-[#212121]">
                          {r.name}
                        </span>
                        <span className="rounded-none bg-[#e3f2fd] px-2 py-0.5 font-mono text-[11px] text-[#1565c0]">
                          {r.key}
                        </span>
                        <span
                          className={cn(
                            "rounded-none px-2 py-0.5 text-xs",
                            r.enabled
                              ? "bg-[#e8f5e9] text-[#2e7d32]"
                              : "bg-[#f5f5f5] text-[#757575]",
                          )}
                        >
                          {r.enabled ? "Active" : "Paused"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-snug text-[#757575]">
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
                      className="border-t border-[#e0e0e0] bg-[#fafafa] px-4 py-4"
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
