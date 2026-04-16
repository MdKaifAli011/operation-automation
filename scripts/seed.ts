/**
 * Full MongoDB seed: target exams, lead sources, exam–subject catalog, faculties
 * (with structured assignments), meet links, institute profile, bank accounts,
 * exam fee defaults, course brochure templates (multiple URLs per exam), sample
 * leads, and fee records.
 *
 * Usage:
 *   npm run seed
 *   FORCE_SEED=1 npm run seed
 *
 * Requires MONGODB_URI in .env.local (or .env).
 *
 * - First run (empty `leads`): inserts everything.
 * - If leads already exist: exits unless FORCE_SEED=1 (drops seed-related
 *   collections first, then re-inserts).
 */

import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

import connectDB from "../src/lib/mongodb";
import { ensureDefaultTemplates } from "../src/lib/email/ensureDefaultTemplates";
import LeadModel from "../src/models/Lead";
import FacultyModel from "../src/models/Faculty";
import FeeRecordModel from "../src/models/FeeRecord";
import MeetLinkModel from "../src/models/MeetLink";
import TargetExamSettingsModel from "../src/models/TargetExamSettings";
import LeadSourceSettingsModel from "../src/models/LeadSourceSettings";
import ExamSubjectCatalogModel from "../src/models/ExamSubjectCatalog";
import ExamFeeStructureModel from "../src/models/ExamFeeStructure";
import ExamCourseCatalogModel from "../src/models/ExamCourseCatalog";
import ExamCourseFeeStructureModel from "../src/models/ExamCourseFeeStructure";
import ExamBrochureTemplateModel from "../src/models/ExamBrochureTemplate";
import InstituteProfileSettingsModel from "../src/models/InstituteProfileSettings";
import BankProfileSettingsModel from "../src/models/BankProfileSettings";
import { ensureExamBrochureTemplateIndexes } from "../src/lib/examBrochureTemplateIndexes";
import type { RowTone, SheetTabId } from "../src/lib/types";

const SETTINGS_KEY = "default";

/** Stable sample PDF URLs (public, for UI testing only). */
const SAMPLE_PDF_A =
  "https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.pdf";
const SAMPLE_PDF_B =
  "https://www.africau.edu/images/default/sample.pdf";

const TARGET_EXAMS = [
  { value: "NEET", label: "NEET (UG)", sortOrder: 0, isActive: true },
  { value: "JEE", label: "JEE Main", sortOrder: 1, isActive: true },
  { value: "CUET", label: "CUET", sortOrder: 2, isActive: true },
  { value: "SAT", label: "SAT", sortOrder: 3, isActive: true },
  { value: "Other", label: "Other", sortOrder: 4, isActive: true },
] as const;

const LEAD_SOURCES = [
  { abbrev: "OL", label: "Organic", value: "Organic" },
  { abbrev: "WT", label: "Whatsapp", value: "Whatsapp" },
  { abbrev: "REF", label: "Reference", value: "Reference" },
  { abbrev: "PD", label: "Paid", value: "Paid" },
];

const CATALOG_SUBJECTS = [
  {
    id: "seed-neet-bio",
    examValue: "NEET",
    name: "Biology",
    sortOrder: 0,
    isActive: true,
  },
  {
    id: "seed-neet-phy",
    examValue: "NEET",
    name: "Physics",
    sortOrder: 1,
    isActive: true,
  },
  {
    id: "seed-neet-chem",
    examValue: "NEET",
    name: "Chemistry",
    sortOrder: 2,
    isActive: true,
  },
  {
    id: "seed-jee-phy",
    examValue: "JEE",
    name: "Physics",
    sortOrder: 0,
    isActive: true,
  },
  {
    id: "seed-jee-math",
    examValue: "JEE",
    name: "Mathematics",
    sortOrder: 1,
    isActive: true,
  },
  {
    id: "seed-jee-chem",
    examValue: "JEE",
    name: "Chemistry",
    sortOrder: 2,
    isActive: true,
  },
  {
    id: "seed-cuet-eng",
    examValue: "CUET",
    name: "English",
    sortOrder: 0,
    isActive: true,
  },
  {
    id: "seed-cuet-reason",
    examValue: "CUET",
    name: "General Test",
    sortOrder: 1,
    isActive: true,
  },
  {
    id: "seed-sat-math",
    examValue: "SAT",
    name: "SAT Math",
    sortOrder: 0,
    isActive: true,
  },
  {
    id: "seed-sat-rw",
    examValue: "SAT",
    name: "SAT Reading & Writing",
    sortOrder: 1,
    isActive: true,
  },
  {
    id: "seed-other-counsel",
    examValue: "Other",
    name: "Career Counselling",
    sortOrder: 0,
    isActive: true,
  },
];

