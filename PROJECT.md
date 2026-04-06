# Operation Automation — Project Documentation

Internal CRM-style app for education operations: **leads**, **student pipeline** (demo → brochure → fees → schedule), **faculties**, **fees**, and **exam-based defaults**. Data is stored in **MongoDB** via **Mongoose**; the UI is **Next.js 16** (App Router) with **React 19** and **Tailwind CSS 4**.

---

## Table of contents

1. [Tech stack](#tech-stack)
2. [Prerequisites](#prerequisites)
3. [Environment variables](#environment-variables)
4. [Scripts](#scripts)
5. [Repository layout](#repository-layout)
6. [MongoDB & collections](#mongodb--collections)
7. [REST API routes](#rest-api-routes)
8. [Application routes (pages)](#application-routes-pages)
9. [Core domain concepts](#core-domain-concepts)
10. [Student pipeline & `pipelineMeta`](#student-pipeline--pipelinemeta)
11. [Lead management](#lead-management)
12. [Student detail page](#student-detail-page)
13. [Exam-based defaults](#exam-based-defaults)
14. [Utilities & shared modules](#utilities--shared-modules)
15. [UI & styling](#ui--styling)
16. [Seeding sample data](#seeding-sample-data)

---

## Tech stack

| Layer | Technology |
|--------|------------|
| Framework | [Next.js](https://nextjs.org/) 16.2 (App Router, Turbopack build) |
| UI | React 19.2, client components where needed (`"use client"`) |
| Styling | Tailwind CSS 4, `clsx` + `cn()` helper |
| Database | MongoDB, [Mongoose](https://mongoosejs.com/) 9.x |
| Dates | `date-fns` |
| Excel | `@e965/xlsx` (import/export) |
| Language | TypeScript 5 |

---

## Prerequisites

- **Node.js** (LTS recommended) for `npm install` / `npm run dev` / `npm run build`.
- **MongoDB** reachable via URI (local `mongod`, Atlas, or Docker).

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | **Required.** Connection string, e.g. `mongodb://127.0.0.1:27017/operation-automation` |

Loaded from `.env.local` (preferred) or `.env` at the project root. The Mongo helper reads `MONGODB_URI` **at connection time** so CLI scripts can `dotenv` first.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js development server |
| `npm run build` | Production build |
| `npm run start` | Start production server (after `build`) |
| `npm run lint` | ESLint |
| `npm run seed` | Seed DB: faculties, sample leads, fee records (`tsx scripts/seed.ts`). Optional `FORCE_SEED=1` to drop some collections first — see `scripts/seed.ts` |

---

## Repository layout

```
operation-automation/
├── AGENTS.md                  ← Guidance for AI coding agents (Cursor)
├── PROJECT.md                 ← This file
├── package.json
├── next.config.ts
├── scripts/
│   └── seed.ts                # Sample data seed
└── src/
    ├── app/
    │   ├── layout.tsx         # Root layout
    │   ├── globals.css
    │   ├── (dashboard)/       # Shell: Sidebar + Header + main
    │   │   ├── layout.tsx
    │   │   ├── page.tsx       # Lead management (home)
    │   │   ├── faculties/page.tsx
    │   │   ├── fee-management/page.tsx
    │   │   ├── subjects/page.tsx
    │   │   ├── course-brochure/page.tsx
    │   │   ├── bank-details/page.tsx
    │   │   ├── enroll-student/page.tsx
    │   │   └── students/[id]/page.tsx   # Student detail
    │   └── api/                 # Route handlers (Node runtime)
    │       ├── faculties/route.ts
    │       ├── fees/route.ts
    │       ├── exam-fee-structures/route.ts
    │       ├── exam-brochure-templates/route.ts
    │       └── leads/
    │           ├── route.ts
    │           ├── batch/route.ts
    │           └── [id]/route.ts
    ├── components/
    │   ├── layout/              # Header, Sidebar (nav)
    │   ├── icons/               # CrmIcons
    │   ├── leads/               # Lead grid, dialogs, import/export
    │   └── student/             # StudentDetailPage, student-excel-ui
    ├── lib/
    │   ├── mongodb.ts           # Cached Mongoose connect
    │   ├── types.ts             # Lead, Faculty, FeeRecord, etc.
    │   ├── constants.ts         # TARGET_EXAM_OPTIONS, grades, …
    │   ├── pipeline.ts          # mergePipelineMeta, activity, step rules
    │   ├── leadPipelineMetaTypes.ts  # TS mirror of workspace JSON
    │   ├── serializers.ts       # DB → API JSON
    │   ├── examFeeDefaults.ts   # primaryExamForFee()
    │   ├── lead-display.ts, phone-display.ts, country-phone.ts, …
    │   └── cn.ts
    └── models/                  # Mongoose schemas
        ├── Lead.ts
        ├── leadPipelineMetaSchema.ts
        ├── Faculty.ts
        ├── FeeRecord.ts
        ├── ExamFeeStructure.ts
        └── ExamBrochureTemplate.ts
```

---

## MongoDB & collections

| Collection | Model | Purpose |
|------------|--------|---------|
| `leads` | `Lead` | CRM rows + `pipelineMeta` workspace + notes + calls + activity |
| `faculties` | `Faculty` | Teachers: name, subjects[], contact, active, … |
| `fee_records` | `FeeRecord` | Fee ledger rows (optional `leadId` link) |
| `exam_fee_structures` | `ExamFeeStructure` | Default **base fee (INR)** per target exam |
| `exam_brochure_templates` | `ExamBrochureTemplate` | Per-exam brochure **title, summary, PDF link** |

ObjectIds are serialized to string `id` in API responses where applicable.

---

## REST API routes

All under `src/app/api/…`. Runtime: **`nodejs`** (Mongoose).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/leads` | All leads (newest-oriented in code) |
| `POST` | `/api/leads` | Create lead (body validated in route) |
| `GET` | `/api/leads/[id]` | Single lead by ID |
| `PATCH` | `/api/leads/[id]` | Partial update (merge `pipelineMeta` in handler as designed) |
| `POST` | `/api/leads/batch` | Bulk create (e.g. Excel import) |
| `GET` | `/api/faculties` | All faculties, sorted by name |
| `GET` | `/api/fees` | All fee records |
| `GET` | `/api/exam-fee-structures` | One row per `TARGET_EXAM_OPTIONS` (merged with DB) |
| `PUT` | `/api/exam-fee-structures` | Upsert `{ items: [{ exam, baseFee, notes? }] }` |
| `GET` | `/api/exam-brochure-templates` | One row per exam (title, summary, linkUrl, linkLabel) |
| `PUT` | `/api/exam-brochure-templates` | Upsert brochure templates per exam |

---

## Application routes (pages)

| Route | Component / role |
|-------|------------------|
| `/` | `LeadManagementPage` — main sheet: tabs, filters, add lead, import/export |
| `/students/[id]` | `StudentDetailPage` — full pipeline + notes + calls |
| `/faculties` | Faculty CRUD-style UI backed by `/api/faculties` |
| `/fee-management` | Fee records table + **exam default fees** editor |
| `/subjects` | Subject list derived from **faculty.subjects** (no separate subject collection) |
| `/course-brochure` | **Exam brochure templates** (admin) |
| `/bank-details` | Institute/bank form (local draft UX; not persisted to API unless extended) |
| `/enroll-student` | Converted leads + fee status from `/api/fees` |

Navigation is defined in `src/components/layout/Sidebar.tsx`. Student URLs are linked from the lead grid / enroll page as `/students/{id}`.

---

## Core domain concepts

### Lead (`src/lib/types.ts` / `Lead` model)

- **Identity & CRM:** `studentName`, `parentName`, `phone`, `email`, `country`, `grade`, `targetExams[]`, `dataType`, `date`, `followUpDate`.
- **Sheet:** `sheetTab` — `ongoing` | `followup` | `not_interested` | `converted`.
- **Tone:** `rowTone` — interest / follow-up / not interested / new / no response.
- **Pipeline:** `pipelineSteps` 0–4 (dots); derived from `pipelineMeta` via `computePipelineStepsFromMeta` in `src/lib/pipeline.ts`.
- **Workspace:** `pipelineMeta` — nested **demo**, **brochure**, **fees**, **schedule** (see below).
- **Activity:** `activityLog[]` — `{ at, kind, message }`.
- **Notes:** `workspaceNotes`.
- **Calls:** `callHistory[]`.

### Faculty

Fields include `name`, `subjects[]`, `phone`, `email`, `active`, `qualification`, `experience`, `joined`.

### Fee record

Financial row: `studentName`, `course`, `total`, `discount`, `finalAmount`, `paid`, `emiMonths`, `status`, optional `leadId`.

---

## Student pipeline & `pipelineMeta`

Stored on **`Lead.pipelineMeta`** (MongoDB). TypeScript shapes live in `src/lib/leadPipelineMetaTypes.ts`; Mongoose structure in `src/models/leadPipelineMetaSchema.ts`.

| Block | Contents (high level) |
|-------|------------------------|
| **demo** | `rows[]`: subject, teacher, timezone, status, IST date/time, invite flags; optional `lastInviteSharedAt` / summary |
| **brochure** | Notes, file name, generated flag, WhatsApp/email send flags + timestamps |
| **fees** | `baseTotal`, scholarship, installments, currency, send flags, enrollment sent, etc. |
| **schedule** | View mode, `classes[]` (day, subject, times, teacher, duration), week anchor, send flags |

**`mergePipelineMeta(current, patch)`** (`src/lib/pipeline.ts`) shallow-merges top-level keys and **deep-merges** the four nested buckets so PATCH updates do not wipe sibling fields.

**Pipeline steps (0–4)** are recomputed from stored flags (demos present, brochure done, fee sends, schedule sends) — see `computePipelineStepsFromMeta`.

---

## Lead management

File: `src/components/leads/LeadManagementPage.tsx` (and table/dialog subcomponents).

- Tabbed or filtered views aligned with `sheetTab`.
- Row actions: open student detail, follow-up, tone, pipeline dots.
- **AddStudentLeadDialog** — create lead via `POST /api/leads`.
- **ImportExcelControl** / **ExportLeadsButton** — batch Excel using `src/lib/lead-csv.ts` and `@e965/xlsx`.
- Updates per row typically `PATCH /api/leads/[id]`.

---

## Student detail page

File: `src/components/student/StudentDetailPage.tsx` (large client component).

- Loads lead + faculties; patches via `PATCH /api/leads/[id]`.
- **Stepper:** Steps 1–4 — Demo, Brochure, Fees, Schedule.
- **Aside:** Activity feed, workspace notes (debounced save), call history UI.
- **Demo:** Table of demo rows; schedule form; edit dialog; share invite dialog; **delete removed** — use status Completed/Cancelled instead.
- **Brochure:** Exam template card from `/api/exam-brochure-templates`; upload / generate notes; send buttons show **sent** state (checkmark + border).
- **Fees:** Base fee (auto from exam defaults when unset), scholarship, installments, currency; send buttons reflect **sent** state.
- **Schedule:** Table + calendar week view; classes persisted in `pipelineMeta.schedule`; send schedule buttons + timestamps.

Shared styles: `src/components/student/student-excel-ui.ts` (`SX`).

---

## Exam-based defaults

### Fees (`primaryExamForFee`)

- Helper: `src/lib/examFeeDefaults.ts` — picks exam in canonical order (NEET, JEE, CUET, SAT, Other, then any remaining).
- Defaults stored in **`exam_fee_structures`**; edited on **Fee Management** page.
- On fee step, if saved `baseTotal` is still `0`, client loads defaults and fills once (guarded by refs).

### Brochures

- Templates in **`exam_brochure_templates`**; edited on **Course Brochures** page.
- Student step 2 shows the template for the lead’s primary exam; optional “Insert summary into notes”.

---

## Utilities & shared modules

| Module | Role |
|--------|------|
| `src/lib/pipeline.ts` | `mergePipelineMeta`, `appendActivity`, `computePipelineStepsFromMeta`, step access helpers |
| `src/lib/serializers.ts` | Normalize Mongo documents to API/client types (`serializeLead`, `serializeFaculty`, …) |
| `src/lib/lead-display.ts` | `formatTargetExams`, etc. |
| `src/lib/mongodb.ts` | Single cached connection for serverless-friendly reuse |

---

## UI & styling

- **Dashboard layout:** `Sidebar` + `Header` + scrollable `main` (`src/app/(dashboard)/layout.tsx`).
- **CSS variables:** Sidebar width (`--sidebar-collapsed` / `--sidebar-expanded`) in globals.
- **Icons:** `src/components/icons/CrmIcons.tsx`.

---

## Seeding sample data

```bash
npm run seed
```

Requires `MONGODB_URI`. Seeds faculties, many sample leads, and fee records. See `scripts/seed.ts` for `FORCE_SEED` behavior and exact counts.

---

## Further reading (in-repo)

- `src/models/Lead.ts` — lead schema comments.
- `src/models/leadPipelineMetaSchema.ts` — nested pipeline fields.
- `src/lib/types.ts` — TypeScript types for API/client.
- API route files — request/response shapes and error handling.

---

*Generated for the **operation-automation** codebase. Update this file when you add routes, collections, or major features.*
