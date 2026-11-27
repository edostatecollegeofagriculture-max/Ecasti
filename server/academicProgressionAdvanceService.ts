import { neonPool } from './neon';
import { db } from './db';
import { advanceStudentProgression } from './academicProgressionDecisionService';

const ND_PASS_MARK = 40;

export interface AdvanceResult {
  studentId: string;
  decision: {
    fromStage: string;
    toStage: string;
    fromStatus: string;
    toStatus: string;
    decisionType: string;
    outstandingCourseIds: string[];
    historyId: string;
  };
  classification: {
    passedCourseIds: string[];
    missingResultCourseIds: string[];
    failedCourseIds: string[];
  };
}

export async function advanceStudentById(input: {
  studentId: string;
  academicSession: string;
  decidedBy: string;
}): Promise<AdvanceResult> {
  const { studentId, academicSession, decidedBy } = input;

  const snapshots = await neonPool.query(
    `SELECT course_id FROM student_academic_required_courses
      WHERE student_id = $1 AND is_required = TRUE`,
    [studentId]
  );
  const requiredCourseIds: string[] = snapshots.rows.map((r: any) => r.course_id);
  if (requiredCourseIds.length === 0) {
    throw new Error(`No required-course snapshots for student ${studentId}.`);
  }

  const state = db.getState();
  const passed: string[] = [];
  const missing: string[] = [];
  const failed: string[] = [];

  for (const courseId of requiredCourseIds) {
    const results = state.results.filter(
      (r) => r.studentId === studentId && r.courseId === courseId
    );
    const published = results
      .filter((r) => r.status === 'PUBLISHED')
      .sort((a, b) => {
        const s = b.session.localeCompare(a.session);
        return s || b.semester.localeCompare(a.semester);
      });
    if (published.length === 0) {
      missing.push(courseId);
      continue;
    }
    const passing = published.find((r) => Number(r.totalScore) >= ND_PASS_MARK);
    if (passing) passed.push(courseId);
    else failed.push(courseId);
  }

  // advanceStudentProgression returns decision fields at the TOP LEVEL,
  // not nested under a 'decision' key.
  const raw = await advanceStudentProgression({
    studentId,
    academicSession,
    passedCourseIds: passed,
    missingResultCourseIds: missing,
    decidedBy,
  });

  const r: any = raw;
  return {
    studentId,
    decision: {
      fromStage: r.fromStage ?? r.from_stage,
      toStage: r.toStage ?? r.to_stage,
      fromStatus: r.fromStatus ?? r.from_status ?? r.progressionStatus,
      toStatus: r.toStatus ?? r.to_status ?? r.progressionStatus,
      decisionType: r.decisionType ?? r.decision_type ?? 'SESSION_ROLLOVER',
      outstandingCourseIds: r.outstandingCourseIds ?? r.outstanding_course_ids ?? [],
      historyId: r.historyId ?? r.history_id,
    },
    classification: {
      passedCourseIds: passed,
      missingResultCourseIds: missing,
      failedCourseIds: failed,
    },
  };
}