const EXAM_COURSES = [
  { id: "seed-neet-2yr", examValue: "NEET", name: "2-Year Foundation", sortOrder: 0, isActive: true },
  { id: "seed-neet-dropper", examValue: "NEET", name: "Dropper Batch", sortOrder: 1, isActive: true },
  { id: "seed-jee-main-adv", examValue: "JEE", name: "Main + Advanced", sortOrder: 0, isActive: true },
  { id: "seed-jee-weekend", examValue: "JEE", name: "Weekend Crash Course", sortOrder: 1, isActive: true },
  { id: "seed-cuet-ug", examValue: "CUET", name: "CUET UG Integrated", sortOrder: 0, isActive: true },
  { id: "seed-sat-global", examValue: "SAT", name: "SAT Global Prep", sortOrder: 0, isActive: true },
  { id: "seed-other-mentoring", examValue: "Other", name: "Mentoring Program", sortOrder: 0, isActive: true },
] as const;

const FACULTY_ROWS = [
  {
    name: "Dr. Meena Singh",
    phone: "9810000001",
    email: "meena.seed@example.com",
    qualification: "MD",
    experience: 12,
    joined: "2018-04-01",
    assignments: [
      { examValue: "NEET", subjectId: "seed-neet-bio" },
      { examValue: "NEET", subjectId: "seed-neet-chem" },
    ],
    subjects: ["Biology", "Chemistry"],
    courses: ["NEET"],
  },
  {
    name: "Mr. Ravi Kumar",
    phone: "9810000002",
    email: "ravi.seed@example.com",
    qualification: "M.Sc",
    experience: 10,
    joined: "2019-06-15",
    assignments: [
      { examValue: "NEET", subjectId: "seed-neet-phy" },
      { examValue: "JEE", subjectId: "seed-jee-phy" },
    ],
    subjects: ["Physics", "Mathematics"],
    courses: ["NEET", "JEE"],
  },
  {
    name: "Ms. Priya Sharma",
    phone: "9810000003",
    email: "priya.seed@example.com",
    qualification: "MA",
    experience: 8,
    joined: "2020-01-10",
    assignments: [
      { examValue: "CUET", subjectId: "seed-cuet-eng" },
      { examValue: "CUET", subjectId: "seed-cuet-reason" },
    ],
    subjects: ["English", "General Test"],
    courses: ["CUET"],
  },
  {
    name: "Mr. Arjun Das",
    phone: "9810000004",
    email: "arjun.seed@example.com",
    qualification: "B.Tech",
    experience: 6,
    joined: "2021-03-01",
    assignments: [
      { examValue: "JEE", subjectId: "seed-jee-math" },
      { examValue: "JEE", subjectId: "seed-jee-chem" },
    ],
    subjects: ["Mathematics", "Chemistry"],
    courses: ["JEE"],
  },
];

const MEET_LINKS = [
  {
    url: "https://meet.google.com/lookup/seed-demo-physics",
    label: "Seed · Physics demo",
    active: true,
    sortOrder: 0,
  },
  {
    url: "https://meet.google.com/lookup/seed-demo-chem",
    label: "Seed · Chemistry demo",
    active: true,
    sortOrder: 1,
  },
  {
    url: "https://meet.google.com/lookup/seed-demo-backup",
    label: "Seed · Backup room",
    active: true,
    sortOrder: 2,
  },
];

