import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Read-only JSON migration preflight.
 *
 * This script deliberately does not import DatabaseEngine: its constructor
 * can seed or rewrite the JSON store. No Neon connection is opened and no
 * application records are printed.
 */

type JsonRecord = Record<string, unknown>;
type Finding = { severity: 'BLOCKED' | 'REVIEW'; collection: string; issue: string };

const DB_FILE = process.env.EDOCASTI_DATA_FILE
  ? path.resolve(process.env.EDOCASTI_DATA_FILE)
  : path.resolve(process.cwd(), 'data', 'edocasti_db.json');

const REQUIRED_ARRAYS = [
  'users', 'schools', 'departments', 'programmes', 'courses',
  'applications', 'students', 'registrations', 'results',
  'feeSchedules', 'invoices', 'payments', 'attendance',
  'supportTickets', 'auditLogs', 'newsArticles', 'sliderSlides',
  'issuedDocuments',
] as const;

const OPTIONAL_ARRAYS = [
  'feeCatalogItems', 'programFeeSchedules', 'programFeeScheduleItems',
  'studentFeeObligations', 'studentPayments', 'studentPaymentAllocations',
] as const;

const OBJECT_COLLECTIONS = ['settings', 'pageContent'] as const;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return '[' + value.map(canonical).join(',') + ']';
  }
  if (isRecord(value)) {
    const keys = Object.keys(value).sort();
    return '{' + keys.map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}

function checksum(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function stableId(value: unknown): string | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id.trim()) return null;
  return value.id;
}

