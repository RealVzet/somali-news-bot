import { validateConfig } from "./config";
import { connectDb, disconnectDb } from "./database/prisma";
import { createBot, startBot } from "./bot";
import { startNewsMonitor } from "./jobs/news-monitor.job";
import { logger } from "./utils/logger";

async function main(): Promise<void> {
  logger.info("=== AI News Bot (Somali) starting... ===");

  // 1. Validate all required env vars
  validateConfig();

  // 2. Connect to database
  await connectDb();

  // 3. Create and start Telegram bot
  const bot = createBot();
  await startBot(bot);

  // 4. Start news monitor (runs immediately + on schedule)
  startNewsMonitor();

  logger.info("=== Bot is fully running ===");
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  logger.info("Shutting down...");
  await disconnectDb();
  process.exit(0);
}

process.on("SIGINT",  () => void shutdown());
process.on("SIGTERM", () => void shutdown());
process.on("uncaughtException",  err => { logger.error("Uncaught exception",  { err }); });
process.on("unhandledRejection", err => { logger.error("Unhandled rejection", { err }); });

void main().catch(err => {
  logger.error("Fatal startup error", { err });
  process.exit(1);
});