const FIRST = [
  "Rahul",
  "Sneha",
  "Aryan",
  "Kavya",
  "Rohan",
  "Ananya",
  "Vikram",
  "Pooja",
  "Amit",
  "Riya",
  "Ishaan",
  "Neha",
  "Dev",
  "Meera",
  "Arjun",
  "Sanjay",
  "Tara",
  "Kabir",
  "Diya",
  "Manish",
  "Aditi",
  "Karan",
  "Swati",
  "Harsh",
  "Nisha",
  "Yash",
  "Priya",
  "Ritvik",
];

const LAST = [
  "Sharma",
  "Patel",
  "Mehta",
  "Nair",
  "Gupta",
  "Singh",
  "Joshi",
  "Reddy",
  "Kumar",
  "Verma",
  "Kapoor",
  "Malhotra",
  "Iyer",
  "Menon",
  "Desai",
  "Kulkarni",
  "Chopra",
  "Bansal",
  "Agarwal",
  "Sen",
  "Rao",
  "Pillai",
  "Ghosh",
  "Das",
  "Mishra",
  "Tiwari",
  "Bhatt",
  "Shah",
];

/** Values must exist in seeded lead sources (Settings → Lead sources). */
const DATA_TYPES = [
  "Organic",
  "Paid",
  "Whatsapp",
  "Reference",
  "Paid",
] as const;
const GRADES = ["10th", "11th", "12th", "Dropper", "Graduate"] as const;

const EXAM_SETS = [
  ["NEET"],
  ["JEE"],
  ["NEET", "JEE"],
  ["CUET"],
  ["SAT"],
  ["JEE", "SAT"],
  ["NEET", "CUET"],
  ["Other"],
] as const;

const COUNTRIES = [
  "India",
  "India",
  "India",
  "UAE",
  "Singapore",
  "Nepal",
  "India",
  "Saudi Arabia",
];

const TONES: RowTone[] = [
  "new",
  "interested",
  "followup_later",
  "called_no_response",
  "not_interested",
];

const SHEETS: SheetTabId[] = [
  "today",
  "ongoing",
  "ongoing",
  "followup",
  "ongoing",
  "not_interested",
  "ongoing",
  "converted",
  "ongoing",
];

function brochureItem(
  title: string,
  linkUrl: string,
  sortOrder: number,
): {
  key: string;
  title: string;
  summary: string;
  linkUrl: string;
  linkLabel: string;
  storedFileUrl: null;
  storedFileName: null;
  sortOrder: number;
} {
  return {
    key: randomUUID(),
    title,
    summary: "",
    linkUrl,
    linkLabel: "Open link",
    storedFileUrl: null,
    storedFileName: null,
    sortOrder,
  };
}

