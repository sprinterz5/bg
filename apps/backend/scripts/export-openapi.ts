import { writeFile } from "node:fs/promises";
import path from "node:path";
import { buildApp } from "../src/app.js";

const app = await buildApp();

try {
  await app.ready();
  const document = (app as any).swagger();
  const outputPath = path.resolve("docs", "openapi.json");
  await writeFile(outputPath, JSON.stringify(document, null, 2));
  console.log(`OpenAPI written to ${outputPath}`);
} finally {
  await app.close();
}
