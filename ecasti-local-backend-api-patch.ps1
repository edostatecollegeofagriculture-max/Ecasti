$ErrorActionPreference = 'Stop'

# Run this script from the EDOCASTI-LOCAL project root.
$backendPath = Join-Path (Get-Location) 'server\apiRouter.ts'
$apiPath = Join-Path (Get-Location) 'src\services\api.ts'

if (-not (Test-Path $backendPath)) { throw "Cannot find $backendPath. Open PowerShell in the EDOCASTI-LOCAL project root." }
if (-not (Test-Path $apiPath)) { throw "Cannot find $apiPath. Open PowerShell in the EDOCASTI-LOCAL project root." }

$backend = [System.IO.File]::ReadAllText($backendPath)
$api = [System.IO.File]::ReadAllText($apiPath)

$routeMarker = 'function computeHonoursClassification(cgpa: number): string {'
$routeAlreadyExists = $backend.Contains("'/results/student/:studentId'")
if ($routeAlreadyExists) {
    Write-Host 'Student-results clearing route already exists; backend file will not be changed.' -ForegroundColor Yellow
} elseif (-not $backend.Contains($routeMarker)) {
    throw 'Could not find the expected backend insertion point. No files were changed.'
}

$hodBulkMarker = '  approveResultByHod(id: string) {'
$hodBulkAlreadyExists = $api.Contains('approveResultsByHodBulk(')
$clearApiAlreadyExists = $api.Contains('clearStudentResults(')
if ((-not $hodBulkAlreadyExists -or -not $clearApiAlreadyExists) -and -not $api.Contains($hodBulkMarker)) {
    throw 'Could not find the expected API-client insertion point. No files were changed.'
}

$route = @'
apiRouter.delete(
  '/results/student/:studentId',
  authenticateToken,
  requireRoles('SUPER_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { studentId } = req.params;
    const state = db.getState();
    const student = state.students.find((item) => item.id === studentId);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const originalCount = state.results.length;
    state.results = state.results.filter((result) => result.studentId !== studentId);
    const deletedCount = originalCount - state.results.length;

    // Clearing a student's results must also clear cached academic totals.
    student.cgpa = 0;
    student.totalCreditsEarned = 0;

    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'STUDENT_RESULTS_CLEARED',
      resource: 'RESULT',
      details: {
        studentId: student.id,
        matricNumber: student.matricNumber,
        studentName: student.fullName || student.matricNumber,
        deletedCount,
      },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: deletedCount > 0 ? 'Student results cleared.' : 'No result records were found for this student.',
      deletedCount,
    });
  }
);

'@

$apiMethods = @'
  approveResultsByHodBulk(payload: { resultIds?: string[]; courseId?: string }) {
    return this.request<{ success: boolean; approvedCount: number; skippedCount: number }>(
      '/results/hod-approve-bulk',
      { method: 'POST', body: JSON.stringify(payload) }
    );
  }

  clearStudentResults(studentId: string) {
    return this.request<{ success: boolean; message: string; deletedCount: number }>(
      `/results/student/${encodeURIComponent(studentId)}`,
      { method: 'DELETE' }
    );
  }

'@

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$changed = @()

if (-not $routeAlreadyExists) {
    $backendBackup = "$backendPath.before-student-results-clear-$stamp.bak"
    Copy-Item $backendPath $backendBackup
    $backend = $backend.Replace($routeMarker, $route + $routeMarker)
    [System.IO.File]::WriteAllText($backendPath, $backend, [System.Text.UTF8Encoding]::new($false))
    $changed += "server\apiRouter.ts (backup: $(Split-Path $backendBackup -Leaf))"
}

if (-not $hodBulkAlreadyExists -or -not $clearApiAlreadyExists) {
    $apiBackup = "$apiPath.before-results-api-methods-$stamp.bak"
    Copy-Item $apiPath $apiBackup
    $methodsToInsert = ''
    if (-not $hodBulkAlreadyExists) {
        $methodsToInsert += @'
  approveResultsByHodBulk(payload: { resultIds?: string[]; courseId?: string }) {
    return this.request<{ success: boolean; approvedCount: number; skippedCount: number }>(
      '/results/hod-approve-bulk',
      { method: 'POST', body: JSON.stringify(payload) }
    );
  }

'@
    }
    if (-not $clearApiAlreadyExists) {
        $methodsToInsert += @'
  clearStudentResults(studentId: string) {
    return this.request<{ success: boolean; message: string; deletedCount: number }>(
      `/results/student/${encodeURIComponent(studentId)}`,
      { method: 'DELETE' }
    );
  }

'@
    }
    $api = $api.Replace($hodBulkMarker, $methodsToInsert + $hodBulkMarker)
    [System.IO.File]::WriteAllText($apiPath, $api, [System.Text.UTF8Encoding]::new($false))
    $changed += "src\services\api.ts (backup: $(Split-Path $apiBackup -Leaf))"
}

if ($changed.Count -eq 0) {
    Write-Host 'No changes needed: the route and API methods already exist.' -ForegroundColor Yellow
} else {
    Write-Host 'Updated:' -ForegroundColor Green
    $changed | ForEach-Object { Write-Host " - $_" }
}

# Verify the expected symbols after writing.
$backendCheck = [System.IO.File]::ReadAllText($backendPath)
$apiCheck = [System.IO.File]::ReadAllText($apiPath)
if (-not $backendCheck.Contains("'/results/student/:studentId'")) { throw 'Backend route verification failed.' }
if (-not $apiCheck.Contains('approveResultsByHodBulk(')) { throw 'HOD bulk API method verification failed.' }
if (-not $apiCheck.Contains('clearStudentResults(')) { throw 'Student clear API method verification failed.' }

Write-Host 'Verified: backend route and both API methods are present.' -ForegroundColor Green
Write-Host 'No deployment, commit, merge, or production action was performed.' -ForegroundColor Cyan
