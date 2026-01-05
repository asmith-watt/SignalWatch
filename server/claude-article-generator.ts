import Anthropic from "@anthropic-ai/sdk";
import type { Signal, Company } from "@shared/schema";
import type { GeneratedArticle } from "./article-generator";

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) {
    throw new Error("Claude API not configured. Please set up Anthropic integration to use Claude models.");
  }
  
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    });
  }
  
  return anthropicClient;
}

export type ClaudeModel = "claude-sonnet-4-5" | "claude-opus-4-5" | "claude-haiku-4-5";

export async function generateArticleWithClaude(
  signal: Signal,
  company: Company | null,
  style: "news" | "analysis" | "brief" | "signal" = "news",
  model: ClaudeModel = "claude-sonnet-4-5"
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
    return generateSignalFirstArticle(signal, company, sourceInfo, companyContext, aiAnalysis, entities, model);
  }

  return generateStandardArticle(signal, company, style, sourceInfo, companyContext, model);
}

async function generateStandardArticle(
  signal: Signal,
  company: Company | null,
  style: "news" | "analysis" | "brief",
  sourceInfo: string,
  companyContext: string,
  model: ClaudeModel
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

OUTPUT (STRICT JSON - output ONLY the JSON, no markdown):
{
  "headline": "60-90 characters, include company name when relevant, use specific verbs (acquires, launches, expands, appoints, reports)",
  "subheadline": "1-2 sentences: what changed, why it matters now, who is affected first",
  "body": "4-10 short paragraphs. Start with strong lead. Include key facts (who, what, when, where, numbers). Include one natural source reference like 'According to [Source]...' Keep paragraphs short (1-3 lines).",
  "keyTakeaways": ["3-5 concrete facts or implications, not vague restatements"],
  "seoDescription": "150-160 character meta description",
  "suggestedTags": ["5-10 industry-appropriate tags, company name, signal type"],
  "sourceAttribution": "Source: [Source Name] — [Source URL]"
}`;

  const response = await getAnthropicClient().messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("No text response from Claude");
  }

  let jsonContent = content.text.trim();
  if (jsonContent.startsWith("```json")) {
    jsonContent = jsonContent.slice(7);
  }
  if (jsonContent.startsWith("```")) {
    jsonContent = jsonContent.slice(3);
  }
  if (jsonContent.endsWith("```")) {
    jsonContent = jsonContent.slice(0, -3);
  }
  jsonContent = jsonContent.trim();

  const parsed = JSON.parse(jsonContent);
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
  entities: Record<string, unknown> | null,
  model: ClaudeModel
): Promise<GeneratedArticle> {
  const aiAnalysisInfo = aiAnalysis 
    ? `AI Analysis: ${JSON.stringify(aiAnalysis)}`
    : "";
  
  const entitiesInfo = entities
    ? `Extracted Entities: ${JSON.stringify(entities)}`
    : "";

  const prompt = `You are an experienced B2B trade journalist writing for baking and milling professionals. Turn a verified company signal into decision-useful coverage. Write like a human editor, not a press release.

SIGNAL:
Type: ${signal.type}
Title: ${signal.title}
Summary: ${signal.summary || "No summary available"}
Content: ${signal.content || "No additional content"}
${sourceInfo}
${companyContext}
${aiAnalysisInfo}
${entitiesInfo}

ABSOLUTE RULES (breaking these fails the task):
1. Never invent facts, numbers, dates, locations, or quotes.
2. If specific details are not provided, acknowledge the gap rather than filling it.
3. Every statement must be directly traceable to the SIGNAL inputs above.

STRUCTURE REQUIREMENTS:
- Headline: 60-90 characters, include company name, use specific action verb
- Subheadline: One sentence explaining what changed and who is affected
- Body: 4-6 short paragraphs with concrete facts and natural source attribution
- Key Takeaways: 3-5 specific, actionable insights
- Why It Matters: One paragraph on industry implications
- Key Details: Bullet list of specific facts from the signal
- What's Next: One sentence on expected developments (if supported by signal)

OUTPUT (STRICT JSON - output ONLY the JSON, no markdown):
{
  "headline": "Headline here",
  "subheadline": "Subheadline here",
  "body": "Article body with paragraphs separated by newlines",
  "keyTakeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"],
  "seoDescription": "150-160 character meta description",
  "suggestedTags": ["tag1", "tag2", "tag3"],
  "sourceAttribution": "Source: [Name] — [URL]",
  "whyItMatters": "Industry implications paragraph",
  "keyDetails": ["Detail 1", "Detail 2"],
  "whatsNext": "Expected next steps"
}`;

  const response = await getAnthropicClient().messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("No text response from Claude");
  }

  let jsonContent = content.text.trim();
  if (jsonContent.startsWith("```json")) {
    jsonContent = jsonContent.slice(7);
  }
  if (jsonContent.startsWith("```")) {
    jsonContent = jsonContent.slice(3);
  }
  if (jsonContent.endsWith("```")) {
    jsonContent = jsonContent.slice(0, -3);
  }
  jsonContent = jsonContent.trim();

  const parsed = JSON.parse(jsonContent);
  return {
    ...parsed,
    sourceUrl: signal.sourceUrl || null,
  } as GeneratedArticle;
}
