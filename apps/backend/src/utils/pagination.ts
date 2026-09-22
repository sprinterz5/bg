import { z } from "zod";

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional()
});

export function getPagination(query: unknown) {
  return paginationSchema.parse(query);
}

export function takePlusOne(limit: number) {
  return limit + 1;
}

export function pageResult<T extends { id: string }>(items: T[], limit: number) {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  return {
    data,
    nextCursor: hasMore ? data.at(-1)?.id ?? null : null
  };
}
