import type { NewsSource } from "../types";

export const NEWS_SOURCES: NewsSource[] = [
  {
    name: "TechCrunch",
    rssUrl: "https://techcrunch.com/feed/",
    baseUrl: "https://techcrunch.com",
    category: "Technology",
  },
  {
    name: "The Verge",
    rssUrl: "https://www.theverge.com/rss/index.xml",
    baseUrl: "https://www.theverge.com",
    category: "Technology",
  },
  {
    name: "Wired",
    rssUrl: "https://www.wired.com/feed/rss",
    baseUrl: "https://www.wired.com",
    category: "Technology",
  },
  {
    name: "Ars Technica",
    rssUrl: "https://feeds.arstechnica.com/arstechnica/index",
    baseUrl: "https://arstechnica.com",
    category: "Technology",
  },
  {
    name: "VentureBeat",
    rssUrl: "https://venturebeat.com/feed/",
    baseUrl: "https://venturebeat.com",
    category: "AI",
  },
  {
    name: "MIT Technology Review",
    rssUrl: "https://www.technologyreview.com/feed/",
    baseUrl: "https://www.technologyreview.com",
    category: "AI",
  },
  {
    name: "Google AI Blog",
    rssUrl: "https://blog.research.google/feeds/posts/default",
    baseUrl: "https://blog.research.google",
    category: "AI",
  },
  {
    name: "NVIDIA Blog",
    rssUrl: "https://blogs.nvidia.com/feed/",
    baseUrl: "https://blogs.nvidia.com",
    category: "AI",
  },
  {
    name: "Hacker News",
    rssUrl: "https://news.ycombinator.com/rss",
    baseUrl: "https://news.ycombinator.com",
    category: "Technology",
  },
  {
    name: "InfoQ",
    rssUrl: "https://feed.infoq.com",
    baseUrl: "https://www.infoq.com",
    category: "Software",
  },
];

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Artificial Intelligence": ["ai", "artificial intelligence", "machine learning", "neural", "llm", "gpt", "openai", "gemini", "claude", "deep learning", "chatgpt"],
  "Robotics": ["robot", "robotics", "autonomous", "drone", "humanoid"],
  "Cybersecurity": ["security", "hack", "breach", "vulnerability", "cyber", "malware", "ransomware", "phishing"],
  "Startups": ["startup", "funding", "venture", "series a", "series b", "seed round", "ipo", "valuation"],
  "Programming": ["programming", "developer", "code", "software", "api", "framework", "open source", "github"],
  "Gadgets": ["iphone", "android", "smartphone", "laptop", "tablet", "wearable", "headset", "gadget"],
  "Space Technology": ["space", "nasa", "spacex", "rocket", "satellite", "mars", "moon", "orbit"],
  "Cloud Computing": ["cloud", "aws", "azure", "google cloud", "kubernetes", "docker", "serverless"],
  "Software": ["app", "software", "update", "release", "feature", "platform", "saas"],
  "Hardware": ["chip", "processor", "gpu", "nvidia", "intel", "amd", "semiconductor", "hardware"],
};

export function classifyArticle(title: string, content?: string): { category: string; hashtags: string[] } {
  const text = `${title} ${content ?? ""}`.toLowerCase();
  const matched: string[] = [];

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      matched.push(category);
    }
  }

  const category = matched[0] ?? "Technology";
  const hashtags = [
    ...matched.slice(0, 3).map(c => `#${c.replace(/\s+/g, "")}`),
    "#Technology",
    "#AI",
    "#News",
    "#Somali",
  ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 6);

  return { category, hashtags };
}
