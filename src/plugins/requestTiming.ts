import fp from "fastify-plugin";

export const requestTimingPlugin = fp(async (app) => {
  app.addHook("onRequest", async (request) => {
    (request as any).startedAtNs = process.hrtime.bigint();
  });

  app.addHook("onResponse", async (request, reply) => {
    const startedAtNs = (request as any).startedAtNs as bigint | undefined;
    if (!startedAtNs) {
      return;
    }

    const durationMs = Number(process.hrtime.bigint() - startedAtNs) / 1_000_000;
    const logPayload = {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
      userId: request.user?.sub
    };

    if (durationMs >= 300) {
      app.log.warn(logPayload, "Slow request");
    } else {
      app.log.debug(logPayload, "Request completed");
    }
  });
});
