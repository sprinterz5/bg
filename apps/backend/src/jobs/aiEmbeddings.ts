import { buildApp } from "../app.js";
import { runAiEmbeddingBackfill } from "../services/aiEmbeddingService.js";

const limitArg = Number(process.argv[2]);
const limit = Number.isFinite(limitArg) && limitArg > 0 ? limitArg : undefined;

const app = await buildApp();
await app.ready();

try {
  const result = await runAiEmbeddingBackfill(app, { limit });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await app.close();
}