function buildLeads() {
  const leads: Record<string, unknown>[] = [];
  const dates = [
    "2026-04-03",
    "2026-04-03",
    "2026-04-02",
    "2026-04-02",
    "2026-04-01",
    "2026-04-01",
    "2026-03-31",
    "2026-03-31",
    "2026-03-30",
    "2026-03-30",
    "2026-03-29",
    "2026-03-28",
    "2026-03-27",
    "2026-03-26",
    "2026-03-25",
    "2026-03-24",
    "2026-03-23",
    "2026-03-22",
    "2026-03-21",
    "2026-03-20",
    "2026-03-19",
    "2026-03-18",
    "2026-03-17",
    "2026-03-16",
    "2026-03-15",
    "2026-03-14",
    "2026-03-13",
    "2026-03-12",
  ];
  for (let i = 0; i < 28; i++) {
    const date = dates[i] ?? "2026-04-01";
    const sheetTab = SHEETS[i % SHEETS.length];
    let rowTone: RowTone = TONES[i % TONES.length];
    if (sheetTab === "today") {
      rowTone = "new";
    }
    const pipelineSteps =
      sheetTab === "converted"
        ? 4
        : sheetTab === "not_interested"
          ? Math.min(2, i % 4)
          : Math.min(4, i % 5);
    const followUpDate =
      sheetTab === "followup"
        ? `2026-04-${String(5 + (i % 10)).padStart(2, "0")}`
        : null;
    const fn = FIRST[i % FIRST.length];
    const ln = LAST[(i * 3) % LAST.length];
    const email = `${fn.toLowerCase()}.${ln.toLowerCase()}+seed${i + 1}@example.com`;
    const examSet = [...EXAM_SETS[i % EXAM_SETS.length]];
    leads.push({
      date,
      followUpDate,
      studentName: `${fn} ${ln}`,
      parentName: `${ln} Family`,
      dataType: DATA_TYPES[i % DATA_TYPES.length],
      grade: GRADES[i % GRADES.length],
      targetExams: examSet,
      country: COUNTRIES[i % COUNTRIES.length],
      phone: `98${String(76543210 + i * 10007).padStart(8, "0").slice(-8)}`,
      email,
      pipelineSteps,
      rowTone,
      sheetTab,
      pipelineMeta: buildSeedPipelineMeta(i, examSet),
    });
  }
  return leads;
}

function buildSeedPipelineMeta(i: number, exams: readonly string[]) {
  const primaryExam = String(exams[0] ?? "NEET");
  const demoRowIdA = `seed-demo-${i + 1}-a`;
  const demoRowIdB = `seed-demo-${i + 1}-b`;
  const hasTeacherFeedback = i % 2 === 0;
  const hasGeneratedReport = i % 4 === 0;

  const baseDemoRows = [
    {
      meetRowId: demoRowIdA,
      examValue: primaryExam,
      subject: primaryExam === "JEE" ? "Physics" : "Biology",
      teacher: primaryExam === "JEE" ? "Mr. Ravi Kumar" : "Dr. Meena Singh",
      studentTimeZone: "Asia/Kolkata",
      status: "Scheduled",
      isoDate: `2026-04-${String(7 + (i % 6)).padStart(2, "0")}`,
      timeHmIST: i % 3 === 0 ? "10:30" : "16:00",
      inviteSent: i % 3 !== 0,
      inviteSentAt: i % 3 !== 0 ? "2026-04-08T08:00:00.000Z" : null,
      teacherFeedbackInviteSentAt: hasTeacherFeedback
        ? "2026-04-09T12:30:00.000Z"
        : null,
      teacherFeedbackSubmittedAt: hasTeacherFeedback
        ? "2026-04-09T15:10:00.000Z"
        : null,
      teacherFeedbackRating: hasTeacherFeedback ? "Good" : "",
      teacherFeedbackStrengths: hasTeacherFeedback
        ? "Good concept clarity and attentive participation."
        : "",
      teacherFeedbackImprovements: hasTeacherFeedback
        ? "Needs faster calculations in timed questions."
        : "",
      teacherFeedbackNotes: hasTeacherFeedback
        ? "Parent joined the last 5 minutes."
        : "",
    },
    ...(i % 5 === 0
      ? [
          {
            meetRowId: demoRowIdB,
            examValue: primaryExam,
            subject: primaryExam === "JEE" ? "Mathematics" : "Chemistry",
            teacher: primaryExam === "JEE" ? "Mr. Arjun Das" : "Mr. Ravi Kumar",
            studentTimeZone: "Asia/Kolkata",
            status: "Scheduled",
            isoDate: "2026-04-15",
            timeHmIST: "18:30",
            inviteSent: false,
            inviteSentAt: null,
            teacherFeedbackInviteSentAt: null,
            teacherFeedbackSubmittedAt: null,
            teacherFeedbackRating: "",
            teacherFeedbackStrengths: "",
            teacherFeedbackImprovements: "",
            teacherFeedbackNotes: "",
          },
        ]
      : []),
  ];

  const documentsItems = [
    ...(hasGeneratedReport
      ? [
          {
            key: "report",
            title: "Demo Session Report - Feedback",
            countLabel: hasTeacherFeedback ? "1" : "0",
            sentAt: i % 8 === 0 ? "2026-04-10T11:00:00.000Z" : null,
          },
        ]
      : []),
    ...(i % 3 === 0
      ? [
          {
            key: `custom-${i + 1}`,
            title: "Academic Planner",
            countLabel: "1",
            isCustom: true,
            documentUrl: "https://www.africau.edu/images/default/sample.pdf",
            sentAt: "2026-04-10T12:00:00.000Z",
          },
        ]
      : []),
  ];

  return {
    demo: {
      rows: baseDemoRows,
      lastInviteSharedAt: "2026-04-08T08:00:00.000Z",
      lastInviteSummary: "Seed invite sharing snapshot",
    },
    documents: { items: documentsItems },
    studentReport: {
      pdfUrl: hasGeneratedReport
        ? `/uploads/student-reports/seed/lead-${i + 1}.pdf`
        : null,
      fileName: hasGeneratedReport ? `demo-report-${i + 1}.pdf` : null,
      generatedAt: hasGeneratedReport ? "2026-04-10T10:00:00.000Z" : null,
      generatedForMeetRowId: hasGeneratedReport ? demoRowIdA : null,
      recommendations: hasTeacherFeedback
        ? "Keep weekly practice tests and revise weak chapters."
        : "",
      additionalNotes: "",
      sendConfirmedAt: i % 8 === 0 ? "2026-04-10T11:00:00.000Z" : null,
    },
    brochure: {
      sentEmail: i % 3 === 0,
      sentEmailAt: i % 3 === 0 ? "2026-04-08T09:30:00.000Z" : null,
    },
    fees: {
      feeSelectedBankAccountId: "seed-bank-fees-main",
      feeSentEmail: i % 6 === 0,
      feeSentEmailAt: i % 6 === 0 ? "2026-04-11T08:00:00.000Z" : null,
      enrollmentSent: i % 7 === 0,
      enrollmentSentAt: i % 7 === 0 ? "2026-04-11T08:05:00.000Z" : null,
      /** Pipeline Fees step completion (email fee plan from Step 3). */
      feePlanEmailSentAt:
        i % 5 === 0 ? "2026-04-11T08:10:00.000Z" : null,
    },
  };
}

