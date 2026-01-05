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
  whyItMatters?: string;
  keyDetails?: string[];
  whatsNext?: string;
}

export async function generateArticleFromSignal(
  signal: Signal,
  company: Company | null,
  style: "news" | "analysis" | "brief" | "signal" = "news"
): Promise<GeneratedArticle> {
  const companyContext = company
    ? `Company: ${company.name} (${company.industry}). ${company.description || ""}`
    : "";

  const sourceInfo = signal.sourceUrl 
    ? `Source: ${signal.sourceName || "Industry sources"} (${signal.sourceUrl})`
    : `Source: ${signal.sourceName || "Industry sources"}`;

  const aiAnalysis = signal.aiAnalysis as Record<string, unknown> | null;
  const entities = signal.entities as Record<string, unknown> | null;

  if (style === "signal") {
    return generateSignalFirstArticle(signal, company, sourceInfo, companyContext, aiAnalysis, entities);
  }

  return generateStandardArticle(signal, company, style, sourceInfo, companyContext);
}

async function generateStandardArticle(
  signal: Signal,
  company: Company | null,
  style: "news" | "analysis" | "brief",
  sourceInfo: string,
  companyContext: string
): Promise<GeneratedArticle> {
  const styleInstructions = {
    news: "Write a professional news article in journalistic style. Be factual and objective.",
    analysis: "Write an in-depth analysis piece exploring implications and market impact. Include expert-style commentary.",
    brief: "Write a concise market brief (2-3 paragraphs) suitable for a newsletter or quick update.",
  };

  const prompt = `You are a B2B business journalist. Write like a human editor: clear, specific, and factual. Avoid repetitive phrasing and filler.

INPUTS:
Signal Type: ${signal.type}
Title: ${signal.title}
Summary: ${signal.summary || ""}
Content: ${signal.content || ""}
${sourceInfo}
${companyContext}

Style: ${styleInstructions[style]}

NON-NEGOTIABLE RULES:
- Never invent facts, numbers, dates, locations, or quotes.
- If details are missing, say so plainly.
- Vary sentence length and structure.
- Limit explicit source attribution to once per paragraph unless a new source is introduced.
- Avoid vague phrases like "strategic positioning" unless followed by a concrete example.

OUTPUT (STRICT JSON):
{
  "headline": "60-90 characters, include company name when relevant, use specific verbs (acquires, launches, expands, appoints, reports)",
  "subheadline": "1-2 sentences: what changed, why it matters now, who is affected first",
  "body": "4-10 short paragraphs. Start with strong lead. Include key facts (who, what, when, where, numbers). Include one natural source reference like 'According to [Source]...' Keep paragraphs short (1-3 lines).",
  "keyTakeaways": ["3-5 concrete facts or implications, not vague restatements"],
  "seoDescription": "150-160 character meta description",
  "suggestedTags": ["5-10 industry-appropriate tags, company name, signal type"],
  "sourceAttribution": "Source: [Source Name] — [Source URL]"
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

async function generateSignalFirstArticle(
  signal: Signal,
  company: Company | null,
  sourceInfo: string,
  companyContext: string,
  aiAnalysis: Record<string, unknown> | null,
  entities: Record<string, unknown> | null
): Promise<GeneratedArticle> {
  const aiAnalysisInfo = aiAnalysis 
    ? `AI Analysis: ${JSON.stringify(aiAnalysis)}`
    : "";
  
  const entitiesInfo = entities
    ? `Extracted Entities: ${JSON.stringify(entities)}`
    : "";

  const prompt = `You are an experienced B2B trade journalist writing for baking and milling professionals. Turn a verified company signal into decision-useful coverage. Write like a human editor, not a press release.

INPUTS:
Signal Type: ${signal.type}
Title: ${signal.title}
Summary: ${signal.summary || ""}
Content: ${signal.content || ""}
${sourceInfo}
${companyContext}
${aiAnalysisInfo}
${entitiesInfo}

NON-NEGOTIABLE RULES:
- Never invent facts, numbers, dates, locations, or quotes.
- If information is missing or unclear, state that directly.
- Keep paragraphs short and skimmable.
- Limit explicit source attribution to once per paragraph.
- Avoid filler phrases like "planning signal" or "strategic positioning" unless followed by a specific example.

OUTPUT STRUCTURE (STRICT JSON):
{
  "headline": "Clear and factual, prefer 'Company + action', avoid vague verbs",
  "subheadline": "1-2 sentences: what changed, why it matters now, who is affected first",
  "whyItMatters": "2-3 sentences explaining business significance for baking/milling. Mention segment affected (baking or milling) explicitly. Make impact concrete (capacity, cost, supply chain, competition, regulation, operations).",
  "body": "Factual description of the signal: who, what, when, where. Short paragraphs. Include one natural reference to the source in the body text.",
  "keyDetails": ["3-8 confirmed details only: location, facility/product name, investment amount, capacity/volume, timeline, partners. Omit if unknown."],
  "whatsNext": "2-3 sentences with conservative, clearly framed next steps or implications. If speculative, label as 'what stakeholders will watch next'.",
  "keyTakeaways": ["3-5 bullets summarizing most important facts and implications for industry reader"],
  "seoDescription": "150-160 character meta description",
  "suggestedTags": ["5-10 industry-appropriate tags"],
  "sourceAttribution": "Source: [Source Name] — [Source URL]"
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

  const whyItMattersSection = article.whyItMatters 
    ? `\n\n## Why It Matters\n\n${article.whyItMatters}`
    : "";

  const keyDetailsSection = article.keyDetails && article.keyDetails.length > 0
    ? `\n\n## Key Details\n\n${article.keyDetails.map((d) => `- ${d}`).join("\n")}`
    : "";

  const whatsNextSection = article.whatsNext
    ? `\n\n## What's Next\n\n${article.whatsNext}`
    : "";

  const markdown = `# ${article.headline}

*${article.subheadline}*
${whyItMattersSection}

${article.body}
${keyDetailsSection}
${whatsNextSection}

## Key Takeaways

${article.keyTakeaways.map((t) => `- ${t}`).join("\n")}

---

**Source:** ${sourceLink}
**Company:** ${company?.name || "N/A"}
**Signal Type:** ${signal.type}
`;

  const whyItMattersHtml = article.whyItMatters
    ? `<h2>Why It Matters</h2><p>${article.whyItMatters}</p>`
    : "";

  const keyDetailsHtml = article.keyDetails && article.keyDetails.length > 0
    ? `<h2>Key Details</h2><ul>${article.keyDetails.map((d) => `<li>${d}</li>`).join("")}</ul>`
    : "";

  const whatsNextHtml = article.whatsNext
    ? `<h2>What's Next</h2><p>${article.whatsNext}</p>`
    : "";

  const wordpressContent = `${whyItMattersHtml}

${article.body}

${keyDetailsHtml}

${whatsNextHtml}

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
    markdown,
    json: {
      headline: article.headline,
      subheadline: article.subheadline,
      whyItMatters: article.whyItMatters || null,
      body: article.body,
      keyDetails: article.keyDetails || [],
      whatsNext: article.whatsNext || null,
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
