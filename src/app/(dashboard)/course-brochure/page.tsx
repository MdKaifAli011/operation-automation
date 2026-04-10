"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconCloudUpload } from "@/components/icons/CrmIcons";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";
import { useTargetExamOptions } from "@/hooks/useTargetExamOptions";
import { randomUuid } from "@/lib/randomUuid";
import {
  activeTargetExamValues,
  normalizeTargetExams,
} from "@/lib/targetExams";

type BrochureItem = {
  key: string;
  title: string;
  summary: string;
  linkUrl: string;
  linkLabel: string;
  storedFileUrl: string | null;
  storedFileName: string | null;
  sortOrder: number;
};

type ExamGroup = {
  exam: string;
  brochures: BrochureItem[];
  updatedAt?: string | null;
};

function emptyGroup(exam: string): ExamGroup {
  return { exam, brochures: [], updatedAt: null };
}

/** Settings order first, then any exams only present in API (orphans). */
function unionExamOrder(
  activeFromSettings: string[],
  serverRows: ExamGroup[],
): string[] {
  const serverExams = serverRows.map((g) => g.exam).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of activeFromSettings) {
    if (e && !seen.has(e)) {
      seen.add(e);
      out.push(e);
    }
  }
  for (const e of serverExams) {
    if (e && !seen.has(e)) {
      seen.add(e);
      out.push(e);
    }
  }
  return out;
}

/** Href for opening a brochure in a new tab (uploaded path or external URL). */
function brochureOpenHref(b: BrochureItem): string | null {
  const stored = b.storedFileUrl?.trim();
  const link = b.linkUrl?.trim();
  const u = stored || link;
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return u.startsWith("/") ? u : `/${u}`;
}

