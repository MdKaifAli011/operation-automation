# AGENTS.md — AI coding agents (Cursor / automation)

This document tells **coding agents** how to work in **operation-automation** safely and consistently. For full architecture and API detail, read **`PROJECT.md`** first.

---

## Project in one paragraph

Internal **CRM** for education ops: **MongoDB** + **Mongoose**, **Next.js 16** App Router, **React 19**, **Tailwind 4**. Main surfaces: lead sheet (`/`), student workspace (`/students/[id]`) with **pipeline** (demo → brochure → fees → schedule), faculties, fees, exam defaults, **Course Brochures** templates. Lead workspace JSON lives on **`Lead.pipelineMeta`**; merge updates with **`mergePipelineMeta`** in `src/lib/pipeline.ts`.

---

## Environment

| Variable        | Required | Purpose                          |
|-----------------|----------|----------------------------------|
| `MONGODB_URI`   | Yes      | MongoDB connection string        |

Use `.env.local` (preferred) or `.env` at the repo root.

---

## Commands

| Command           | Use case                          |
|-------------------|-----------------------------------|
| `npm run dev`     | Local development                 |
| `npm run build`   | Verify production compile         |
| `npm run lint`    | ESLint                            |
| `npm run seed`    | Optional sample data (`scripts/seed.ts`) |

Run **`npm run build`** after non-trivial changes before considering work done.

---

## Golden rules

1. **Scope** — Change only what the task needs. No drive-by refactors, no unrelated files, no extra docs unless requested.
2. **Truth** — **`PROJECT.md`** is the canonical map of routes, collections, and `pipelineMeta`. If behavior is unclear, read it or the cited `src/` files.
3. **Data shape** — Schema + TS types for workspace data: `src/models/leadPipelineMetaSchema.ts`, `src/lib/leadPipelineMetaTypes.ts`. Keep them aligned when adding fields.
4. **Patches** — Client and API should merge nested `pipelineMeta` with **`mergePipelineMeta`**, not replace the whole object blindly.
5. **Style** — Match existing patterns: `cn()` + `SX` from `student-excel-ui`, imports, and naming in the touched area.
6. **API routes** — Live under `src/app/api/**`; use **`export const runtime = "nodejs"`** when using Mongoose or filesystem (e.g. brochure uploads).
7. **Uploads** — Brochure files go under `public/uploads/brochures/{leadId}/`; URLs like `/uploads/...` are rewritten to **`/api/uploads/[...path]`** (see `next.config.ts`). Do not commit binaries; `.gitignore` excludes `public/uploads/`.

---

## High-signal file map

| Area              | Location |
|-------------------|----------|
| Lead CRUD + PATCH | `src/app/api/leads/[id]/route.ts` |
| Brochure upload   | `src/app/api/leads/[id]/brochure-upload/route.ts` |
| Static uploads    | `src/app/api/uploads/[...path]/route.ts` |
| Pipeline merge    | `src/lib/pipeline.ts` |
| Lead model        | `src/models/Lead.ts` |
| Student UI        | `src/components/student/StudentDetailPage.tsx` (large) |
| Lead grid         | `src/components/leads/LeadManagementPage.tsx` |
| Exam brochure admin | `src/app/(dashboard)/course-brochure/page.tsx` |
| Nav               | `src/components/layout/Sidebar.tsx` |

---

## Brochure behavior (student step)

- **Course Brochures** (`/course-brochure`, collection `exam_brochure_templates`) provides the **default** PDF/link per exam.
- On the student **Brochure** step, that default previews inline when the lead has **no** `pipelineMeta.brochure.storedFileUrl`.
- A **per-lead upload** replaces the preview; **Remove** restores the course default. Optional **document URL** on the lead overrides the default for preview when no upload is set.

---

## What to avoid

- Adding new environment variables or dependencies without a clear need and user alignment.
- Storing large binaries in MongoDB — files belong on disk under `public/uploads/…` with paths stored on the lead.
- Breaking the lead PATCH contract: always merge `pipelineMeta` safely for partial updates.

---

## Cursor-specific

- Prefer **`.cursor/rules/`** for narrow, file-scoped rules (see Cursor docs). This **`AGENTS.md`** is project-wide guidance at the repository root.
- If the task is only “how does X work?”, read **`PROJECT.md`** and the linked source before editing.

---

*Last aligned with the repo layout described in `PROJECT.md`. Update both when architecture or conventions change materially.*
