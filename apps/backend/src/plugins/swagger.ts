import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fp from "fastify-plugin";
import { env } from "../config/env.js";

export const swaggerPlugin = fp(async (app) => {
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Bookgram API",
        description: "Backend API for the Bookgram social reading network.",
        version: "0.1.0"
      },
      servers: [{ url: "http://localhost:4000" }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT"
          }
        }
      }
    }
  });

  // Swagger UI exposes the full API surface; keep it off in production.
  if (env.NODE_ENV !== "production") {
    await app.register(swaggerUi, {
      routePrefix: "/docs"
    });
  }
});
