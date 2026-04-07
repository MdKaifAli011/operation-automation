"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type MeetLinkRow = {
  id: string;
  url: string;
  label: string;
  active: boolean;
  sortOrder: number;
};

const btnGreen =
  "inline-flex items-center justify-center rounded-none bg-[#2e7d32] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-60";
const btnOutline =
  "inline-flex items-center justify-center rounded-none border border-[#e0e0e0] bg-white px-3 py-1.5 text-sm font-medium text-[#424242] transition-colors hover:bg-[#fafafa] disabled:opacity-50";
const btnDanger =
  "inline-flex items-center justify-center rounded-none border border-[#ffcdd2] bg-[#ffebee] px-3 py-1.5 text-sm font-medium text-[#c62828] hover:bg-[#ffcdd2]/40 disabled:opacity-50";

export default function MeetLinksPage() {
  const [links, setLinks] = useState<MeetLinkRow[]>([]);
  const [holdMinutes, setHoldMinutes] = useState<number>(300);
  const [teacherBlockMinutes, setTeacherBlockMinutes] = useState<number>(120);
  const [demoAutoCompleteMinutes, setDemoAutoCompleteMinutes] =
    useState<number>(300);
  const [teacherFeedbackAfterMinutes, setTeacherFeedbackAfterMinutes] =
    useState<number>(45);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/meet-links", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as {
        links?: MeetLinkRow[];
        holdDurationMinutes?: number;
        teacherBlockMinutes?: number;
        demoAutoCompleteAfterMinutes?: number;
        teacherFeedbackAfterMinutes?: number;
      };
      setLinks(Array.isArray(data.links) ? data.links : []);
      if (
        typeof data.holdDurationMinutes === "number" &&
        Number.isFinite(data.holdDurationMinutes)
      ) {
        setHoldMinutes(data.holdDurationMinutes);
      }
      if (
        typeof data.teacherBlockMinutes === "number" &&
        Number.isFinite(data.teacherBlockMinutes)
      ) {
        setTeacherBlockMinutes(data.teacherBlockMinutes);
      }
      if (
        typeof data.demoAutoCompleteAfterMinutes === "number" &&
        Number.isFinite(data.demoAutoCompleteAfterMinutes)
      ) {
        setDemoAutoCompleteMinutes(data.demoAutoCompleteAfterMinutes);
      }
      if (
        typeof data.teacherFeedbackAfterMinutes === "number" &&
        Number.isFinite(data.teacherFeedbackAfterMinutes)
      ) {
        setTeacherFeedbackAfterMinutes(data.teacherFeedbackAfterMinutes);
      }
    } catch {
      setListError("Could not load Meet links. Check MongoDB and try again.");
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addLink = useCallback(async () => {
    setAddError(null);
    const u = url.trim();
    if (!u || !/^https?:\/\//i.test(u)) {
      setAddError("Enter a valid http(s) URL (e.g. a Google Meet link).");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/meet-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u, label: label.trim(), active: true }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setAddError(data.error ?? "Could not add link.");
        return;
      }
      setUrl("");
      setLabel("");
      await load();
    } catch {
      setAddError("Could not add link.");
    } finally {
      setAdding(false);
    }
  }, [url, label, load]);

  const toggleActive = useCallback(
    async (row: MeetLinkRow) => {
      setBusyId(row.id);
      try {
        const res = await fetch(`/api/meet-links/${encodeURIComponent(row.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: !row.active }),
        });
        if (!res.ok) return;
        await load();
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const remove = useCallback(async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/meet-links/${encodeURIComponent(deleteId)}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setListError(data.error ?? "Could not delete.");
        setDeleteId(null);
        return;
      }
      setDeleteId(null);
      await load();
    } finally {
      setDeleting(false);
    }
  }, [deleteId, load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#212121]">Google Meet links</h1>
        <div className="mt-1 max-w-2xl space-y-2 text-sm leading-relaxed text-[#616161]">
          <p>
            Add the Google Meet URLs your team reuses for trial classes. When
            someone schedules a demo, the app assigns a link that is not already
            booked for that window.
          </p>
          <ul className="list-inside list-disc space-y-1 text-[13px] text-[#424242]">
            <li>
              <span className="font-medium">Meet link hold:</span>{" "}
              <span className="tabular-nums">{holdMinutes}</span> minutes from
              the scheduled start (
              <code className="rounded bg-slate-100 px-1 text-[12px]">
                MEET_HOLD_DURATION_MINUTES
              </code>
              ).
            </li>
            <li>
              <span className="font-medium">Teacher double-booking:</span> the
              same teacher cannot overlap another demo for{" "}
              <span className="tabular-nums">{teacherBlockMinutes}</span> minutes
              (
              <code className="rounded bg-slate-100 px-1 text-[12px]">
                TEACHER_DEMO_BLOCK_MINUTES
              </code>
              ).
            </li>
            <li>
              <span className="font-medium">Auto-complete:</span> rows left as
              Scheduled are marked Completed after{" "}
              <span className="tabular-nums">{demoAutoCompleteMinutes}</span>{" "}
              minutes (
              <code className="rounded bg-slate-100 px-1 text-[12px]">
                DEMO_AUTO_COMPLETE_AFTER_MINUTES
              </code>
              )              . Cancelling a demo releases Meet and teacher for that slot.
            </li>
            <li>
              <span className="font-medium">Teacher feedback link:</span> staff
              can send a one-time form{" "}
              <span className="tabular-nums">{teacherFeedbackAfterMinutes}</span>{" "}
              minutes after the demo start (
              <code className="rounded bg-slate-100 px-1 text-[12px]">
                DEMO_TEACHER_FEEDBACK_AFTER_MINUTES
              </code>
              ). The link expires after submission.
            </li>
          </ul>
        </div>
      </div>

      {listError ? (
        <p className="text-sm text-red-700" role="alert">
          {listError}{" "}
          <button type="button" className="underline" onClick={() => void load()}>
            Retry
          </button>
        </p>
      ) : null}

      <div className="rounded-none border border-[#e0e0e0] bg-white p-4">
        <h2 className="text-sm font-semibold text-[#424242]">Add a link</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs font-medium text-[#757575]">
            URL
            <input
              className="rounded-none border border-[#e0e0e0] px-3 py-2 text-sm text-[#212121]"
              placeholder="https://meet.google.com/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs font-medium text-[#757575]">
            Label (optional)
            <input
              className="rounded-none border border-[#e0e0e0] px-3 py-2 text-sm text-[#212121]"
              placeholder="Room A"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={btnGreen}
            disabled={adding}
            onClick={() => void addLink()}
          >
            {adding ? "Adding…" : "Add link"}
          </button>
        </div>
        {addError ? (
          <p className="mt-2 text-sm text-red-700">{addError}</p>
        ) : null}
      </div>

      <div className="overflow-auto rounded-none border border-[#e0e0e0]">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="bg-[#f8f9fa] text-left text-xs uppercase tracking-wide text-[#616161]">
              <th className="border border-[#e0e0e0] px-2 py-2">#</th>
              <th className="border border-[#e0e0e0] px-2 py-2">Label</th>
              <th className="border border-[#e0e0e0] px-2 py-2">URL</th>
              <th className="border border-[#e0e0e0] px-2 py-2">Active</th>
              <th className="border border-[#e0e0e0] px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  className="border border-[#e0e0e0] px-2 py-4 text-[#757575]"
                  colSpan={5}
                >
                  Loading…
                </td>
              </tr>
            ) : links.length === 0 ? (
              <tr>
                <td
                  className="border border-[#e0e0e0] px-2 py-4 text-[#757575]"
                  colSpan={5}
                >
                  No links yet. Add at least one Meet URL so demos can be assigned
                  automatically.
                </td>
              </tr>
            ) : (
              links.map((row, i) => (
                <tr key={row.id}>
                  <td className="border border-[#e0e0e0] px-2 py-2 tabular-nums">
                    {i + 1}
                  </td>
                  <td className="border border-[#e0e0e0] px-2 py-2">
                    {row.label || "—"}
                  </td>
                  <td className="border border-[#e0e0e0] px-2 py-2">
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all font-medium text-[#1565c0] underline"
                    >
                      {row.url}
                    </a>
                  </td>
                  <td className="border border-[#e0e0e0] px-2 py-2">
                    <button
                      type="button"
                      className={cn(
                        btnOutline,
                        "text-xs",
                        !row.active && "border-amber-200 bg-amber-50 text-amber-900",
                      )}
                      disabled={busyId === row.id}
                      onClick={() => void toggleActive(row)}
                    >
                      {busyId === row.id
                        ? "…"
                        : row.active
                          ? "Active"
                          : "Inactive"}
                    </button>
                  </td>
                  <td className="border border-[#e0e0e0] px-2 py-2">
                    <button
                      type="button"
                      className={btnDanger}
                      onClick={() => setDeleteId(row.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {deleteId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="meet-delete-title"
        >
          <div className="max-w-md border border-[#e0e0e0] bg-white p-6 shadow-lg">
            <h2 id="meet-delete-title" className="text-lg font-semibold text-[#212121]">
              Delete this Meet link?
            </h2>
            <p className="mt-2 text-sm text-[#616161]">
              You cannot delete a link that has upcoming demo bookings. Past
              bookings are removed automatically.
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={btnOutline}
                disabled={deleting}
                onClick={() => setDeleteId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={btnDanger}
                disabled={deleting}
                onClick={() => void remove()}
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
