import { env } from "./config/env.js";
import { buildApp } from "./app.js";

const app = await buildApp();

try {
  await app.listen({ host: env.HOST, port: env.PORT });
  app.log.info(`Puzzle API listening on ${env.API_BASE_URL}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
