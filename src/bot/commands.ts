import type { Telegraf, Context } from "telegraf";
import { config } from "../config";
import { logger } from "../utils/logger";
import { getStats, runNewsCheck } from "../services/news.service";
import { sendAdminMessage } from "../services/telegram.service";
import { prisma } from "../database/prisma";
import { NEWS_SOURCES } from "../scrapers/sources";

function isAdmin(ctx: Context): boolean {
  const userId = ctx.from?.id;
  if (!userId) return false;
  return config.telegram.adminIds.includes(userId);
}

function adminOnly(handler: (ctx: Context) => Promise<void>) {
  return async (ctx: Context) => {
    if (!isAdmin(ctx)) {
      await ctx.reply("⛔ Admin access required.");
      return;
    }
    await handler(ctx);
  };
}

export function registerCommands(bot: Telegraf): void {

  // /start
  bot.start(async ctx => {
    if (!isAdmin(ctx)) return;
    await ctx.reply(
      `👋 <b>AI News Bot (Somali)</b>\n\nBot waa shaqeynayaa! Isticmaal amarrada hoose:\n\n` +
      `/stats — Tirakoobka bot\n` +
      `/sources — Xaaladda isha wararka\n` +
      `/latest — 5da warka u dambeeyay\n` +
      `/repost — Dib u daabac warki ugu dambeeyay\n` +
      `/pause — Jooji bot\n` +
      `/resume — Bilow bot\n` +
      `/health — Caafimaadka nidaamka`,
      { parse_mode: "HTML" }
    );
  });

  // /stats
  bot.command("stats", adminOnly(async ctx => {
    const stats = await getStats();
    const statusEmoji = stats.isPaused ? "⏸️ Joojiyaan" : "▶️ Shaqeynaya";
    const text = [
      `📊 <b>Tirakoobka Bot</b>`,
      ``,
      `Xaaladda: ${statusEmoji}`,
      ``,
      `📰 Wararka La Daabacay: <b>${stats.totalPublished}</b>`,
      `📅 Maanta: <b>${stats.publishedToday}</b>`,
      `⏳ Sugaya: <b>${stats.totalPending}</b>`,
      `❌ Fashilmay: <b>${stats.totalFailed}</b>`,
      ``,
      `🌐 Ilaha Firfircoon: <b>${stats.activeSources}</b>`,
      `🔴 Dhammaaday: <b>${stats.disabledSources}</b>`,
    ].join("\n");
    await ctx.reply(text, { parse_mode: "HTML" });
  }));

  // /sources
  bot.command("sources", adminOnly(async ctx => {
    const healths = await prisma.sourceHealth.findMany({ orderBy: { sourceName: "asc" } });
    const healthMap = new Map(healths.map(h => [h.sourceName, h]));

    const lines = NEWS_SOURCES.map(s => {
      const h = healthMap.get(s.name);
      const icon = h?.isDisabled ? "🔴" : h?.lastSuccess ? "🟢" : "⚪";
      const fails = h?.failureCount ? ` (${h.failureCount} fails)` : "";
      return `${icon} ${s.name}${fails}`;
    });

    await ctx.reply(
      `🌐 <b>Ilaha Wararka</b>\n\n${lines.join("\n")}`,
      { parse_mode: "HTML" }
    );
  }));

  // /latest
  bot.command("latest", adminOnly(async ctx => {
    const articles = await prisma.article.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { processedAt: "desc" },
      take: 5,
      select: { somaliTitle: true, source: true, url: true, processedAt: true },
    });

    if (articles.length === 0) {
      await ctx.reply("Warkii la daabacay ma jiro.");
      return;
    }

    const lines = articles.map((a, i) => {
      const time = a.processedAt ? a.processedAt.toLocaleTimeString("so-SO") : "";
      return `${i + 1}. <a href="${a.url}">${a.somaliTitle ?? "—"}</a>\n   <i>${a.source} · ${time}</i>`;
    });

    await ctx.reply(
      `📰 <b>5 Wararka U Dambeeyay</b>\n\n${lines.join("\n\n")}`,
      { parse_mode: "HTML", disable_web_page_preview: true }
    );
  }));

  // /repost
  bot.command("repost", adminOnly(async ctx => {
    await ctx.reply("🔄 Dib u hubinaya wararka cusub...");
    try {
      await runNewsCheck();
      await ctx.reply("✅ Hubinta waa dhammaatay.");
    } catch (err) {
      await ctx.reply(`❌ Khalad: ${String(err)}`);
    }
  }));

  // /pause
  bot.command("pause", adminOnly(async ctx => {
    await prisma.botState.update({ where: { id: "singleton" }, data: { isPaused: true } });
    logger.info(`Bot paused by admin ${ctx.from?.id}`);
    await ctx.reply("⏸️ Bot waa la joojiyay. Isticmaal /resume si aad dib u bilowdo.");
  }));

  // /resume
  bot.command("resume", adminOnly(async ctx => {
    await prisma.botState.update({ where: { id: "singleton" }, data: { isPaused: false } });
    logger.info(`Bot resumed by admin ${ctx.from?.id}`);
    await ctx.reply("▶️ Bot waa bilaabmay mar kale!");
  }));

  // /health
  bot.command("health", adminOnly(async ctx => {
    const mem = process.memoryUsage();
    const uptime = process.uptime();
    const hrs = Math.floor(uptime / 3600);
    const mins = Math.floor((uptime % 3600) / 60);

    const text = [
      `💚 <b>Caafimaadka Nidaamka</b>`,
      ``,
      `⏱️ Xilliga Socdaalka: ${hrs}h ${mins}m`,
      `💾 Xasuusta: ${Math.round(mem.rss / 1024 / 1024)} MB`,
      `🖥️ Node.js: ${process.version}`,
      `🌍 Deegaanka: ${process.env.NODE_ENV ?? "development"}`,
    ].join("\n");

    await ctx.reply(text, { parse_mode: "HTML" });
  }));

  logger.info("Bot commands registered");
}
