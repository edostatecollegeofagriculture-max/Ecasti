import ts from 'typescript';
import { readFileSync } from 'fs';
const src = readFileSync('./server/apiRouter.ts', 'utf8');
const result = ts.transpileModule(src, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, removeComments: false },
  reportDiagnostics: true,
});
const diags = result.diagnostics || [];
console.log(`Total diagnostics: ${diags.length}`);
for (const diag of diags) {
  const msg = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
  const pos = diag.file && diag.start !== undefined
    ? diag.file.getLineAndCharacterOfPosition(diag.start)
    : null;
  console.log(`\nTS${diag.code}: ${msg}`);
  if (pos) {
    console.log(`  Line ${pos.line + 1}, col ${pos.character + 1}, offset ${diag.start}`);
    console.log(`  Context: ${JSON.stringify(src.substring(Math.max(0, diag.start - 150), diag.start + 150))}`);
  }
}
