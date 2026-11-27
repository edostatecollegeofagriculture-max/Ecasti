/**
 * Fix mis-tagged courses in data/edocasti_db.json.
 *
 * Changes (per user confirmation):
 *   crs-com111  COM 111  → prog-nd-cs     / dept-cs
 *   crs-com112  COM 112  → prog-nd-cs     / dept-cs
 *   crs-slt111  SLT 111  → prog-nd-slt    / dept-slt
 *   crs-ahp111  AHP 111  → prog-nd-animal / dept-animal
 *
 * SAFETY:
 *   - Reads and validates the source file BEFORE writing.
 *   - Creates a timestamped backup next to the file.
 *   - Only modifies the four course records; preserves every other byte
 *     of the file structure (JSON.parse/stringify round-trip).
 *   - Prints a diff of before/after for each course.
 *   - Refuses if any course is already at its correct value (idempotent
 *     re-run is a no-op; if all four are correct, exits cleanly).
 *   - Default DRY-RUN; --apply required to write.
 */
const fs = require('fs');
const path = require('path');

const DB_FILE = path.resolve(process.cwd(), 'data', 'edocasti_db.json');

const FIXES = [
  { id: 'crs-com111', programmeId: 'prog-nd-cs',     departmentId: 'dept-cs' },
  { id: 'crs-com112', programmeId: 'prog-nd-cs',     departmentId: 'dept-cs' },
  { id: 'crs-slt111', programmeId: 'prog-nd-slt',    departmentId: 'dept-slt' },
  { id: 'crs-ahp111', programmeId: 'prog-nd-animal', departmentId: 'dept-animal' },
];

function main() {
  const apply = process.argv.includes('--apply');

  if (!fs.existsSync(DB_FILE)) {
    console.error('[FATAL] Source file not found:', DB_FILE);
    process.exit(1);
  }

  const raw = fs.readFileSync(DB_FILE, 'utf8');
  const state = JSON.parse(raw);

  if (!Array.isArray(state.courses)) {
    console.error('[FATAL] state.courses is not an array.');
    process.exit(1);
  }

  const byId = new Map(state.courses.map((c) => [c.id, c]));

  let changed = 0;
  let alreadyCorrect = 0;
  const changes = [];

  for (const fix of FIXES) {
    const course = byId.get(fix.id);
    if (!course) {
      console.error(`[FATAL] Course "${fix.id}" not found in state.courses.`);
      process.exit(1);
    }

    const before = {
      programmeId: course.programmeId,
      departmentId: course.departmentId,
    };
    const after = {
      programmeId: fix.programmeId,
      departmentId: fix.departmentId,
    };

    if (before.programmeId === after.programmeId &&
        before.departmentId === after.departmentId) {
      alreadyCorrect++;
      console.log(`[skip] ${fix.id} ${course.code}: already correct ` +
                  `(${after.programmeId} / ${after.departmentId})`);
      continue;
    }

    changes.push({ id: fix.id, code: course.code, before, after });
    course.programmeId = fix.programmeId;
    course.departmentId = fix.departmentId;
    changed++;
  }

  console.log('\n=== CHANGES ===');
  if (changes.length === 0) {
    console.log('(no changes needed)');
  } else {
    for (const c of changes) {
      console.log(`${c.id} ${c.code}`);
      console.log(`  programmeId : ${c.before.programmeId} -> ${c.after.programmeId}`);
      console.log(`  departmentId: ${c.before.departmentId} -> ${c.after.departmentId}`);
    }
  }
  console.log(`\n${changed} course(s) to update, ${alreadyCorrect} already correct, ${FIXES.length} total.`);

  if (changed === 0) {
    console.log('Nothing to do. Exiting.');
    return;
  }

  if (!apply) {
    console.log('\n=== DRY-RUN ===');
    console.log('No writes performed. Re-run with --apply to commit.');
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = `${DB_FILE}.bak-${stamp}`;
  fs.copyFileSync(DB_FILE, backup);
  console.log('\nBackup written:', backup);

  const out = JSON.stringify(state, null, 2);
  fs.writeFileSync(DB_FILE, out, 'utf8');
  console.log('Wrote', DB_FILE, '(' + out.length + ' bytes)');
  console.log('\nStatus: COURSE_PROGRAMMES_FIXED');
}
main();