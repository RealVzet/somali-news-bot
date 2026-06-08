import { prisma } from "../database/prisma";
import { fetchRssFeed, scrapeArticleContent } from "../scrapers/rss.scraper";
import { translateAndSummarize } from "../ai/openai.service";
import { publishArticle } from "./telegram.service";
import { classifyArticle, NEWS_SOURCES } from "../scrapers/sources";
import { logger } from "../utils/logger";
import { sleep, normalizeUrl } from "../utils/helpers";
import { config } from "../config";
import type { RawArticle } from "../types";

export async function runNewsCheck(): Promise<void> {
  const state = await prisma.botState.findUnique({ where: { id: "singleton" } });
  if (state?.isPaused) {
    logger.info("Bot is paused — skipping news check");
    return;
  }

  logger.info("Starting news check cycle...");
  let newFound = 0;

  for (const source of NEWS_SOURCES) {
    const health = await prisma.sourceHealth.findUnique({ where: { sourceName: source.name } });
    if (health?.isDisabled) {
      logger.debug(`Skipping disabled source: ${source.name}`);
      continue;
    }

    try {
      const articles = await fetchRssFeed(source);
      const fresh = await filterNew(articles);

      if (fresh.length > 0) {
        logger.info(`${source.name}: ${fresh.length} new article(s) found`);
        newFound += fresh.length;
      }

      for (const article of fresh.slice(0, config.bot.maxArticlesPerRun)) {
        await queueArticle(article);
      }

      await prisma.sourceHealth.upsert({
        where: { sourceName: source.name },
        create: { sourceName: source.name, lastSuccess: new Date(), failureCount: 0 },
        update: { lastSuccess: new Date(), failureCount: 0, isDisabled: false },
      });
    } catch (err) {
      logger.error(`Failed to fetch source: ${source.name}`, { error: String(err) });
      await prisma.sourceHealth.upsert({
        where: { sourceName: source.name },
        create: { sourceName: source.name, lastFailure: new Date(), failureCount: 1 },
        update: { lastFailure: new Date(), failureCount: { increment: 1 } },
      });
      await maybeDisableSource(source.name);
    }

    await sleep(800);
  }

  logger.info(`News check done. New articles queued: ${newFound}`);
  await processQueue();
}

async function filterNew(articles: RawArticle[]): Promise<RawArticle[]> {
  const urls = articles.map(a => normalizeUrl(a.url));
  const existing = await prisma.article.findMany({
    where: { url: { in: urls } },
    select: { url: true },
  });
  const existingSet = new Set(existing.map(e => e.url));
  return articles.filter(a => !existingSet.has(normalizeUrl(a.url)));
}

async function queueArticle(article: RawArticle): Promise<void> {
  try {
    await prisma.article.create({
      data: {
        url: normalizeUrl(article.url),
        source: article.source,
        originalTitle: article.originalTitle,
        originalContent: article.originalContent,
        imageUrl: article.imageUrl,
        author: article.author,
        publishedAt: article.publishedAt,
        status: "PENDING",
      },
    });
  } catch {
    // Unique constraint = already exists, ignore
  }
}

export async function processQueue(): Promise<void> {
  const pending = await prisma.article.findMany({
    where: {
      status: "PENDING",
      retryCount: { lt: config.bot.maxRetryCount },
    },
    orderBy: { createdAt: "asc" },
    take: config.bot.maxArticlesPerRun,
  });

  for (const article of pending) {
    await processArticle(article.id);
    await sleep(3000); // Rate limiting between posts
  }
}

async function processArticle(id: string): Promise<void> {
  await prisma.article.update({ where: { id }, data: { status: "PROCESSING" } });

  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) return;

  try {
    // Get full content if RSS snippet is short
    let content = article.originalContent ?? "";
    let imageUrl = article.imageUrl ?? undefined;

    if (content.length < 300) {
      const scraped = await scrapeArticleContent(article.url);
      if (scraped.content.length > content.length) content = scraped.content;
      if (!imageUrl && scraped.imageUrl) imageUrl = scraped.imageUrl;
    }

    // Translate + summarize
    const { somaliTitle, somaliSummary } = await translateAndSummarize(
      article.originalTitle,
      content,
      article.source
    );

    // Classify
    const { category, hashtags } = classifyArticle(article.originalTitle, content);

    // Publish
    const telegramMessageId = await publishArticle({
      url: article.url,
      source: article.source,
      originalTitle: article.originalTitle,
      originalContent: content,
      imageUrl,
      author: article.author ?? undefined,
      publishedAt: article.publishedAt ?? undefined,
      somaliTitle,
      somaliSummary,
      category,
      hashtags,
    });

    await prisma.article.update({
      where: { id },
      data: {
        somaliTitle,
        somaliSummary,
        imageUrl,
        originalContent: content,
        category,
        hashtags,
        telegramMessageId,
        status: "PUBLISHED",
        processedAt: new Date(),
      },
    });

    logger.info(`Published: ${article.originalTitle}`);
  } catch (err) {
    logger.error(`Failed to process article ${id}`, { error: String(err) });
    const updated = await prisma.article.update({
      where: { id },
      data: {
        status: "FAILED",
        errorMessage: String(err),
        retryCount: { increment: 1 },
      },
    });
    // Re-queue if retries remain
    if (updated.retryCount < config.bot.maxRetryCount) {
      await prisma.article.update({ where: { id }, data: { status: "PENDING" } });
    }
  }
}

async function maybeDisableSource(sourceName: string): Promise<void> {
  const health = await prisma.sourceHealth.findUnique({ where: { sourceName } });
  if (health && health.failureCount >= 10) {
    await prisma.sourceHealth.update({
      where: { sourceName },
      data: { isDisabled: true },
    });
    logger.warn(`Source disabled after 10 failures: ${sourceName}`);
  }
}

export async function getStats() {
  const [total, published, failed, pending, today, sources, state] = await Promise.all([
    prisma.article.count(),
    prisma.article.count({ where: { status: "PUBLISHED" } }),
    prisma.article.count({ where: { status: "FAILED" } }),
    prisma.article.count({ where: { status: "PENDING" } }),
    prisma.article.count({
      where: {
        status: "PUBLISHED",
        processedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
    prisma.sourceHealth.findMany(),
    prisma.botState.findUnique({ where: { id: "singleton" } }),
  ]);

  return {
    totalPublished: published,
    totalFailed: failed,
    totalPending: pending,
    publishedToday: today,
    activeSources: sources.filter(s => !s.isDisabled).length,
    disabledSources: sources.filter(s => s.isDisabled).length,
    isPaused: state?.isPaused ?? false,
  };
}
