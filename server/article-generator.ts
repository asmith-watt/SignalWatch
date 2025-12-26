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
  sourceAttribution: string;
  sourceUrl: string | null;
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

  const sourceInfo = signal.sourceUrl 
    ? `Source: ${signal.sourceName || "Industry sources"} (${signal.sourceUrl})`
    : `Source: ${signal.sourceName || "Industry sources"}`;

  const prompt = `You are a B2B business journalist. Generate a professional article based on this business signal.

Signal Type: ${signal.type}
Title: ${signal.title}
Summary: ${signal.summary || ""}
Content: ${signal.content || ""}
${sourceInfo}
${companyContext}

Style: ${styleInstructions[style]}

IMPORTANT: The article body MUST include a natural reference to the original source with attribution. For example: "According to ${signal.sourceName || "industry sources"}..." or "As reported by ${signal.sourceName || "sources"}..."

Respond in JSON format:
{
  "headline": "Compelling, SEO-friendly headline",
  "subheadline": "Supporting context in 1-2 sentences",
  "body": "Full article body with multiple paragraphs. Include natural source attribution within the text.",
  "keyTakeaways": ["3-5 bullet points summarizing key points"],
  "seoDescription": "150-160 character meta description for SEO",
  "suggestedTags": ["relevant", "tags", "for", "categorization"],
  "sourceAttribution": "A formal attribution line like: Originally reported by [Source Name]"
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

  const parsed = JSON.parse(content);
  return {
    ...parsed,
    sourceUrl: signal.sourceUrl || null,
  } as GeneratedArticle;
}

export interface CMSExportFormat {
  wordpress: {
    post_title: string;
    post_content: string;
    post_excerpt: string;
    post_status: string;
    tags_input: string[];
    categories: string[];
    source_url: string | null;
  };
  contentful: {
    fields: {
      title: { "en-US": string };
      body: { "en-US": string };
      excerpt: { "en-US": string };
      tags: { "en-US": string[] };
      sourceUrl: { "en-US": string | null };
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
  const sourceLink = signal.sourceUrl 
    ? `[${signal.sourceName || "Original Source"}](${signal.sourceUrl})`
    : signal.sourceName || "Industry sources";
  
  const sourceHtml = signal.sourceUrl
    ? `<a href="${signal.sourceUrl}" target="_blank" rel="noopener noreferrer">${signal.sourceName || "Original Source"}</a>`
    : signal.sourceName || "Industry sources";

  const markdown = `# ${article.headline}

*${article.subheadline}*

${article.body}

## Key Takeaways

${article.keyTakeaways.map((t) => `- ${t}`).join("\n")}

---

**Source:** ${sourceLink}
**Company:** ${company?.name || "N/A"}
**Signal Type:** ${signal.type}
`;

  const wordpressContent = `${article.body}

<p><strong>Source:</strong> ${sourceHtml}</p>`;

  return {
    wordpress: {
      post_title: article.headline,
      post_content: wordpressContent,
      post_excerpt: article.seoDescription,
      post_status: "draft",
      tags_input: article.suggestedTags,
      categories: [signal.type, company?.industry || "Business"].filter(Boolean),
      source_url: signal.sourceUrl || null,
    },
    contentful: {
      fields: {
        title: { "en-US": article.headline },
        body: { "en-US": `${article.body}\n\nSource: ${signal.sourceName || "Industry sources"}${signal.sourceUrl ? ` (${signal.sourceUrl})` : ""}` },
        excerpt: { "en-US": article.seoDescription },
        tags: { "en-US": article.suggestedTags },
        sourceUrl: { "en-US": signal.sourceUrl || null },
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
