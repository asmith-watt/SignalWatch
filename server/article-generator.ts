import OpenAI from "openai";
import type { Signal, Company } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface GeneratedArticle {
  headline: string;
  subheadline: string;
  body: string;
  keyTakeaways: string[];
  seoDescription: string;
  suggestedTags: string[];
}

export async function generateArticleFromSignal(
  signal: Signal,
  company: Company | null,
  style: "news" | "analysis" | "brief" = "news"
): Promise<GeneratedArticle> {
  const companyContext = company
    ? `Company: ${company.name} (${company.industry}). ${company.description || ""}`
    : "";

  const styleInstructions = {
    news: "Write a professional news article in journalistic style. Be factual and objective.",
    analysis: "Write an in-depth analysis piece exploring implications and market impact. Include expert-style commentary.",
    brief: "Write a concise market brief (2-3 paragraphs) suitable for a newsletter or quick update.",
  };

  const prompt = `You are a B2B business journalist. Generate a professional article based on this business signal.

Signal Type: ${signal.type}
Title: ${signal.title}
Summary: ${signal.summary || ""}
Content: ${signal.content || ""}
Source: ${signal.sourceName || "Industry sources"}
${companyContext}

Style: ${styleInstructions[style]}

Respond in JSON format:
{
  "headline": "Compelling, SEO-friendly headline",
  "subheadline": "Supporting context in 1-2 sentences",
  "body": "Full article body with multiple paragraphs. Use professional business journalism style.",
  "keyTakeaways": ["3-5 bullet points summarizing key points"],
  "seoDescription": "150-160 character meta description for SEO",
  "suggestedTags": ["relevant", "tags", "for", "categorization"]
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  return JSON.parse(content) as GeneratedArticle;
}

export interface CMSExportFormat {
  wordpress: {
    post_title: string;
    post_content: string;
    post_excerpt: string;
    post_status: string;
    tags_input: string[];
    categories: string[];
  };
  contentful: {
    fields: {
      title: { "en-US": string };
      body: { "en-US": string };
      excerpt: { "en-US": string };
      tags: { "en-US": string[] };
    };
  };
  markdown: string;
  json: object;
}

export function exportArticleForCMS(
  article: GeneratedArticle,
  signal: Signal,
  company: Company | null
): CMSExportFormat {
  const markdown = `# ${article.headline}

*${article.subheadline}*

${article.body}

## Key Takeaways

${article.keyTakeaways.map((t) => `- ${t}`).join("\n")}

---

*Source: ${signal.sourceName || "Industry sources"}*
*Company: ${company?.name || "N/A"}*
*Signal Type: ${signal.type}*
`;

  return {
    wordpress: {
      post_title: article.headline,
      post_content: article.body,
      post_excerpt: article.seoDescription,
      post_status: "draft",
      tags_input: article.suggestedTags,
      categories: [signal.type, company?.industry || "Business"].filter(Boolean),
    },
    contentful: {
      fields: {
        title: { "en-US": article.headline },
        body: { "en-US": article.body },
        excerpt: { "en-US": article.seoDescription },
        tags: { "en-US": article.suggestedTags },
      },
    },
    markdown,
    json: {
      headline: article.headline,
      subheadline: article.subheadline,
      body: article.body,
      keyTakeaways: article.keyTakeaways,
      seoDescription: article.seoDescription,
      tags: article.suggestedTags,
      source: {
        signalId: signal.id,
        signalType: signal.type,
        signalTitle: signal.title,
        sourceName: signal.sourceName,
        sourceUrl: signal.sourceUrl,
      },
      company: company
        ? {
            id: company.id,
            name: company.name,
            industry: company.industry,
          }
        : null,
      generatedAt: new Date().toISOString(),
    },
  };
}
