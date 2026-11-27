# EDOCASTI - Project State (Living Document)

> Read this first. Updated by scripts at every milestone. Do not hand-edit.

---

## 1. Where We Came From

EDOCASTI is a prototype school management portal (ND/HND) that started as a
JSON-file-backed app (`data/edocasti_db.json`) via `server/db.ts` -> `DatabaseEngine`.
It later added a Postgres mirror in `ecasti_application_state` (JSONB envelope),
activated by `EDOCASTI_USE_POSTGRES_STATE=true`.

Migration 006 defines the academic progression tables (ND_I -> ND_II -> EXTENSION_1..3
-> GRADUATED). These tables were installed in `ecasti_local` and seeded with 4
students. Before this session, the progression evaluator was only a
`LIVE_CATALOGUE_PREVIEW_ONLY` -- it never actually read from the Postgres snapshot.

---

## 2. Where We Are Now

### Environment
- Local PostgreSQL, port **5433**, database **`ecasti_local`**
- `server/neon.ts` -> `neonPool` (pg.Pool via DATABASE_URL)
- App entry: `tsx server.ts` (Vite middleware + Express API on same port)
- **API prefix is `/api/v1`** (server.ts line 86). Not `/api`.
- **Port 3000 = app.** Port 8080 = **Oracle `tnslsnr`** (do not touch).
- Postgres is authoritative: `EDOCASTI_USE_POSTGRES_STATE=true`

