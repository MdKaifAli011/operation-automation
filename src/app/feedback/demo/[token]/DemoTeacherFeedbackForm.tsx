"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  EXAM_TRACK_OPTIONS,
  PACE_OPTIONS,
  PARENT_INVOLVEMENT_OPTIONS,
  RECOMMENDED_NEXT_OPTIONS,
} from "@/lib/demoFeedback/teacherFeedbackExtended";

const OVERALL_RATINGS = [
  {
    value: "excellent",
    label: "Excellent",
    hint: "Fully engaged, strong grasp of the level tested",
  },
  {
    value: "good",
    label: "Good",
    hint: "Follows well; small gaps only",
  },
  {
    value: "satisfactory",
    label: "Satisfactory",
    hint: "Needs more practice before exam tempo",
  },
  {
    value: "needs_improvement",
    label: "Needs improvement",
    hint: "Foundations or pace need significant support",
  },
] as const;

const STAR_HINTS = [
  {
    key: "ratingEngagement",
    label: "Engagement & participation",
    hint: "Focus, questions, willingness to try hard items",
  },
  {
    key: "ratingConceptual",
    label: "Conceptual clarity",
    hint: "Definitions, reasoning, NCERT / syllabus depth as relevant",
  },
  {
    key: "ratingApplication",
    label: "Application & problem solving",
    hint: "Speed, accuracy, multi-step / exam-style items",
  },
  {
    key: "ratingExamReadiness",
    label: "Exam orientation",
    hint: "Pattern recognition, time discipline, stress handling",
  },
] as const;

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "done"; submitted: true; submittedAt: string }
  | {
      kind: "done";
      submitted: false;
      studentName: string;
      teacherName: string;
      demoSummary: string;
      grade?: string;
      targetExams?: string[];
      dataType?: string;
      suggestedExamTrack?: string;
    };

type ScoreKey = (typeof STAR_HINTS)[number]["key"];

