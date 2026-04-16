"use client";

import { format, parseISO } from "date-fns";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";
import type { Faculty } from "@/lib/types";
import {
  normalizeTargetExams,
  slugifyExamStoredValue,
  type TargetExamOption,
} from "@/lib/targetExams";
import {
  normalizeExamSubjectEntries,
  type ExamSubjectEntry,
} from "@/lib/examSubjectTypes";
import { randomUuid } from "@/lib/randomUuid";

function uniqueExamValue(name: string, rows: TargetExamOption[]): string {
  let base = slugifyExamStoredValue(name);
  if (!base) base = `EXAM_${randomUuid().slice(0, 8)}`;
  let v = base;
  let n = 1;
  while (rows.some((r) => r.value === v)) {
    v = `${base}_${n++}`.slice(0, 64);
  }
  return v;
}

const EXAMS_SUBJECTS_CACHE_TTL_MS = 60_000;
let examsSettingsCache:
  | { data: { exams: TargetExamOption[]; updatedAt: string | null }; fetchedAt: number }
  | null = null;
let examsSettingsInFlight:
  | Promise<{ exams: TargetExamOption[]; updatedAt: string | null }>
  | null = null;
let examSubjectsCatalogCache:
  | { data: ExamSubjectEntry[]; fetchedAt: number }
  | null = null;
let examSubjectsCatalogInFlight: Promise<ExamSubjectEntry[]> | null = null;
let examsSubjectsFacultiesCache:
  | { data: Faculty[]; fetchedAt: number }
  | null = null;
let examsSubjectsFacultiesInFlight: Promise<Faculty[]> | null = null;

function hasFreshExamsSubjectsCache(ts: number) {
  return Date.now() - ts < EXAMS_SUBJECTS_CACHE_TTL_MS;
}

