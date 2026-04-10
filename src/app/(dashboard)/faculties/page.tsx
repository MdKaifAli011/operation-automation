"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useExamSubjectCatalog } from "@/hooks/useExamSubjectCatalog";
import { useTargetExamOptions } from "@/hooks/useTargetExamOptions";
import type { Faculty, FacultyAssignment } from "@/lib/types";
import type { FacultyPayload } from "@/lib/parseFacultyPayload";
import type { ExamSubjectEntry } from "@/lib/examSubjectTypes";
import { cn } from "@/lib/cn";

function dedupeAssignments(pairs: FacultyAssignment[]): FacultyAssignment[] {
  const seen = new Set<string>();
  const out: FacultyAssignment[] = [];
  for (const p of pairs) {
    const k = `${p.examValue}\0${p.subjectId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

/** Best-effort map legacy free-text subjects to catalog rows for the same course. */
function inferAssignmentsFromLegacy(
  f: Faculty,
  catalog: ExamSubjectEntry[],
): FacultyAssignment[] {
  const courses = f.courses?.length ? [...f.courses] : [];
  const subs = f.subjects ?? [];
  if (!courses.length || !subs.length) return [];
  const out: FacultyAssignment[] = [];
  for (const exam of courses) {
    const entries = catalog.filter(
      (e) => e.examValue === exam && e.isActive !== false,
    );
    for (const subjName of subs) {
      const hit = entries.find(
        (e) => e.name.toLowerCase() === subjName.trim().toLowerCase(),
      );
      if (hit) out.push({ examValue: exam, subjectId: hit.id });
    }
  }
  return dedupeAssignments(out);
}

type FormState = {
  name: string;
  email: string;
  phone: string;
  assignments: FacultyAssignment[];
  qualification: string;
  experience: string;
  joined: string;
  active: boolean;
};

const emptyForm = (): FormState => ({
  name: "",
  email: "",
  phone: "",
  assignments: [],
  qualification: "",
  experience: "",
  joined: "",
  active: true,
});

function facultyToForm(f: Faculty): FormState {
  return {
    name: f.name,
    email: f.email,
    phone: f.phone,
    assignments: [...(f.assignments ?? [])],
    qualification: f.qualification,
    experience: String(f.experience ?? 0),
    joined: f.joined || "",
    active: f.active,
  };
}

function formToPayload(form: FormState): FacultyPayload {
  const experienceNum =
    form.experience.trim() === ""
      ? 0
      : Math.max(0, Math.round(Number(form.experience) || 0));
  return {
    name: form.name.trim(),
    email: form.email.trim(),
    phone: form.phone.replace(/\s+/g, "").trim(),
    subjects: [],
    courses: [],
    assignments: dedupeAssignments(form.assignments),
    qualification: form.qualification.trim(),
    experience: experienceNum,
    joined: form.joined.trim(),
    active: form.active,
  };
}

function payloadFromFaculty(
  f: Faculty,
  overrides: Partial<FacultyPayload> = {},
): FacultyPayload {
  const base: FacultyPayload = {
    name: f.name,
    email: f.email,
    phone: f.phone,
    subjects: [...f.subjects],
    courses: [...(f.courses ?? [])],
    qualification: f.qualification,
    experience: f.experience,
    joined: f.joined,
    active: f.active,
  };
  const asg = f.assignments ?? [];
  if (asg.length > 0) {
    return { ...base, assignments: [...asg], ...overrides };
  }
  return { ...base, ...overrides };
}

const btnOutline =
  "inline-flex items-center justify-center border border-[#e0e0e0] bg-white px-3 py-1.5 text-sm font-medium text-[#424242] transition-colors hover:bg-[#fafafa]";
const btnGreen =
  "inline-flex items-center justify-center bg-[#2e7d32] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-60";
const btnDanger =
  "inline-flex items-center justify-center border border-[#ffcdd2] bg-[#ffebee] px-3 py-1.5 text-sm font-medium text-[#c62828] hover:bg-[#ffcdd2]/40";

export default function FacultiesPage() {
  const { activeValues, labelFor } = useTargetExamOptions();
  const {
    subjects: catalogSubjects,
    loading: catalogLoading,
    nameById: catalogNameById,
  } = useExamSubjectCatalog();
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Faculty | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toggleBusyId, setToggleBusyId] = useState<string | null>(null);
  const [pickExam, setPickExam] = useState("");
  const [pickSubjectId, setPickSubjectId] = useState("");
  const inferLockRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/faculties", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load faculty");
      const data = (await res.json()) as Faculty[];
      setFaculty(Array.isArray(data) ? data : []);
    } catch {
      setListError(
        "Could not load faculty. Check MongoDB connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = useCallback(() => {
    inferLockRef.current = null;
    setDrawerMode("create");
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setPickExam(activeValues[0] ?? "");
    setPickSubjectId("");
    setDrawerOpen(true);
  }, [activeValues]);

  const openEdit = useCallback((f: Faculty) => {
    inferLockRef.current = null;
    setDrawerMode("edit");
    setEditingId(f.id);
    setForm(facultyToForm(f));
    setFormError(null);
    setPickExam(
      (f.assignments?.[0]?.examValue as string | undefined) ??
        activeValues[0] ??
        "",
    );
    setPickSubjectId("");
    setDrawerOpen(true);
  }, [activeValues]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setFormError(null);
    setEditingId(null);
  }, []);

  const subjectsForPickExam = useMemo(() => {
    if (!pickExam) return [];
    return catalogSubjects
      .filter((s) => s.examValue === pickExam && s.isActive !== false)
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      );
  }, [catalogSubjects, pickExam]);

  useEffect(() => {
    if (!drawerOpen || drawerMode !== "edit" || !editingId) {
      inferLockRef.current = null;
      return;
    }
    if (catalogLoading) return;
    if (inferLockRef.current === editingId) return;
    const f = faculty.find((x) => x.id === editingId);
    if (!f) return;
    if ((f.assignments?.length ?? 0) > 0) {
      inferLockRef.current = editingId;
      return;
    }
    const inferred = inferAssignmentsFromLegacy(f, catalogSubjects);
    inferLockRef.current = editingId;
    if (inferred.length > 0) {
      setForm((prev) => ({ ...prev, assignments: inferred }));
    }
  }, [
    drawerOpen,
    drawerMode,
    editingId,
    faculty,
    catalogSubjects,
    catalogLoading,
  ]);

  const addTeachingPair = useCallback(() => {
    const exam = pickExam.trim();
    const sid = pickSubjectId.trim();
    if (!exam || !sid) return;
    setForm((prev) => ({
      ...prev,
      assignments: dedupeAssignments([
        ...prev.assignments,
        { examValue: exam, subjectId: sid },
      ]),
    }));
    setPickSubjectId("");
  }, [pickExam, pickSubjectId]);

  const removeTeachingPair = useCallback((examValue: string, subjectId: string) => {
    setForm((prev) => ({
      ...prev,
      assignments: prev.assignments.filter(
        (a) => !(a.examValue === examValue && a.subjectId === subjectId),
      ),
    }));
  }, []);

  const submitForm = useCallback(async () => {
    setFormError(null);
    const payload = formToPayload(form);
    if (!payload.name) {
      setFormError("Please enter a name.");
      return;
    }
    setSaving(true);
    try {
      const isEdit = drawerMode === "edit" && editingId;
      const url = isEdit
        ? `/api/faculties/${encodeURIComponent(editingId!)}`
        : "/api/faculties";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Request failed.");
      }
      await load();
      closeDrawer();
      setForm(emptyForm());
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [form, drawerMode, editingId, load, closeDrawer]);

  const toggleActive = useCallback(
    async (f: Faculty) => {
      setToggleBusyId(f.id);
      setListError(null);
      try {
        const res = await fetch(`/api/faculties/${encodeURIComponent(f.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadFromFaculty(f, { active: !f.active })),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error || "Update failed.");
        await load();
      } catch (e) {
        setListError(
          e instanceof Error ? e.message : "Could not update status.",
        );
      } finally {
        setToggleBusyId(null);
      }
    },
    [load],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setListError(null);
    try {
      const res = await fetch(
        `/api/faculties/${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Delete failed.");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, load]);

  const countLabel = useMemo(
    () =>
      faculty.length === 1
        ? "1 faculty member"
        : `${faculty.length} faculty members`,
    [faculty.length],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#212121]">
            Faculty Management
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#757575]">
            Create and manage teachers. Tag <strong>exam + subject</strong> pairs from{" "}
            <Link href="/exams-subjects" className="font-medium text-[#1565c0] underline">
              Exams &amp; subjects
            </Link>
            . They appear when scheduling demos and in subject pickers.{" "}
            <Link href="/" className="font-medium text-[#1565c0] underline">
              Back to leads
            </Link>
          </p>
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-[#9e9e9e]">
            {loading ? "Loading…" : countLabel}
          </p>
        </div>
        <button type="button" onClick={openCreate} className={btnGreen}>
          + Add faculty
        </button>
      </div>

      {listError ? (
        <div
          className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
          role="alert"
        >
          {listError}{" "}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => void load()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-[#757575]">Loading faculty…</p>
      ) : faculty.length === 0 ? (
        <div className="border border-dashed border-[#bdbdbd] bg-[#fafafa] px-6 py-14 text-center">
          <p className="text-base font-semibold text-[#424242]">
            No faculty yet
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#757575]">
            Add your first teacher to use them on student demos and schedules.
          </p>
          <button
            type="button"
            className={cn(btnGreen, "mt-6")}
            onClick={openCreate}
          >
            + Add faculty
          </button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto border border-[#e0e0e0] md:block">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#e0e0e0] bg-[#f8f9fa] text-left text-xs font-bold uppercase tracking-wide text-[#757575]">
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Teaching</th>
                  <th className="px-3 py-3">Phone</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Qualification</th>
                  <th className="px-3 py-3 text-center">Exp.</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {faculty.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-[#eeeeee] bg-white last:border-b-0"
                  >
                    <td className="px-3 py-3 font-semibold text-[#212121]">
                      {f.name}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex max-w-[320px] flex-wrap gap-1">
                        {(f.assignments?.length ?? 0) > 0 ? (
                          f.assignments!.map((a) => (
                            <span
                              key={`${a.examValue}:${a.subjectId}`}
                              className="border border-[#bbdefb] bg-[#e3f2fd] px-1.5 py-0.5 text-[11px] text-[#1565c0]"
                            >
                              {labelFor(a.examValue)} ·{" "}
                              {catalogNameById.get(a.subjectId) ??
                                a.subjectId}
                            </span>
                          ))
                        ) : f.subjects.length ? (
                          f.subjects.map((s) => (
                            <span
                              key={s}
                              className="border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-950"
                            >
                              {s}
                            </span>
                          ))
                        ) : (
                          <span className="text-[#bdbdbd]">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-[#616161]">
                      {f.phone || "—"}
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-3 text-[#616161]">
                      {f.email || "—"}
                    </td>
                    <td className="max-w-[140px] truncate px-3 py-3 text-[#616161]">
                      {f.qualification || "—"}
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums text-[#616161]">
                      {f.experience ?? 0}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "inline-block border px-2 py-0.5 text-xs font-semibold",
                          f.active
                            ? "border-[#c8e6c9] bg-[#e8f5e9] text-[#2e7d32]"
                            : "border-[#e0e0e0] bg-[#f5f5f5] text-[#757575]",
                        )}
                      >
                        {f.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          className={btnOutline}
                          onClick={() => openEdit(f)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={btnOutline}
                          disabled={toggleBusyId === f.id}
                          onClick={() => void toggleActive(f)}
                        >
                          {toggleBusyId === f.id
                            ? "…"
                            : f.active
                              ? "Deactivate"
                              : "Activate"}
                        </button>
                        <button
                          type="button"
                          className={btnDanger}
                          onClick={() => setDeleteTarget(f)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {faculty.map((f) => (
              <li
                key={f.id}
                className="border border-[#e0e0e0] bg-white p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-[#1565c0] text-sm font-bold text-white">
                    {f.name
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold text-[#212121]">{f.name}</h2>
                      <span
                        className={cn(
                          "border px-2 py-0.5 text-[11px] font-semibold",
                          f.active
                            ? "border-[#c8e6c9] bg-[#e8f5e9] text-[#2e7d32]"
                            : "border-[#e0e0e0] bg-[#f5f5f5] text-[#757575]",
                        )}
                      >
                        {f.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(f.assignments?.length ?? 0) > 0 ? (
                        f.assignments!.map((a) => (
                          <span
                            key={`${a.examValue}:${a.subjectId}`}
                            className="border border-[#bbdefb] bg-[#e3f2fd] px-2 py-0.5 text-xs text-[#1565c0]"
                          >
                            {labelFor(a.examValue)} ·{" "}
                            {catalogNameById.get(a.subjectId) ?? a.subjectId}
                          </span>
                        ))
                      ) : f.subjects.length ? (
                        f.subjects.map((s) => (
                          <span
                            key={s}
                            className="border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-950"
                          >
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-[#bdbdbd]">
                          Not set
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-[#616161]">{f.phone}</p>
                    <p className="text-sm text-[#616161]">{f.email}</p>
                    {(f.qualification || f.experience != null) && (
                      <p className="mt-1 text-xs text-[#9e9e9e]">
                        {f.qualification}
                        {f.qualification && f.experience != null ? " · " : ""}
                        {f.experience != null ? `${f.experience} yrs` : ""}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={btnOutline}
                        onClick={() => openEdit(f)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={btnOutline}
                        disabled={toggleBusyId === f.id}
                        onClick={() => void toggleActive(f)}
                      >
                        {toggleBusyId === f.id
                          ? "…"
                          : f.active
                            ? "Deactivate"
                            : "Activate"}
                      </button>
                      <button
                        type="button"
                        className={btnDanger}
                        onClick={() => setDeleteTarget(f)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Drawer: create / edit */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close"
            onClick={closeDrawer}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="faculty-drawer-title"
            className="relative z-10 flex h-full w-full max-w-md flex-col overflow-hidden border-l border-[#e0e0e0] bg-white shadow-xl"
          >
            <div className="border-b border-[#eeeeee] px-5 py-4">
              <div className="flex items-center justify-between gap-2">
                <h2
                  id="faculty-drawer-title"
                  className="text-lg font-bold text-[#212121]"
                >
                  {drawerMode === "create" ? "Add faculty" : "Edit faculty"}
                </h2>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center text-xl leading-none text-[#757575] hover:bg-[#f5f5f5]"
                  onClick={closeDrawer}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <p className="mt-2 text-sm text-[#757575]">
                {drawerMode === "create"
                  ? "Creates a new record in the database."
                  : "Changes apply immediately after you save."}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {formError ? (
                <p className="mb-4 text-sm text-rose-700" role="alert">
                  {formError}
                </p>
              ) : null}
              <form
                className="space-y-4 text-sm"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitForm();
                }}
              >
                <div className="rounded border border-[#e8eaf0] bg-[#fafbfd] p-3">
                  <span className="text-[13px] font-semibold text-[#424242]">
                    What they teach
                  </span>
                  <p className="mt-1 text-[11px] leading-snug text-[#757575]">
                    Pick an exam, then a subject from your catalog, then Add.
                    Manage lists under{" "}
                    <Link
                      href="/exams-subjects"
                      className="font-medium text-[#1565c0] underline"
                    >
                      Exams &amp; subjects
                    </Link>
                    .
                  </p>
                  {catalogLoading ? (
                    <p className="mt-2 text-[12px] text-[#9e9e9e]">
                      Loading subject catalog…
                    </p>
                  ) : (
                    <>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                        <label className="min-w-0 flex-1">
                          <span className="text-[11px] font-medium text-[#757575]">
                            Exam
                          </span>
                          <select
                            className="mt-1 w-full border border-[#e0e0e0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#1565c0]"
                            value={pickExam}
                            onChange={(e) => {
                              setPickExam(e.target.value);
                              setPickSubjectId("");
                            }}
                            aria-label="Exam"
                          >
                            {activeValues.length === 0 ? (
                              <option value="">No exams in settings</option>
                            ) : (
                              activeValues.map((c) => (
                                <option key={c} value={c}>
                                  {labelFor(c)}
                                </option>
                              ))
                            )}
                          </select>
                        </label>
                        <label className="min-w-0 flex-1">
                          <span className="text-[11px] font-medium text-[#757575]">
                            Subject
                          </span>
                          <select
                            className="mt-1 w-full border border-[#e0e0e0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#1565c0]"
                            value={pickSubjectId}
                            onChange={(e) => setPickSubjectId(e.target.value)}
                            disabled={!pickExam || subjectsForPickExam.length === 0}
                            aria-label="Subject"
                          >
                            <option value="">
                              {!pickExam
                                ? "Pick exam first"
                                : subjectsForPickExam.length === 0
                                  ? "Add active subjects for this exam"
                                  : "Select subject"}
                            </option>
                            {subjectsForPickExam.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          className={cn(btnOutline, "shrink-0 py-2.5")}
                          disabled={!pickExam || !pickSubjectId}
                          onClick={addTeachingPair}
                        >
                          Add
                        </button>
                      </div>
                      <div className="mt-3 flex min-h-[2rem] flex-wrap gap-1.5">
                        {form.assignments.length === 0 ? (
                          <span className="text-[12px] text-[#bdbdbd]">
                            No exam–subject pairs yet
                          </span>
                        ) : (
                          form.assignments.map((a) => (
                            <span
                              key={`${a.examValue}:${a.subjectId}`}
                              className="inline-flex items-center gap-1 border border-[#c5cae9] bg-white px-2 py-1 text-[12px] text-[#37474f]"
                            >
                              <span>
                                {labelFor(a.examValue)} ·{" "}
                                {catalogNameById.get(a.subjectId) ??
                                  a.subjectId}
                              </span>
                              <button
                                type="button"
                                className="text-[14px] leading-none text-rose-700 hover:text-rose-900"
                                aria-label="Remove"
                                onClick={() =>
                                  removeTeachingPair(
                                    a.examValue,
                                    a.subjectId,
                                  )
                                }
                              >
                                ×
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
                <label className="block">
                  <span className="text-[#616161]">Name *</span>
                  <input
                    required
                    value={form.name}
                    onChange={(e) =>
                      setForm((x) => ({ ...x, name: e.target.value }))
                    }
                    className="mt-1 w-full border border-[#e0e0e0] bg-white px-3 py-2.5 outline-none focus:border-[#1565c0] focus:ring-1 focus:ring-[#1565c0]"
                  />
                </label>
                <label className="block">
                  <span className="text-[#616161]">Email</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((x) => ({ ...x, email: e.target.value }))
                    }
                    className="mt-1 w-full border border-[#e0e0e0] bg-white px-3 py-2.5 outline-none focus:border-[#1565c0] focus:ring-1 focus:ring-[#1565c0]"
                  />
                </label>
                <label className="block">
                  <span className="text-[#616161]">Phone</span>
                  <input
                    value={form.phone}
                    onChange={(e) =>
                      setForm((x) => ({ ...x, phone: e.target.value }))
                    }
                    className="mt-1 w-full border border-[#e0e0e0] bg-white px-3 py-2.5 outline-none focus:border-[#1565c0] focus:ring-1 focus:ring-[#1565c0]"
                  />
                </label>
                <label className="block">
                  <span className="text-[#616161]">Status</span>
                  <select
                    className="mt-1 w-full border border-[#e0e0e0] bg-white px-3 py-2.5 outline-none focus:border-[#1565c0] focus:ring-1 focus:ring-[#1565c0]"
                    value={form.active ? "active" : "inactive"}
                    onChange={(e) =>
                      setForm((x) => ({
                        ...x,
                        active: e.target.value === "active",
                      }))
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                <details className="rounded border border-[#eeeeee] bg-[#fafafa] px-3 py-2">
                  <summary className="cursor-pointer text-[13px] font-medium text-[#424242]">
                    More details (optional)
                  </summary>
                  <div className="mt-3 space-y-4 pb-1">
                    <label className="block">
                      <span className="text-[#616161]">Qualification</span>
                      <input
                        value={form.qualification}
                        onChange={(e) =>
                          setForm((x) => ({
                            ...x,
                            qualification: e.target.value,
                          }))
                        }
                        className="mt-1 w-full border border-[#e0e0e0] bg-white px-3 py-2.5 outline-none focus:border-[#1565c0] focus:ring-1 focus:ring-[#1565c0]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[#616161]">Experience (years)</span>
                      <input
                        type="number"
                        min={0}
                        value={form.experience}
                        onChange={(e) =>
                          setForm((x) => ({
                            ...x,
                            experience: e.target.value,
                          }))
                        }
                        className="mt-1 w-full border border-[#e0e0e0] bg-white px-3 py-2.5 outline-none focus:border-[#1565c0] focus:ring-1 focus:ring-[#1565c0]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[#616161]">Joining date</span>
                      <input
                        type="date"
                        value={form.joined}
                        onChange={(e) =>
                          setForm((x) => ({ ...x, joined: e.target.value }))
                        }
                        className="mt-1 w-full border border-[#e0e0e0] bg-white px-3 py-2.5 outline-none focus:border-[#1565c0] focus:ring-1 focus:ring-[#1565c0]"
                      />
                    </label>
                  </div>
                </details>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    className={cn(btnOutline, "flex-1 py-3")}
                    onClick={closeDrawer}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className={cn(btnGreen, "flex-1 py-3")}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div
            role="alertdialog"
            aria-labelledby="delete-faculty-title"
            aria-describedby="delete-faculty-desc"
            className="w-full max-w-md border border-[#e0e0e0] bg-white p-6 shadow-xl"
          >
            <h2
              id="delete-faculty-title"
              className="text-lg font-bold text-[#212121]"
            >
              Delete faculty?
            </h2>
            <p id="delete-faculty-desc" className="mt-3 text-sm text-[#616161]">
              This removes{" "}
              <strong className="text-[#212121]">{deleteTarget.name}</strong>{" "}
              from the database. Demo rows that reference this name by text are
              not changed.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={btnOutline}
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center bg-[#c62828] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                disabled={deleting}
                onClick={() => void confirmDelete()}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
