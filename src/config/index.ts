export const config = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN!,
    channelId: process.env.TELEGRAM_CHANNEL_ID!,
    adminIds: (process.env.TELEGRAM_ADMIN_IDS ?? "").split(",").map(s => parseInt(s.trim(), 10)).filter(Boolean),
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  },
  bot: {
    checkIntervalSeconds: parseInt(process.env.NEWS_CHECK_INTERVAL_SECONDS ?? "45", 10),
    maxArticlesPerRun: parseInt(process.env.MAX_ARTICLES_PER_RUN ?? "10", 10),
    maxRetryCount: parseInt(process.env.MAX_RETRY_COUNT ?? "3", 10),
    logLevel: process.env.LOG_LEVEL ?? "info",
    nodeEnv: process.env.NODE_ENV ?? "development",
  },
};

export function validateConfig(): void {
  const missing: string[] = [];
  if (!config.telegram.botToken) missing.push("TELEGRAM_BOT_TOKEN");
  if (!config.telegram.channelId) missing.push("TELEGRAM_CHANNEL_ID");
  if (!config.openai.apiKey) missing.push("OPENAI_API_KEY");
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
