import 'dotenv/config';
import { apiRouter } from "../server/apiRouter";
import { documentsApiRouter } from "../server/documentsApiRouter";

console.log(`Before mount: ${(apiRouter as any).stack.length} layers`);

try {
  console.log("Attempting to mount documentsApiRouter...");
  (apiRouter as any).use('/documents-v2', documentsApiRouter);
  console.log(`After mount: ${(apiRouter as any).stack.length} layers`);
} catch (err: any) {
  console.error(`MOUNT FAILED: ${err.message}`);
  console.error(err.stack);
}
