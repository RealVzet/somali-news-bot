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
  const prompt = `You are a professional Somali journalist writing for everyday Somali readers — people of all ages and education levels across Somalia and the diaspora.

Article Source: ${source}
Article Title: ${title}

Article Content:
${content.slice(0, 3000)}

Your task:
1. Translate the title into simple, clear, everyday Somali that anyone can understand.
2. Write a Somali news summary (3-5 sentences) covering the main points of the article.
3. Use simple, common Somali words that ordinary people use in daily conversation — avoid old-fashioned, overly formal, or scholarly Somali.
4. Write in a friendly, clear news style — like a trusted Somali radio presenter or journalist.
5. Keep proper names (people, companies, products, places) in their original English spelling.
6. Keep technical terms in English when there is no simple Somali word for them (e.g. "AI", "robot", "software", "app"). You may add a short Somali explanation in brackets if helpful.
7. Do NOT use HTML entities like &#8216; or &amp; — write everything as plain readable text.
8. Do NOT translate word-for-word from English — write naturally as a Somali speaker would say it.

IMPORTANT LANGUAGE RULES:
- Use SHORT, simple sentences. If a sentence is getting long, split it into two.
- Prefer common Somali words over rare or borrowed words.
- A 10-year-old Somali child and a 60-year-old Somali elder should both understand what you wrote.
- Read your output aloud in your mind — if it sounds unnatural, rewrite it.

Respond ONLY with valid JSON in this exact format:
{
  "somaliTitle": "simple clear somali title here",
  "somaliSummary": "simple clear somali summary here"
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

    // Strip any HTML entities that slipped through
    parsed.somaliTitle = decodeHtmlEntities(parsed.somaliTitle);
    parsed.somaliSummary = decodeHtmlEntities(parsed.somaliSummary);

    return parsed;
  }, 3, 3000);
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8212;/g, '—')
    .replace(/&#8211;/g, '–')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

export async function generateDailyDigest(articles: Array<{ somaliTitle: string; source: string }>): Promise<string> {
  const list = articles.map((a, i) => `${i + 1}. ${a.somaliTitle} (${a.source})`).join("\n");

  const response = await client.chat.completions.create({
    model: config.openai.model,
    messages: [{
      role: "user",
      content: `Ku qor Af-Soomaali fudud oo cad hordhac gaaban (2-3 jumlood) oo loogu talagalay wararka teknolojiyada maanta. Ka dib, ku taxo wararkaan:\n\n${list}\n\nIsticmaal Af-Soomaali fudud oo qof walba fahmi karo. Ha isticmaalin ereyada adag.`,
    }],
    temperature: 0.5,
    max_tokens: 500,
  });

  return response.choices[0]?.message?.content ?? "Wararkii teknolojiyada maanta:";
}