function main(): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(DB_FILE, 'utf8'));
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown read/parse error';
    console.error(JSON.stringify({
      status: 'BLOCKED',
      message: 'Could not read and parse the configured JSON database.',
      reason,
    }, null, 2));
    process.exitCode = 2;
    return;
  }

  if (!isRecord(parsed)) {
    console.error(JSON.stringify({
      status: 'BLOCKED',
      message: 'The JSON database root must be an object.',
    }, null, 2));
    process.exitCode = 2;
    return;
  }

  const findings: Finding[] = [];
  const collections: Record<string, {
    records: number;
    missingIds: number;
    duplicateIds: number;
    sha256: string;
    optional?: boolean;
  }> = {};
  const arrays: Record<string, JsonRecord[]> = {};

  for (const name of REQUIRED_ARRAYS) {
    const value = parsed[name];
    if (!Array.isArray(value)) {
      findings.push({ severity: 'BLOCKED', collection: name, issue: 'Required collection is missing or is not an array.' });
      continue;
    }
    arrays[name] = value.filter(isRecord);
    const missingIds = value.filter((row) => stableId(row) === null).length;
    const ids = value.map(stableId).filter((id): id is string => id !== null);
    const duplicateIds = ids.length - new Set(ids).size;
    collections[name] = {
      records: value.length,
      missingIds,
      duplicateIds,
      sha256: checksum([...value].sort((a, b) => {
        const aId = stableId(a) ?? '';
        const bId = stableId(b) ?? '';
        return aId.localeCompare(bId);
      })),
    };
    if (missingIds) findings.push({ severity: 'BLOCKED', collection: name, issue: `${missingIds} row(s) have no non-empty string ID.` });
    if (duplicateIds) findings.push({ severity: 'BLOCKED', collection: name, issue: `${duplicateIds} duplicate ID occurrence(s) detected.` });
    if (arrays[name].length !== value.length) {
      findings.push({ severity: 'BLOCKED', collection: name, issue: 'One or more collection rows are not objects.' });
    }
  }

  for (const name of OPTIONAL_ARRAYS) {
    const value = parsed[name];
    if (value === undefined) {
      collections[name] = { records: 0, missingIds: 0, duplicateIds: 0, sha256: checksum([]), optional: true };
      findings.push({ severity: 'REVIEW', collection: name, issue: 'Optional collection is absent; treated as empty for this report.' });
      continue;
    }
    if (!Array.isArray(value)) {
      findings.push({ severity: 'BLOCKED', collection: name, issue: 'Optional collection exists but is not an array.' });
      continue;
    }
    arrays[name] = value.filter(isRecord);
    const missingIds = value.filter((row) => stableId(row) === null).length;
    const ids = value.map(stableId).filter((id): id is string => id !== null);
    const duplicateIds = ids.length - new Set(ids).size;
    collections[name] = {
      records: value.length,
      missingIds,
      duplicateIds,
      sha256: checksum([...value].sort((a, b) => (stableId(a) ?? '').localeCompare(stableId(b) ?? ''))),
      optional: true,
    };
    if (missingIds) findings.push({ severity: 'BLOCKED', collection: name, issue: `${missingIds} row(s) have no non-empty string ID.` });
    if (duplicateIds) findings.push({ severity: 'BLOCKED', collection: name, issue: `${duplicateIds} duplicate ID occurrence(s) detected.` });
    if (arrays[name].length !== value.length) findings.push({ severity: 'BLOCKED', collection: name, issue: 'One or more collection rows are not objects.' });
  }

  for (const name of OBJECT_COLLECTIONS) {
    const value = parsed[name];
    if (!isRecord(value)) {
      findings.push({ severity: 'BLOCKED', collection: name, issue: 'Required object collection is missing or is not an object.' });
      continue;
    }
    collections[name] = { records: 1, missingIds: 0, duplicateIds: 0, sha256: checksum(value) };
  }

  const idSets = new Map<string, Set<string>>();
  for (const [name, rows] of Object.entries(arrays)) {
    idSets.set(name, new Set(rows.map(stableId).filter((id): id is string => id !== null)));
  }

  const relations: Array<{ source: string; field: string; target: string; many?: boolean }> = [
    { source: 'departments', field: 'schoolId', target: 'schools' },
    { source: 'programmes', field: 'departmentId', target: 'departments' },
    { source: 'courses', field: 'departmentId', target: 'departments' },
    { source: 'courses', field: 'programmeId', target: 'programmes' },
    { source: 'courses', field: 'lecturerId', target: 'users' },
    { source: 'applications', field: 'userId', target: 'users' },
    { source: 'applications', field: 'programmeId', target: 'programmes' },
    { source: 'applications', field: 'reviewedBy', target: 'users' },
    { source: 'students', field: 'userId', target: 'users' },
    { source: 'students', field: 'programmeId', target: 'programmes' },
    { source: 'students', field: 'departmentId', target: 'departments' },
    { source: 'students', field: 'schoolId', target: 'schools' },
    { source: 'registrations', field: 'studentId', target: 'students' },
    { source: 'registrations', field: 'courseIds', target: 'courses', many: true },
    { source: 'registrations', field: 'approvedBy', target: 'users' },
    { source: 'results', field: 'studentId', target: 'students' },
    { source: 'results', field: 'courseId', target: 'courses' },
    { source: 'feeSchedules', field: 'programmeId', target: 'programmes' },
    { source: 'invoices', field: 'studentId', target: 'students' },
    { source: 'payments', field: 'studentId', target: 'students' },
    { source: 'payments', field: 'invoiceId', target: 'invoices' },
    { source: 'attendance', field: 'courseId', target: 'courses' },
    { source: 'attendance', field: 'lecturerId', target: 'users' },
    { source: 'supportTickets', field: 'userId', target: 'users' },
    { source: 'issuedDocuments', field: 'studentId', target: 'students' },
    { source: 'issuedDocuments', field: 'invoiceId', target: 'invoices' },
    { source: 'issuedDocuments', field: 'generatedBy', target: 'users' },
    { source: 'programFeeSchedules', field: 'programmeId', target: 'programmes' },
    { source: 'programFeeScheduleItems', field: 'scheduleId', target: 'programFeeSchedules' },
    { source: 'programFeeScheduleItems', field: 'feeCatalogItemId', target: 'feeCatalogItems' },
    { source: 'studentFeeObligations', field: 'studentId', target: 'students' },
    { source: 'studentFeeObligations', field: 'programmeId', target: 'programmes' },
    { source: 'studentFeeObligations', field: 'feeCatalogItemId', target: 'feeCatalogItems' },
    { source: 'studentPaymentAllocations', field: 'paymentId', target: 'studentPayments' },
    { source: 'studentPaymentAllocations', field: 'obligationId', target: 'studentFeeObligations' },
    { source: 'studentPaymentAllocations', field: 'feeCatalogItemId', target: 'feeCatalogItems' },
  ];

  const referenceDiagnostics: Array<{
    source: string;
    field: string;
    target: string;
    sourceRecords: number;
    targetRecords: number;
    targetCollectionEmpty: boolean;
    fieldTypes: { string: number; null: number; missing: number; other: number };
    emptyStrings: number;
    matchedReferences: number;
    unresolvedReferences: number;
  }> = [];

  for (const relation of relations) {
    const sourceRows = arrays[relation.source];
    if (!sourceRows) continue;

    const targetRows = arrays[relation.target] ?? [];
    const targetIds = idSets.get(relation.target) ?? new Set<string>();
    const fieldTypes = { string: 0, null: 0, missing: 0, other: 0 };
    let emptyStrings = 0;
    let matchedReferences = 0;
    let unresolvedReferences = 0;

    for (const row of sourceRows) {
      const raw = row[relation.field];

      if (raw === undefined) {
        fieldTypes.missing++;
        continue;
      }
      if (raw === null) {
        fieldTypes.null++;
        continue;
      }
      if (relation.many) {
        if (!Array.isArray(raw)) {
          fieldTypes.other++;
          unresolvedReferences++;
          continue;
        }
        for (const value of raw) {
          if (value === null || value === undefined || value === '') {
            if (value === '') emptyStrings++;
            continue;
          }
          if (typeof value !== 'string') {
            fieldTypes.other++;
            unresolvedReferences++;
          } else {
            fieldTypes.string++;
            if (targetIds.has(value)) matchedReferences++;
            else unresolvedReferences++;
          }
        }
        continue;
      }

      if (typeof raw !== 'string') {
        fieldTypes.other++;
        unresolvedReferences++;
      } else {
        fieldTypes.string++;
        if (!raw.trim()) {
          emptyStrings++;
        } else if (targetIds.has(raw)) {
          matchedReferences++;
        } else {
          unresolvedReferences++;
        }
      }
    }

    referenceDiagnostics.push({
      source: relation.source,
      field: relation.field,
      target: relation.target,
      sourceRecords: sourceRows.length,
      targetRecords: targetRows.length,
      targetCollectionEmpty: targetRows.length === 0,
      fieldTypes,
      emptyStrings,
      matchedReferences,
      unresolvedReferences,
    });

    if (unresolvedReferences) {
      findings.push({
        severity: 'BLOCKED',
        collection: relation.source,
        issue: `${unresolvedReferences} orphan/invalid reference(s) in ${relation.field} -> ${relation.target}. Confirm this mapping against the approved schema before import.`,
      });
    }
  }

  const blocked = findings.filter((item) => item.severity === 'BLOCKED').length;
  const review = findings.filter((item) => item.severity === 'REVIEW').length;
  const status = blocked ? 'BLOCKED' : review ? 'REVIEW' : 'PASS';

  console.log(JSON.stringify({
    status,
    sourceFile: path.basename(DB_FILE),
    mode: 'READ_ONLY_NO_NEON_CONNECTION',
    collections,
    referenceDiagnostics,
    findings,
    totals: {
      collectionsChecked: Object.keys(collections).length,
      recordsCounted: Object.values(collections).reduce((sum, item) => sum + item.records, 0),
      blockedFindings: blocked,
      reviewFindings: review,
    },
    note: 'Only aggregate metadata and SHA-256 checksums are emitted. No record values are printed. Checksums are local verification aids, not proof of target-schema compatibility.',
  }, null, 2));

  if (blocked) process.exitCode = 2;
}

main();
