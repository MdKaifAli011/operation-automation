import { getActiveTargetExamValues } from "@/lib/serverTargetExams";
import { getExamCourseCatalog } from "@/lib/serverExamCourseCatalog";
import ExamCourseFeeStructureModel from "@/models/ExamCourseFeeStructure";
import ExamFeeStructureModel from "@/models/ExamFeeStructure";
import connectDB from "@/lib/mongodb";
import { escapeHtmlForEmail } from "@/lib/email/buildLeadEmailVars";

type LeanLead = {
  targetExams?: string[];
  grade?: string;
};

/**
 * Maps grade to course name patterns for matching
 */
function gradeMatchesCourse(grade: string, courseName: string): boolean {
  const g = grade.toLowerCase().trim();
  const c = courseName.toLowerCase();
  
  // Grade 6-10 matches "Foundation" or "Foundation Course"
  if (["6th", "7th", "8th", "9th", "10th"].includes(g)) {
    return c.includes("foundation") || c.includes("6th") || c.includes("7th") || 
           c.includes("8th") || c.includes("9th") || c.includes("10th");
  }
  
  // Grade 11 matches "11th" or "Class 11"
  if (g === "11th") {
    return c.includes("11th") || c.includes("class 11") || c.includes("11 grade");
  }
  
  // Grade 12 matches "12th" or "Class 12" or "Dropper"
  if (g === "12th") {
    return c.includes("12th") || c.includes("class 12") || c.includes("12 grade") || 
           c.includes("dropper") || c.includes("repeater");
  }
  
  return false;
}

/**
 * Builds HTML table of fee details for a lead based on their grade and target exams
 * Priority: Grade-specific courses first, then all courses for target exams
 * Returns body content only (to be inserted into email template with header/footer)
 */
