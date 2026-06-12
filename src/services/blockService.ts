import type { FastifyInstance } from "fastify";

export async function getBlockedIds(app: FastifyInstance, userId: string) {
  const blocks = await app.prisma.userBlock.findMany({
    where: {
      OR: [{ blockerId: userId }, { blockedId: userId }]
    },
    select: {
      blockerId: true,
      blockedId: true
    }
  });

  return new Set(
    blocks.map((block) => (block.blockerId === userId ? block.blockedId : block.blockerId))
  );
}

export async function invalidateUserFeedCache(app: FastifyInstance, userId: string) {
  // Use SCAN instead of KEYS to avoid blocking Redis on large keyspaces.
  const pattern = `feed:${userId}:*`;
  let cursor = "0";
  do {
    const result = await app.redis.scan(cursor, "MATCH", pattern, "COUNT", 100).catch((): [string, string[]] => ["0", []]);
    cursor = result[0];
    const keys = result[1];
    if (keys.length > 0) {
      await app.redis.del(...keys).catch(() => undefined);
    }
  } while (cursor !== "0");
}
