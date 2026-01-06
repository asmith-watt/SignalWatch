import type { Signal, Company, Article } from "@shared/schema";
import type { GeneratedArticle } from "./article-generator";
import { generateImageBuffer } from "./replit_integrations/image/client";
import { openai } from "./replit_integrations/image/client";
import { objectStorageClient } from "./replit_integrations/object_storage";

export interface MediaSitePayload {
  headline: string;
  subheadline: string;
  body: string;
  keyTakeaways: string[];
  seoDescription: string;
  tags: string[];
  author: string;
  imageUrl: string;
  imageCredit?: string;
  clientReferenceId: string;
  canonicalUrl?: string;
  signal: {
    id: number;
    type: string;
    relevanceScore: number;
    sourceName: string | null;
    sourceUrl: string | null;
  };
  company: {
    id: number;
    name: string;
    industry: string | null;
  } | null;
  generatedAt: string;
}

export interface MediaSitePublishResult {
  success: boolean;
  error?: string;
  warning?: string;
  articleId?: string;
  articleUrl?: string;
}

const stockImages: Record<string, string[]> = {
  "Poultry": [
    "poultry_001.jpg",
    "poultry_002.jpg",
    "poultry_003.jpg",
  ],
  "Feed": [
    "feed_001.jpg",
    "feed_002.jpg",
    "feed_003.jpg",
  ],
  "Pet Food": [
    "pet_food_001.jpg",
    "pet_food_002.jpg",
    "pet_food_003.jpg",
  ],
};

export function selectStockImage(signal: Signal, company: Company | null, baseUrl: string): string {
  const industry = company?.industry || "Poultry";
  const images = stockImages[industry] || stockImages["Poultry"];
  const selectedImage = images[signal.id % images.length];
  return `${baseUrl}/stock-images/${selectedImage}`;
}

export async function generateAIImage(
  signal: Signal,
  company: Company | null,
  baseUrl: string
): Promise<{ imageUrl: string; credit: string } | null> {
  try {
    const industry = company?.industry || "business";
    const companyName = company?.name || "company";
    const signalType = signal.type.replace(/_/g, " ");
    
    const promptContent = signal.title + (signal.summary ? `. ${signal.summary}` : "");
    
    const promptRequest = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You create concise image generation prompts for news articles about ${industry}. Generate a professional, editorial-style image prompt. Focus on abstract business imagery, industry themes, or symbolic representations. Never include text, logos, or specific people's faces. Keep prompts under 100 words.`
        },
        {
          role: "user",
          content: `Create an image prompt for an article about: ${promptContent}\n\nCompany: ${companyName}\nSignal type: ${signalType}\nIndustry: ${industry}`
        }
      ],
      max_tokens: 150,
    });

    const imagePrompt = promptRequest.choices[0]?.message?.content || 
      `Professional ${industry} business scene, modern corporate setting, editorial photography style`;

    console.log("Generating AI image with prompt:", imagePrompt);

    const imageBuffer = await generateImageBuffer(
      `Editorial news photo style: ${imagePrompt}. Professional, high-quality, suitable for business publication. No text or logos.`,
      "1024x1024"
    );

    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) {
      console.error("Object storage bucket not configured");
      return null;
    }

    const filename = `ai-image-${signal.id}-${Date.now()}.png`;
    const objectPath = `public/generated-images/${filename}`;
    
    const bucket = objectStorageClient.bucket(bucketId);
    const file = bucket.file(objectPath);
    
    await file.save(imageBuffer, {
      contentType: "image/png",
      metadata: {
        "custom:aclPolicy": JSON.stringify({
          owner: "system",
          visibility: "public",
        }),
      },
    });

    console.log(`AI image uploaded to Object Storage: ${objectPath}`);

    const imageUrl = `${baseUrl}/api/storage/images/${filename}`;

    return {
      imageUrl,
      credit: "AI-generated image via OpenAI DALL-E"
    };
  } catch (error) {
    console.error("Error generating AI image:", error);
    return null;
  }
}