async function dropSeedCollections(force: boolean) {
  if (!force) return;
  await LeadModel.deleteMany({});
  await FeeRecordModel.deleteMany({});
  await FacultyModel.deleteMany({});
  await MeetLinkModel.deleteMany({});
  await TargetExamSettingsModel.deleteMany({});
  await LeadSourceSettingsModel.deleteMany({});
  await ExamSubjectCatalogModel.deleteMany({});
  await ExamCourseCatalogModel.deleteMany({});
  await ExamFeeStructureModel.deleteMany({});
  await ExamCourseFeeStructureModel.deleteMany({});
  await ExamBrochureTemplateModel.deleteMany({});
  await InstituteProfileSettingsModel.deleteMany({});
  await BankProfileSettingsModel.deleteMany({});
  console.log(
    "Cleared leads, fees, faculties, meet links, exams, sources, subject/course catalogs, fee structures, brochures, institute, bank (FORCE_SEED=1).",
  );
}

async function seedSettingsAndContent() {
  await TargetExamSettingsModel.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { $set: { exams: [...TARGET_EXAMS] } },
    { upsert: true },
  );
  console.log(`Target exams: ${TARGET_EXAMS.length} rows.`);

  await LeadSourceSettingsModel.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { $set: { sources: LEAD_SOURCES } },
    { upsert: true },
  );
  console.log(`Lead sources: ${LEAD_SOURCES.length} rows.`);

  await ExamSubjectCatalogModel.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { $set: { subjects: CATALOG_SUBJECTS } },
    { upsert: true },
  );
  console.log(`Exam–subject catalog: ${CATALOG_SUBJECTS.length} subjects.`);

  await ExamCourseCatalogModel.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { $set: { courses: [...EXAM_COURSES] } },
    { upsert: true },
  );
  console.log(`Exam-course catalog: ${EXAM_COURSES.length} rows.`);

  await MeetLinkModel.insertMany(MEET_LINKS);
  console.log(`Meet links: ${MEET_LINKS.length} rows.`);

  await InstituteProfileSettingsModel.findOneAndUpdate(
    { key: SETTINGS_KEY },
    {
      $set: {
        institute: {
          instituteName: "TestPrep Institute (Seed)",
          regNo: "REG-SEED-2026",
          gst: "22AAAAA0000A1Z5",
          feeGstPercent: 18,
          inrPerUsd: 83,
          inrPerAed: 22.5,
          address: "12 Demo Road, Sector 18",
          city: "Gurugram",
          state: "Haryana",
          country: "India",
          pincode: "122015",
          phone: "+91 120 0000000",
          email: "admin@example-seed.edu",
          website: "https://example-seed.edu",
        },
      },
    },
    { upsert: true },
  );
  console.log("Institute profile: saved.");

  const feeBankId = "seed-bank-fees-main";
  const secondBankId = "seed-bank-secondary";
  await BankProfileSettingsModel.findOneAndUpdate(
    { key: SETTINGS_KEY },
    {
      $set: {
        bankAccounts: [
          {
            id: feeBankId,
            label: "Main · Student fees (HDFC)",
            bankName: "HDFC Bank",
            accountHolderName: "TestPrep Institute (Seed)",
            accountNumber: "50100123456789",
            ifsc: "HDFC0001234",
            branch: "Gurugram Sector 18",
            accountType: "Current" as const,
            upi: "testprep.seed@hdfcbank",
            isActive: true,
          },
          {
            id: secondBankId,
            label: "Secondary · Scholarships (ICICI)",
            bankName: "ICICI Bank",
            accountHolderName: "TestPrep Institute (Seed)",
            accountNumber: "123456789012",
            ifsc: "ICIC0005678",
            branch: "Gurugram DLF Phase 2",
            accountType: "Current" as const,
            upi: "",
            isActive: true,
          },
        ],
        defaultFeeBankAccountId: feeBankId,
      },
    },
    { upsert: true },
  );
  console.log("Bank profile: 2 accounts + default for fees.");

  const feeStructDocs = TARGET_EXAMS.map((e, i) => ({
    exam: e.value,
    baseFee: 125000 + i * 12000,
    notes: `Seed base fee for ${e.label}`,
  }));
  await ExamFeeStructureModel.insertMany(feeStructDocs);
  console.log(`Exam fee structures: ${feeStructDocs.length} rows.`);

  const courseFeeRows = EXAM_COURSES.map((c, i) => ({
    exam: c.examValue,
    courseId: c.id,
    baseFee: 115000 + i * 9000,
    notes: `Seed fee for ${c.examValue} · ${c.name}`,
  }));
  await ExamCourseFeeStructureModel.insertMany(courseFeeRows);
  console.log(`Exam course fee structures: ${courseFeeRows.length} rows.`);

  const neetBrochures = [
    brochureItem("NEET — Full course brochure", SAMPLE_PDF_A, 0),
    brochureItem("NEET — Biology module outline", SAMPLE_PDF_B, 1),
    brochureItem("NEET — Quick FAQ (link only)", SAMPLE_PDF_A, 2),
  ];
  const jeeBrochures = [
    brochureItem("JEE Main — Information PDF", SAMPLE_PDF_B, 0),
    brochureItem("JEE — PCM combo overview", SAMPLE_PDF_A, 1),
  ];
  const cuetBrochures = [
    brochureItem("CUET — General brochure", SAMPLE_PDF_A, 0),
  ];

  await ensureExamBrochureTemplateIndexes(ExamBrochureTemplateModel);
  await ExamBrochureTemplateModel.insertMany([
    { exam: "NEET", courseId: "seed-neet-2yr", brochures: neetBrochures },
    { exam: "NEET", courseId: "seed-neet-dropper", brochures: neetBrochures },
    { exam: "JEE", courseId: "seed-jee-main-adv", brochures: jeeBrochures },
    { exam: "JEE", courseId: "seed-jee-weekend", brochures: jeeBrochures },
    { exam: "CUET", courseId: "seed-cuet-ug", brochures: cuetBrochures },
    { exam: "SAT", courseId: "seed-sat-global", brochures: [brochureItem("SAT — Global prep brochure", SAMPLE_PDF_B, 0)] },
    { exam: "Other", courseId: "seed-other-mentoring", brochures: [brochureItem("Mentoring program overview", SAMPLE_PDF_A, 0)] },
  ]);
  console.log(
    "Course brochures: seeded for all exam-course combinations.",
  );

  await FacultyModel.insertMany(
    FACULTY_ROWS.map((f) => ({
      name: f.name,
      phone: f.phone,
      email: f.email,
      active: true,
      qualification: f.qualification,
      experience: f.experience,
      joined: f.joined,
      assignments: f.assignments,
      subjects: f.subjects,
      courses: f.courses,
    })),
  );
  console.log(`Faculties: ${FACULTY_ROWS.length} with catalog assignments.`);

  await ensureDefaultTemplates();
  console.log("Email templates: ensured defaults where missing.");
}