function StarRow({
  label,
  hint,
  value,
  onChange,
  groupName,
}: {
  label: string;
  hint: string;
  value: string | null;
  onChange: (v: string) => void;
  groupName: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200/90 bg-slate-50/80 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-900">{label}</p>
          <p className="mt-0.5 text-[12px] leading-snug text-slate-600">{hint}</p>
        </div>
        <span
          className="shrink-0 rounded-md bg-white px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-600 ring-1 ring-slate-200/80"
          aria-live="polite"
        >
          {value ? `${value} / 5` : "Tap 1–5"}
        </span>
      </div>
      <div
        className="mt-3 flex flex-wrap gap-2"
        role="radiogroup"
        aria-label={label}
      >
        {(["1", "2", "3", "4", "5"] as const).map((n) => {
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected}
              name={groupName}
              onClick={() => onChange(n)}
              className={[
                "flex h-11 min-w-[2.75rem] flex-1 items-center justify-center rounded-lg text-[14px] font-semibold transition sm:max-w-[3.5rem] sm:flex-none",
                selected
                  ? "bg-[#1565c0] text-white shadow-sm ring-2 ring-[#1565c0] ring-offset-1"
                  : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 active:scale-[0.98]",
              ].join(" ")}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SectionTitle({
  id,
  n,
  children,
}: {
  id: string;
  n: number;
  children: ReactNode;
}) {
  return (
    <h2
      id={id}
      className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.06em] text-slate-500"
    >
      <span
        className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200/90 text-[11px] font-bold text-slate-700"
        aria-hidden
      >
        {n}
      </span>
      {children}
    </h2>
  );
}

export function DemoTeacherFeedbackForm({ token }: { token: string }) {
  const formId = useId();
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [rating, setRating] = useState<string>("good");
  const [examTrack, setExamTrack] = useState("");
  const [sessionTopicsCovered, setSessionTopicsCovered] = useState("");
  const [paceFit, setPaceFit] = useState("");
  const [scores, setScores] = useState<Record<ScoreKey, string | null>>({
    ratingEngagement: null,
    ratingConceptual: null,
    ratingApplication: null,
    ratingExamReadiness: null,
  });
  const [parentInvolvement, setParentInvolvement] = useState("");
  const [recommendedNext, setRecommendedNext] = useState("");
  const [followUpHomework, setFollowUpHomework] = useState("");
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const safeToken = encodeURIComponent(token.trim());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/demo-feedback/${safeToken}`, {
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          submitted?: boolean;
          submittedAt?: string;
          studentName?: string;
          teacherName?: string;
          demoSummary?: string;
          grade?: string;
          targetExams?: string[];
          dataType?: string;
          suggestedExamTrack?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setLoad({
            kind: "error",
            message:
              typeof data.error === "string"
                ? data.error
                : "This link is not valid.",
          });
          return;
        }
        if (data.submitted === true) {
          setLoad({
            kind: "done",
            submitted: true,
            submittedAt: String(data.submittedAt ?? ""),
          });
          return;
        }
        const suggested = String(data.suggestedExamTrack ?? "").trim();
        if (!cancelled && suggested) setExamTrack(suggested);
        setLoad({
          kind: "done",
          submitted: false,
          studentName: String(data.studentName ?? "Student"),
          teacherName: String(data.teacherName ?? ""),
          demoSummary: String(data.demoSummary ?? ""),
          grade: data.grade,
          targetExams: data.targetExams,
          dataType: data.dataType,
          suggestedExamTrack: data.suggestedExamTrack,
        });
      } catch {
        if (!cancelled) {
          setLoad({ kind: "error", message: "Could not load this form." });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [safeToken]);

  const crmSummary = useMemo(() => {
    if (load.kind !== "done" || load.submitted) return null;
    const parts: string[] = [];
    if (load.grade) parts.push(`Grade: ${load.grade}`);
    if (load.targetExams?.length)
      parts.push(`Targets: ${load.targetExams.join(", ")}`);
    if (load.dataType) parts.push(`Source: ${load.dataType}`);
    return parts.length ? parts : null;
  }, [load]);

  const onSubmit = useCallback(async () => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/demo-feedback/${safeToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          examTrack,
          sessionTopicsCovered,
          paceFit,
          ratingEngagement: scores.ratingEngagement,
          ratingConceptual: scores.ratingConceptual,
          ratingApplication: scores.ratingApplication,
          ratingExamReadiness: scores.ratingExamReadiness,
          parentInvolvement,
          recommendedNext,
          followUpHomework,
          strengths,
          improvements,
          notes,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setSubmitError(
          typeof data.error === "string" ? data.error : "Could not submit.",
        );
        setSubmitting(false);
        return;
      }
      const doneAt = new Date().toISOString();
      setLoad({
        kind: "done",
        submitted: true,
        submittedAt: doneAt,
      });
    } catch {
      setSubmitError("Could not submit. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }, [
    safeToken,
    rating,
    examTrack,
    sessionTopicsCovered,
    paceFit,
    scores,
    parentInvolvement,
    recommendedNext,
    followUpHomework,
    strengths,
    improvements,
    notes,
  ]);

  if (load.kind === "loading") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 bg-gradient-to-b from-slate-50 to-slate-100/80 px-4">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-[#1565c0] border-t-transparent"
          aria-hidden
        />
        <p className="text-sm text-slate-600">Loading your feedback form…</p>
      </div>
    );
  }

  if (load.kind === "error") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50/50 to-slate-50 px-4 py-16">
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl border border-amber-200/90 bg-white px-5 py-8 text-center shadow-sm">
            <h1 className="text-lg font-semibold text-amber-950">
              Link unavailable
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-amber-900/85">
              {load.message}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (load.submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 to-slate-50 px-4 py-16">
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl border border-emerald-200/90 bg-white px-5 py-10 text-center shadow-sm">
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-800"
              aria-hidden
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="mt-4 text-lg font-semibold text-emerald-950">
              Thank you
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-emerald-900/85">
              Your feedback has been saved. The admissions team will use it for
              NEET, JEE, SAT, IB, and other tracks. This secure link is now
              closed and cannot be used again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/80 pb-16 pt-8">
      <div className="mx-auto max-w-lg px-4">
        <header className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100">
          <div className="border-b border-slate-100 bg-[linear-gradient(90deg,rgba(21,101,192,0.08)_0%,transparent_60%)] px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1565c0]">
              Teacher demo feedback
            </p>
            <h1 className="mt-1 text-[17px] font-bold leading-snug text-slate-900">
              Trial class reflections
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-700">
              <span className="font-semibold text-slate-900">Session:</span>{" "}
              {load.demoSummary}
            </p>
            <p className="mt-2 text-[12px] text-slate-600">
              <span className="font-medium text-slate-800">Student:</span>{" "}
              {load.studentName}
              {load.teacherName ? (
                <>
                  <span className="text-slate-300"> · </span>
                  <span className="font-medium text-slate-800">You:</span>{" "}
                  {load.teacherName}
                </>
              ) : null}
            </p>
            {crmSummary ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {crmSummary.map((line) => (
                  <li
                    key={line}
                    className="rounded-full bg-slate-100/90 px-2.5 py-1 text-[11px] font-medium text-slate-700"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            ) : null}
            {load.suggestedExamTrack ? (
              <p className="mt-3 rounded-lg bg-amber-50/90 px-3 py-2 text-[11px] leading-snug text-amber-950 ring-1 ring-amber-200/80">
                We pre-selected the exam focus from the CRM. Please correct it
                if the student is actually preparing for something else.
              </p>
            ) : null}
          </div>
        </header>

        <form
          id={formId}
          className="mt-6 space-y-8"
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit();
          }}
        >
          <section
            className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm"
            aria-labelledby={`${formId}-s1`}
          >
            <SectionTitle id={`${formId}-s1`} n={1}>
              Exam / track focus
            </SectionTitle>
            <p className="text-[12px] leading-relaxed text-slate-600">
              Confirms how we should interpret your ratings (NEET PCB vs JEE PCM,
              SAT, IB, CUET, boards, manual intakes, etc.).
            </p>
            <label className="block">
              <span className="sr-only">Primary exam or track</span>
              <select
                required
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[13px] text-slate-900 shadow-sm focus:border-[#1565c0] focus:outline-none focus:ring-2 focus:ring-[#1565c0]/25"
                value={examTrack}
                onChange={(e) => setExamTrack(e.target.value)}
              >
                <option value="">Select one…</option>
                {EXAM_TRACK_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section
            className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm"
            aria-labelledby={`${formId}-s2`}
          >
            <SectionTitle id={`${formId}-s2`} n={2}>
              Overall performance
            </SectionTitle>
            <p className="text-[12px] leading-relaxed text-slate-600">
              One headline judgment your coordinator reads first.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {OVERALL_RATINGS.map((r) => {
                const selected = rating === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRating(r.value)}
                    className={[
                      "rounded-xl border px-3 py-3 text-left transition",
                      selected
                        ? "border-[#1565c0] bg-[#1565c0]/[0.06] ring-2 ring-[#1565c0]/25"
                        : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-white",
                    ].join(" ")}
                  >
                    <span className="block text-[13px] font-semibold text-slate-900">
                      {r.label}
                    </span>
                    <span className="mt-1 block text-[11px] leading-snug text-slate-600">
                      {r.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section
            className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm"
            aria-labelledby={`${formId}-s3`}
          >
            <SectionTitle id={`${formId}-s3`} n={3}>
              This session
            </SectionTitle>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Topics & skill focus (what you actually taught)
              </span>
              <textarea
                required
                className="min-h-[96px] w-full rounded-xl border border-slate-200 px-3 py-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-[#1565c0] focus:outline-none focus:ring-2 focus:ring-[#1565c0]/25"
                placeholder="e.g. Kinematics graphs · thermo intro · SAT evidence questions · IB IA rubric expectations…"
                value={sessionTopicsCovered}
                onChange={(e) => setSessionTopicsCovered(e.target.value)}
              />
            </label>
            <div>
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Session pace
              </span>
              <div className="grid gap-2 sm:grid-cols-3">
                {PACE_OPTIONS.map((p) => {
                  const selected = paceFit === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPaceFit(p.value)}
                      className={[
                        "rounded-xl border px-3 py-3 text-left text-[12px] leading-snug transition",
                        selected
                          ? "border-[#1565c0] bg-[#1565c0]/[0.06] font-medium text-slate-900 ring-2 ring-[#1565c0]/25"
                          : "border-slate-200 bg-slate-50/50 text-slate-700 hover:border-slate-300",
                      ].join(" ")}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section
            className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm"
            aria-labelledby={`${formId}-s4`}
          >
            <SectionTitle id={`${formId}-s4`} n={4}>
              Dimensional ratings (1–5)
            </SectionTitle>
            <p className="text-[12px] leading-relaxed text-slate-600">
              Each score is independent — a student can be strong on concepts but
              slow under exam pressure.
            </p>
            <div className="space-y-3">
              {STAR_HINTS.map((row) => (
                <StarRow
                  key={row.key}
                  label={row.label}
                  hint={row.hint}
                  value={scores[row.key]}
                  groupName={`${formId}-${row.key}`}
                  onChange={(v) =>
                    setScores((s) => ({ ...s, [row.key]: v }))
                  }
                />
              ))}
            </div>
          </section>

          <section
            className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm"
            aria-labelledby={`${formId}-s5`}
          >
            <SectionTitle id={`${formId}-s5`} n={5}>
              Written feedback
            </SectionTitle>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Strengths & bright spots
              </span>
              <textarea
                className="min-h-[88px] w-full rounded-xl border border-slate-200 px-3 py-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-[#1565c0] focus:outline-none focus:ring-2 focus:ring-[#1565c0]/25"
                placeholder="What went well — participation, intuition, prior prep, habits…"
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Gaps & what to reinforce
              </span>
              <textarea
                className="min-h-[88px] w-full rounded-xl border border-slate-200 px-3 py-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-[#1565c0] focus:outline-none focus:ring-2 focus:ring-[#1565c0]/25"
                placeholder="Mistakes, skipped steps, theory vs drills, exam strategy…"
                value={improvements}
                onChange={(e) => setImprovements(e.target.value)}
              />
            </label>
          </section>

          <section
            className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm"
            aria-labelledby={`${formId}-s6`}
          >
            <SectionTitle id={`${formId}-s6`} n={6}>
              Parent & follow-up
            </SectionTitle>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Parent / guardian involvement this session
              </span>
              <select
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[13px] text-slate-900 shadow-sm focus:border-[#1565c0] focus:outline-none focus:ring-2 focus:ring-[#1565c0]/25"
                value={parentInvolvement}
                onChange={(e) => setParentInvolvement(e.target.value)}
              >
                <option value="">Select one…</option>
                {PARENT_INVOLVEMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Homework, drills, or next-session focus (optional)
              </span>
              <textarea
                className="min-h-[72px] w-full rounded-xl border border-slate-200 px-3 py-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-[#1565c0] focus:outline-none focus:ring-2 focus:ring-[#1565c0]/25"
                placeholder="Specific problems, readings, or habits you want logged for continuity"
                value={followUpHomework}
                onChange={(e) => setFollowUpHomework(e.target.value)}
              />
            </label>
          </section>

          <section
            className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm"
            aria-labelledby={`${formId}-s7`}
          >
            <SectionTitle id={`${formId}-s7`} n={7}>
              Recommendation for ops
            </SectionTitle>
            <p className="text-[12px] leading-relaxed text-slate-600">
              Helps sales / counselling prioritize without rereading everything.
            </p>
            <label className="block">
              <span className="sr-only">Recommended next step</span>
              <select
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[13px] text-slate-900 shadow-sm focus:border-[#1565c0] focus:outline-none focus:ring-2 focus:ring-[#1565c0]/25"
                value={recommendedNext}
                onChange={(e) => setRecommendedNext(e.target.value)}
              >
                <option value="">Select one…</option>
                {RECOMMENDED_NEXT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section
            className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm"
            aria-labelledby={`${formId}-s8`}
          >
            <SectionTitle id={`${formId}-s8`} n={8}>
              Anything else
            </SectionTitle>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Confidential notes (optional)
              </span>
              <textarea
                className="min-h-[72px] w-full rounded-xl border border-slate-200 px-3 py-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-[#1565c0] focus:outline-none focus:ring-2 focus:ring-[#1565c0]/25"
                placeholder="Logistics, tech issues, behavioural flags, scholarship sensitivity…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          </section>

          {submitError ? (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-900"
            >
              {submitError}
            </div>
          ) : null}

          <div className="sticky bottom-0 -mx-1 rounded-2xl border border-slate-200/90 bg-white/95 px-4 py-4 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-sm">
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-[#1565c0] py-3.5 text-[14px] font-semibold text-white shadow-md transition hover:bg-[#145ea8] disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit feedback"}
            </button>
            <p className="mt-3 text-center text-[11px] leading-snug text-slate-500">
              One submission per link. You can scroll up to edit before sending.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
