$ErrorActionPreference = 'Stop'
$path = Join-Path (Get-Location) 'src\views\AdminPortal.tsx'
if (-not (Test-Path $path)) { throw 'Run this from the EDOCASTI-LOCAL project root.' }

$source = [System.IO.File]::ReadAllText($path)
$original = $source

# State for HOD bulk approval and Super Admin result clearing.
$stateMarker = "  const [publishingResults, setPublishingResults] = useState(false);"
$stateInsert = @'
  const [publishingResults, setPublishingResults] = useState(false);
  const [selectedHodResultIds, setSelectedHodResultIds] = useState<string[]>([]);
  const [approvingHodResults, setApprovingHodResults] = useState(false);
  const [clearResultsStudentId, setClearResultsStudentId] = useState('');
  const [confirmClearStudentResults, setConfirmClearStudentResults] = useState(false);
  const [clearingStudentResults, setClearingStudentResults] = useState(false);
'@
if (-not $source.Contains('const [selectedHodResultIds, setSelectedHodResultIds]')) {
    if (-not $source.Contains($stateMarker)) { throw 'Could not find results state insertion point.' }
    $source = $source.Replace($stateMarker, $stateInsert.TrimEnd())
}

# HOD bulk approval handler.
$hodHandlerMarker = @'
  const handleHodApproveResult = async (resultId: string) => {
    try {
      await api.approveResultByHod(resultId);
      notify('Result approved by HOD and forwarded to the Exam Officer for moderation.');
      await loadData();
    } catch (err: any) {
      notify(err.message || 'Failed to approve result', 'error');
    }
  };
'@
$hodHandlerInsert = $hodHandlerMarker + @'

  const handleBulkHodApproveResults = async () => {
    const eligibleIds = [...new Set(selectedHodResultIds)].filter((id) =>
      filteredExamResults.some((result) => result.id === id && result.status === 'SUBMITTED')
    );
    if (eligibleIds.length === 0 || approvingHodResults) return;

    setApprovingHodResults(true);
    try {
      const response = await api.approveResultsByHodBulk({ resultIds: eligibleIds });
      notify(
        `Approved ${response.approvedCount} result(s) for Exam Officer moderation. ${
          response.skippedCount ? `${response.skippedCount} skipped.` : ''
        }`
      );
      setSelectedHodResultIds([]);
      await loadData();
    } catch (err: any) {
      notify(err.message || 'Failed to bulk approve results', 'error');
    } finally {
      setApprovingHodResults(false);
    }
  };

  const handleClearStudentResults = async () => {
    if (!clearResultsStudentId || clearingStudentResults) return;
    setClearingStudentResults(true);
    try {
      const response = await api.clearStudentResults(clearResultsStudentId);
      notify(`${response.message} ${response.deletedCount} result record(s) cleared.`);
      setClearResultsStudentId('');
      setConfirmClearStudentResults(false);
      await loadData();
    } catch (err: any) {
      notify(err.message || 'Failed to clear student results', 'error');
    } finally {
      setClearingStudentResults(false);
    }
  };
'@
if (-not $source.Contains('const handleBulkHodApproveResults = async')) {
    if (-not $source.Contains($hodHandlerMarker)) { throw 'Could not find HOD approval handler insertion point.' }
    $source = $source.Replace($hodHandlerMarker, $hodHandlerInsert)
}
if (-not $source.Contains('const handleClearStudentResults = async')) {
    if (-not $source.Contains('const handleBulkHodApproveResults = async')) { throw 'HOD handler insertion failed.' }
    $source = $source.Replace("  const handleBulkPublishResults = async (resultIds: string[]) => {", "  const handleClearStudentResults = async () => {
    if (!clearResultsStudentId || clearingStudentResults) return;
    setClearingStudentResults(true);
    try {
      const response = await api.clearStudentResults(clearResultsStudentId);
      notify(`${response.message} ${response.deletedCount} result record(s) cleared.`);
      setClearResultsStudentId('');
      setConfirmClearStudentResults(false);
      await loadData();
    } catch (err: any) {
      notify(err.message || 'Failed to clear student results', 'error');
    } finally {
      setClearingStudentResults(false);
    }
  };

  const handleBulkPublishResults = async (resultIds: string[]) => {")
}

# Insert HOD summary and bulk controls immediately after the results filter.
$filterStart = $source.IndexOf('query={examResQuery}')
if ($filterStart -lt 0) { throw 'Could not locate the results filter.' }
$tableMarker = '                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">'
$tableAt = $source.IndexOf($tableMarker, $filterStart)
if ($tableAt -lt 0) { throw 'Could not locate the results table after its filter.' }

if (-not $source.Contains('Students with passing results')) {
$summaryUi = @'
                {user?.role === 'HOD' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <p className="text-xs font-semibold text-slate-500">Students with passing results (40+)</p>
                        <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
                          {new Set(filteredExamResults.filter((r) => Number(r.totalScore) >= 40).map((r) => r.studentId)).size}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <p className="text-xs font-semibold text-slate-500">Students with failing results (below 40)</p>
                        <p className="text-2xl font-black text-rose-700 dark:text-rose-400">
                          {new Set(filteredExamResults.filter((r) => Number(r.totalScore) < 40).map((r) => r.studentId)).size}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <p className="text-xs font-semibold text-slate-500">Awaiting HOD approval</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">
                          {filteredExamResults.filter((r) => r.status === 'SUBMITTED').length}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={
                            filteredExamResults.filter((r) => r.status === 'SUBMITTED').length > 0 &&
                            filteredExamResults.filter((r) => r.status === 'SUBMITTED').every((r) => selectedHodResultIds.includes(r.id))
                          }
                          onChange={(event) => {
                            const eligibleIds = filteredExamResults.filter((r) => r.status === 'SUBMITTED').map((r) => r.id);
                            setSelectedHodResultIds(event.target.checked ? eligibleIds : []);
                          }}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        Select all awaiting HOD approval
                      </label>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-600 dark:text-slate-300">
                          {selectedHodResultIds.filter((id) => filteredExamResults.some((r) => r.id === id && r.status === 'SUBMITTED')).length} selected
                        </span>
                        <button
                          type="button"
                          disabled={approvingHodResults || !selectedHodResultIds.some((id) => filteredExamResults.some((r) => r.id === id && r.status === 'SUBMITTED'))}
                          onClick={handleBulkHodApproveResults}
                          className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg"
                        >
                          {approvingHodResults ? 'Approving...' : 'Approve Selected for Exam Moderation'}
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Pass/fail figures count distinct students represented in the current filtered results. A student may appear in both groups when different course results have different outcomes.
                    </p>
                  </div>
                )}

'@
$source = $source.Insert($tableAt, $summaryUi)
}

