import type { FastifyReply, FastifyRequest } from "fastify";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowSeconds: number;
  by?: "ip" | "userOrIp";
  // When true, the endpoint is denied (503) if Redis is unavailable instead of
  // silently allowing all requests through. Use for brute-force-sensitive paths
  // (login, forgot-password, registration).
  failClosed?: boolean;
};

export function endpointRateLimit(options: RateLimitOptions) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const identity =
      options.by === "userOrIp" && request.user?.sub
        ? `user:${request.user.sub}`
        : `ip:${request.ip}`;
    const redisKey = `rate:${options.key}:${identity}`;

    let count: number;
    try {
      count = await request.server.redis.incr(redisKey);
      if (count === 1) {
        await request.server.redis.expire(redisKey, options.windowSeconds).catch(() => undefined);
      }
    } catch {
      if (options.failClosed) {
        throw reply.serviceUnavailable("Rate limiter unavailable; please retry shortly");
      }
      // Fail open for non-sensitive endpoints — don't block the request.
      return;
    }

    if (count > options.limit) {
      throw reply.tooManyRequests("Rate limit exceeded");
    }
  };
}
