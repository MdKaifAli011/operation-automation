"use client";

import {
  useCallback,
  useEffect,
  useId,
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
    hint: "Very involved and clearly ready for this level",
  },
  {
    value: "good",
    label: "Good",
    hint: "Understands most of it; small gaps only",
  },
  {
    value: "satisfactory",
    label: "Okay / average",
    hint: "Needs more practice before exam speed",
  },
  {
    value: "needs_improvement",
    label: "Needs more support",
    hint: "Basics or pace need extra help from us",
  },
] as const;

const STAR_HINTS = [
  {
    key: "ratingEngagement",
    label: "Interest & participation",
    hint: "Were they alert, asking questions, and trying when work got hard?",
  },
  {
    key: "ratingConceptual",
    label: "Understanding of concepts",
    hint: "Did they follow explanations and connect ideas (theory)?",
  },
  {
    key: "ratingApplication",
    label: "Solving questions",
    hint: "Accuracy and speed on problems similar to the exam",
  },
  {
    key: "ratingExamReadiness",
    label: "Exam habits",
    hint: "Time sense, careless errors, handling pressure",
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
      parentName?: string;
      teacherName: string;
      demoSummary: string;
      grade?: string;
      targetExams?: string[];
      dataType?: string;
      phone?: string;
      email?: string;
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
    <div className="rounded-lg border border-slate-200/90 bg-slate-50/80 px-3 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-slate-900">{label}</p>
          <p className="mt-1 text-[13px] leading-snug text-slate-600">{hint}</p>
        </div>
        <span
          className="shrink-0 rounded-md bg-white px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-600 ring-1 ring-slate-200/80"
          aria-live="polite"
        >
          {value ? `${value} out of 5` : "Choose 1 to 5"}
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

function DetailLine({
  label,
  value,
  empty = "Not in our records",
  link,
}: {
  label: string;
  value?: string;
  empty?: string;
  link?: "tel" | "mailto";
}) {
  const raw = typeof value === "string" ? value.trim() : "";
  const body = !raw ? (
    <span className="italic text-slate-400">{empty}</span>
  ) : link === "tel" ? (
    <a
      href={`tel:${raw.replace(/\s/g, "")}`}
      className="font-medium text-[#1565c0] underline-offset-2 hover:underline"
    >
      {raw}
    </a>
  ) : link === "mailto" ? (
    <a
      href={`mailto:${raw}`}
      className="break-all font-medium text-[#1565c0] underline-offset-2 hover:underline"
    >
      {raw}
    </a>
  ) : (
    <span className="font-medium text-slate-900">{raw}</span>
  );
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-600">
        {label}
      </p>
      <div className="mt-0.5 text-[15px] leading-snug text-slate-900">{body}</div>
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
      className="flex items-center gap-2.5 text-[13px] font-bold uppercase tracking-[0.05em] text-slate-600"
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1565c0]/10 text-[12px] font-bold text-[#1565c0]"
        aria-hidden
      >
        {n}
      </span>
      <span className="leading-tight">{children}</span>
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
          parentName?: string;
          teacherName?: string;
          demoSummary?: string;
          grade?: string;
          targetExams?: string[];
          dataType?: string;
          phone?: string;
          email?: string;
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
          parentName:
            typeof data.parentName === "string" && data.parentName.trim()
              ? data.parentName.trim()
              : undefined,
          teacherName: String(data.teacherName ?? ""),
          demoSummary: String(data.demoSummary ?? ""),
          grade: data.grade,
          targetExams: data.targetExams,
          dataType: data.dataType,
          phone:
            typeof data.phone === "string" && data.phone.trim()
              ? data.phone.trim()
              : undefined,
          email:
            typeof data.email === "string" && data.email.trim()
              ? data.email.trim()
              : undefined,
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
          className="h-9 w-9 animate-spin rounded-full border-2 border-[#1565c0] border-t-transparent"
          aria-hidden
        />
        <p className="text-sm font-medium text-slate-700">
          Opening your feedback form…
        </p>
      </div>
    );
  }

  if (load.kind === "error") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50/50 to-slate-50 px-4 py-16">
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl border border-amber-200/90 bg-white px-5 py-8 text-center shadow-sm">
            <h1 className="text-lg font-semibold text-amber-950">
              This link doesn’t work
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
              Thank you — you’re done
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-emerald-900/85">
              Your feedback has been saved for the counselling team. This page
              is closed now; you don’t need to do anything else.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/80 pb-28 pt-6 sm:pb-24 sm:pt-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <header className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100">
          <div className="border-b border-slate-100 bg-[linear-gradient(90deg,rgba(21,101,192,0.07)_0%,transparent_55%)] px-5 py-5 sm:px-6 sm:py-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1565c0]">
              After the trial class
            </p>
            <h1 className="mt-1.5 text-xl font-bold leading-snug text-slate-900 sm:text-[22px]">
              Teacher feedback form
            </h1>
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-slate-700">
              This is for you — the teacher who took the class. Share how the
              student did so counselling can help the family. It takes about{" "}
              <span className="font-semibold text-slate-900">5 minutes</span>.
              The student’s details below are filled in for you; you only answer
              the questions after that.
            </p>
          </div>

          <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-5 sm:px-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
              Student on this form
            </p>
            <p className="mt-1 text-[13px] text-slate-600">
              Please check that this is the child you taught. Call or email if
              you need to fix something — don’t change these boxes yourself.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <DetailLine label="Student name" value={load.studentName} />
              <DetailLine label="Class / grade" value={load.grade} />
              <DetailLine
                label="Exam(s) they are preparing for"
                value={
                  load.targetExams?.length
                    ? load.targetExams.join(", ")
                    : undefined
                }
                empty="Not added yet"
              />
              <DetailLine label="Parent / guardian name" value={load.parentName} />
              <DetailLine label="Mobile number" value={load.phone} link="tel" />
              <DetailLine label="Email" value={load.email} link="mailto" />
              <DetailLine
                label="How we got this lead"
                value={load.dataType}
                empty="—"
              />
            </div>
            <div className="mt-5 rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-[14px] leading-snug text-slate-800 shadow-sm">
              <span className="font-semibold text-slate-900">Trial session:</span>{" "}
              {load.demoSummary}
            </div>
            {load.teacherName ? (
              <p className="mt-3 text-[14px] text-slate-700">
                <span className="font-semibold text-slate-900">You (teacher):</span>{" "}
                {load.teacherName}
              </p>
            ) : (
              <p className="mt-3 text-[13px] italic text-slate-500">
                Your name was not attached to this link — the office still knows
                who taught the class.
              </p>
            )}
            {load.suggestedExamTrack ? (
              <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2.5 text-[13px] leading-snug text-amber-950 ring-1 ring-amber-200/90">
                <span className="font-semibold">Heads up:</span> we guessed the
                exam type from the student’s profile. If that’s wrong, you can
                pick the right one in the next section.
              </p>
            ) : null}
          </div>
        </header>

        <p
          className="mt-6 text-center text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500"
          id={`${formId}-your-answers`}
        >
          Your answers — start here
        </p>

        <form
          id={formId}
          className="mt-4 space-y-7 pb-2"
          aria-describedby={`${formId}-your-answers`}
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit();
          }}
        >
          <section
            className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6"
            aria-labelledby={`${formId}-s1`}
          >
            <SectionTitle id={`${formId}-s1`} n={1}>
              Which exam is this student mainly preparing for?
            </SectionTitle>
            <p className="text-[13px] leading-relaxed text-slate-600">
              Pick the one that matches how you taught today (NEET, JEE, boards,
              SAT, etc.). This helps the office read your scores correctly.
            </p>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-slate-800">
                Exam / course focus
              </span>
              <select
                required
                className="mt-0.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3.5 text-[15px] text-slate-900 shadow-sm focus:border-[#1565c0] focus:outline-none focus:ring-2 focus:ring-[#1565c0]/25"
                value={examTrack}
                onChange={(e) => setExamTrack(e.target.value)}
              >
                <option value="">Tap to choose one…</option>
                {EXAM_TRACK_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section
            className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6"
            aria-labelledby={`${formId}-s2`}
          >
            <SectionTitle id={`${formId}-s2`} n={2}>
              Overall, how was the student in class?
            </SectionTitle>
            <p className="text-[13px] leading-relaxed text-slate-600">
              One quick summary — the team reads this first.
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
                      "rounded-xl border px-3 py-3.5 text-left transition",
                      selected
                        ? "border-[#1565c0] bg-[#1565c0]/[0.06] ring-2 ring-[#1565c0]/25"
                        : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-white",
                    ].join(" ")}
                  >
                    <span className="block text-[14px] font-semibold text-slate-900">
                      {r.label}
                    </span>
                    <span className="mt-1 block text-[12px] leading-snug text-slate-600">
                      {r.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section
            className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6"
            aria-labelledby={`${formId}-s3`}
          >
            <SectionTitle id={`${formId}-s3`} n={3}>
              About today’s class
            </SectionTitle>
            <p className="text-[13px] leading-relaxed text-slate-600">
              Write in simple words — no need for perfect sentences.
            </p>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-slate-800">
                What did you teach or practise? (topics, type of questions)
              </span>
              <textarea
                required
                className="min-h-[100px] w-full rounded-xl border border-slate-200 px-3 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-[#1565c0] focus:outline-none focus:ring-2 focus:ring-[#1565c0]/25"
                placeholder="Example: Motion in one dimension — graphs and formulas. We did board-style and MCQ practice."
                value={sessionTopicsCovered}
                onChange={(e) => setSessionTopicsCovered(e.target.value)}
              />
            </label>
            <div>
              <span className="mb-2 block text-[13px] font-medium text-slate-800">
                Was the speed of the class right for this student?
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
                        "rounded-xl border px-3 py-3.5 text-left text-[13px] leading-snug transition",
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
            className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6"
            aria-labelledby={`${formId}-s4`}
          >
            <SectionTitle id={`${formId}-s4`} n={4}>
              Rate the student (1 to 5)
            </SectionTitle>
            <p className="rounded-lg bg-blue-50/90 px-3 py-2.5 text-[13px] leading-relaxed text-slate-800 ring-1 ring-blue-100">
              <span className="font-semibold text-slate-900">How to score:</span>{" "}
              <span className="font-semibold">1</span> = needs a lot of support,{" "}
              <span className="font-semibold">5</span> = very strong. Each line
              is separate — someone can be weak on speed but good on concepts.
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
            className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6"
            aria-labelledby={`${formId}-s5`}
          >
            <SectionTitle id={`${formId}-s5`} n={5}>
              Written comments (short is fine)
            </SectionTitle>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-slate-800">
                What did you like about this student?
              </span>
              <textarea
                className="min-h-[92px] w-full rounded-xl border border-slate-200 px-3 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-[#1565c0] focus:outline-none focus:ring-2 focus:ring-[#1565c0]/25"
                placeholder="e.g. Asked good questions, remembered last time’s homework, stayed calm when stuck…"
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-slate-800">
                What should we help them improve?
              </span>
              <textarea
                className="min-h-[92px] w-full rounded-xl border border-slate-200 px-3 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-[#1565c0] focus:outline-none focus:ring-2 focus:ring-[#1565c0]/25"
                placeholder="e.g. Silly mistakes, speed, theory gaps, writing steps, exam fear…"
                value={improvements}
                onChange={(e) => setImprovements(e.target.value)}
              />
            </label>
          </section>

          <section
            className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6"
            aria-labelledby={`${formId}-s6`}
          >
            <SectionTitle id={`${formId}-s6`} n={6}>
              Parent & homework
            </SectionTitle>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-slate-800">
                Was a parent or guardian involved in this class? (joined, asked questions, etc.)
              </span>
              <select
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3.5 text-[15px] text-slate-900 shadow-sm focus:border-[#1565c0] focus:outline-none focus:ring-2 focus:ring-[#1565c0]/25"
                value={parentInvolvement}
                onChange={(e) => setParentInvolvement(e.target.value)}
              >
                <option value="">Tap to choose…</option>
                {PARENT_INVOLVEMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-slate-800">
                Homework or what to do next (optional — skip if none)
              </span>
              <textarea
                className="min-h-[80px] w-full rounded-xl border border-slate-200 px-3 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-[#1565c0] focus:outline-none focus:ring-2 focus:ring-[#1565c0]/25"
                placeholder="e.g. Chapter 3 exercises 1–10, revise formulas, read one passage daily…"
                value={followUpHomework}
                onChange={(e) => setFollowUpHomework(e.target.value)}
              />
            </label>
          </section>

          <section
            className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6"
            aria-labelledby={`${formId}-s7`}
          >
            <SectionTitle id={`${formId}-s7`} n={7}>
              What should the office do next?
            </SectionTitle>
            <p className="text-[13px] leading-relaxed text-slate-600">
              Counselling and sales use this to support the family — pick the
              closest option.
            </p>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-slate-800">
                Your recommendation
              </span>
              <select
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3.5 text-[15px] text-slate-900 shadow-sm focus:border-[#1565c0] focus:outline-none focus:ring-2 focus:ring-[#1565c0]/25"
                value={recommendedNext}
                onChange={(e) => setRecommendedNext(e.target.value)}
              >
                <option value="">Tap to choose…</option>
                {RECOMMENDED_NEXT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section
            className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6"
            aria-labelledby={`${formId}-s8`}
          >
            <SectionTitle id={`${formId}-s8`} n={8}>
              Anything else we should know?
            </SectionTitle>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-slate-800">
                Private note for the team (optional)
              </span>
              <textarea
                className="min-h-[80px] w-full rounded-xl border border-slate-200 px-3 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-[#1565c0] focus:outline-none focus:ring-2 focus:ring-[#1565c0]/25"
                placeholder="e.g. Internet issues, behaviour, fee sensitivity, speak softly with parents…"
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

          <div className="sticky bottom-3 z-10 -mx-1 rounded-2xl border border-slate-200/90 bg-white/95 px-4 py-4 shadow-[0_-12px_32px_rgba(15,23,42,0.1)] backdrop-blur-md supports-[backdrop-filter]:bg-white/90">
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-[#1565c0] py-3.5 text-[15px] font-semibold text-white shadow-md transition hover:bg-[#145ea8] disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit feedback"}
            </button>
            <p className="mt-2.5 text-center text-[12px] leading-snug text-slate-600">
              You can submit only once. Scroll up if you want to check your answers.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
