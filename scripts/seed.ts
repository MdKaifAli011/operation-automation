/**
 * Seed MongoDB with faculty, 28 sample leads, and fee rows.
 * Usage: npm run seed
 * Requires MONGODB_URI in .env.local
 * Set FORCE_SEED=1 to drop leads, faculties, and fee_records first.
 */

import path from "node:path";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

import connectDB from "../src/lib/mongodb";
import LeadModel from "../src/models/Lead";
import FacultyModel from "../src/models/Faculty";
import FeeRecordModel from "../src/models/FeeRecord";
import type { RowTone, SheetTabId } from "../src/lib/types";

const FACULTIES = [
  {
    name: "Dr. Meena Singh",
    subjects: ["Biology", "Chemistry"],
    phone: "9810000001",
    email: "meena@testprepkart.com",
    active: true,
    qualification: "MD",
    experience: 12,
    joined: "2018-04-01",
  },
  {
    name: "Mr. Ravi Kumar",
    subjects: ["Physics", "Mathematics"],
    phone: "9810000002",
    email: "ravi@testprepkart.com",
    active: true,
    qualification: "M.Sc",
    experience: 10,
    joined: "2019-06-15",
  },
  {
    name: "Ms. Priya Sharma",
    subjects: ["CUET English", "Reasoning", "English"],
    phone: "9810000003",
    email: "priya@testprepkart.com",
    active: true,
    qualification: "MA",
    experience: 8,
    joined: "2020-01-10",
  },
  {
    name: "Mr. Arjun Das",
    subjects: ["JEE Mathematics", "Mathematics"],
    phone: "9810000004",
    email: "arjun@testprepkart.com",
    active: true,
    qualification: "B.Tech",
    experience: 6,
    joined: "2021-03-01",
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

const DATA_TYPES = ["Organic", "Paid", "Referral", "Walk-in", "Partner"] as const;
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
  "ongoing",
  "ongoing",
  "followup",
  "ongoing",
  "not_interested",
  "ongoing",
  "converted",
  "ongoing",
];

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
    const email = `${fn.toLowerCase()}.${ln.toLowerCase()}@student.mail`;
    leads.push({
      date,
      followUpDate,
      studentName: `${fn} ${ln}`,
      parentName: `${ln} Family`,
      dataType: DATA_TYPES[i % DATA_TYPES.length],
      grade: GRADES[i % GRADES.length],
      targetExams: [...EXAM_SETS[i % EXAM_SETS.length]],
      country: COUNTRIES[i % COUNTRIES.length],
      phone: `98${String(76543210 + i * 10007).padStart(8, "0").slice(-8)}`,
      email,
      pipelineSteps,
      rowTone: TONES[i % TONES.length],
      sheetTab,
    });
  }
  return leads;
}

async function main() {
  const force = process.env.FORCE_SEED === "1";
  await connectDB();

  if (force) {
    await LeadModel.deleteMany({});
    await FeeRecordModel.deleteMany({});
    await FacultyModel.deleteMany({});
    console.log("Cleared leads, fee_records, faculties (FORCE_SEED=1).");
  } else if ((await LeadModel.countDocuments()) > 0) {
    console.log(
      "Leads already exist. Set FORCE_SEED=1 in env to replace all seed data.",
    );
    process.exit(0);
  }

  await FacultyModel.insertMany(FACULTIES);
  console.log(`Inserted ${FACULTIES.length} faculty.`);

  const leadPayloads = buildLeads();
  const inserted = await LeadModel.insertMany(leadPayloads);
  console.log(`Inserted ${inserted.length} leads.`);

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
    return {
      studentName: lead.studentName,
      course: lead.targetExams[0] ?? "NEET",
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
  console.log(`Inserted ${feeRows.length} fee records.`);

  console.log("Seed completed.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