export default function CourseBrochurePage() {
  const { activeValues, labelFor, loading: examsLoading } = useTargetExamOptions();
  const [groups, setGroups] = useState<ExamGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingBrochureKey, setSavingBrochureKey] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<{
    exam: string;
    at: string;
  } | null>(null);

  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  const mergeLoaded = useCallback(
    (data: ExamGroup[], exams: string[]) =>
      exams.map((exam) => {
        const hit = data.find((d) => d.exam === exam);
        const brochures = Array.isArray(hit?.brochures)
          ? hit!.brochures.map((b, i) => ({
              key: String(b.key ?? ""),
              title: typeof b.title === "string" ? b.title : "",
              summary: typeof b.summary === "string" ? b.summary : "",
              linkUrl: typeof b.linkUrl === "string" ? b.linkUrl : "",
              linkLabel: typeof b.linkLabel === "string" ? b.linkLabel : "",
              storedFileUrl:
                b.storedFileUrl === null || b.storedFileUrl === undefined
                  ? null
                  : String(b.storedFileUrl),
              storedFileName:
                b.storedFileName === null || b.storedFileName === undefined
                  ? null
                  : String(b.storedFileName),
              sortOrder:
                typeof b.sortOrder === "number" ? b.sortOrder : i,
            }))
          : [];
        return {
          exam,
          brochures,
          updatedAt: hit?.updatedAt ?? null,
        };
      }),
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [examRes, brochureRes] = await Promise.all([
        fetch("/api/settings/target-exams", { cache: "no-store" }),
        fetch("/api/exam-brochure-templates", { cache: "no-store" }),
      ]);
      let exams: string[] = [];
      if (examRes.ok) {
        const ex = (await examRes.json()) as { exams?: unknown };
        exams = activeTargetExamValues(normalizeTargetExams(ex.exams));
      }
      if (!brochureRes.ok) throw new Error("Could not load templates.");
      const data = (await brochureRes.json()) as ExamGroup[];
      const list = Array.isArray(data) ? data : [];
      const merged = unionExamOrder(exams, list);
      const examKeys =
        merged.length > 0 ? merged : list.map((g) => g.exam).filter(Boolean);
      if (examKeys.length === 0) {
        setGroups([]);
      } else {
        setGroups(mergeLoaded(list, examKeys));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }, [mergeLoaded]);

  useEffect(() => {
    if (!examsLoading) void load();
  }, [examsLoading, load]);

  const persistExamBrochure = useCallback(
    async (exam: string, brochureKey: string, mode: "url" | "file") => {
      const g = groupsRef.current.find((x) => x.exam === exam);
      if (!g) return;
      setSavingBrochureKey(brochureKey);
      setError(null);
      try {
        const brochures = g.brochures.map((b, i) => {
          const base = { ...b, sortOrder: i };
          if (b.key !== brochureKey) return base;
          if (mode === "url") {
            return {
              ...base,
              storedFileUrl: null,
              storedFileName: null,
            };
          }
          return {
            ...base,
            linkUrl: "",
            linkLabel: "",
          };
        });
        const res = await fetch("/api/exam-brochure-templates", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: [{ exam, brochures }],
          }),
        });
        if (!res.ok) throw new Error("Save failed.");
        const data = (await res.json()) as ExamGroup[];
        if (Array.isArray(data)) {
          setGroups((prev) => {
            const examKeys = unionExamOrder(
              activeValues.length > 0
                ? activeValues
                : prev.map((x) => x.exam).filter(Boolean),
              data,
            );
            const keys =
              examKeys.length > 0 ? examKeys : data.map((r) => r.exam);
            return mergeLoaded(data, keys);
          });
        }
        setLastSaved({ exam, at: new Date().toISOString() });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed.");
      } finally {
        setSavingBrochureKey(null);
      }
    },
    [activeValues, mergeLoaded],
  );

  const setBrochuresForExam = (exam: string, brochures: BrochureItem[]) => {
    setGroups((prev) => {
      const ix = prev.findIndex((g) => g.exam === exam);
      if (ix >= 0) {
        return prev.map((g) => (g.exam === exam ? { ...g, brochures } : g));
      }
      return [...prev, { exam, brochures, updatedAt: null }];
    });
  };

  const patchBrochure = (
    exam: string,
    key: string,
    patch: Partial<BrochureItem>,
  ) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.exam !== exam) return g;
        return {
          ...g,
          brochures: g.brochures.map((b) =>
            b.key === key ? { ...b, ...patch } : b,
          ),
        };
      }),
    );
  };

  const showSpinner = loading || examsLoading;

  const examTabKeys = useMemo(() => {
    return unionExamOrder(
      activeValues.length > 0 ? activeValues : [],
      groups,
    );
  }, [activeValues, groups]);

  const [selectedExam, setSelectedExam] = useState("");

  useEffect(() => {
    if (showSpinner) return;
    setSelectedExam((prev) => {
      if (examTabKeys.length === 0) return "";
      if (prev && examTabKeys.includes(prev)) return prev;
      return examTabKeys[0] ?? "";
    });
  }, [showSpinner, examTabKeys]);

  const selectedGroup = useMemo((): ExamGroup | null => {
    if (!selectedExam) return null;
    const hit = groups.find((g) => g.exam === selectedExam);
    if (hit) return hit;
    return emptyGroup(selectedExam);
  }, [groups, selectedExam]);

  return (
    <div className={SX.pageWrap}>
      <div className={SX.outerSheet}>
        <div className={SX.toolbar}>
          <div className="min-w-0 flex-1">
            <h1 className={SX.toolbarTitle}>Course brochures</h1>
            <p className={SX.toolbarMeta}>
              Pick an exam, then one row per document: title and either a link
              or an upload — <strong className="font-semibold">Save</strong>{" "}
              stores that exam&apos;s list (not a global save-all).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className={SX.btnSecondary}>
              Leads
            </Link>
          </div>
        </div>

        {error ? (
          <div
            className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-[13px] text-rose-900"
            role="alert"
          >
            {error}{" "}
            <button
              type="button"
              className="underline"
              onClick={() => void load()}
            >
              Retry
            </button>
          </div>
        ) : null}
        {lastSaved ? (
          <p className="border-b border-emerald-100 bg-emerald-50/80 px-4 py-1.5 text-[12px] text-emerald-900">
            Last saved: {labelFor(lastSaved.exam)} ·{" "}
            {new Date(lastSaved.at).toLocaleString()}
          </p>
        ) : null}

        {showSpinner ? (
          <p className="px-4 py-6 text-sm text-slate-600">
            Loading brochure templates…
          </p>
        ) : examTabKeys.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-600">
            No target exams configured. Add exams under{" "}
            <Link
              href="/exams-subjects"
              className="font-medium text-primary underline"
            >
              Exams &amp; subjects
            </Link>
            .
          </p>
        ) : selectedGroup ? (
          <>
            <div
              className="flex flex-wrap gap-2 border-b border-[#d0d0d0] bg-slate-50/60 px-4 py-3"
              role="tablist"
              aria-label="Target exam"
            >
              {examTabKeys.map((exam) => (
                <button
                  key={exam}
                  type="button"
                  role="tab"
                  aria-selected={selectedExam === exam}
                  onClick={() => setSelectedExam(exam)}
                  className={cn(
                    "rounded-none px-3 py-1.5 text-[13px] font-medium transition-colors",
                    selectedExam === exam
                      ? "bg-white text-primary shadow-sm ring-2 ring-primary/25"
                      : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100",
                  )}
                >
                  {labelFor(exam)}
                </button>
              ))}
            </div>
            <ExamBrochureSection
              key={selectedGroup.exam}
              group={selectedGroup}
              examLabel={labelFor(selectedGroup.exam)}
              savingBrochureKey={savingBrochureKey}
              onSetBrochures={(brochures) =>
                setBrochuresForExam(selectedGroup.exam, brochures)
              }
              onPatchBrochure={(key, patch) =>
                patchBrochure(selectedGroup.exam, key, patch)
              }
              onPersistRow={(brochureKey, mode) =>
                void persistExamBrochure(selectedGroup.exam, brochureKey, mode)
              }
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function ExamBrochureSection({
  group: g,
  examLabel,
  savingBrochureKey,
  onSetBrochures,
  onPatchBrochure,
  onPersistRow,
}: {
  group: ExamGroup;
  examLabel: string;
  savingBrochureKey: string | null;
  onSetBrochures: (brochures: BrochureItem[]) => void;
  onPatchBrochure: (key: string, patch: Partial<BrochureItem>) => void;
  onPersistRow: (brochureKey: string, mode: "url" | "file") => void;
}) {
  const addBrochure = () => {
    const key = randomUuid();
    onSetBrochures([
      ...g.brochures,
      {
        key,
        title: "",
        summary: "",
        linkUrl: "",
        linkLabel: "",
        storedFileUrl: null,
        storedFileName: null,
        sortOrder: g.brochures.length,
      },
    ]);
  };

  const removeBrochure = async (key: string) => {
    const row = g.brochures.find((b) => b.key === key);
    if (
      !window.confirm(
        row?.storedFileUrl?.trim()
          ? "Remove this brochure and delete its uploaded file from the server?"
          : "Remove this brochure row? Unsaved changes are lost unless you saved.",
      )
    ) {
      return;
    }
    if (row?.storedFileUrl?.trim()) {
      try {
        await fetch(
          `/api/exam-brochure-templates/${encodeURIComponent(g.exam)}/upload?brochureKey=${encodeURIComponent(key)}`,
          { method: "DELETE" },
        );
      } catch {
        /* continue */
      }
    }
    onSetBrochures(g.brochures.filter((b) => b.key !== key));
  };

  return (
    <section className="bg-white">
      <div className={cn(SX.sectionHead, "px-4")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className={SX.sectionTitle}>{examLabel}</h2>
            <span className={SX.leadSectionMeta}>
              {g.updatedAt
                ? `Updated ${new Date(g.updatedAt).toLocaleString()}`
                : "Not saved yet"}
            </span>
          </div>
          <button type="button" className={SX.btnSecondary} onClick={addBrochure}>
            Add document
          </button>
        </div>
      </div>
      <div className={cn(SX.sectionBody, "space-y-3 px-4 pb-6")}>
        {g.brochures.length === 0 ? (
          <div className="rounded-none border border-dashed border-slate-300 bg-slate-50/80 px-4 py-8 text-center text-[13px] text-slate-600">
            No documents for this exam yet. Use <strong>Add document</strong>,
            fill the row, then <strong>Save</strong>.
          </div>
        ) : (
          g.brochures.map((b, idx) => (
            <BrochureRow
              key={b.key}
              exam={g.exam}
              row={b}
              rowIndex={idx + 1}
              saving={savingBrochureKey === b.key}
              onPatch={(patch) => onPatchBrochure(b.key, patch)}
              onRemoveRow={() => void removeBrochure(b.key)}
              onPersist={(mode) => onPersistRow(b.key, mode)}
            />
          ))
        )}
      </div>
    </section>
  );
}

function BrochureRow({
  exam,
  row: b,
  rowIndex,
  saving,
  onPatch,
  onRemoveRow,
  onPersist,
}: {
  exam: string;
  row: BrochureItem;
  rowIndex: number;
  saving: boolean;
  onPatch: (patch: Partial<BrochureItem>) => void;
  onRemoveRow: () => void;
  onPersist: (mode: "url" | "file") => void;
}) {
  const hasFile = Boolean(b.storedFileUrl?.trim());
  const [source, setSource] = useState<"url" | "file">(() =>
    hasFile ? "file" : "url",
  );

  useEffect(() => {
    setSource(hasFile ? "file" : "url");
  }, [b.key, hasFile]);

  const openHref = brochureOpenHref(b);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | null) => {
    if (!file) return;
    setLocalError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("brochureKey", b.key);
      const res = await fetch(
        `/api/exam-brochure-templates/${encodeURIComponent(exam)}/upload`,
        { method: "POST", body: fd },
      );
      const data = (await res.json().catch(() => ({}))) as {
        storedFileUrl?: string;
        storedFileName?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (!data.storedFileUrl) throw new Error("Invalid response");
      onPatch({
        storedFileUrl: data.storedFileUrl,
        storedFileName: data.storedFileName ?? null,
        linkUrl: "",
        linkLabel: "",
      });
      setSource("file");
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="rounded-none border border-slate-200 bg-slate-50/40 p-3 ring-1 ring-slate-900/[0.04]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Title · #{rowIndex}
          </span>
          <input
            className={cn(SX.input, "w-full")}
            placeholder="e.g. NEET 2026 brochure"
            value={b.title}
            onChange={(e) => onPatch({ title: e.target.value })}
            aria-label="Brochure title"
          />
        </div>

        <div className="min-w-0 flex-[2] space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Document (one)
            </span>
            <div
              className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-[11px] font-medium"
              role="group"
              aria-label="Link or file"
            >
              <button
                type="button"
                className={cn(
                  "rounded px-2.5 py-1 transition-colors",
                  source === "url"
                    ? "bg-primary text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50",
                )}
                onClick={() => setSource("url")}
              >
                URL
              </button>
              <button
                type="button"
                className={cn(
                  "rounded px-2.5 py-1 transition-colors",
                  source === "file"
                    ? "bg-primary text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50",
                )}
                onClick={() => setSource("file")}
              >
                Upload
              </button>
            </div>
          </div>

          {source === "url" ? (
            <input
              className={cn(SX.input, "w-full font-mono text-[12px]")}
              placeholder="https://… (PDF or document link)"
              value={b.linkUrl}
              onChange={(e) => onPatch({ linkUrl: e.target.value })}
              aria-label="Document URL"
            />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,application/pdf"
                disabled={busy}
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                className={cn(
                  SX.btnSecondary,
                  "inline-flex items-center gap-1.5 text-[12px]",
                )}
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                <IconCloudUpload className="h-3.5 w-3.5" />
                {busy ? "Uploading…" : "Choose file"}
              </button>
              {hasFile ? (
                <span
                  className="max-w-[200px] truncate text-[12px] text-slate-700"
                  title={b.storedFileName ?? ""}
                >
                  {b.storedFileName ?? "File"}
                </span>
              ) : (
                <span className="text-[12px] text-slate-500">
                  PDF / Office (max 25 MB)
                </span>
              )}
            </div>
          )}
          {localError ? (
            <p className="text-[11px] text-rose-700">{localError}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-slate-200/80 pt-2 lg:border-t-0 lg:pt-0">
          <button
            type="button"
            className={cn(SX.leadBtnGreen, "min-w-[5.5rem] px-3 py-2 text-[12px]")}
            disabled={saving || busy}
            onClick={() => onPersist(source)}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {openHref ? (
            <a
              href={openHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-semibold text-primary underline"
            >
              Open
            </a>
          ) : null}
          <button
            type="button"
            className="text-[12px] font-semibold text-rose-800 hover:underline"
            onClick={onRemoveRow}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