export async function buildFeeDetailsHtmlForLead(lead: LeanLead): Promise<string> {
  await connectDB();
  
  const targetExams = Array.isArray(lead.targetExams) ? lead.targetExams : [];
  const grade = lead.grade?.trim() || "";
  
  if (targetExams.length === 0) {
    return `<p style="margin:16px 0 0;font-size:13px;color:#757575;">No target exams specified for this lead.</p>`;
  }
  
  const activeExams = await getActiveTargetExamValues();
  const catalog = await getExamCourseCatalog();
  
  // Get legacy per-exam fees
  const legacyDocs = await ExamFeeStructureModel.find({}).lean();
  const legacyByExam = new Map<string, { baseFee: number; notes: string }>();
  for (const d of legacyDocs) {
    const ex = typeof d.exam === "string" ? d.exam.trim() : "";
    if (!ex) continue;
    legacyByExam.set(ex, {
      baseFee: typeof d.baseFee === "number" && Number.isFinite(d.baseFee)
        ? Math.max(0, Math.round(d.baseFee))
        : 0,
      notes: typeof d.notes === "string" ? d.notes : "",
    });
  }
  
  // Get course-specific fees
  const courseDocs = await ExamCourseFeeStructureModel.find({}).lean();
  const byKey = new Map<string, { baseFee: number; notes: string }>();
  for (const d of courseDocs) {
    const ex = typeof d.exam === "string" ? d.exam.trim() : "";
    const cid = typeof d.courseId === "string" ? d.courseId.trim() : "";
    if (!ex || !cid) continue;
    byKey.set(`${ex}::${cid}`, {
      baseFee: typeof d.baseFee === "number" && Number.isFinite(d.baseFee)
        ? Math.max(0, Math.round(d.baseFee))
        : 0,
      notes: typeof d.notes === "string" ? d.notes : "",
    });
  }
  
  const rows: Array<{ exam: string; courseName: string; fee: number; notes: string }> = [];
  
  for (const exam of targetExams) {
    if (!activeExams.includes(exam) && !activeExams.some(e => e.toLowerCase() === exam.toLowerCase())) {
      continue;
    }
    
    const examNormalized = activeExams.find(e => e.toLowerCase() === exam.toLowerCase()) || exam;
    
    const courses = catalog
      .filter(
        (c) =>
          c.examValue === examNormalized ||
          c.examValue.toLowerCase() === examNormalized.toLowerCase(),
      )
      .filter((c) => c.isActive !== false)
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      );
    
    const leg = legacyByExam.get(examNormalized);
    
    if (courses.length === 0) {
      // No courses, use legacy fee
      if (leg) {
        rows.push({
          exam: examNormalized,
          courseName: "All Courses",
          fee: leg.baseFee,
          notes: leg.notes,
        });
      }
      continue;
    }
    
    // If grade is specified, try to find matching courses first
    if (grade) {
      const gradeCourses = courses.filter(c => gradeMatchesCourse(grade, c.name));
      
      if (gradeCourses.length > 0) {
        // Add grade-specific courses
        for (const c of gradeCourses) {
          const hit = byKey.get(`${examNormalized}::${c.id}`);
          rows.push({
            exam: examNormalized,
            courseName: c.name,
            fee: hit?.baseFee ?? leg?.baseFee ?? 0,
            notes: hit?.notes ?? "",
          });
        }
        continue; // Skip other courses if we found grade-specific ones
      }
    }
    
    // No grade match or no grade specified, add all courses
    for (const c of courses) {
      const hit = byKey.get(`${examNormalized}::${c.id}`);
      rows.push({
        exam: examNormalized,
        courseName: c.name,
        fee: hit?.baseFee ?? leg?.baseFee ?? 0,
        notes: hit?.notes ?? "",
      });
    }
  }
  
  if (rows.length === 0) {
    return `<p style="margin:16px 0 0;font-size:13px;color:#757575;">No fee details available for the target exams. Configure fees under <strong>Fee Management</strong>.</p>`;
  }
  
  // Build HTML table
  const tableRows = rows.map((r) => {
    const notesHtml = r.notes 
      ? `<p style="margin:4px 0 0;font-size:11px;color:#616161;">${escapeHtmlForEmail(r.notes)}</p>` 
      : "";
    return `<tr>
<td style="padding:10px 14px;vertical-align:top;border-bottom:1px solid #eeeeee;font-size:13px;color:#616161;width:30%;">${escapeHtmlForEmail(r.exam)}</td>
<td style="padding:10px 14px;vertical-align:top;border-bottom:1px solid #eeeeee;font-size:13px;color:#212121;font-weight:500;">${escapeHtmlForEmail(r.courseName)}</td>
<td style="padding:10px 14px;vertical-align:top;border-bottom:1px solid #eeeeee;font-size:14px;color:#1565c0;font-weight:600;">₹${r.fee.toLocaleString()}</td>
</tr>
${notesHtml ? `<tr><td colspan="3" style="padding:0 14px 8px;">${notesHtml}</td></tr>` : ""}`;
  }).join("");
  
  return `<div style="margin:20px 0 0;border:1px solid #e3f2fd;border-radius:8px;overflow:hidden;max-width:640px;">
<div style="background:linear-gradient(180deg,#e3f2fd 0%,#bbdefb 100%);padding:12px 16px;font-weight:700;font-size:14px;color:#0d47a1;">Course Fee Structure</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#fafafa;">
<tr>
<th style="padding:10px 14px;text-align:left;font-size:12px;color:#616161;font-weight:600;border-bottom:2px solid #e0e0e0;">Exam</th>
<th style="padding:10px 14px;text-align:left;font-size:12px;color:#616161;font-weight:600;border-bottom:2px solid #e0e0e0;">Course</th>
<th style="padding:10px 14px;text-align:right;font-size:12px;color:#616161;font-weight:600;border-bottom:2px solid #e0e0e0;">Fee (INR)</th>
</tr>
${tableRows}
</table>
<p style="margin:12px 16px 14px;font-size:12px;line-height:1.45;color:#616161;">Fees shown are base rates. Contact us for scholarships, EMI options, or custom packages.</p>
</div>`;
}