async function seedLeadsAndFees() {
  const leadPayloads = buildLeads();
  const inserted = await LeadModel.insertMany(leadPayloads);
  console.log(`Leads: ${inserted.length} inserted.`);

  const feeStatuses = ["Paid", "Partial", "Pending"] as const;
  const feeSlice = inserted.slice(0, 10);
  const feeRows = feeSlice.map((lead, i) => {
    const total = 65000 + i * 7500;
    const discountPct = i % 4 === 0 ? 10 : i % 4 === 1 ? 5 : 0;
    const finalAmount = Math.round(total * (1 - discountPct / 100));
    const paid =
      feeStatuses[i % 3] === "Paid"
        ? finalAmount
        : feeStatuses[i % 3] === "Partial"
          ? Math.round(finalAmount * 0.45)
          : 0;
    const exams = lead.targetExams as string[] | undefined;
    const course = Array.isArray(exams) && exams[0] ? exams[0] : "NEET";
    return {
      studentName: lead.studentName,
      course,
      total,
      discount: discountPct,
      finalAmount,
      paid,
      emiMonths: i % 2 === 0 ? 12 : i % 3 === 0 ? 6 : 0,
      status: feeStatuses[i % 3],
      leadId: lead._id,
    };
  });
  await FeeRecordModel.insertMany(feeRows);
  console.log(`Fee records: ${feeRows.length} inserted.`);
}

async function main() {
  const force = process.env.FORCE_SEED === "1";

  if (!process.env.MONGODB_URI?.trim()) {
    console.error("Missing MONGODB_URI. Set it in .env.local");
    process.exit(1);
  }

  await connectDB();

  if (force) {
    await dropSeedCollections(true);
  } else if ((await LeadModel.countDocuments()) > 0) {
    console.log(
      "Leads already exist. Set FORCE_SEED=1 to replace all seed data (settings + leads).",
    );
    process.exit(0);
  }

  await seedSettingsAndContent();
  await seedLeadsAndFees();

  console.log("\nSeed completed. Open the app and verify:");
  console.log("  · Leads / students / fees");
  console.log("  · Exams & subjects, Faculties, Meet links");
  console.log("  · Course brochures, Bank details, Fee management");
  console.log("  · Enrolled students dashboard tiles match target exams\n");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
