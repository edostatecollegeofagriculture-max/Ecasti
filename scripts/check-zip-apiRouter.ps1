$cleanRouter = "C:\Users\EDSG-JOOPSA\Documents\EDOCASTI-RESTORE\EDOCASTI-LOCAL\server\apiRouter.ts"

Write-Host "Clean file: $cleanRouter" -ForegroundColor Green
Write-Host "Size: $((Get-Item $cleanRouter).Length) bytes"
Write-Host "Lines: $((Get-Content $cleanRouter).Count)"
Write-Host ""

$content = Get-Content $cleanRouter -Raw

Write-Host "=== SANITY MARKERS IN ZIP VERSION ===" -ForegroundColor Cyan
Write-Host ("req.user.txt (corruption): {0}  [must be 0]" -f ([regex]::Matches($content, 'req\.user\.txt')).Count)
Write-Host ("NEWS_ARTICLE_UPDATED:      {0}  [must be 1]" -f ([regex]::Matches($content, 'NEWS_ARTICLE_UPDATED')).Count)
Write-Host ("PAGE_CONTENT_UPDATED:      {0}  [must be 1]" -f ([regex]::Matches($content, 'PAGE_CONTENT_UPDATED')).Count)
Write-Host ("documents/generate route:  {0}  [must be 1]" -f ([regex]::Matches($content, "documents/generate")).Count)
Write-Host ("GRADUATION GATE:           {0}  [expect 0]" -f ([regex]::Matches($content, 'GRADUATION GATE')).Count)
Write-Host ("FEE GATE:                  {0}  [expect 0]" -f ([regex]::Matches($content, 'FEE GATE')).Count)
Write-Host ("unpaidObligations:         {0}  [expect 0]" -f ([regex]::Matches($content, 'const unpaidObligations')).Count)
Write-Host ("skippedReasons:            {0}  [expect >=1]" -f ([regex]::Matches($content, 'skippedReasons')).Count)
Write-Host ("Level gate message:        {0}  [expect 1]" -f ([regex]::Matches($content, 'You cannot register courses outside your current level')).Count)
Write-Host ""

Write-Host "=== ROUTE COUNT ===" -ForegroundColor Cyan
$routes = [regex]::Matches($content, "apiRouter\.(get|post|put|patch|delete)\s*\(\s*'([^']+)'")
Write-Host ("Total routes: {0}" -f $routes.Count)
