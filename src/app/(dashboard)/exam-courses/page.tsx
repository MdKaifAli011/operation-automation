"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";
import { randomUuid } from "@/lib/randomUuid";
import {
  normalizeTargetExams,
  type TargetExamOption,
} from "@/lib/targetExams";
import {
  normalizeExamCourseEntries,
  type ExamCourseEntry,
} from "@/lib/examCourseTypes";

export default function ExamCoursesPage() {
  const [exams, setExams] = useState<TargetExamOption[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);

  const [catalogCourses, setCatalogCourses] = useState<ExamCourseEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    examValue: "",
    name: "",
    sortOrder: 0,
    isActive: true,
  });
  const [modalErr, setModalErr] = useState<string | null>(null);

  const labelByValue = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of exams) m.set(e.value, e.label);
    return m;
  }, [exams]);

  const coursesSorted = useMemo(
    () =>
      [...catalogCourses].sort((a, b) => {
        const c = a.examValue.localeCompare(b.examValue);
        return c !== 0
          ? c
          : a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
      }),
    [catalogCourses],
  );

  const loadExams = useCallback(async () => {
    setExamsLoading(true);
    try {
      const res = await fetch("/api/settings/target-exams", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("load");
      const data = (await res.json()) as { exams?: unknown };
      setExams(normalizeTargetExams(data.exams));
    } catch {
      setExams([]);
    } finally {
      setExamsLoading(false);
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const res = await fetch("/api/settings/exam-courses", {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        courses?: unknown;
        error?: string;
      };
      if (!res.ok) {
        setCatalogError(
          typeof data.error === "string" ? data.error : "Load failed.",
        );
        setCatalogCourses([]);
        return;
      }
      setCatalogCourses(normalizeExamCourseEntries(data.courses));
    } catch {
      setCatalogError("Could not load courses.");
      setCatalogCourses([]);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadExams();
  }, [loadExams]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const persistCatalog = async (next: ExamCourseEntry[]) => {
    setCatalogBusy(true);
    setCatalogError(null);
    setCatalogMessage(null);
    try {
      const res = await fetch("/api/settings/exam-courses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courses: next }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        courses?: unknown;
        error?: string;
      };
      if (!res.ok) {
        setCatalogError(
          typeof data.error === "string" ? data.error : "Save failed.",
        );
        return false;
      }
      setCatalogCourses(normalizeExamCourseEntries(data.courses));
      setCatalogMessage("Courses saved.");
      return true;
    } catch {
      setCatalogError("Network error.");
      return false;
    } finally {
      setCatalogBusy(false);
    }
  };

  const openAdd = () => {
    const first = exams[0]?.value ?? "";
    const maxO = catalogCourses
      .filter((c) => c.examValue === first)
      .reduce((m, c) => Math.max(m, c.sortOrder), 0);
    setModalMode("add");
    setEditId(null);
    setDraft({
      examValue: first,
      name: "",
      sortOrder: maxO + 1,
      isActive: true,
    });
    setModalErr(null);
    setModalOpen(true);
  };

  const openEdit = (id: string) => {
    const row = catalogCourses.find((c) => c.id === id);
    if (!row) return;
    setModalMode("edit");
    setEditId(id);
    setDraft({
      examValue: row.examValue,
      name: row.name,
      sortOrder: row.sortOrder,
      isActive: row.isActive !== false,
    });
    setModalErr(null);
    setModalOpen(true);
  };

  const commitModal = async () => {
    const name = draft.name.trim();
    if (!name) {
      setModalErr("Course name is required.");
      return;
    }
    if (!draft.examValue) {
      setModalErr("Select an exam.");
      return;
    }
    let next: ExamCourseEntry[];
    if (modalMode === "add") {
      next = [
        ...catalogCourses,
        {
          id: randomUuid(),
          examValue: draft.examValue,
          name,
          sortOrder: draft.sortOrder,
          isActive: draft.isActive,
        },
      ];
    } else {
      if (!editId) return;
      next = catalogCourses.map((c) =>
        c.id === editId
          ? {
              ...c,
              examValue: draft.examValue,
              name,
              sortOrder: draft.sortOrder,
              isActive: draft.isActive,
            }
          : c,
      );
    }
    const ok = await persistCatalog(next);
    if (ok) setModalOpen(false);
  };

  const removeAt = async (id: string) => {
    if (!window.confirm("Remove this course from the catalog?")) return;
    await persistCatalog(catalogCourses.filter((c) => c.id !== id));
  };

  const showSpinner = examsLoading || catalogLoading;

  return (
    <div className={SX.pageWrap}>
      <div className={SX.outerSheet}>
        <div className={SX.toolbar}>
          <div className="min-w-0 flex-1">
            <h1 className={SX.toolbarTitle}>Exam courses</h1>
            <p className={SX.toolbarMeta}>
              Define course tracks under each target exam (e.g. classroom vs
              online). These drive{" "}
              <Link href="/fee-management" className="font-medium text-primary underline">
                fee defaults
              </Link>{" "}
              and{" "}
              <Link
                href="/course-brochure"
                className="font-medium text-primary underline"
              >
                course brochures
              </Link>
              . Exams are managed under{" "}
              <Link
                href="/exams-subjects"
                className="font-medium text-primary underline"
              >
                Exams &amp; subjects
              </Link>
              .
            </p>
          </div>
          <button
            type="button"
            className={SX.leadBtnGreen}
            disabled={catalogBusy || exams.length === 0}
            onClick={openAdd}
          >
            Add course
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
            {showSpinner
              ? "Loading…"
              : catalogError
                ? catalogError
                : catalogMessage
                  ? catalogMessage
                  : "Each row is one course under one exam — stable ids stay tied to fees and brochures."}
          </span>
        </div>

        {!catalogLoading ? (
          <div className="overflow-x-auto border-b border-slate-200 bg-white">
            <table className={cn(SX.dataTable, "min-w-[640px]")}>
              <thead>
                <tr>
                  <th className={SX.dataTh}>Order</th>
                  <th className={SX.dataTh}>Exam</th>
                  <th className={SX.dataTh}>Course</th>
                  <th className={SX.dataTh}>Status</th>
                  <th className={cn(SX.dataTh, "text-right")}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {coursesSorted.length === 0 ? (
                  <tr>
                    <td className={SX.dataTd} colSpan={5}>
                      No courses yet. Add at least one course per exam you charge
                      or brochure for.
                    </td>
                  </tr>
                ) : (
                  coursesSorted.map((c, i) => (
                    <tr
                      key={c.id}
                      className={i % 2 === 1 ? SX.zebraRow : undefined}
                    >
                      <td className={cn(SX.dataTd, "tabular-nums")}>
                        {c.sortOrder}
                      </td>
                      <td className={SX.dataTd}>
                        {labelByValue.get(c.examValue) ?? c.examValue}
                      </td>
                      <td className={cn(SX.dataTd, "font-medium")}>{c.name}</td>
                      <td className={SX.dataTd}>
                        <span
                          className={cn(
                            "inline-block rounded-none px-2 py-0.5 text-[11px] font-semibold uppercase",
                            c.isActive !== false
                              ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100"
                              : "bg-slate-100 text-slate-600",
                          )}
                        >
                          {c.isActive !== false ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className={cn(SX.dataTd, "text-right")}>
                        <div className="flex flex-wrap justify-end gap-1">
                          <button
                            type="button"
                            className={cn(SX.btnSecondary, "px-2 py-1 text-[12px]")}
                            disabled={catalogBusy}
                            onClick={() => openEdit(c.id)}
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
                            onClick={() => void removeAt(c.id)}
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

        {!catalogLoading ? (
          <p className="border-t border-slate-100 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-600">
            Internal id is assigned when a course is created and stays stable for
            fee rows and brochure uploads.
          </p>
        ) : null}
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => !catalogBusy && setModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-modal-title"
            className="w-full max-w-md border border-slate-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h2
                id="course-modal-title"
                className="text-[15px] font-bold text-slate-900"
              >
                {modalMode === "add" ? "Add course" : "Edit course"}
              </h2>
            </div>
            <div className="space-y-3 px-4 py-4">
              {modalErr ? (
                <p className="text-[13px] text-rose-700" role="alert">
                  {modalErr}
                </p>
              ) : null}
              {modalMode === "edit" && editId ? (
                <p className="text-[11px] text-slate-500">
                  Stored id:{" "}
                  <code className="rounded bg-slate-100 px-1 font-mono text-[11px]">
                    {editId}
                  </code>
                </p>
              ) : null}
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Exam
                </span>
                <select
                  className={cn(SX.select, "mt-1 w-full")}
                  value={draft.examValue}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, examValue: e.target.value }))
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
                  Course name
                </span>
                <input
                  className={cn(SX.input, "mt-1 w-full")}
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: e.target.value }))
                  }
                  placeholder="e.g. Classroom batch · Weekend"
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
                  value={draft.sortOrder}
                  onChange={(e) =>
                    setDraft((d) => ({
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
                  checked={draft.isActive}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, isActive: e.target.checked }))
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
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={SX.leadBtnGreen}
                disabled={catalogBusy}
                onClick={() => void commitModal()}
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
