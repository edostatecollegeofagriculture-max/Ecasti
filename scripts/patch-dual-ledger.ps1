$path = '.\server\documentsApiRouter.ts'
$content = Get-Content $path -Raw

# Idempotency: if already patched, skip
if ($content.Contains('unpaidInvoices')) {
  Write-Host "SKIP: dual-ledger gate already present" -ForegroundColor Yellow
  exit 0
}

# Markers — avoid line-ending sensitivity, match substrings
$startMarker = "// 4. FEE GATE"
$endMarker = "// 5. Resolve fee"

$startIdx = $content.IndexOf($startMarker)
$endIdx = $content.IndexOf($endMarker)

if ($startIdx -lt 0 -or $endIdx -lt 0 -or $endIdx -le $startIdx) {
  Write-Host "MARKER NOT FOUND: startIdx=$startIdx endIdx=$endIdx" -ForegroundColor Red
  exit 1
}

# Back up to the beginning of the line containing the start marker
$lineStartIdx = $content.LastIndexOf("`n", $startIdx) + 1

$before = $content.Substring(0, $lineStartIdx)
$after = $content.Substring($endIdx)

# New gate block (no ${} template literals to avoid any interpolation risk)
$newGate = @"
    // 4. FEE GATE - dual ledger. Checks BOTH studentFeeObligations AND state.invoices.
    //    Either source of debt blocks document generation. inv-doc-* invoices are
    //    THIS document's own post-issuance fee and are excluded from the gate.
    const unpaidObligations = (state.studentFeeObligations || []).filter(
      (o) => o.studentId === studentId && o.balance > 0
    );
    const unpaidInvoices = (state.invoices || []).filter(
      (i) => i.studentId === studentId && i.status !== 'PAID' && i.id.indexOf('inv-doc-') !== 0
    );

    if (unpaidObligations.length > 0 || unpaidInvoices.length > 0) {
      db.logAudit({
        userId: req.user!.id,
        userEmail: req.user!.email,
        action: 'DOCUMENT_GENERATION_BLOCKED_UNPAID_FEES',
        resource: 'DOCUMENT',
        details: {
          studentId,
          type,
          unpaidObligationCount: unpaidObligations.length,
          unpaidInvoiceCount: unpaidInvoices.length,
          totalObligationBalance: unpaidObligations.reduce((sum, o) => sum + o.balance, 0),
          totalInvoiceBalance: unpaidInvoices.reduce((sum, i) => sum + (i.amount - i.amountPaid), 0),
        },
        ipAddress: req.ip,
      });
      return res.status(409).json({
        success: false,
        message: 'Cannot generate ' + (type === 'FINAL_CERTIFICATE' ? 'certificate' : 'transcript') + ': ' + (unpaidObligations.length + unpaidInvoices.length) + ' unpaid fee item(s).',
        unpaidObligations: unpaidObligations.map((o) => ({
          kind: 'OBLIGATION',
          id: o.id,
          feeName: o.feeNameSnapshot,
          session: o.session,
          level: o.level,
          amountDue: o.amountDue,
          amountPaid: o.amountPaid,
          balance: o.balance,
        })),
        unpaidInvoices: unpaidInvoices.map((i) => ({
          kind: 'INVOICE',
          id: i.id,
          feeName: i.title,
          session: i.session,
          amountDue: i.amount,
          amountPaid: i.amountPaid,
          balance: i.amount - i.amountPaid,
        })),
      });
    }

"@

$newContent = $before + $newGate + $after
Set-Content $path $newContent -Encoding UTF8 -NoNewline
Write-Host "PATCHED: dual-ledger fee gate" -ForegroundColor Green
Write-Host "File size before: $($content.Length)  after: $($newContent.Length)  (delta: $($newContent.Length - $content.Length))"
