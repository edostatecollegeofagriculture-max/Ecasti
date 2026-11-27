param(
  [Parameter(Mandatory = $true)][string]$Milestone,
  [string]$Deliverable = "",
  [string]$Unchecked = ""
)
$path = Join-Path (Get-Location) "README.md"
if (-not (Test-Path $path)) { Write-Error "README.md not found."; exit 1 }
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$content = Get-Content $path -Raw
$logEntry = "- **[$timestamp] $Milestone**"
if ($Deliverable) { $logEntry += "`n  - Deliverable: $Deliverable" }
if ($Unchecked)   { $logEntry += "`n  - Next unchecked: $Unchecked" }
$content = $content -replace "(?s)(<!-- MILESTONE_LOG_END -->)", "$logEntry`n`$1"
Set-Content -Path $path -Value $content -Encoding UTF8 -NoNewline
Write-Host "Milestone logged: $Milestone" -ForegroundColor Green
