import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import LeadModel from "@/models/Lead";
import DemoTeacherFeedbackTokenModel from "@/models/DemoTeacherFeedbackToken";
import { patchDemoRowTeacherFeedback } from "@/lib/demoFeedback/persistLeadRow";
import {
  examTrackLabel,
  inferExamTrackFromLead,
  parseExtendedBody,
  recommendedNextLabel,
} from "@/lib/demoFeedback/teacherFeedbackExtended";
import { format, parseISO } from "date-fns";

export const runtime = "nodejs";

const RATINGS = new Set(["excellent", "good", "satisfactory", "needs_improvement"]);

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, context: Ctx) {
  const { token: raw } = await context.params;
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token || token.length < 16 || token.length > 80) {
    return NextResponse.json({ error: "Invalid link." }, { status: 400 });
  }

  try {
    await connectDB();
    const doc = await DemoTeacherFeedbackTokenModel.findOne({ token }).lean();
    if (!doc) {
      return NextResponse.json({ error: "This link is invalid or has already been used." }, { status: 410 });
    }

    if (doc.submittedAt) {
      return NextResponse.json({
        submitted: true,
        submittedAt: (doc.submittedAt as Date).toISOString(),
      });
    }

    const lead = await LeadModel.findById(doc.leadId)
      .select({
        studentName: 1,
        parentName: 1,
        grade: 1,
        targetExams: 1,
        dataType: 1,
        phone: 1,
        email: 1,
        pipelineMeta: 1,
      })
      .lean();
    if (!lead) {
      return NextResponse.json({ error: "Lead not found." }, { status: 410 });
    }

    const rows =
      (
        lead as {
          pipelineMeta?: { demo?: { rows?: Array<{ meetRowId?: string; subject?: string; isoDate?: string; timeHmIST?: string }> } };
        }
      ).pipelineMeta?.demo?.rows ?? [];
    const row = rows.find(
      (r) => String(r.meetRowId ?? "").trim() === String(doc.meetRowId).trim(),
    );
    const studentName = String((lead as { studentName?: string }).studentName ?? "Student");
    const parentName = String((lead as { parentName?: string }).parentName ?? "").trim();
    const grade = String((lead as { grade?: string }).grade ?? "").trim();
    const targetExams = Array.isArray((lead as { targetExams?: string[] }).targetExams)
      ? (lead as { targetExams: string[] }).targetExams.map((x) => String(x ?? "").trim()).filter(Boolean)
      : [];
    const dataType = String((lead as { dataType?: string }).dataType ?? "").trim();
    const phone = String((lead as { phone?: string }).phone ?? "").trim();
    const email = String((lead as { email?: string }).email ?? "").trim();
    const demoSummary = row
      ? `${row.subject ?? "Demo"} · ${row.isoDate ? format(parseISO(String(row.isoDate)), "d MMM yyyy") : ""} · ${row.timeHmIST ?? ""} IST`
      : "Trial class";

    const suggestedExamTrack = inferExamTrackFromLead({ targetExams, dataType });

    return NextResponse.json({
      submitted: false,
      studentName,
      parentName: parentName || undefined,
      teacherName: String(doc.teacherName ?? ""),
      demoSummary,
      grade: grade || undefined,
      targetExams: targetExams.length ? targetExams : undefined,
      dataType: dataType || undefined,
      phone: phone || undefined,
      email: email || undefined,
      suggestedExamTrack: suggestedExamTrack || undefined,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load form." }, { status: 500 });
  }
}

export async function POST(req: Request, context: Ctx) {
  const { token: raw } = await context.params;
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token || token.length < 16 || token.length > 80) {
    return NextResponse.json({ error: "Invalid link." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const rating = typeof body.rating === "string" ? body.rating.trim() : "";
  if (!RATINGS.has(rating)) {
    return NextResponse.json(
      { error: "Choose a valid performance rating." },
      { status: 400 },
    );
  }

  const ext = parseExtendedBody(body);
  if (!ext.ok) {
    return NextResponse.json({ error: ext.error }, { status: 400 });
  }
  const extended = ext.extended;

  const strengths = typeof body.strengths === "string" ? body.strengths.trim() : "";
  const improvements = typeof body.improvements === "string" ? body.improvements.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  if (strengths.length > 8000 || improvements.length > 8000 || notes.length > 8000) {
    return NextResponse.json({ error: "Text is too long." }, { status: 400 });
  }

  try {
    await connectDB();
    const doc = await DemoTeacherFeedbackTokenModel.findOne({ token });
    if (!doc) {
      return NextResponse.json(
        { error: "This link is invalid or has already been used." },
        { status: 410 },
      );
    }
    if (doc.submittedAt) {
      return NextResponse.json(
        { error: "This form was already submitted. The link is no longer active." },
        { status: 410 },
      );
    }

    const submittedAt = new Date();
    doc.submittedAt = submittedAt;
    doc.rating = rating;
    doc.strengths = strengths;
    doc.improvements = improvements;
    doc.notes = notes;
    doc.examTrack = extended.examTrack;
    doc.sessionTopicsCovered = extended.sessionTopicsCovered;
    doc.paceFit = extended.paceFit;
    doc.ratingEngagement = extended.ratingEngagement;
    doc.ratingConceptual = extended.ratingConceptual;
    doc.ratingApplication = extended.ratingApplication;
    doc.ratingExamReadiness = extended.ratingExamReadiness;
    doc.parentInvolvement = extended.parentInvolvement;
    doc.recommendedNext = extended.recommendedNext;
    doc.followUpHomework = extended.followUpHomework;
    await doc.save();

    const leadId = String(doc.leadId);
    const meetRowId = String(doc.meetRowId);
    const ratingLabel: Record<string, string> = {
      excellent: "Excellent",
      good: "Good",
      satisfactory: "Satisfactory",
      needs_improvement: "Needs improvement",
    };

    const summaryNext = recommendedNextLabel(extended.recommendedNext);
    const trackLbl = examTrackLabel(extended.examTrack);

    await patchDemoRowTeacherFeedback(
      leadId,
      meetRowId,
      {
        teacherFeedbackSubmittedAt: submittedAt.toISOString(),
        teacherFeedbackRating: ratingLabel[rating] ?? rating,
        teacherFeedbackStrengths: strengths,
        teacherFeedbackImprovements: improvements,
        teacherFeedbackNotes: notes,
        teacherFeedbackExamTrack: extended.examTrack,
        teacherFeedbackSessionTopics: extended.sessionTopicsCovered,
        teacherFeedbackPaceFit: extended.paceFit,
        teacherFeedbackRatingEngagement: extended.ratingEngagement,
        teacherFeedbackRatingConceptual: extended.ratingConceptual,
        teacherFeedbackRatingApplication: extended.ratingApplication,
        teacherFeedbackRatingExamReadiness: extended.ratingExamReadiness,
        teacherFeedbackParentInvolvement: extended.parentInvolvement,
        teacherFeedbackRecommendedNext: extended.recommendedNext,
        teacherFeedbackFollowUpHomework: extended.followUpHomework,
      },
      {
        kind: "demo",
        message: `Teacher submitted demo feedback (${ratingLabel[rating] ?? rating} · ${trackLbl} · next: ${summaryNext})`,
      },
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not save feedback." }, { status: 500 });
  }
}
