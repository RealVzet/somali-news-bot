import { Telegraf } from "telegraf";
import { config } from "../config";
import { registerCommands } from "./commands";
import { logger } from "../utils/logger";

let botInstance: Telegraf | null = null;

export function createBot(): Telegraf {
  if (botInstance) return botInstance;

  const bot = new Telegraf(config.telegram.botToken);
  registerCommands(bot);

  bot.catch((err, ctx) => {
    logger.error("Telegram bot error", { error: String(err), update: ctx.updateType });
  });

  botInstance = bot;
  return bot;
}

export async function startBot(bot: Telegraf): Promise<void> {
  await bot.launch();
  logger.info("Telegram bot started (long polling)");

  process.once("SIGINT",  () => { bot.stop("SIGINT");  });
  process.once("SIGTERM", () => { bot.stop("SIGTERM"); });
}
