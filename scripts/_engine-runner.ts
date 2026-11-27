/**
 * Thin TS runner for the progression engine.
 * Reads a JSON scenario from EDOCASTI_TEST_SCENARIO, invokes the engine,
 * prints the result between markers. Errors go to stderr with non-zero exit.
 */
import { advanceStudentProgression } from '../server/academicProgressionDecisionService';

type Scenario = {
  op: 'advance';
  studentId: string;
  academicSession: string;
  passedCourseIds: string[];
  missingResultCourseIds: string[];
  decidedBy: string;
};

async function main() {
  const raw = process.env.EDOCASTI_TEST_SCENARIO;
  if (!raw) {
    console.error('EDOCASTI_TEST_SCENARIO not set');
    process.exit(2);
  }
  let scenario: Scenario;
  try {
    scenario = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse scenario JSON:', (e as Error).message);
    process.exit(2);
  }

  if (scenario.op !== 'advance') {
    console.error('Unsupported op:', scenario.op);
    process.exit(2);
  }

  try {
    const result = await advanceStudentProgression({
      studentId: scenario.studentId,
      academicSession: scenario.academicSession,
      passedCourseIds: scenario.passedCourseIds,
      missingResultCourseIds: scenario.missingResultCourseIds,
      decidedBy: scenario.decidedBy,
    });
    console.log('<<<RESULT>>>');
    console.log(JSON.stringify(result, null, 2));
    console.log('<<<END>>>');
  } catch (e) {
    console.error('ENGINE_ERROR:', (e as Error).message);
    process.exit(1);
  }
}
main();