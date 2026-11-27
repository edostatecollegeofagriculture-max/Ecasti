$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path

$files = @(
  'src\views\StudentPortal.tsx',
  'src\services\api.ts',
  'server\apiRouter.ts',
  'src\types.ts',
  'src\types\index.ts'
)

foreach ($relative in $files) {
  $path = Join-Path $root $relative
  if (Test-Path $path) {
    Write-Output "`n========== $relative : matching lines =========="
    Select-String -Path $path -Pattern 'my-results|getMyResults|My Results|my results|PUBLISHED|HOD_APPROVED|SUBMITTED|results' -Context 3,5 |
      Select-Object -First 45 |
      ForEach-Object { $_.ToString() }
  }
}

Write-Output "`n========== Student portal file candidates =========="
Get-ChildItem '.\src' -Recurse -File -Include '*Student*Portal*.tsx','*Portal*.tsx' |
  Select-Object -ExpandProperty FullName
