import { Telegraf } from "telegraf";
import { config } from "../config";
import { logger } from "../utils/logger";
import { truncate } from "../utils/helpers";
import type { ProcessedArticle } from "../types";

let bot: Telegraf;

export function getBot(): Telegraf {
  if (!bot) bot = new Telegraf(config.telegram.botToken);
  return bot;
}

/**
 * Escape special HTML characters for Telegram HTML parse mode.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function publishArticle(article: ProcessedArticle): Promise<string> {
  const tg = getBot();
  const hashtags = article.hashtags.join(" ");

  // Source name is the clickable link — no raw URL shown in the post
  const sourceLink = `<a href="${article.url}">${escapeHtml(article.source)}</a>`;

  const caption = [
    `🚀 <b>Wararka Teknolojiyada</b>`,
    ``,
    `📰 <b>Cinwaanka:</b>`,
    escapeHtml(truncate(article.somaliTitle, 180)),
    ``,
    `📝 <b>Koobaad:</b>`,
    escapeHtml(truncate(article.somaliSummary, 700)),
    ``,
    `🌐 <b>Isha:</b> ${sourceLink}`,
    ``,
    escapeHtml(hashtags),
  ].join("\n");

  let messageId: number;

  if (article.imageUrl) {
    try {
      const msg = await tg.telegram.sendPhoto(config.telegram.channelId, article.imageUrl, {
        caption,
        parse_mode: "HTML",
      });
      messageId = msg.message_id;
    } catch {
      // Image failed — fall back to text-only
      logger.warn(`Image send failed for: ${article.url}, falling back to text`);
      const msg = await tg.telegram.sendMessage(config.telegram.channelId, caption, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
      messageId = msg.message_id;
    }
  } else {
    const msg = await tg.telegram.sendMessage(config.telegram.channelId, caption, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    messageId = msg.message_id;
  }

  logger.info(`Published to Telegram: ${article.originalTitle}`, { messageId });
  return String(messageId);
}

export async function sendAdminMessage(chatId: number | string, text: string): Promise<void> {
  const tg = getBot();
  await tg.telegram.sendMessage(chatId, text, { parse_mode: "HTML" });
}

export async function publishDailyDigest(intro: string, articles: Array<{ somaliTitle: string; url: string; source: string }>): Promise<void> {
  const tg = getBot();
  const lines = [
    `📅 <b>Wararka Maanta — Teknolojiyada</b>`,
    ``,
    escapeHtml(intro),
    ``,
    ...articles.slice(0, 10).map((a, i) =>
      `${i + 1}. <a href="${a.url}">${escapeHtml(a.somaliTitle)}</a> <i>(${escapeHtml(a.source)})</i>`
    ),
    ``,
    `#WararkaMaanta #Teknolojiyada #AI`,
  ].join("\n");

  await tg.telegram.sendMessage(config.telegram.channelId, lines, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}