export default function ExamsAndSubjectsPage() {
  const [exams, setExams] = useState<TargetExamOption[]>(
    () => examsSettingsCache?.data.exams ?? [],
  );
  const [loading, setLoading] = useState(() => !examsSettingsCache);
  const [examBusy, setExamBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serverUpdatedAt, setServerUpdatedAt] = useState<string | null>(
    () => examsSettingsCache?.data.updatedAt ?? null,
  );

  const [faculties, setFaculties] = useState<Faculty[]>(
    () => examsSubjectsFacultiesCache?.data ?? [],
  );
  const [subjectsLoading, setSubjectsLoading] = useState(
    () => !examsSubjectsFacultiesCache,
  );
  const [subjectsError, setSubjectsError] = useState<string | null>(null);

  const [catalogSubjects, setCatalogSubjects] = useState<ExamSubjectEntry[]>(
    () => examSubjectsCatalogCache?.data ?? [],
  );
  const [catalogLoading, setCatalogLoading] = useState(
    () => !examSubjectsCatalogCache,
  );
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  /** Exam modal */
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [examModalMode, setExamModalMode] = useState<"add" | "edit">("add");
  const [examEditIndex, setExamEditIndex] = useState<number | null>(null);
  const [examDraft, setExamDraft] = useState({
    label: "",
    sortOrder: 0,
    isActive: true,
  });
  const [examModalErr, setExamModalErr] = useState<string | null>(null);

  /** Subject modal */
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subModalMode, setSubModalMode] = useState<"add" | "edit">("add");
  const [subEditId, setSubEditId] = useState<string | null>(null);
  const [subDraft, setSubDraft] = useState({
    examValue: "",
    name: "",
    sortOrder: 0,
    isActive: true,
  });
  const [subModalErr, setSubModalErr] = useState<string | null>(null);

  const labelByValue = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of exams) m.set(e.value, e.label);
    return m;
  }, [exams]);

  const examsSorted = useMemo(
    () =>
      [...exams].sort(
        (a, b) =>
          a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
      ),
    [exams],
  );

  const subjectsSorted = useMemo(
    () =>
      [...catalogSubjects].sort((a, b) => {
        const c = a.examValue.localeCompare(b.examValue);
        return c !== 0
          ? c
          : a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
      }),
    [catalogSubjects],
  );

  const loadExams = useCallback(async (opts?: { force?: boolean; showLoading?: boolean }) => {
    const force = opts?.force ?? false;
    const showLoading = opts?.showLoading ?? false;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      if (!force && examsSettingsCache && hasFreshExamsSubjectsCache(examsSettingsCache.fetchedAt)) {
        setExams(examsSettingsCache.data.exams);
        setServerUpdatedAt(examsSettingsCache.data.updatedAt);
        return;
      }
      if (!force && examsSettingsInFlight) {
        const out = await examsSettingsInFlight;
        setExams(out.exams);
        setServerUpdatedAt(out.updatedAt);
        return;
      }
      examsSettingsInFlight = fetch("/api/settings/target-exams", {
        cache: "no-store",
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("Load failed");
          const data = (await res.json()) as {
            exams?: unknown;
            updatedAt?: string | null;
          };
          const out = {
            exams: normalizeTargetExams(data.exams),
            updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
          };
          examsSettingsCache = { data: out, fetchedAt: Date.now() };
          return out;
        })
        .finally(() => {
          examsSettingsInFlight = null;
        });
      const out = await examsSettingsInFlight;
      setExams(out.exams);
      setServerUpdatedAt(out.updatedAt);
    } catch {
      setError("Could not load target course settings.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  const loadFaculties = useCallback(async (opts?: { force?: boolean; showLoading?: boolean }) => {
    const force = opts?.force ?? false;
    const showLoading = opts?.showLoading ?? false;
    if (showLoading) setSubjectsLoading(true);
    setSubjectsError(null);
    try {
      if (
        !force &&
        examsSubjectsFacultiesCache &&
        hasFreshExamsSubjectsCache(examsSubjectsFacultiesCache.fetchedAt)
      ) {
        setFaculties(examsSubjectsFacultiesCache.data);
        return;
      }
      if (!force && examsSubjectsFacultiesInFlight) {
        setFaculties(await examsSubjectsFacultiesInFlight);
        return;
      }
      examsSubjectsFacultiesInFlight = fetch("/api/faculties", { cache: "no-store" })
        .then(async (res) => {
          if (!res.ok) throw new Error("Failed");
          const data = (await res.json()) as Faculty[];
          const out = Array.isArray(data) ? data : [];
          examsSubjectsFacultiesCache = { data: out, fetchedAt: Date.now() };
          return out;
        })
        .finally(() => {
          examsSubjectsFacultiesInFlight = null;
        });
      setFaculties(await examsSubjectsFacultiesInFlight);
    } catch {
      setSubjectsError("Could not load faculties for subject directory.");
      setFaculties([]);
    } finally {
      if (showLoading) setSubjectsLoading(false);
    }
  }, []);

  const loadCatalog = useCallback(async (opts?: { force?: boolean; showLoading?: boolean }) => {
    const force = opts?.force ?? false;
    const showLoading = opts?.showLoading ?? false;
    if (showLoading) setCatalogLoading(true);
    setCatalogError(null);
    try {
      if (
        !force &&
        examSubjectsCatalogCache &&
        hasFreshExamsSubjectsCache(examSubjectsCatalogCache.fetchedAt)
      ) {
        setCatalogSubjects(examSubjectsCatalogCache.data);
        return;
      }
      if (!force && examSubjectsCatalogInFlight) {
        setCatalogSubjects(await examSubjectsCatalogInFlight);
        return;
      }
      examSubjectsCatalogInFlight = fetch("/api/settings/exam-subjects", {
        cache: "no-store",
      })
        .then(async (res) => {
          const data = (await res.json().catch(() => ({}))) as {
            subjects?: unknown;
            error?: string;
          };
          if (!res.ok) {
            throw new Error(typeof data.error === "string" ? data.error : "Load failed");
          }
          const out = normalizeExamSubjectEntries(data.subjects);
          examSubjectsCatalogCache = { data: out, fetchedAt: Date.now() };
          return out;
        })
        .finally(() => {
          examSubjectsCatalogInFlight = null;
        });
      setCatalogSubjects(await examSubjectsCatalogInFlight);
    } catch (e) {
      setCatalogError(e instanceof Error ? e.message : "Could not load subject catalog.");
      setCatalogSubjects([]);
    } finally {
      if (showLoading) setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (examsSettingsCache && hasFreshExamsSubjectsCache(examsSettingsCache.fetchedAt)) {
      setExams(examsSettingsCache.data.exams);
      setServerUpdatedAt(examsSettingsCache.data.updatedAt);
      setLoading(false);
      return;
    }
    void loadExams({ force: true, showLoading: !examsSettingsCache });
  }, [loadExams]);

  useEffect(() => {
    if (
      examsSubjectsFacultiesCache &&
      hasFreshExamsSubjectsCache(examsSubjectsFacultiesCache.fetchedAt)
    ) {
      setFaculties(examsSubjectsFacultiesCache.data);
      setSubjectsLoading(false);
      return;
    }
    void loadFaculties({ force: true, showLoading: !examsSubjectsFacultiesCache });
  }, [loadFaculties]);

  useEffect(() => {
    if (
      examSubjectsCatalogCache &&
      hasFreshExamsSubjectsCache(examSubjectsCatalogCache.fetchedAt)
    ) {
      setCatalogSubjects(examSubjectsCatalogCache.data);
      setCatalogLoading(false);
      return;
    }
    void loadCatalog({ force: true, showLoading: !examSubjectsCatalogCache });
  }, [loadCatalog]);

  const persistExams = async (next: TargetExamOption[]) => {
    setExamBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/target-exams", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exams: next }),
      });
      const data = (await res.json()) as {
        exams?: unknown;
        error?: string;
        updatedAt?: string | null;
      };
      if (!res.ok) {
        setError(
          typeof data?.error === "string" ? data.error : "Save failed.",
        );
        return false;
      }
      const normalized = normalizeTargetExams(data.exams);
      setExams(normalized);
      examsSettingsCache = {
        data: {
          exams: normalized,
          updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
        },
        fetchedAt: Date.now(),
      };
      setServerUpdatedAt(
        typeof data.updatedAt === "string" ? data.updatedAt : null,
      );
      setMessage("Exams saved.");
      return true;
    } catch {
      setError("Network error.");
      return false;
    } finally {
      setExamBusy(false);
    }
  };

  const persistCatalog = async (next: ExamSubjectEntry[]) => {
    setCatalogBusy(true);
    setCatalogError(null);
    setCatalogMessage(null);
    try {
      const res = await fetch("/api/settings/exam-subjects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjects: next }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        subjects?: unknown;
        error?: string;
      };
      if (!res.ok) {
        setCatalogError(
          typeof data.error === "string" ? data.error : "Save failed.",
        );
        return false;
      }
      const normalized = normalizeExamSubjectEntries(data.subjects);
      setCatalogSubjects(normalized);
      examSubjectsCatalogCache = { data: normalized, fetchedAt: Date.now() };
      setCatalogMessage("Subjects saved.");
      void loadFaculties({ force: true });
      return true;
    } catch {
      setCatalogError("Network error.");
      return false;
    } finally {
      setCatalogBusy(false);
    }
  };

  const resetExams = async () => {
    if (
      !window.confirm(
        "Reset target courses to built-in defaults (NEET, JEE, CUET, SAT, Other)?",
      )
    ) {
      return;
    }
    setExamBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/settings/target-exams", {
        method: "DELETE",
      });
      const data = (await res.json()) as {
        exams?: unknown;
        error?: string;
        updatedAt?: string | null;
      };
      if (!res.ok) {
        setError(
          typeof data?.error === "string" ? data.error : "Reset failed.",
        );
        return;
      }
      setExams(normalizeTargetExams(data.exams));
      setServerUpdatedAt(
        typeof data.updatedAt === "string" ? data.updatedAt : null,
      );
      setMessage("Restored defaults.");
    } catch {
      setError("Network error.");
    } finally {
      setExamBusy(false);
    }
  };

  const openExamAdd = () => {
    const maxO = exams.reduce((m, e) => Math.max(m, e.sortOrder), -1);
    setExamModalMode("add");
    setExamEditIndex(null);
    setExamDraft({
      label: "",
      sortOrder: maxO + 1,
      isActive: true,
    });
    setExamModalErr(null);
    setExamModalOpen(true);
  };

  const openExamEdit = (indexInSorted: number) => {
    const row = examsSorted[indexInSorted];
    if (!row) return;
    const idx = exams.findIndex((e) => e.value === row.value);
    setExamModalMode("edit");
    setExamEditIndex(idx >= 0 ? idx : null);
    setExamDraft({
      label: row.label,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    });
    setExamModalErr(null);
    setExamModalOpen(true);
  };

  const commitExamModal = async () => {
    const name = examDraft.label.trim();
    if (!name) {
      setExamModalErr("Exam name is required.");
      return;
    }
    const sortOrder = Number.isFinite(Number(examDraft.sortOrder))
      ? Math.round(Number(examDraft.sortOrder))
      : 0;

    let next: TargetExamOption[];
    if (examModalMode === "add") {
      const value = uniqueExamValue(name, exams);
      next = [
        ...exams,
        {
          value,
          label: name,
          sortOrder,
          isActive: examDraft.isActive,
        },
      ];
    } else {
      if (examEditIndex === null || examEditIndex < 0) return;
      next = exams.map((r, i) =>
        i === examEditIndex
          ? {
              ...r,
              label: name,
              sortOrder,
              isActive: examDraft.isActive,
            }
          : r,
      );
    }

    const ok = await persistExams(next);
    if (ok) setExamModalOpen(false);
  };

  const removeExamAt = async (indexInSorted: number) => {
    const row = examsSorted[indexInSorted];
    if (!row) return;
    if (exams.length <= 1) {
      setError("At least one exam is required.");
      return;
    }
    if (!window.confirm(`Remove exam “${row.label}”?`)) return;
    const next = exams.filter((e) => e.value !== row.value);
    await persistExams(next);
  };

  const openSubjectAdd = () => {
    const first = exams[0]?.value ?? "";
    const maxForExam = catalogSubjects
      .filter((s) => s.examValue === first)
      .reduce((m, s) => Math.max(m, s.sortOrder), -1);
    setSubModalMode("add");
    setSubEditId(null);
    setSubDraft({
      examValue: first,
      name: "",
      sortOrder: maxForExam + 1,
      isActive: true,
    });
    setSubModalErr(null);
    setSubModalOpen(true);
  };

  const openSubjectEdit = (id: string) => {
    const row = catalogSubjects.find((s) => s.id === id);
    if (!row) return;
    setSubModalMode("edit");
    setSubEditId(id);
    setSubDraft({
      examValue: row.examValue,
      name: row.name,
      sortOrder: row.sortOrder,
      isActive: row.isActive !== false,
    });
    setSubModalErr(null);
    setSubModalOpen(true);
  };

  const commitSubjectModal = async () => {
    const name = subDraft.name.trim();
    const exam = subDraft.examValue.trim();
    if (!exam) {
      setSubModalErr("Select an exam.");
      return;
    }
    if (!name) {
      setSubModalErr("Subject name is required.");
      return;
    }
    const sortOrder = Number.isFinite(Number(subDraft.sortOrder))
      ? Math.round(Number(subDraft.sortOrder))
      : 0;

    let next: ExamSubjectEntry[];
    if (subModalMode === "add") {
      next = [
        ...catalogSubjects,
        {
          id: randomUuid(),
          examValue: exam,
          name,
          sortOrder,
          isActive: subDraft.isActive,
        },
      ];
    } else {
      if (!subEditId) return;
      next = catalogSubjects.map((s) =>
        s.id === subEditId
          ? {
              ...s,
              examValue: exam,
              name,
              sortOrder,
              isActive: subDraft.isActive,
            }
          : s,
      );
    }

    const ok = await persistCatalog(next);
    if (ok) setSubModalOpen(false);
  };

  const removeSubjectById = async (id: string) => {
    const row = catalogSubjects.find((s) => s.id === id);
    if (!row) return;
    if (!window.confirm(`Remove subject “${row.name}”?`)) return;
    const next = catalogSubjects.filter((s) => s.id !== id);
    await persistCatalog(next);
  };

  const nameBySubjectId = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of catalogSubjects) m.set(s.id, s.name);
    return m;
  }, [catalogSubjects]);

  const subjectRows = useMemo(() => {
    const structured: {
      key: string;
      subject: string;
      courses: string;
      faculty: string;
      active: boolean;
    }[] = [];
    let anyStructured = false;
    for (const f of faculties) {
      const asg = f.assignments ?? [];
      if (asg.length) anyStructured = true;
      for (const a of asg) {
        const subj = nameBySubjectId.get(a.subjectId)?.trim() || a.subjectId;
        const courseLab = labelByValue.get(a.examValue) ?? a.examValue;
        structured.push({
          key: `${f.id}:${a.examValue}:${a.subjectId}`,
          subject: subj,
          courses: courseLab,
          faculty: f.name,
          active: f.active,
        });
      }
    }
    if (anyStructured) {
      return structured.sort((a, b) => {
        const c = a.courses.localeCompare(b.courses);
        return c !== 0 ? c : a.subject.localeCompare(b.subject);
      });
    }
    const out: typeof structured = [];
    for (const f of faculties) {
      for (const s of f.subjects ?? []) {
        const subj = String(s).trim();
        if (!subj) continue;
        const courseLabels = (f.courses ?? [])
          .map((c) => labelByValue.get(c) ?? c)
          .filter(Boolean);
        out.push({
          key: `${f.id}:${subj}`,
          subject: subj,
          courses: courseLabels.length ? courseLabels.join(", ") : "—",
          faculty: f.name,
          active: f.active,
        });
      }
    }
    return out.sort((a, b) => {
      const c = a.subject.localeCompare(b.subject);
      return c !== 0 ? c : a.faculty.localeCompare(b.faculty);
    });
  }, [faculties, labelByValue, nameBySubjectId]);

  const lastSavedLabel =
    serverUpdatedAt &&
    (() => {
      try {
        return format(parseISO(serverUpdatedAt), "dd MMM yyyy, HH:mm");
      } catch {
        return serverUpdatedAt;
      }
    })();

  const examSectionBusy = loading || examBusy;
  const subSectionBusy = catalogLoading || catalogBusy;

  return (
    <div className={cn(SX.leadPageRoot, "gap-0 pb-6")}>
      {/* Exams */}
      <div className={SX.outerSheet}>
        <div className={SX.toolbar}>
          <div className="min-w-0 flex-1">
            <h1 className={SX.toolbarTitle}>Exams &amp; subjects</h1>
            <p className={SX.toolbarMeta}>
              <strong>Exams</strong> drive leads, fees, and brochures.{" "}
              <strong>Subjects</strong> belong to one exam; faculty links both.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <button
              type="button"
              className={SX.btnSecondary}
              disabled={examSectionBusy}
              onClick={openExamAdd}
            >
              Add exam
            </button>
            <button
              type="button"
              className={SX.btnSecondary}
              disabled={examSectionBusy}
              onClick={() => void resetExams()}
            >
              Reset defaults
            </button>
          </div>
        </div>

        <div
          className={cn(
            SX.leadStatBar,
            "border-t-0",
            error && "bg-rose-50/80 text-rose-900",
            !error && message && "bg-emerald-50/50 text-emerald-900",
          )}
        >
          <span
            className={cn(
              "min-w-0 flex-1 font-medium",
              !error && !message && "font-normal text-slate-600",
            )}
            role={error ? "alert" : message ? "status" : undefined}
          >
            {loading
              ? "Loading…"
              : error
                ? error
                : message
                  ? message
                  : lastSavedLabel
                    ? `Exams last saved ${lastSavedLabel}`
                    : "Add or edit exams via the table — each change saves when you confirm in the dialog."}
          </span>
          {!loading ? (
            <span className="shrink-0 tabular-nums text-slate-500">
              {exams.length} exam{exams.length !== 1 ? "s" : ""}
            </span>
          ) : null}
        </div>

        {!loading ? (
          <div className="overflow-x-auto border-b border-slate-200 bg-white">
            <table
              className={cn(SX.dataTable, "w-full min-w-[min(100%,560px)]")}
            >
              <thead>
                <tr>
                  <th className={cn(SX.dataTh, "py-2")}>Order</th>
                  <th className={cn(SX.dataTh, "py-2")}>Exam name</th>
                  <th className={cn(SX.dataTh, "py-2 text-center")}>Status</th>
                  <th className={cn(SX.dataTh, "py-2 text-right")}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {examsSorted.map((row, i) => (
                  <tr
                    key={row.value}
                    className={i % 2 === 1 ? SX.zebraRow : undefined}
                  >
                    <td className={cn(SX.dataTd, "tabular-nums text-slate-700")}>
                      {row.sortOrder}
                    </td>
                    <td className={cn(SX.dataTd, "font-medium text-slate-900")}>
                      {row.label}
                    </td>
                    <td className={cn(SX.dataTd, "text-center")}>
                      <span
                        className={cn(
                          "inline-block rounded-none px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                          row.isActive
                            ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100"
                            : "bg-slate-100 text-slate-600",
                        )}
                      >
                        {row.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className={cn(SX.dataTd, "text-right")}>
                      <div className="flex flex-wrap justify-end gap-1">
                        <button
                          type="button"
                          className={cn(SX.btnSecondary, "px-2 py-1 text-[12px]")}
                          disabled={examBusy}
                          onClick={() => openExamEdit(i)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={cn(
                            SX.btnGhost,
                            "px-2 py-1 text-[12px] text-rose-700",
                          )}
                          disabled={examBusy || exams.length <= 1}
                          onClick={() => void removeExamAt(i)}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading ? (
          <p className="border-t border-slate-100 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-600">
            Internal id is set when an exam is first created and stays stable for
            leads and fees — you can rename the exam anytime.
          </p>
        ) : null}
      </div>

      {/* Subjects catalog */}
      <div className={SX.outerSheet}>
        <div className={SX.toolbar}>
          <div className="min-w-0 flex-1">
            <h2 className={SX.toolbarTitle}>Subjects by exam</h2>
            <p className={SX.toolbarMeta}>
              Each row is one subject under one exam (e.g. NEET → Biology). Use{" "}
              <Link href="/faculties" className="font-medium text-primary underline">
                Faculties
              </Link>{" "}
              to assign teachers.
            </p>
          </div>
          <button
            type="button"
            className={SX.leadBtnGreen}
            disabled={subSectionBusy || exams.length === 0}
            onClick={openSubjectAdd}
          >
            Add subject
          </button>
        </div>
        <div
          className={cn(
            SX.leadStatBar,
            "border-t-0",
            catalogError && "bg-rose-50/80 text-rose-900",
            !catalogError && catalogMessage && "bg-emerald-50/50 text-emerald-900",
          )}
        >
          <span
            className={cn(
              "min-w-0 flex-1 text-[13px] font-medium",
              !catalogError && !catalogMessage && "font-normal text-slate-600",
            )}
            role={catalogError ? "alert" : catalogMessage ? "status" : undefined}
          >
            {catalogLoading
              ? "Loading subjects…"
              : catalogError
                ? catalogError
                : catalogMessage
                  ? catalogMessage
                  : "Edit subjects from the table — saving happens when you confirm each dialog."}
          </span>
        </div>

        {!catalogLoading ? (
          <div className="overflow-x-auto border-b border-slate-200 bg-white">
            <table className={cn(SX.dataTable, "min-w-[640px]")}>
              <thead>
                <tr>
                  <th className={SX.dataTh}>Order</th>
                  <th className={SX.dataTh}>Exam</th>
                  <th className={SX.dataTh}>Subject</th>
                  <th className={SX.dataTh}>Status</th>
                  <th className={cn(SX.dataTh, "text-right")}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {subjectsSorted.length === 0 ? (
                  <tr>
                    <td className={SX.dataTd} colSpan={5}>
                      No subjects yet. Add at least one subject per exam you use.
                    </td>
                  </tr>
                ) : (
                  subjectsSorted.map((s, i) => (
                    <tr
                      key={s.id}
                      className={i % 2 === 1 ? SX.zebraRow : undefined}
                    >
                      <td className={cn(SX.dataTd, "tabular-nums")}>
                        {s.sortOrder}
                      </td>
                      <td className={SX.dataTd}>
                        {labelByValue.get(s.examValue) ?? s.examValue}
                      </td>
                      <td className={cn(SX.dataTd, "font-medium")}>{s.name}</td>
                      <td className={SX.dataTd}>
                        <span
                          className={cn(
                            "inline-block rounded-none px-2 py-0.5 text-[11px] font-semibold uppercase",
                            s.isActive !== false
                              ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100"
                              : "bg-slate-100 text-slate-600",
                          )}
                        >
                          {s.isActive !== false ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className={cn(SX.dataTd, "text-right")}>
                        <div className="flex flex-wrap justify-end gap-1">
                          <button
                            type="button"
                            className={cn(
                              SX.btnSecondary,
                              "px-2 py-1 text-[12px]",
                            )}
                            disabled={catalogBusy}
                            onClick={() => openSubjectEdit(s.id)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={cn(
                              SX.btnGhost,
                              "px-2 py-1 text-[12px] text-rose-700",
                            )}
                            disabled={catalogBusy}
                            onClick={() => void removeSubjectById(s.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {/* Directory */}
      <div id="subjects" className={SX.outerSheet}>
        <div className={SX.toolbar}>
          <div className="min-w-0 flex-1">
            <h2 className={SX.toolbarTitle}>Who teaches what</h2>
            <p className={SX.toolbarMeta}>
              Live view from faculty assignments (or legacy tags).
            </p>
          </div>
          <Link href="/faculties" className={SX.leadBtnGreen}>
            Faculties
          </Link>
        </div>

        {subjectsError ? (
          <p
            className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-[13px] text-rose-900"
            role="alert"
          >
            {subjectsError}{" "}
            <button
              type="button"
              className="underline"
              onClick={() => void loadFaculties({ force: true, showLoading: true })}
            >
              Retry
            </button>
          </p>
        ) : null}

        <div className="overflow-x-auto border-b border-slate-200 bg-white">
          <table className={cn(SX.dataTable, "min-w-[640px]")}>
            <thead>
              <tr>
                <th className={SX.dataTh}>#</th>
                <th className={SX.dataTh}>Exam</th>
                <th className={SX.dataTh}>Subject</th>
                <th className={SX.dataTh}>Faculty</th>
                <th className={SX.dataTh}>Active</th>
              </tr>
            </thead>
            <tbody>
              {subjectsLoading ? (
                <tr>
                  <td className={SX.dataTd} colSpan={5}>
                    Loading…
                  </td>
                </tr>
              ) : subjectRows.length === 0 ? (
                <tr>
                  <td className={SX.dataTd} colSpan={5}>
                    Nothing yet. Add subjects above and link them on{" "}
                    <Link href="/faculties" className="text-primary underline">
                      Faculties
                    </Link>
                    .
                  </td>
                </tr>
              ) : (
                subjectRows.map((s, i) => (
                  <tr key={s.key} className={i % 2 === 1 ? SX.zebraRow : undefined}>
                    <td className={SX.dataTd}>{i + 1}</td>
                    <td className={SX.dataTd}>{s.courses}</td>
                    <td className={cn(SX.dataTd, "font-medium")}>{s.subject}</td>
                    <td className={SX.dataTd}>{s.faculty}</td>
                    <td className={SX.dataTd}>{s.active ? "Yes" : "No"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Exam modal */}
      {examModalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => !examBusy && setExamModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="exam-modal-title"
            className="w-full max-w-md border border-slate-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h2
                id="exam-modal-title"
                className="text-[15px] font-bold text-slate-900"
              >
                {examModalMode === "add" ? "Add exam" : "Edit exam"}
              </h2>
            </div>
            <div className="space-y-3 px-4 py-4">
              {examModalErr ? (
                <p className="text-[13px] text-rose-700" role="alert">
                  {examModalErr}
                </p>
              ) : null}
              {examModalMode === "edit" &&
              examEditIndex !== null &&
              exams[examEditIndex] ? (
                <p className="text-[11px] text-slate-500">
                  Stored id:{" "}
                  <code className="rounded bg-slate-100 px-1 font-mono text-[11px]">
                    {exams[examEditIndex]!.value}
                  </code>
                </p>
              ) : null}
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Exam name
                </span>
                <input
                  className={cn(SX.input, "mt-1 w-full")}
                  value={examDraft.label}
                  onChange={(e) =>
                    setExamDraft((d) => ({ ...d, label: e.target.value }))
                  }
                  placeholder="e.g. NEET"
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Order
                </span>
                <input
                  type="number"
                  className={cn(SX.input, "mt-1 w-full max-w-[120px]")}
                  value={examDraft.sortOrder}
                  onChange={(e) =>
                    setExamDraft((d) => ({
                      ...d,
                      sortOrder: Number(e.target.value) || 0,
                    }))
                  }
                />
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-800">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={examDraft.isActive}
                  onChange={(e) =>
                    setExamDraft((d) => ({ ...d, isActive: e.target.checked }))
                  }
                />
                Active
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-3">
              <button
                type="button"
                className={SX.btnSecondary}
                disabled={examBusy}
                onClick={() => setExamModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={SX.leadBtnGreen}
                disabled={examBusy}
                onClick={() => void commitExamModal()}
              >
                {examBusy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Subject modal */}
      {subModalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => !catalogBusy && setSubModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sub-modal-title"
            className="w-full max-w-md border border-slate-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h2
                id="sub-modal-title"
                className="text-[15px] font-bold text-slate-900"
              >
                {subModalMode === "add" ? "Add subject" : "Edit subject"}
              </h2>
            </div>
            <div className="space-y-3 px-4 py-4">
              {subModalErr ? (
                <p className="text-[13px] text-rose-700" role="alert">
                  {subModalErr}
                </p>
              ) : null}
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Exam
                </span>
                <select
                  className={cn(SX.select, "mt-1 w-full")}
                  value={subDraft.examValue}
                  onChange={(e) =>
                    setSubDraft((d) => ({ ...d, examValue: e.target.value }))
                  }
                >
                  {exams.map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Subject name
                </span>
                <input
                  className={cn(SX.input, "mt-1 w-full")}
                  value={subDraft.name}
                  onChange={(e) =>
                    setSubDraft((d) => ({ ...d, name: e.target.value }))
                  }
                  placeholder="e.g. Biology"
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Order
                </span>
                <input
                  type="number"
                  className={cn(SX.input, "mt-1 w-full max-w-[120px]")}
                  value={subDraft.sortOrder}
                  onChange={(e) =>
                    setSubDraft((d) => ({
                      ...d,
                      sortOrder: Number(e.target.value) || 0,
                    }))
                  }
                />
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-800">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={subDraft.isActive}
                  onChange={(e) =>
                    setSubDraft((d) => ({ ...d, isActive: e.target.checked }))
                  }
                />
                Active
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-3">
              <button
                type="button"
                className={SX.btnSecondary}
                disabled={catalogBusy}
                onClick={() => setSubModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={SX.leadBtnGreen}
                disabled={catalogBusy}
                onClick={() => void commitSubjectModal()}
              >
                {catalogBusy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
