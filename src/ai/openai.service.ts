import OpenAI from "openai";
import { config } from "../config";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/helpers";

const client = new OpenAI({ apiKey: config.openai.apiKey });

interface TranslationResult {
  somaliTitle: string;
  somaliSummary: string;
}

export async function translateAndSummarize(
  title: string,
  content: string,
  source: string
): Promise<TranslationResult> {
  const prompt = `You are an expert Somali translator and news summarizer.

Article Source: ${source}
Article Title: ${title}

Article Content:
${content.slice(0, 3000)}

Your task:
1. Translate the title into fluent, natural Somali.
2. Write a clear, engaging Somali summary (3-5 sentences) of the main points.
3. Keep all proper names (people, companies, products) in their original form.
4. Keep technical terms in English when there is no good Somali equivalent.
5. Write in a professional news style that Somali readers will understand.

Respond ONLY with valid JSON in this exact format:
{
  "somaliTitle": "translated title here",
  "somaliSummary": "somali summary here"
}`;

  return withRetry(async () => {
    const response = await client.chat.completions.create({
      model: config.openai.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 800,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    let parsed: TranslationResult;

    try {
      parsed = JSON.parse(raw) as TranslationResult;
    } catch {
      logger.warn("OpenAI returned invalid JSON, using fallback", { raw });
      parsed = { somaliTitle: title, somaliSummary: content.slice(0, 300) };
    }

    if (!parsed.somaliTitle || !parsed.somaliSummary) {
      throw new Error("OpenAI response missing required fields");
    }

    return parsed;
  }, 3, 3000);
}

export async function generateDailyDigest(articles: Array<{ somaliTitle: string; source: string }>): Promise<string> {
  const list = articles.map((a, i) => `${i + 1}. ${a.somaliTitle} (${a.source})`).join("\n");

  const response = await client.chat.completions.create({
    model: config.openai.model,
    messages: [{
      role: "user",
      content: `Write a short, engaging Somali introduction (2-3 sentences) for today's technology news digest. Then list these articles:\n\n${list}\n\nRespond in Somali language only.`,
    }],
    temperature: 0.5,
    max_tokens: 500,
  });

  return response.choices[0]?.message?.content ?? "Wararkii teknolojiyada maanta:";
}
