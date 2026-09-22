import { Prisma } from "@prisma/client";
import type { FastifyReply, FastifyRequest } from "fastify";
import { sha256 } from "../utils/hash.js";

type IdempotentHandler<T> = () => Promise<{ statusCode?: number; body: T }>;

export async function withIdempotency<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  handler: IdempotentHandler<T>
) {
  const keyHeader = request.headers["idempotency-key"];
  const key = Array.isArray(keyHeader) ? keyHeader[0] : keyHeader;
  if (!key) {
    return handler();
  }

  if (!request.user?.sub) {
    throw reply.unauthorized("Authentication required for idempotent writes");
  }

  if (key.length < 8 || key.length > 200) {
    throw reply.badRequest("Invalid Idempotency-Key");
  }

  const requestPath = request.routeOptions.url ?? request.url.split("?")[0] ?? request.url;
  const requestHash = sha256(JSON.stringify({
    method: request.method,
    path: requestPath,
    body: request.body ?? null
  }));

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const existing = await request.server.prisma.idempotencyKey.findUnique({
    where: {
      userId_key: {
        userId: request.user.sub,
        key
      }
    }
  });

  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw reply.conflict("Idempotency-Key was reused with a different request");
    }
    if (existing.status === "COMPLETED" && existing.responseCode && existing.responseBody !== null) {
      return {
        statusCode: existing.responseCode,
        body: existing.responseBody as T
      };
    }
    throw reply.conflict("Request with this Idempotency-Key is still in progress");
  }

  try {
    await request.server.prisma.idempotencyKey.create({
      data: {
        userId: request.user.sub,
        key,
        method: request.method,
        path: requestPath,
        requestHash,
        expiresAt
      }
    });
  } catch (error: any) {
    // A concurrent request with the same key created the row first.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw reply.conflict("Request with this Idempotency-Key is still in progress");
    }
    throw error;
  }

  let result: { statusCode?: number; body: T };
  try {
    result = await handler();
  } catch (error) {
    // Delete the IN_PROGRESS key so the client can retry after a handler
    // failure; leaving it would block all future retries for 24 hours.
    await request.server.prisma.idempotencyKey.delete({
      where: { userId_key: { userId: request.user.sub, key } }
    }).catch(() => undefined);
    throw error;
  }

  await request.server.prisma.idempotencyKey.update({
    where: {
      userId_key: {
        userId: request.user.sub,
        key
      }
    },
    data: {
      status: "COMPLETED",
      responseCode: result.statusCode ?? 200,
      responseBody: result.body as any
    }
  });

  return result;
}
