# EDOCASTI Phase 2 — apply generalized curriculum mapping TypeScript changes
# LOCAL ONLY. This script does not run SQL, connect to Neon/Render, deploy, or commit.
# It validates every expected source block before writing any project file.

$ErrorActionPreference = "Stop"
$Project = "C:\Users\EDSG-JOOPSA\Documents\EDOCASTI-LOCAL"

function Replace-ExactOnce {
    param(
        [string]$Content,
        [string]$Old,
        [string]$New,
        [string]$Label
    )
    $count = ([regex]::Matches($Content, [regex]::Escape($Old))).Count
    if ($count -ne 1) {
        throw "Safety stop: expected exactly one match for '$Label'; found $count. No project files have been written."
    }
    return $Content.Replace($Old, $New)
}

if (-not (Test-Path $Project)) { throw "Project folder not found: $Project" }
Set-Location $Project

$servicePath = Join-Path $Project "server\academicCurriculumMappingService.ts"
$apiPath = Join-Path $Project "server\academicCurriculumMappingApiRouter.ts"

foreach ($path in @($servicePath, $apiPath)) {
    if (-not (Test-Path $path)) { throw "Required source file missing: $path" }
}

$service = [IO.File]::ReadAllText($servicePath) -replace "`r`n", "`n"
$api = [IO.File]::ReadAllText($apiPath) -replace "`r`n", "`n"

# Service: classification domain type.
$old = "export type MappingReviewDecision = 'APPROVE' | 'REJECT';"
$new = @'
export type MappingReviewDecision = 'APPROVE' | 'REJECT';
export type CurriculumCourseClassification = 'COMPULSORY' | 'ELECTIVE' | 'OPTIONAL';
'@.Trim()
$service = Replace-ExactOnce $service $old $new "service classification type"

# Service: generic mapping-course read model.
$old = @'
    `SELECT id, course_id AS "courseId",
            course_code_snapshot AS "courseCode",
            course_title_snapshot AS "courseTitle",
            course_level_snapshot AS level,
            semester_snapshot AS semester,
            credit_units_snapshot AS "creditUnits",
            is_compulsory_snapshot AS compulsory
       FROM academic_curriculum_mapping_courses
      WHERE mapping_id = $1
      ORDER BY course_level_snapshot, semester_snapshot, course_code_snapshot`,
'@
$new = @'
    `SELECT id, course_id AS "courseId",
            course_code_snapshot AS "courseCode",
            course_title_snapshot AS "courseTitle",
            stage_code_snapshot AS "stageCode",
            stage_label_snapshot AS "stageLabel",
            period_code_snapshot AS "periodCode",
            period_label_snapshot AS "periodLabel",
            classification_snapshot AS classification,
            course_level_snapshot AS level,
            semester_snapshot AS semester,
            credit_units_snapshot AS "creditUnits",
            is_compulsory_snapshot AS compulsory
       FROM academic_curriculum_mapping_courses
      WHERE mapping_id = $1
      ORDER BY stage_code_snapshot, period_code_snapshot, course_code_snapshot`,
'@
$service = Replace-ExactOnce $service $old $new "mapping course read query"

