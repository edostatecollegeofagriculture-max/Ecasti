
$ErrorActionPreference = 'Stop'

$root = (Get-Location).Path
$studentPath = Join-Path $root 'src\views\StudentPortal.tsx'
$printPath = Join-Path $root 'src\components\PrintSlipModal.tsx'

if (!(Test-Path $studentPath)) {
    throw "StudentPortal.tsx not found. Run this script from EDOCASTI-LOCAL."
}
if (!(Test-Path $printPath)) {
    throw "PrintSlipModal.tsx not found. Run this script from EDOCASTI-LOCAL."
}

$student = [System.IO.File]::ReadAllText($studentPath)
$print = [System.IO.File]::ReadAllText($printPath)

# ------------------------------------------------------------
# 1. Add semester grouping and credit-weighted GPA calculation
# ------------------------------------------------------------

$invoiceMarker = 'const filteredInvoices = invoices.filter'

if (!$student.Contains($invoiceMarker)) {
    throw 'Could not find filteredInvoices insertion point. No files have been written.'
}

$semesterLogic = @'
const getSemesterResultKey = (r: any) =>
  `${r.session || 'Session not specified'}::${r.semester || 'Semester not specified'}`;

const semesterGroups = Array.from(
  new Set(filteredResults.map((r) => getSemesterResultKey(r)))
).map((key) => {
  const [session, semester] = key.split('::');

  const semesterPublishedResults = results.filter(
    (r) =>
      r.status === 'PUBLISHED' &&
      (r.session || 'Session not specified') === session &&
      (r.semester || 'Semester not specified') === semester
  );

  const weightedResults = semesterPublishedResults.map((r) => {
    const course = eligibleCourses.find((c) => c.id === r.courseId);
    const units = Number(course?.creditUnits);
    return {
      gradePoint: Number(r.gradePoint),
      units,
      valid: Number.isFinite(units) && units > 0 &&
        Number.isFinite(Number(r.gradePoint)),
    };
  });

  const hasCompleteCreditUnits =
    weightedResults.length > 0 &&
    weightedResults.every((item) => item.valid);

  const totalUnits = weightedResults.reduce(
    (sum, item) => sum + (item.valid ? item.units : 0),
    0
  );

  const totalWeightedPoints = weightedResults.reduce(
    (sum, item) =>
      sum + (item.valid ? item.gradePoint * item.units : 0),
    0
  );

  return {
    key,
    session,
    semester,
    gpa:
      hasCompleteCreditUnits && totalUnits > 0
        ? Number((totalWeightedPoints / totalUnits).toFixed(2))
        : null,
    creditsUsed: hasCompleteCreditUnits ? totalUnits : null,
    publishedCount: semesterPublishedResults.length,
    displayedResults: filteredResults.filter(
      (r) => getSemesterResultKey(r) === key
    ),
    publishedResults: semesterPublishedResults,
  };
});
 
'@

$student = $student.Replace(
    $invoiceMarker,
    $semesterLogic + $invoiceMarker
)

# ------------------------------------------------------------
# 2. Replace the combined results table with semester sections
# ------------------------------------------------------------

$resultsStartToken = '{filteredResults.length > 0 ? ('
$section3Token = '{/* Section 3: Payment-Gated Transcripts & Final Certificates */}'

$resultsStart = $student.IndexOf(
    $resultsStartToken,
    [StringComparison]::Ordinal
)

$section3Start = $student.IndexOf(
    $section3Token,
    [StringComparison]::Ordinal
)

if ($resultsStart -lt 0 -or $section3Start -lt 0 -or $section3Start -le $resultsStart) {
    throw 'Could not locate the results section boundaries. No files have been written.'
}

$resultsEnd = $student.LastIndexOf(
    '          )}',
    $section3Start,
    [StringComparison]::Ordinal
)

if ($resultsEnd -lt $resultsStart) {
    throw 'Could not locate the results conditional closing. No files have been written.'
}

$resultsEnd += '          )}'.Length

