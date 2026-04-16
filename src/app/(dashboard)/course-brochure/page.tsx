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
  courseId: string;
  courseName: string;
  brochures: BrochureItem[];
  updatedAt?: string | null;
};

const COURSE_BROCHURE_CACHE_TTL_MS = 60_000;
let courseBrochureCache: { data: ExamGroup[]; fetchedAt: number } | null = null;
let courseBrochureInFlight: Promise<ExamGroup[]> | null = null;

function hasFreshCourseBrochureCache() {
  if (!courseBrochureCache) return false;
  return Date.now() - courseBrochureCache.fetchedAt < COURSE_BROCHURE_CACHE_TTL_MS;
}

function writeCourseBrochureCache(data: ExamGroup[]) {
  courseBrochureCache = { data, fetchedAt: Date.now() };
}

function mapServerRow(raw: unknown): ExamGroup | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const exam = typeof o.exam === "string" ? o.exam.trim() : "";
  const courseId = typeof o.courseId === "string" ? o.courseId.trim() : "";
  const courseName =
    typeof o.courseName === "string" ? o.courseName.trim() : "";
  if (!exam) return null;
  const brochures = Array.isArray(o.brochures)
    ? o.brochures.map((b, i) => {
        const x = b as Record<string, unknown>;
        return {
          key: String(x.key ?? ""),
          title: typeof x.title === "string" ? x.title : "",
          summary: typeof x.summary === "string" ? x.summary : "",
          linkUrl: typeof x.linkUrl === "string" ? x.linkUrl : "",
          linkLabel: typeof x.linkLabel === "string" ? x.linkLabel : "",
          storedFileUrl:
            x.storedFileUrl === null || x.storedFileUrl === undefined
              ? null
              : String(x.storedFileUrl),
          storedFileName:
            x.storedFileName === null || x.storedFileName === undefined
              ? null
              : String(x.storedFileName),
          sortOrder:
            typeof x.sortOrder === "number" ? x.sortOrder : i,
        };
      })
    : [];
  return {
    exam,
    courseId,
    courseName: courseName || "Course",
    brochures,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : null,
  };
}