# Service: replace addCurriculumCourse with the generalized snapshot writer.
$old = @'
export async function addCurriculumCourse(
  mappingIdInput: string,
  course: {
    courseId: string;
    courseCode: string;
    courseTitle: string;
    level: string;
    semester: string;
    creditUnits: number;
    compulsory: boolean;
  }
) {
  const mappingId = required(mappingIdInput, 'Mapping ID');
  const courseId = required(course.courseId, 'Course ID');
  return transaction(async (client) => {
    const mapping = await client.query(
      'SELECT status FROM academic_curriculum_mappings WHERE id = $1 FOR UPDATE',
      [mappingId]
    );
    if (!mapping.rows[0]) throw new Error('Curriculum mapping not found.');
    if (mapping.rows[0].status !== 'DRAFT') throw new Error('Courses can only be changed while a mapping is in DRAFT status.');
    const id = newId('mapping-course');
    await client.query(
      `INSERT INTO academic_curriculum_mapping_courses
         (id, mapping_id, course_id, course_code_snapshot,
          course_title_snapshot, course_level_snapshot,
          semester_snapshot, credit_units_snapshot, is_compulsory_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, mappingId, courseId, course.courseCode, course.courseTitle,
       course.level, course.semester, course.creditUnits, course.compulsory]
    );
    return { id, mappingId, courseId };
  });
}
'@
$new = @'
export async function addCurriculumCourse(
  mappingIdInput: string,
  course: {
    courseId: string;
    courseCode: string;
    courseTitle: string;
    stageCode: string;
    stageLabel: string;
    periodCode: string;
    periodLabel: string;
    classification: CurriculumCourseClassification;
    legacyLevel: string | null;
    legacySemester: string | null;
    creditUnits: number;
  }
) {
  const mappingId = required(mappingIdInput, 'Mapping ID');
  const courseId = required(course.courseId, 'Course ID');
  const stageCode = required(course.stageCode, 'Stage code');
  const stageLabel = required(course.stageLabel, 'Stage label');
  const periodCode = required(course.periodCode, 'Period code');
  const periodLabel = required(course.periodLabel, 'Period label');
  if (!['COMPULSORY', 'ELECTIVE', 'OPTIONAL'].includes(course.classification)) {
    throw new Error('Course classification is invalid.');
  }
  if (!Number.isFinite(course.creditUnits) || course.creditUnits < 0) {
    throw new Error('Course credit units are invalid.');
  }
  return transaction(async (client) => {
    const mapping = await client.query(
      'SELECT status FROM academic_curriculum_mappings WHERE id = $1 FOR UPDATE',
      [mappingId]
    );
    if (!mapping.rows[0]) throw new Error('Curriculum mapping not found.');
    if (mapping.rows[0].status !== 'DRAFT') throw new Error('Courses can only be changed while a mapping is in DRAFT status.');
    const id = newId('mapping-course');
    await client.query(
      `INSERT INTO academic_curriculum_mapping_courses
         (id, mapping_id, course_id, course_code_snapshot,
          course_title_snapshot, course_level_snapshot, semester_snapshot,
          credit_units_snapshot, is_compulsory_snapshot,
          stage_code_snapshot, stage_label_snapshot,
          period_code_snapshot, period_label_snapshot, classification_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        id, mappingId, courseId, course.courseCode, course.courseTitle,
        course.legacyLevel, course.legacySemester, course.creditUnits,
        course.classification === 'COMPULSORY',
        stageCode, stageLabel, periodCode, periodLabel, course.classification,
      ]
    );
    return { id, mappingId, courseId, stageCode, periodCode, classification: course.classification };
  });
}
'@
$service = Replace-ExactOnce $service $old $new "addCurriculumCourse implementation"

# Service: assignment copies generic snapshots and only compulsory classifications.
$old = @'
    const mappingCourses = await client.query(
      `SELECT id, course_id, course_code_snapshot, course_title_snapshot,
              course_level_snapshot, semester_snapshot, credit_units_snapshot
         FROM academic_curriculum_mapping_courses
        WHERE mapping_id = $1
          AND is_compulsory_snapshot = TRUE
        ORDER BY course_level_snapshot, semester_snapshot, course_code_snapshot`,
      [mappingId]
    );
'@
$new = @'
    const mappingCourses = await client.query(
      `SELECT id, course_id, course_code_snapshot, course_title_snapshot,
              course_level_snapshot, semester_snapshot, credit_units_snapshot,
              stage_code_snapshot, stage_label_snapshot,
              period_code_snapshot, period_label_snapshot, classification_snapshot
         FROM academic_curriculum_mapping_courses
        WHERE mapping_id = $1
          AND classification_snapshot = 'COMPULSORY'
        ORDER BY stage_code_snapshot, period_code_snapshot, course_code_snapshot`,
      [mappingId]
    );
