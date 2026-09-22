import { PrismaClient } from "@prisma/client";
import fp from "fastify-plugin";

export const prismaPlugin = fp(async (app) => {
  const prisma = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error", "warn"]
  });

  app.decorate("prisma", prisma);

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
});
