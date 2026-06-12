import type { PrismaClient } from "@prisma/client";

export async function runTrackedJob<T>(
  prisma: PrismaClient,
  input: {
    name: string;
    payload?: unknown;
    fn: () => Promise<T>;
  }
) {
  const startedAt = Date.now();
  const run = await prisma.jobRun.create({
    data: {
      name: input.name,
      payload: input.payload as any
    }
  });

  try {
    const result = await input.fn();
    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        result: result as any,
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt
      }
    });
    return result;
  } catch (error) {
    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message : String(error),
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt
      }
    });
    throw error;
  }
}