/** Settings order first, then any exams only present in API (orphans). */
function unionExamOrder(
  activeFromSettings: string[],
  serverRows: ExamGroup[],
): string[] {
  const serverExams = [...new Set(serverRows.map((g) => g.exam).filter(Boolean))];
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
  const [groups, setGroups] = useState<ExamGroup[]>(
    () => courseBrochureCache?.data ?? [],
  );
  const [loading, setLoading] = useState(() => !courseBrochureCache);
  const [savingBrochureKey, setSavingBrochureKey] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<{
    exam: string;
    courseId: string;
    at: string;
  } | null>(null);

  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  const load = useCallback(async (opts?: { force?: boolean; showLoading?: boolean }) => {
    const force = opts?.force ?? false;
    const showLoading = opts?.showLoading ?? false;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      if (!force && hasFreshCourseBrochureCache() && courseBrochureCache) {
        setGroups(courseBrochureCache.data);
        return;
      }
      if (!force && courseBrochureInFlight) {
        setGroups(await courseBrochureInFlight);
        return;
      }
      courseBrochureInFlight = (async () => {
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
      const raw = (await brochureRes.json()) as unknown[];
      const list = Array.isArray(raw)
        ? raw.map(mapServerRow).filter((x): x is ExamGroup => Boolean(x))
        : [];
      const merged = unionExamOrder(exams, list);
      const examKeys =
        merged.length > 0 ? merged : [...new Set(list.map((g) => g.exam))];
      let next: ExamGroup[] = [];
      if (examKeys.length !== 0) {
        const order = new Map(examKeys.map((e, i) => [e, i]));
        const sorted = [...list].sort((a, b) => {
          const ae = order.get(a.exam) ?? 99;
          const be = order.get(b.exam) ?? 99;
          if (ae !== be) return ae - be;
          return a.courseName.localeCompare(b.courseName);
        });
        next = sorted.filter((g) => examKeys.includes(g.exam));
      }
      writeCourseBrochureCache(next);
      return next;
      })().finally(() => {
        courseBrochureInFlight = null;
      });
      setGroups(await courseBrochureInFlight);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (examsLoading) return;
    if (hasFreshCourseBrochureCache() && courseBrochureCache) {
      setGroups(courseBrochureCache.data);
      setLoading(false);
      return;
    }
    void load({ force: true, showLoading: !courseBrochureCache });
  }, [examsLoading, load]);

  const persistExamBrochure = useCallback(
    async (
      exam: string,
      courseId: string,
      brochureKey: string,
      mode: "url" | "file",
    ) => {
      const g = groupsRef.current.find(
        (x) => x.exam === exam && x.courseId === courseId,
      );
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
            items: [{ exam, courseId, brochures }],
          }),
        });
        if (!res.ok) throw new Error("Save failed.");
        const raw = (await res.json()) as unknown[];
        const data = Array.isArray(raw)
          ? raw.map(mapServerRow).filter((x): x is ExamGroup => Boolean(x))
          : [];
        writeCourseBrochureCache(data);
        setGroups(data);
        setLastSaved({
          exam,
          courseId,
          at: new Date().toISOString(),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed.");
      } finally {
        setSavingBrochureKey(null);
      }
    },
    [],
  );

  const setBrochuresForSlot = (
    exam: string,
    courseId: string,
    brochures: BrochureItem[],
  ) => {
    setGroups((prev) => {
      const ix = prev.findIndex(
        (g) => g.exam === exam && g.courseId === courseId,
      );
      if (ix >= 0) {
        return prev.map((g) =>
          g.exam === exam && g.courseId === courseId ? { ...g, brochures } : g,
        );
      }
      return [
        ...prev,
        {
          exam,
          courseId,
          courseName: "",
          brochures,
          updatedAt: null,
        },
      ];
    });
  };

  const patchBrochure = (
    exam: string,
    courseId: string,
    key: string,
    patch: Partial<BrochureItem>,
  ) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.exam !== exam || g.courseId !== courseId) return g;
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

  const coursesForExam = useMemo(() => {
    return groups
      .filter((g) => g.exam === selectedExam)
      .sort((a, b) => a.courseName.localeCompare(b.courseName));
  }, [groups, selectedExam]);

  const [selectedCourseId, setSelectedCourseId] = useState("");

  useEffect(() => {
    if (!selectedExam || coursesForExam.length === 0) {
      setSelectedCourseId("");
      return;
    }
    setSelectedCourseId((prev) => {
      const ids = coursesForExam.map((c) => c.courseId);
      if (prev && ids.includes(prev)) return prev;
      return ids[0] ?? "";
    });
  }, [selectedExam, coursesForExam]);

  const selectedGroup = useMemo((): ExamGroup | null => {
    if (!selectedExam) return null;
    const hit = coursesForExam.find((g) => g.courseId === selectedCourseId);
    return hit ?? coursesForExam[0] ?? null;
  }, [coursesForExam, selectedExam, selectedCourseId]);

  return (
    <div className={SX.pageWrap}>
      <div className={SX.outerSheet}>
        <div className={SX.toolbar}>
          <div className="min-w-0 flex-1">
            <h1 className={SX.toolbarTitle}>Course brochures</h1>
            <p className={SX.toolbarMeta}>
              Choose a target exam, then a <strong className="font-semibold">course</strong>{" "}
              (from{" "}
              <Link
                href="/exam-courses"
                className="font-medium text-primary underline"
              >
                Exam courses
              </Link>
              ). Each row is one document — link or upload — then{" "}
              <strong className="font-semibold">Save</strong> for that course.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/exam-courses" className={SX.btnSecondary}>
              Exam courses
            </Link>
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
      onClick={() => void load({ force: true, showLoading: true })}
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
            , then courses under{" "}
            <Link
              href="/exam-courses"
              className="font-medium text-primary underline"
            >
              Exam courses
            </Link>
            .
          </p>
        ) : (
          <>
            <div
              className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50/60 px-4 py-3"
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

            {coursesForExam.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-600">
                No courses for this exam yet. Add them under{" "}
                <Link
                  href="/exam-courses"
                  className="font-medium text-primary underline"
                >
                  Exam courses
                </Link>{" "}
                and reload.
              </p>
            ) : !selectedGroup ? (
              <p className="px-4 py-6 text-sm text-slate-600">
                Select a course tab above.
              </p>
            ) : (
              <>
                {coursesForExam.length > 1 ? (
                  <div
                    className="flex flex-wrap gap-2 border-b border-slate-100 bg-white px-4 py-2"
                    role="tablist"
                    aria-label="Course under exam"
                  >
                    {coursesForExam.map((g) => (
                      <button
                        key={g.courseId || "_legacy"}
                        type="button"
                        role="tab"
                        aria-selected={selectedCourseId === g.courseId}
                        onClick={() => setSelectedCourseId(g.courseId)}
                        className={cn(
                          "rounded-none px-2.5 py-1 text-[12px] font-medium transition-colors",
                          selectedCourseId === g.courseId
                            ? "bg-sky-50 text-primary ring-1 ring-primary/30"
                            : "text-slate-600 hover:bg-slate-50",
                        )}
                      >
                        {g.courseName}
                      </button>
                    ))}
                  </div>
                ) : null}

                <ExamBrochureSection
                  key={`${selectedGroup.exam}-${selectedGroup.courseId}`}
                  group={selectedGroup}
                  examLabel={labelFor(selectedGroup.exam)}
                  savingBrochureKey={savingBrochureKey}
                  onSetBrochures={(brochures) =>
                    setBrochuresForSlot(
                      selectedGroup.exam,
                      selectedGroup.courseId,
                      brochures,
                    )
                  }
                  onPatchBrochure={(key, patch) =>
                    patchBrochure(
                      selectedGroup.exam,
                      selectedGroup.courseId,
                      key,
                      patch,
                    )
                  }
                  onPersistRow={(brochureKey, mode) =>
                    void persistExamBrochure(
                      selectedGroup.exam,
                      selectedGroup.courseId,
                      brochureKey,
                      mode,
                    )
                  }
                />
              </>
            )}
          </>
        )}
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

  const qCourse =
    g.courseId ? `&courseId=${encodeURIComponent(g.courseId)}` : "";

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
          `/api/exam-brochure-templates/${encodeURIComponent(g.exam)}/upload?brochureKey=${encodeURIComponent(key)}${qCourse}`,
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
            <h2 className={SX.sectionTitle}>
              {examLabel}
              {g.courseName ? (
                <span className="text-slate-500"> · {g.courseName}</span>
              ) : null}
            </h2>
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
            No documents for this course yet. Use <strong>Add document</strong>,
            fill the row, then <strong>Save</strong>.
          </div>
        ) : (
          g.brochures.map((b, idx) => (
            <BrochureRow
              key={b.key}
              exam={g.exam}
              courseId={g.courseId}
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
  courseId,
  row: b,
  rowIndex,
  saving,
  onPatch,
  onRemoveRow,
  onPersist,
}: {
  exam: string;
  courseId: string;
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

  const qCourse =
    courseId ? `&courseId=${encodeURIComponent(courseId)}` : "";

  const onFile = async (file: File | null) => {
    if (!file) return;
    setLocalError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("brochureKey", b.key);
      const res = await fetch(
        `/api/exam-brochure-templates/${encodeURIComponent(exam)}/upload?brochureKey=${encodeURIComponent(b.key)}${qCourse}`,
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
