$path = '.\src\services\api.ts'
$content = Get-Content $path -Raw

Write-Host "Before:" -ForegroundColor Cyan
Write-Host ("  /documents/my-documents: {0}" -f ([regex]::Matches($content, '/documents/my-documents')).Count)
Write-Host ("  /documents/generate:     {0}" -f ([regex]::Matches($content, '/documents/generate')).Count)
Write-Host ("  '/documents' (list):     {0}" -f ([regex]::Matches($content, "'/documents'")).Count)
Write-Host ("  /documents/${id}:        {0}" -f ([regex]::Matches($content, '/documents/\$\{id\}')).Count)

$content = $content.Replace('/documents/my-documents', '/documents-v2/my-documents')
$content = $content.Replace('/documents/generate', '/documents-v2/generate')
$content = $content.Replace('/documents/${id}', '/documents-v2/${id}')
$content = $content.Replace("'/documents'", "'/documents-v2'")

Set-Content $path $content -Encoding UTF8 -NoNewline
Write-Host "`nFRONTEND UPDATED" -ForegroundColor Green

$verify = Get-Content $path -Raw
Write-Host "`nAfter:" -ForegroundColor Cyan
Write-Host ("  /documents-v2/my-documents: {0} [expect 1]" -f ([regex]::Matches($verify, '/documents-v2/my-documents')).Count)
Write-Host ("  /documents-v2/generate:     {0} [expect 1]" -f ([regex]::Matches($verify, '/documents-v2/generate')).Count)
Write-Host ("  '/documents-v2' (list):     {0} [expect 1]" -f ([regex]::Matches($verify, "'/documents-v2'")).Count)
Write-Host ("  /documents-v2/`${id}:        {0} [expect 1]" -f ([regex]::Matches($verify, '/documents-v2/\$\{id\}')).Count)
Write-Host ("  Remaining /documents/ (no v2): {0} [expect 0]" -f ([regex]::Matches($verify, '/documents/(?!v2)')).Count)
