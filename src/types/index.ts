export type ArticleStatus = "PENDING" | "PROCESSING" | "PUBLISHED" | "FAILED" | "SKIPPED";

export interface RawArticle {
  url: string;
  source: string;
  originalTitle: string;
  originalContent?: string;
  imageUrl?: string;
  author?: string;
  publishedAt?: Date;
}

export interface ProcessedArticle extends RawArticle {
  somaliTitle: string;
  somaliSummary: string;
  category: string;
  hashtags: string[];
}

export interface NewsSource {
  name: string;
  rssUrl: string;
  baseUrl: string;
  category?: string;
}

export interface BotStats {
  totalPublished: number;
  totalFailed: number;
  totalPending: number;
  publishedToday: number;
  activeSources: number;
  disabledSources: number;
  isPaused: boolean;
}