export function buildPayloadFromExistingArticle(
  existingArticle: Article,
  signal: Signal,
  company: Company | null,
  style: string
): MediaSitePayload {
  const aiAnalysis = signal.aiAnalysis as { relevanceScore?: number } | null;
  const relevanceScore = aiAnalysis?.relevanceScore || 50;
  
  // Apply tag hygiene validation even for existing articles
  const sanitizedTags = sanitizeTags(
    (existingArticle.tags as string[]) || [],
    signal.type,
    company?.name || null
  );

  return {
    headline: existingArticle.headline,
    subheadline: existingArticle.subheadline || "",
    body: existingArticle.body,
    keyTakeaways: (existingArticle.keyTakeaways as string[]) || [],
    seoDescription: existingArticle.seoDescription || "",
    tags: sanitizedTags,
    author: process.env.MEDIA_SITE_AUTHOR || "Your Publication Staff",
    imageUrl: existingArticle.imageUrl || "",
    imageCredit: "AI-generated image via OpenAI DALL-E",
    clientReferenceId: `signalwatch:${signal.id}:${style}`,
    canonicalUrl: existingArticle.externalUrl || undefined,
    signal: {
      id: signal.id,
      type: signal.type,
      relevanceScore: typeof relevanceScore === "number" ? relevanceScore : 50,
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
  };
}

// Map signal types to topic tags for SEO - covers all possible signal types
const SIGNAL_TYPE_TAGS: Record<string, string> = {
  news: "Industry News",
  funding: "Funding",
  partnership: "Partnership",
  acquisition: "Acquisition",
  product_launch: "Product Launch",
  executive_change: "Executive Change",
  earnings: "Earnings",
  regulatory: "Regulation",
  press_release: "Press Release",
  fire: "Fire",
  recall: "Recall",
  expansion: "Expansion",
  layoff: "Layoffs",
  job_posting: "Hiring",
  website_change: "Company Update",
  social_media: "Social Media",
  award: "Awards",
  bankruptcy: "Business News",
  merger: "Mergers",
  ipo: "IPO",
  lawsuit: "Legal",
  sustainability: "Sustainability",
  other: "Business Update",
};

/**
 * Validates and sanitizes tags for SEO requirements:
 * - Ensures at least 2 tags
 * - At least one tag must NOT be the company name
 * - Auto-adds topic tag based on signal type if needed
 * - Strips company-name-only tags to ensure diversity
 */
export function sanitizeTags(
  rawTags: string[],
  signalType: string,
  companyName: string | null
): string[] {
  const companyNameLower = companyName?.toLowerCase().trim() || "";
  
  // Start with non-company tags only (strip company name tags)
  let tags = (rawTags || []).filter(t => 
    t.toLowerCase().trim() !== companyNameLower
  );
  
  // Add topic tag based on signal type if not already present
  // Falls back to "Business Update" for any unknown signal types
  const topicTag = SIGNAL_TYPE_TAGS[signalType] || "Business Update";
  if (!tags.some(t => t.toLowerCase() === topicTag.toLowerCase())) {
    tags.push(topicTag);
  }
  
  // Ensure minimum 2 non-company tags
  const defaultTags = ["Industry Update", "Market News", "Business Intelligence"];
  for (const defaultTag of defaultTags) {
    if (tags.length >= 2) break;
    if (!tags.some(t => t.toLowerCase() === defaultTag.toLowerCase())) {
      tags.push(defaultTag);
    }
  }
  
  // Remove duplicates (case-insensitive) and clean up
  const seen = new Set<string>();
  return tags.filter(tag => {
    const lower = tag.toLowerCase().trim();
    if (!lower || seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}

export function buildMediaSitePayload(
  article: GeneratedArticle,
  signal: Signal,
  company: Company | null,
  imageUrl: string,
  style: string,
  imageCredit?: string,
  canonicalUrl?: string
): MediaSitePayload {
  const aiAnalysis = signal.aiAnalysis as { relevanceScore?: number } | null;
  const relevanceScore = aiAnalysis?.relevanceScore || 50;
  
  // Apply tag hygiene validation
  const sanitizedTags = sanitizeTags(
    article.suggestedTags || [],
    signal.type,
    company?.name || null
  );

  return {
    headline: article.headline,
    subheadline: article.subheadline,
    body: article.body + (article.sourceAttribution ? `\n\n${article.sourceAttribution}` : ""),
    keyTakeaways: article.keyTakeaways,
    seoDescription: article.seoDescription,
    tags: sanitizedTags,
    author: process.env.MEDIA_SITE_AUTHOR || "Your Publication Staff",
    imageUrl,
    imageCredit,
    clientReferenceId: `signalwatch:${signal.id}:${style}`,
    canonicalUrl,
    signal: {
      id: signal.id,
      type: signal.type,
      relevanceScore: typeof relevanceScore === "number" ? relevanceScore : 50,
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
  };
}

export async function publishToMediaSite(
  payload: MediaSitePayload
): Promise<MediaSitePublishResult> {
  const mediaSiteUrl = process.env.MEDIA_SITE_URL;
  const mediaSiteApiKey = process.env.MEDIA_SITE_API_KEY;

  if (!mediaSiteUrl) {
    return {
      success: false,
      error: "MEDIA_SITE_URL environment variable is not configured",
    };
  }

  const apiUrl = `${mediaSiteUrl.replace(/\/$/, "")}/api/articles/receive`;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Source": "signalwatch-platform",
    };

    if (mediaSiteApiKey) {
      headers["X-API-Key"] = mediaSiteApiKey;
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Media site API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      return { success: false, error: errorMessage };
    }

    const result = await response.json();
    
    const articleId = result.id?.toString() || result.articleId?.toString();
    const articleUrl = result.url || result.articleUrl;
    
    if (!articleId && !articleUrl) {
      console.warn("Media site returned success but no article ID or URL - article may not have been saved");
      return {
        success: true,
        articleId: undefined,
        articleUrl: undefined,
        warning: "Article was accepted but no confirmation ID was returned. Please verify on the media site.",
      };
    }

    return {
      success: true,
      articleId,
      articleUrl,
    };
  } catch (error) {
    console.error("Media site publish error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to connect to media site",
    };
  }
}