# Add a selection checkbox column to the HOD results table only.
$courseHeader = '                        <th className="p-3">Course</th>'
if (-not $source.Contains('Select HOD results')) {
    $source = $source.Replace($courseHeader, @'
                        {user?.role === 'HOD' && <th className="p-3"><span className="sr-only">Select HOD results</span></th>}
                        <th className="p-3">Course</th>
'@.TrimEnd())
    $rowMarker = '                          <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">'
    $rowInsert = $rowMarker + @'
                            {user?.role === 'HOD' && (
                              <td className="p-3">
                                {r.status === 'SUBMITTED' ? (
                                  <input
                                    type="checkbox"
                                    aria-label={`Select result for ${r.matricNumber}`}
                                    checked={selectedHodResultIds.includes(r.id)}
                                    onChange={(event) => setSelectedHodResultIds((current) =>
                                      event.target.checked
                                        ? [...new Set([...current, r.id])]
                                        : current.filter((id) => id !== r.id)
                                    )}
                                    className="h-4 w-4 rounded border-slate-300"
                                  />
                                ) : null}
                              </td>
                            )}
'@
    if (-not $source.Contains($rowMarker)) { throw 'Could not locate result row for selection checkbox.' }
    $source = $source.Replace($rowMarker, $rowInsert)
}

# Super Admin-only clear-results panel, separate from deleting student accounts.
$superAdminMarker = '              {user?.role === ''SUPER_ADMIN'' && <SuperAdminDemoDataControls />}'
if (-not $source.Contains('Clear Results for One Student')) {
    if (-not $source.Contains($superAdminMarker)) { throw 'Could not locate Super Admin controls insertion point.' }
    $clearUi = @'
              {user?.role === 'SUPER_ADMIN' && (
                <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">Clear Results for One Student</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      Permanently removes that student's result records and resets cached CGPA and earned credits. The student account and course registrations are retained.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={clearResultsStudentId}
                      onChange={(event) => {
                        setClearResultsStudentId(event.target.value);
                        setConfirmClearStudentResults(false);
                      }}
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                    >
                      <option value="">Select a student by matric number</option>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.matricNumber} — {student.id}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!clearResultsStudentId || clearingStudentResults}
                      onClick={() => setConfirmClearStudentResults(true)}
                      className="px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white text-xs font-bold"
                    >
                      Clear Student Results
                    </button>
                  </div>
                  {confirmClearStudentResults && (
                    <div className="rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 p-3 space-y-2">
                      <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                        Confirm permanent deletion of all result records for {students.find((student) => student.id === clearResultsStudentId)?.matricNumber || 'the selected student'}? This cannot be undone from this screen.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={clearingStudentResults}
                          onClick={handleClearStudentResults}
                          className="px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white text-xs font-bold"
                        >
                          {clearingStudentResults ? 'Clearing...' : 'Yes, Clear All Results'}
                        </button>
                        <button
                          type="button"
                          disabled={clearingStudentResults}
                          onClick={() => setConfirmClearStudentResults(false)}
                          className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

'@
    $source = $source.Replace($superAdminMarker, $superAdminMarker + "`r`n`r`n" + $clearUi.TrimEnd())
}

if ($source -eq $original) {
    Write-Host 'No changes were needed; requested UI markers already exist.' -ForegroundColor Yellow
} else {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    Copy-Item $path "$path.before-hod-bulk-and-superadmin-clear-$stamp.bak"
    [System.IO.File]::WriteAllText($path, $source, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Updated AdminPortal.tsx. Backup: AdminPortal.tsx.before-hod-bulk-and-superadmin-clear-$stamp.bak" -ForegroundColor Green
}

# Verify all expected UI markers.
$verify = [System.IO.File]::ReadAllText($path)
$required = @(
  'selectedHodResultIds',
  'handleBulkHodApproveResults',
  'Students with passing results',
  'Students with failing results',
  'Clear Results for One Student',
  'handleClearStudentResults'
)
foreach ($marker in $required) {
    if (-not $verify.Contains($marker)) { throw "Verification failed: missing $marker" }
}
Write-Host 'Verified HOD summary, bulk approval selection, and Super Admin clear-results UI.' -ForegroundColor Green
Write-Host 'No deployment, commit, merge, or production action was performed.' -ForegroundColor Cyan
