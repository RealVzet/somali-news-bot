import { Telegraf } from "telegraf";
import { config } from "../config";
import { logger } from "../utils/logger";
import { escapeMarkdown, truncate } from "../utils/helpers";
import type { ProcessedArticle } from "../types";

let bot: Telegraf;

export function getBot(): Telegraf {
  if (!bot) bot = new Telegraf(config.telegram.botToken);
  return bot;
}

export async function publishArticle(article: ProcessedArticle): Promise<string> {
  const tg = getBot();
  const hashtags = article.hashtags.join(" ");

  const caption = [
    `🚀 *Wararka Teknolojiyada*`,
    ``,
    `📰 *Cinwaanka:*`,
    escapeMarkdown(truncate(article.somaliTitle, 180)),
    ``,
    `📝 *Koobaad:*`,
    escapeMarkdown(truncate(article.somaliSummary, 700)),
    ``,
    `🌐 *Isha:* ${escapeMarkdown(article.source)}`,
    `🔗 [Akhri Wax Dheeraad ah](${article.url})`,
    ``,
    escapeMarkdown(hashtags),
  ].join("\n");

  let messageId: number;

  if (article.imageUrl) {
    try {
      const msg = await tg.telegram.sendPhoto(config.telegram.channelId, article.imageUrl, {
        caption,
        parse_mode: "MarkdownV2",
      });
      messageId = msg.message_id;
    } catch {
      // Image failed — fall back to text-only
      logger.warn(`Image send failed for: ${article.url}, falling back to text`);
      const msg = await tg.telegram.sendMessage(config.telegram.channelId, caption, {
        parse_mode: "MarkdownV2",
        disable_web_page_preview: false,
      });
      messageId = msg.message_id;
    }
  } else {
    const msg = await tg.telegram.sendMessage(config.telegram.channelId, caption, {
      parse_mode: "MarkdownV2",
      disable_web_page_preview: false,
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
    intro,
    ``,
    ...articles.slice(0, 10).map((a, i) =>
      `${i + 1}. <a href="${a.url}">${a.somaliTitle}</a> <i>(${a.source})</i>`
    ),
    ``,
    `#WararkaMaanta #Teknolojiyada #AI`,
  ].join("\n");

  await tg.telegram.sendMessage(config.telegram.channelId, lines, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}
