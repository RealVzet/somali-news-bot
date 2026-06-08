import cron from "node-cron";
import { runNewsCheck } from "../services/news.service";
import { generateDailyDigest } from "../ai/openai.service";
import { publishDailyDigest } from "../services/telegram.service";
import { prisma } from "../database/prisma";
import { config } from "../config";
import { logger } from "../utils/logger";

let isRunning = false;

export function startNewsMonitor(): void {
  // Main news check — runs every N seconds via cron (minimum 1 minute for cron)
  // For sub-minute intervals we use setInterval instead.
  const intervalMs = config.bot.checkIntervalSeconds * 1000;

  const runSafe = async () => {
    if (isRunning) {
      logger.debug("News check already running, skipping");
      return;
    }
    isRunning = true;
    try {
      await runNewsCheck();
    } catch (err) {
      logger.error("News monitor error", { error: String(err) });
    } finally {
      isRunning = false;
    }
  };

  // Run immediately on startup, then on interval
  void runSafe();
  setInterval(() => void runSafe(), intervalMs);
  logger.info(`News monitor started — checking every ${config.bot.checkIntervalSeconds}s`);

  // Daily digest at 08:00 Africa/Nairobi
  cron.schedule("0 8 * * *", async () => {
    logger.info("Running daily digest...");
    try {
      const articles = await prisma.article.findMany({
        where: {
          status: "PUBLISHED",
          processedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        orderBy: { processedAt: "desc" },
        take: 10,
        select: { somaliTitle: true, source: true, url: true },
      });

      if (articles.length === 0) return;

      const validArticles = articles.filter(a => a.somaliTitle) as Array<{
        somaliTitle: string;
        source: string;
        url: string;
      }>;

      const intro = await generateDailyDigest(validArticles);
      await publishDailyDigest(intro, validArticles);
      logger.info(`Daily digest published with ${validArticles.length} articles`);
    } catch (err) {
      logger.error("Daily digest failed", { error: String(err) });
    }
  }, { timezone: "Africa/Nairobi" });

  // Retry failed articles every 2 hours
  cron.schedule("0 */2 * * *", async () => {
    logger.info("Retrying failed articles...");
    try {
      await prisma.article.updateMany({
        where: {
          status: "FAILED",
          retryCount: { lt: config.bot.maxRetryCount },
          updatedAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
        },
        data: { status: "PENDING" },
      });
    } catch (err) {
      logger.error("Retry job failed", { error: String(err) });
    }
  });

  logger.info("All cron jobs scheduled");
}
