import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [
      { level: "error", emit: "event" },
      { level: "warn",  emit: "event" },
    ],
  });

prisma.$on("error" as never, (e: unknown) => logger.error("Prisma error", { e }));
prisma.$on("warn"  as never, (e: unknown) => logger.warn("Prisma warning", { e }));

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function connectDb(): Promise<void> {
  await prisma.$connect();
  await prisma.botState.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", isPaused: false },
    update: {},
  });
  logger.info("Database connected");
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
  logger.info("Database disconnected");
}