'@
$service = Replace-ExactOnce $service $old $new "assignment compulsory-course query"

$old = @'
        `INSERT INTO student_academic_required_courses
           (id, student_id, programme_id, cohort_session, course_id,
            course_code_snapshot, course_title_snapshot, course_level_snapshot,
            semester_snapshot, credit_units_snapshot, is_required, mapping_course_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, $11)`,
        [
          newId('student-required-course'),
          studentId,
          programmeId,
          cohortSession,
          course.course_id,
          course.course_code_snapshot,
          course.course_title_snapshot,
          course.course_level_snapshot,
          course.semester_snapshot,
          course.credit_units_snapshot,
          course.id,
        ]
'@
$new = @'
        `INSERT INTO student_academic_required_courses
           (id, student_id, programme_id, cohort_session, course_id,
            course_code_snapshot, course_title_snapshot, course_level_snapshot,
            semester_snapshot, credit_units_snapshot, is_required, mapping_course_id,
            stage_code_snapshot, stage_label_snapshot,
            period_code_snapshot, period_label_snapshot, classification_snapshot)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, $11, $12, $13, $14, $15, $16)`,
        [
          newId('student-required-course'),
          studentId,
          programmeId,
          cohortSession,
          course.course_id,
          course.course_code_snapshot,
          course.course_title_snapshot,
          course.course_level_snapshot,
          course.semester_snapshot,
          course.credit_units_snapshot,
          course.id,
          course.stage_code_snapshot,
          course.stage_label_snapshot,
          course.period_code_snapshot,
          course.period_label_snapshot,
          course.classification_snapshot,
        ]
'@
$service = Replace-ExactOnce $service $old $new "student required-course insert"

# Service: expose generic snapshots to assignment readers.
$old = @'
    `SELECT id, course_id AS "courseId",
            course_code_snapshot AS "courseCode",
            course_title_snapshot AS "courseTitle",
            course_level_snapshot AS level,
            semester_snapshot AS semester,
            credit_units_snapshot AS "creditUnits",
            is_required AS "isRequired"
       FROM student_academic_required_courses
      WHERE student_id = $1
      ORDER BY course_level_snapshot, semester_snapshot, course_code_snapshot`,
'@
$new = @'
    `SELECT id, course_id AS "courseId",
            course_code_snapshot AS "courseCode",
            course_title_snapshot AS "courseTitle",
            stage_code_snapshot AS "stageCode",
            stage_label_snapshot AS "stageLabel",
            period_code_snapshot AS "periodCode",
            period_label_snapshot AS "periodLabel",
            classification_snapshot AS classification,
            course_level_snapshot AS level,
            semester_snapshot AS semester,
            credit_units_snapshot AS "creditUnits",
            is_required AS "isRequired"
       FROM student_academic_required_courses
      WHERE student_id = $1
      ORDER BY stage_code_snapshot NULLS LAST, period_code_snapshot NULLS LAST, course_code_snapshot`,
'@
$service = Replace-ExactOnce $service $old $new "student assignment read query"

# API: remove qualification-specific ND-only creation gate.
$old = @'
    if (programme.qualification !== 'ND') {
      return res.status(422).json({ success: false, message: 'This curriculum mapping workflow currently supports ND programmes only.' });
    }

'@
$api = Replace-ExactOnce $api $old "" "ND-only programme gate"

# API: replace the add-course handler body from catalogue validation through service call.
$old = @'
      if (!['ND I', 'ND II'].includes(course.level)) {
        return res.status(422).json({ success: false, message: 'Only ND I and ND II courses can be added to this mapping.' });
      }
      if (course.programmeId && course.programmeId !== programme.id) {
        return res.status(422).json({ success: false, message: 'The selected course belongs to a different programme.' });
      }
      if (!course.programmeId && course.departmentId !== programme.departmentId) {
        return res.status(422).json({ success: false, message: 'The selected course is not assigned to this programme or its department.' });
      }

      const result = await addCurriculumCourse(req.params.mappingId, {
        courseId: course.id,
        courseCode: course.code,
        courseTitle: course.title,
        level: course.level,
        semester: course.semester,
        creditUnits: course.creditUnits,
        compulsory: course.isCompulsory,
      });