$semesterResultsJsx = @'
{semesterGroups.length > 0 ? (
            <div className="space-y-6">
              {semesterGroups.map((group) => (
                <section
                  key={group.key}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800 p-4">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                        {group.semester}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {group.session} Session
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="text-right">
                        <p className="text-[10px] uppercase text-slate-500 dark:text-slate-400">
                          Semester GPA
                        </p>
                        <p className="font-black text-lg text-emerald-800 dark:text-emerald-400">
                          {group.gpa !== null ? group.gpa.toFixed(2) : 'Unavailable'}
                          <span className="text-xs font-normal text-slate-500"> / 5.00</span>
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {group.creditsUsed !== null
                            ? `${group.creditsUsed} credit units`
                            : 'Credit units unavailable or results pending'}
                        </p>
                      </div>
                      {group.publishedCount > 0 && (
                        <button
                          onClick={() =>
                            onOpenPrintModal('RESULT_SLIP', {
                              student: { ...student, photoUrl: resolvedPhoto },
                              semesterGpa: group.gpa,
                              semester: group.semester,
                              session: group.session,
                              resultsList: group.publishedResults.map((r) => {
                                const crs = eligibleCourses.find((c) => c.id === r.courseId);
                                return {
                                  ...r,
                                  courseCode: crs?.code || r.courseId,
                                  courseTitle: crs?.title || 'Course',
                                };
                              }),
                            })
                          }
                          className="px-3 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                        >
                          <Printer className="w-4 h-4" />
                          Print Semester Slip
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-800 text-white uppercase text-[11px]">
                        <tr>
                          <th className="p-3">Course Code</th>
                          <th className="p-3">Course Title</th>
                          <th className="p-3">Result Progress</th>
                          <th className="p-3 text-center">CA ({settings?.caMaxMarks || 40})</th>
                          <th className="p-3 text-center">Exam ({settings?.examMaxMarks || 60})</th>
                          <th className="p-3 text-center">Total (100)</th>
                          <th className="p-3 text-center">Grade</th>
                          <th className="p-3 text-center">Grade Point</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                        {group.displayedResults.map((r) => {
                          const crs = eligibleCourses.find((c) => c.id === r.courseId);
                          return (
                            <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                              <td className="p-3 font-mono font-bold text-emerald-900 dark:text-emerald-400">
                                {crs?.code || r.courseId}
                              </td>
                              <td className="p-3 text-slate-800 dark:text-slate-100 font-medium">
                                {crs?.title || 'Academic Course'}
                              </td>
                              <td className="p-3">
                                <span className={`inline-flex px-2 py-1 rounded text-[11px] font-bold ${
                                  r.status === 'PUBLISHED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {r.status === 'PUBLISHED'
                                    ? 'Published'
                                    : r.status === 'HOD_APPROVED'
                                      ? 'Awaiting Exam Officer'
                                      : r.status === 'SUBMITTED'
                                        ? 'Awaiting HOD Approval'
                                        : 'Draft'}
                                </span>
                                {r.status !== 'PUBLISHED' && (
                                  <p className="mt-1 text-[10px] text-slate-500">
                                    Scores hidden until publication
                                  </p>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {r.status === 'PUBLISHED' ? r.caScore : '-'}
                              </td>
                              <td className="p-3 text-center">
                                {r.status === 'PUBLISHED' ? r.examScore : '-'}
                              </td>
                              <td className="p-3 text-center font-bold">
                                {r.status === 'PUBLISHED' ? r.totalScore : '-'}
                              </td>
                              <td className="p-3 text-center font-black text-emerald-800 dark:text-emerald-400 text-sm">
                                {r.status === 'PUBLISHED' ? r.grade : '-'}
                              </td>
                              <td className="p-3 text-center font-bold">
                                {r.status === 'PUBLISHED'
                                  ? Number(r.gradePoint).toFixed(2)
                                  : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-xs space-y-2">
              <p>No examination results matching your filter yet.</p>
              <p className="text-slate-400">
                Results appear once entered by your Lecturer and approved by the Examination Officer.
              </p>
            </div>
          )}
'@

$student = $student.Substring(0, $resultsStart) +
    $semesterResultsJsx +
    $student.Substring($resultsEnd)

# Remove the old combined print button, which is now replaced by
# one print button for each semester.
$oldPrintButton = @'
            {results.some((r) => r.status === 'PUBLISHED') && (
              <button
                onClick={() =>
                  onOpenPrintModal('RESULT_SLIP', {
                    student: { ...student, photoUrl: resolvedPhoto },
                    resultsList: results.filter((r) => r.status === 'PUBLISHED').map((r) => {
                      const crs = eligibleCourses.find((c) => c.id === r.courseId);
                      return { ...r, courseCode: crs?.code || r.courseId, courseTitle: crs?.title || 'Course' };
                    }),
                  })
                }
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-4 h-4" /> Print / Download Result Slip
              </button>
            )}
'@

if (!$student.Contains($oldPrintButton)) {
    throw 'Could not find the original combined print button. No files have been written.'
}

$student = $student.Replace($oldPrintButton, '')

# ------------------------------------------------------------
# 3. Add semester GPA to the printed result slip header
# ------------------------------------------------------------

$oldSlipHeader = '<p className="text-xs text-slate-600">{currentSession} Session | Approved by Examination Office &amp; Senate</p>'

$newSlipHeader = '<p className="text-xs text-slate-600">{data.session || currentSession} Session | {data.semester || ""}{data.semester ? " | " : ""}{data.semesterGpa !== undefined && data.semesterGpa !== null ? `Semester GPA: ${Number(data.semesterGpa).toFixed(2)} / 5.00 | ` : ""}Approved by Examination Office &amp; Senate</p>'

if (!$print.Contains($oldSlipHeader)) {
    throw 'Could not find the expected result-slip header. No files have been written.'
}

$print = $print.Replace($oldSlipHeader, $newSlipHeader)

# ------------------------------------------------------------
# 4. Validate all edits before writing either file
# ------------------------------------------------------------

if (!$student.Contains('const semesterGroups = Array.from')) {
    throw 'Semester grouping verification failed. No files have been written.'
}
if (!$student.Contains('Print Semester Slip')) {
    throw 'Semester print button verification failed. No files have been written.'
}
if (!$print.Contains('Semester GPA:')) {
    throw 'Print-slip GPA verification failed. No files have been written.'
}

# ------------------------------------------------------------
# 5. Back up both files, then write the updated versions
# ------------------------------------------------------------

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$studentBackup = "$studentPath.before-semester-results-$stamp.bak"
$printBackup = "$printPath.before-semester-results-$stamp.bak"

Copy-Item $studentPath $studentBackup
Copy-Item $printPath $printBackup

$encoding = [System.Text.UTF8Encoding]::new($false)

[System.IO.File]::WriteAllText($studentPath, $student, $encoding)
[System.IO.File]::WriteAllText($printPath, $print, $encoding)

Write-Host ''
Write-Host 'Semester results update applied.' -ForegroundColor Green
Write-Host "Student portal backup: $studentBackup"
Write-Host "Print slip backup:     $printBackup"
Write-Host ''
Write-Host 'Next: run npx tsc --noEmit to check TypeScript.' -ForegroundColor Cyan
