import 'dotenv/config';

try {
  console.log("Loading documentsApiRouter...");
  const { documentsApiRouter } = await import("../server/documentsApiRouter");
  console.log(`Loaded: ${typeof documentsApiRouter}`);
  console.log(`Stack: ${(documentsApiRouter as any).stack?.length || 0} layers`);
} catch (err: any) {
  console.error(`FAILED: ${err.message}`);
  console.error(err.stack);
}
