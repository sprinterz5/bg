import type { FastifyError } from "fastify";
import fp from "fastify-plugin";
import { ZodError } from "zod";

export const errorsPlugin = fp(async (app) => {
  app.setErrorHandler((error: FastifyError | ZodError, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "validation_error",
        message: "Request validation failed",
        issues: error.issues
      });
    }

    if ("statusCode" in error && error.statusCode && error.statusCode < 500) {
      return reply.status(error.statusCode).send({
        error: error.name,
        message: error.message
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      error: "internal_server_error",
      message: "Unexpected server error"
    });
  });
});