'@
$new = @'
      const structure = programme.academicStructure;
      if (!structure || !Array.isArray(structure.stages) || structure.stages.length === 0) {
        return res.status(422).json({ success: false, message: 'Configure the programme academic stages and periods before creating curriculum mappings.' });
      }

      const stageCode = typeof req.body?.stageCode === 'string' ? req.body.stageCode.trim() : '';
      const periodCode = typeof req.body?.periodCode === 'string' ? req.body.periodCode.trim() : '';
      const classification = typeof req.body?.classification === 'string' ? req.body.classification.trim().toUpperCase() : '';
      if (!stageCode || !periodCode) {
        return res.status(400).json({ success: false, message: 'Stage code and period code are required.' });
      }
      if (!['COMPULSORY', 'ELECTIVE', 'OPTIONAL'].includes(classification)) {
        return res.status(400).json({ success: false, message: 'Classification must be COMPULSORY, ELECTIVE or OPTIONAL.' });
      }

      const stage = structure.stages.find((item) => item.code === stageCode);
      if (!stage) return res.status(422).json({ success: false, message: 'The selected stage is not configured for this programme.' });
      const period = stage.periods.find((item) => item.code === periodCode);
      if (!period) return res.status(422).json({ success: false, message: 'The selected period is not configured within the selected stage.' });

      if (course.programmeId && course.programmeId !== programme.id) {
        return res.status(422).json({ success: false, message: 'The selected course belongs to a different programme.' });
      }
      if (!course.programmeId && course.departmentId !== programme.departmentId) {
        return res.status(422).json({ success: false, message: 'The selected course is not assigned to this programme or its department.' });
      }

      // Preserve legacy ND columns only when configured labels exactly match
      // the catalogue's legacy values; never infer ND from arbitrary stage codes.
      const legacyLevel = ['ND I', 'ND II'].includes(stage.label) && course.level === stage.label
        ? course.level
        : null;
      const legacySemester = ['First Semester', 'Second Semester'].includes(period.label) && course.semester === period.label
        ? course.semester
        : null;

      const result = await addCurriculumCourse(req.params.mappingId, {
        courseId: course.id,
        courseCode: course.code,
        courseTitle: course.title,
        stageCode: stage.code,
        stageLabel: stage.label,
        periodCode: period.code,
        periodLabel: period.label,
        classification: classification as 'COMPULSORY' | 'ELECTIVE' | 'OPTIONAL',
        legacyLevel,
        legacySemester,
        creditUnits: course.creditUnits,
      });
'@
$api = Replace-ExactOnce $api $old $new "generalized add-course API validation"

# Verify no old ND-only add-course guard remains in the changed API.
if ($api.Contains("Only ND I and ND II courses can be added") -or
    $api.Contains("workflow currently supports ND programmes only")) {
    throw "Safety stop: an ND-only curriculum mapping restriction remains."
}

# All transformations have been validated in memory. Back up before writing.
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$serviceBackup = "$servicePath.before-generalized-curriculum-$stamp.bak"
$apiBackup = "$apiPath.before-generalized-curriculum-$stamp.bak"
Copy-Item $servicePath $serviceBackup
Copy-Item $apiPath $apiBackup

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($servicePath, ($service -replace "`n", "`r`n"), $utf8NoBom)
[IO.File]::WriteAllText($apiPath, ($api -replace "`n", "`r`n"), $utf8NoBom)

Write-Host ""
Write-Host "Generalized curriculum TypeScript patch applied locally."
Write-Host "Backups:"
Write-Host "  $serviceBackup"
Write-Host "  $apiBackup"
Write-Host ""
Write-Host "Next check (read-only): npx tsc --noEmit"
Write-Host "IMPORTANT: Do not run migration 012 until its SQL has been reviewed against the actual schema."
