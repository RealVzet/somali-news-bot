# 🤖 AI Technology News Bot — Somali Language

Automatically monitors global tech & AI news 24/7, translates to Somali using AI, and posts to a Telegram channel.

## Features
- ✅ Monitors 10+ top tech news sources via RSS every 45 seconds
- ✅ AI-powered Somali translation & summarization (GPT-4o-mini)
- ✅ Auto-classifies into 10 categories with hashtags
- ✅ Duplicate detection via PostgreSQL
- ✅ Daily digest at 08:00 (Africa/Nairobi)
- ✅ Admin commands via Telegram
- ✅ Retry system for failed articles
- ✅ Docker + PM2 support

## Quick Start

### 1. Clone & install
```bash
git clone <repo-url>
cd telegram-news-bot
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your tokens
```

Required variables:
| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | From @BotFather |
| `TELEGRAM_CHANNEL_ID` | e.g. `@mychannel` or `-100123456789` |
| `TELEGRAM_ADMIN_IDS` | Your Telegram user ID(s), comma-separated |
| `OPENAI_API_KEY` | From platform.openai.com |
| `DATABASE_URL` | PostgreSQL connection string |

### 3. Run with Docker (recommended)
```bash
cp .env.example .env   # fill in values
docker-compose up -d
```

### 4. Run with PM2
```bash
npm run build
npx prisma migrate deploy
pm2 start pm2.config.js
pm2 save
```

### 5. Run in development
```bash
npm run prisma:migrate
npm run dev
```

## Admin Commands

| Command | Description |
|---|---|
| `/stats` | Show published/failed/pending counts |
| `/sources` | Show all source health status |
| `/latest` | Last 5 published articles |
| `/repost` | Trigger an immediate news check |
| `/pause` | Pause the bot |
| `/resume` | Resume the bot |
| `/health` | System uptime & memory |

## News Sources
TechCrunch · The Verge · Wired · Ars Technica · VentureBeat · MIT Technology Review · Google AI Blog · NVIDIA Blog · Hacker News · InfoQ

## Post Format
```
🚀 Wararka Teknolojiyada

📰 Cinwaanka:
[Somali translated title]

📝 Koobaad:
[AI Somali summary]

🌐 Isha: TechCrunch
🔗 Akhri Wax Dheeraad ah

#ArtificialIntelligence #Technology #AI #News
```
