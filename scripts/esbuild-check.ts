import { build } from 'esbuild';

build({
  entryPoints: ['./server/apiRouter.ts'],
  bundle: true,
  platform: 'node',
  write: false,
  logLevel: 'verbose',
}).then((result) => {
  console.log(`\n=== BUILD SUCCEEDED ===`);
  console.log(`Output size: ${result.outputFiles[0].text.length} bytes`);
}).catch((err) => {
  console.error(`\n=== BUILD FAILED ===`);
  console.error(err.errors || err.message);
});
