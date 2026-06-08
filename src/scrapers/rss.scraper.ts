import RSSParser from "rss-parser";
import axios from "axios";
import * as cheerio from "cheerio";
import { logger } from "../utils/logger";
import { normalizeUrl, isValidUrl } from "../utils/helpers";
import type { RawArticle, NewsSource } from "../types";

const parser = new RSSParser({
  timeout: 15000,
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; NewsBotSomali/1.0)",
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
  },
});

export async function fetchRssFeed(source: NewsSource): Promise<RawArticle[]> {
  try {
    const feed = await parser.parseURL(source.rssUrl);
    const articles: RawArticle[] = [];

    for (const item of (feed.items ?? []).slice(0, 20)) {
      if (!item.link || !item.title) continue;
      const url = normalizeUrl(item.link);
      if (!isValidUrl(url)) continue;

      const imageUrl = extractImageFromItem(item);
      const publishedAt = item.isoDate ? new Date(item.isoDate) : undefined;

      articles.push({
        url,
        source: source.name,
        originalTitle: item.title.trim(),
        originalContent: cleanHtml(item.contentSnippet ?? item.content ?? ""),
        imageUrl,
        author: item.creator ?? item.author ?? undefined,
        publishedAt,
      });
    }

    logger.debug(`RSS fetch OK: ${source.name} — ${articles.length} items`);
    return articles;
  } catch (err) {
    logger.warn(`RSS fetch failed: ${source.name}`, { error: String(err) });
    return [];
  }
}

export async function scrapeArticleContent(url: string): Promise<{ content: string; imageUrl?: string }> {
  try {
    const response = await axios.get(url, {
      timeout: 12000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      maxRedirects: 5,
    });

    const $ = cheerio.load(response.data as string);

    // Remove clutter
    $("script, style, nav, footer, aside, .ads, .advertisement, .social-share, .related-posts, .comments").remove();

    // Try article-specific selectors first
    const selectors = [
      "article",
      '[class*="article-body"]',
      '[class*="post-content"]',
      '[class*="entry-content"]',
      '[class*="story-body"]',
      "main",
      ".content",
    ];

    let content = "";
    for (const sel of selectors) {
      const el = $(sel).first();
      if (el.length && el.text().trim().length > 200) {
        content = el.text().replace(/\s+/g, " ").trim();
        break;
      }
    }

    // Image from og:image
    const imageUrl = $('meta[property="og:image"]').attr("content")
      ?? $('meta[name="twitter:image"]').attr("content");

    return {
      content: content.slice(0, 4000),
      imageUrl: imageUrl && isValidUrl(imageUrl) ? imageUrl : undefined,
    };
  } catch {
    return { content: "" };
  }
}

function extractImageFromItem(item: RSSParser.Item & Record<string, unknown>): string | undefined {
  if (item.enclosure && typeof item.enclosure === "object") {
    const enc = item.enclosure as { url?: string; type?: string };
    if (enc.url && enc.type?.startsWith("image/")) return enc.url;
  }
  const mediaContent = item["media:content"];
  if (mediaContent && typeof mediaContent === "object") {
    const mc = mediaContent as { $?: { url?: string }; url?: string };
    const url = mc.$?.url ?? mc.url;
    if (url && isValidUrl(url)) return url;
  }
  const mediaThumbnail = item["media:thumbnail"];
  if (mediaThumbnail && typeof mediaThumbnail === "object") {
    const mt = mediaThumbnail as { $?: { url?: string }; url?: string };
    const url = mt.$?.url ?? mt.url;
    if (url && isValidUrl(url)) return url;
  }
  // Try extracting from content HTML
  const content = typeof item.content === "string" ? item.content : "";
  const match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match?.[1] && isValidUrl(match[1])) return match[1];
  return undefined;
}

function cleanHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
