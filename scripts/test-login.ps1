$ErrorActionPreference = "Stop"
try {
  $login = Invoke-RestMethod `
    -Uri "http://localhost:3000/api/v1/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body (@{ email = "superadmin@edocasti.edu.ng"; password = "Password123!" } | ConvertTo-Json)
  Write-Host "SUCCESS" -ForegroundColor Green
  $login | ConvertTo-Json -Depth 3
  Write-Host "`nToken (first 30): $($login.token.Substring(0,30))..."
} catch {
  Write-Host "FAILED" -ForegroundColor Red
  Write-Host "Status: $($_.Exception.Response.StatusCode.value__)"
  Write-Host "Body:   $($_.ErrorDetails.Message)"
}