### Verified Working (this session)
- Migration 006 tables present (7 tables in `ecasti_local`)
- 4 students seeded in `student_academic_progression`
- 7 history events (4x INITIAL_RECORD + 3x SESSION_ROLLOVER)
- Baseline assertions: 6/6 PASS (`EDOCASTI_Progression_Baseline_Report.json`)
- Snapshot evaluator agreement: 4/4 PASS (`EDOCASTI_Postgres_Eligibility_Report.json`)
- `evaluateNdGraduationEligibilityFromPostgres` returns `SNAPSHOT_VERIFIED`
- HTTP login works: `POST /api/v1/auth/login` -> JWT
- HTTP eligibility works: `GET /api/v1/academic-progression/students/:id/eligibility`
- Results publishing hardened: recalc skips orphaned courses (audited); publish/score-entry return 409 on re-publish
- Seed CGPA corrected: std-1 3.75→4.5 / 22→6 credits, std-2 4.15→5.0 / 24→3 credits
- Course registration level gating verified 3/3: ND I cannot register ND II (and vice versa); server gates + client filter; 10 ND II courses added to seed
- Bulk-approve level gate verified 5/5: cross-level registrations skipped with skippedReasons; approved + skipped counts returned
- Document generation gates verified 7/7: unpaid fee obligations block transcript/certificate (409 + unpaidObligations[]); FINAL_CERTIFICATE requires GRADUATED stage (409 + currentStage)
- documentsApiRouter.ts extracted as formatted module (mount: 1 line; frontend: 5 methods -> /documents-v2/*); string-patch corruption permanently ended for document routes

### Current Students in Postgres
| Student | Stage | Status | Passed/Required |
|---|---|---|---|
| std-1 | EXTENSION_1 | EXTENSION | 2/4 |
| std-2 | ND_II | ACTIVE | 1/2 |
| std-1795622008157 | ND_II | ACTIVE | 0/4 |
| std-1795623290388 | GRADUATED | GRADUATED | 4/4 |

### Gotchas (Do Not Re-Discover)
1. Port 8080 = Oracle tnslsnr. App is 3000.
2. API prefix is `/api/v1`, not `/api`.
3. `evaluateNdGraduationEligibility(state, studentId)` needs BOTH args.
4. JSONB envelope (`ecasti_application_state`) holds users, results, invoices. Progression tables are additive.
5. `db.getState()` is a boot-time snapshot. External Postgres writes require server restart.
6. If login 401s: run `scripts/reset-admin-password.ts`, then restart server.

---

## 3. Where We Are Going

### Active Feature: Progression Advancement + Readiness UI

Goal: Registrar can view per-student readiness and trigger advancement from UI.

**`advanceStudentProgression` contract (verified from source):**
- Input: `{ studentId, academicSession, passedCourseIds, missingResultCourseIds, decidedBy }`
- Opens own transaction with advisory lock
- Returns `{ decision: { fromStage, toStage, fromStatus, toStatus, decisionType, outstandingCourseIds, historyId } }`

**Deliverables:**
- [x] `server/academicProgressionAdvanceService.ts` - wrapper deriving passed/missing from snapshot+results
- [x] `POST /api/v1/academic-progression/students/:id/advance` - HTTP route
- [x] `GET /api/v1/academic-progression/students` - roster endpoint
- [x] `src/views/ProgressionDashboard.tsx` (LIVE) - roster + Advance button
- [x] `scripts/test-advance-endpoint.ts` (PASSED) - smoke test advancing std-1795623290388

### Milestone Log (append-only)
<!-- MILESTONE_LOG_START -->
- **Initial README written** - captures state after Postgres eligibility verification.
- **[2026-11-27 11:09] Advance endpoint verified end-to-end on std-1795622008157 (ND_I -> ND_II with SESSION_ROLLOVER, outstanding recorded)**
  - Deliverable: server/academicProgressionAdvanceService.ts + POST /api/v1/academic-progression/students/:id/advance
  - Next unchecked: RegistrarProgressionDashboard.tsx + GET roster endpoint
- **[2026-11-27 11:21] Progression Dashboard live in AdminPortal - roster + advance UI functional end-to-end; 4 students rendering with correct stages/eligibility**
  - Deliverable: src/views/ProgressionDashboard.tsx + GET /academic-progression/students + AdminPortal sub-tab 'progression'
  - Next unchecked: None - feature complete
- **[2026-11-27 11:28] TEST APPLICANT (std-1795623290388) progressed ND_II -> GRADUATED in browser via AdminPortal. Full UI->HTTP->Engine->Postgres->History->Response loop verified live. Progression feature CLOSED.**
  - Deliverable: ProgressionDashboard.tsx session 2027/2028 + error hints; TEST APPLICANT now GRADUATED in DB
  - Next unchecked: None - progression feature fully closed
- **[2026-11-27 11:38] Results publishing hardened + seed CGPA corrected. std-1 3.75->4.5, std-2 4.15->5.0, credits corrected (22->6, 24->3). recalc now skips orphaned courses (audited); publish/score-entry reject overwriting published results.**
  - Deliverable: apiRouter.ts:3 patches + academicProgressionService.ts:evaluateCourseResults import + scripts/recalc-all-cgpa.ts
  - Next unchecked: Wire evaluateCourseResults into evaluator bodies; add publish->progression smoke test
- **[2026-11-27 12:10] Course registration level gating verified 3/3: ND I cannot register ND II (and vice versa). Server gates in /registrations/register and /registrations/:id/approve; client filter in StudentPortal; duplicate removed; seed enriched with 10 ND II courses. Full workflow step now production-safe.**
  - Deliverable: apiRouter.ts: 2 level gates; StudentPortal.tsx: level filter; scripts/verify-registration-gating.ts; scripts/add-nd2-courses.ts
  - Next unchecked: Bulk-approve route level gate; fee -> certificate gate (Gap 2); results visibility to students (Gap 3)
- **[2026-11-27 12:19] Bulk-approve level gate verified 5/5: /registrations/approve-bulk now skips cross-level registrations, returns skippedCount and skippedReasons. Fourth island landed.**
  - Deliverable: apiRouter.ts: bulk-approve loop level gate; scripts/verify-bulk-approve-gate.ts
  - Next unchecked: Fee -> certificate gate (Gap 2); results visibility to students (Gap 3); Dean/Bursar/HOD verification
- **[2026-11-27 12:55] Fee + graduation gate on POST /documents-v2/generate verified 7/7: blocks on unpaid StudentFeeObligation (balance > 0, 409 with unpaidObligations[]) AND requires current_stage === 'GRADUATED' for FINAL_CERTIFICATE (409 with currentStage). Extracted to documentsApiRouter.ts to end string-patch corruption. Fifth island closed.**
  - Deliverable: server/documentsApiRouter.ts (new gated module); apiRouter.ts: 1-line mount + 1-line import; src/services/api.ts: 5 methods -> /documents-v2/*; scripts/verify-document-gates.ts
  - Next unchecked: Results visibility to students (Gap 3); Dean/Bursar/HOD verification; inline /documents routes cleanup
- **[2026-11-27 13:19] Dual-ledger fee gate verified 5/5: POST /documents-v2/generate now blocks on BOTH studentFeeObligations (modern) AND state.invoices (legacy). Seed students with unpaid invoices (std-2, std-1795622008157, std-1795623290388) now blocked. inv-doc-* invoices excluded to prevent self-blocking. Fifth island operationally complete - gate reads real debts, not just fixtures.**
  - Deliverable: server/documentsApiRouter.ts: dual-ledger fee gate (unpaidObligations + unpaidInvoices + inv-doc- exclusion); scripts/verify-dual-ledger-gate.ts
  - Next unchecked: Results visibility to students (Gap 3); Dean/Bursar/HOD verification; inline /documents routes cleanup
- **[2026-11-27 13:20] Dual-ledger fee gate verified 5/5: POST /documents-v2/generate now blocks on BOTH studentFeeObligations (modern) AND state.invoices (legacy). Seed students with unpaid invoices now blocked. inv-doc-* invoices excluded to prevent self-blocking. Fifth island operationally complete - gate reads real debts, not just fixtures.**
  - Deliverable: server/documentsApiRouter.ts: dual-ledger fee gate; scripts/verify-dual-ledger-gate.ts
  - Next unchecked: Results visibility to students (Gap 3); Dean/Bursar/HOD verification; inline /documents routes cleanup
- **[2026-11-27 13:30] Gap 3 (results visibility) verified 5/5: /results/my-results returns published-only data with scores/grades; unpublished results return metadata only (caScore/examScore/grade/gradePoint withheld). Cross-student isolation confirmed. Frontend wired (StudentPortal.tsx:483-606). Gap 3 was already implemented - now verified.**
  - Deliverable: scripts/verify-results-visibility.ts; README lifecycle row 9
  - Next unchecked: Dean/Bursar/HOD verification; inline /documents routes cleanup
- **[2026-11-27 13:35] Bursar fee workflow verified 10/10: fee schedules -> invoices -> payments -> dual-ledger gate correctly distinguishes PAID (allow) from PARTIAL/UNPAID (block). Full loop was already implemented - now verified with smoke test.**
  - Deliverable: scripts/verify-bursar-workflow.ts; README lifecycle row 2
  - Next unchecked: HOD: lecturer allocation (Row 3); Dean: programme + courses (Row 1); inline /documents routes cleanup
- **[2026-11-27 13:38] HOD lecturer allocation verified 11/11: assign-lecturer route (HOD-only) + GET /academics/my-courses + score-entry gate correctly restricts score entry to assigned lecturer (Dr. Osaze allows, Engr. Joy 403). 8 of 18 courses assigned; 10 ND II courses pending assignment (workflow gap, not a bug).**
  - Deliverable: scripts/verify-lecturer-allocation.ts; README lifecycle row 3
  - Next unchecked: Dean: programme + courses (Row 1); Row 10 (status transitions, not built); inline /documents routes cleanup
- **[2026-11-27 13:42] Dean programme + courses workflow verified 12/12: full hierarchy (4 schools -> 10 depts -> 12 programmes -> 18 courses), zero orphaned courses, referential integrity intact, all CRUD routes + admin create handlers present. Row 1 was already fully implemented - now verified. All lifecycle workflows with implementations now verified.**
  - Deliverable: scripts/verify-dean-workflow.ts; README lifecycle row 1
  - Next unchecked: Row 10 (status transitions, not built); Row 7 (HOD score approval, partial); inline /documents routes cleanup
- **[2026-11-27 13:44] HOD score approval verified 14/14: single (PATCH /results/:id/hod-approve) + bulk (POST /results/hod-approve-bulk) routes correct. Department scoping enforced, status gating works (SUBMITTED only), no double-approval, no re-publish. Frontend handlers wired. Row 7 upgraded from PARTIAL to YES.**
  - Deliverable: scripts/verify-hod-approval.ts; README lifecycle row 7
  - Next unchecked: Row 10 (status transitions, not built); inline /documents routes cleanup
- **[2026-11-27 13:55] Student status transitions verified 11/11: GET /academic-progression/students/:id/history reads academic_progression_history (3 events for std-1: INITIAL, promotion, extension; 3 for graduated student) + student_academic_progression. Authorization: STUDENT sees own, staff sees any. Frontend getProgressionHistory added to api.ts. Row 10 built from scratch - first new feature of the session. Lifecycle table now 13/13 verified.**
  - Deliverable: server/academicProgressionApiRouter.ts: history endpoint; src/services/api.ts: getProgressionHistory; scripts/verify-status-transitions.ts
  - Next unchecked: StudentPortal journey panel (UX completion); inline /documents routes cleanup
<!-- MILESTONE_LOG_END -->

---

## 3.5 Academic Lifecycle Verification Status

| # | Step | Verified | Notes |
|---|---|---|---|
| 1 | Dean: programme + courses | YES | Full hierarchy verified 12/12: 4 schools -> 10 depts -> 12 programmes -> 18 courses, zero orphans, all CRUD routes + frontend wired |
| 2 | Bursar: fee assignment | YES | Full loop verified 10/10: fee-schedule -> invoice -> payment -> gate allows PAID, blocks PARTIAL/UNPAID |
| 3 | HOD: lecturer allocation | YES | Assign-lecturer route (HOD-only) + my-courses + score-entry gate verified 11/11 |
| 4 | Student: course registration | YES | Level gating verified 3/3 |
| 5 | HOD: registration approval (single + bulk) | YES | Both paths level-gated |
| 6 | Lecturer: score entry | YES | Publish/score guards |
| 7 | HOD: score approval | YES | Single + bulk verified 14/14: dept scoping, status gating (SUBMITTED only), no double-approval, no re-publish |
| 8 | Exam Officer: publish | YES | Re-publish 409 |
| 9 | Student: see results | YES | Published-only visibility verified 5/5; frontend wired (StudentPortal.tsx:483-606) |
| 10 | Student: see status transitions | YES | GET /academic-progression/students/:id/history verified 11/11: reads academic_progression_history + student_academic_progression; STUDENT sees own, staff sees any |
| 11 | Progression: graduate/extend | YES | Fully verified |
| 12 | Registrar: certificate | YES | Graduation + dual-ledger fee gates verified (7/7 + 5/5) |
| 13 | Registrar: certificate requires fees | YES | 409 + unpaidObligations[] + unpaidInvoices[] |

**Remaining gaps:** results visibility (Gap 3); Dean/Bursar/HOD verification; Bursar fee-assignment workflow verification

---
## 4. How To Start Working (Next AI / Developer)

1. Confirm env: `Get-Content .env | Select-String "EDOCASTI_USE_POSTGRES_STATE"`
2. Verify DB: `npx tsx .\scripts\inspect-db.ts && npx tsx .\scripts\verify-progression-baseline.ts`
3. Boot: `npm run dev` (expect "[EDOCASTI] loaded durable application state from PostgreSQL.")
4. Test login: `powershell -File .\scripts\test-login.ps1`
5. Pick up the first unchecked box in section 3.

---

## 5. Key Files

| File | Role |
|---|---|
| server/neon.ts | neonPool - all DB access |
| server/db.ts | DatabaseEngine, db.getState() |
| server/academicProgressionService.ts | Preview + Postgres evaluator |
| server/academicProgressionDecisionService.ts | advanceStudentProgression (writer) |
| database/migrations/006_academic_progression_foundation.sql | Schema (do not bypass) |
| data/edocasti_db.json | Local cache only - do not hand-edit |
| ecasti_application_state (table) | Authoritative JSONB envelope |

---

## 6. Scripts

| Script | Purpose |
|---|---|
| scripts/inspect-db.ts | List tables |
| scripts/verify-progression-baseline.ts | 6/6 baseline |
| scripts/verify-postgres-eligibility.ts | 4/4 snapshot agreement |
| scripts/reset-admin-password.ts | Reset superadmin password |
| scripts/test-login.ps1 | End-to-end login test |
| scripts/update-readme.ps1 | Append milestone |
