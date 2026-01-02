import type { Signal, Company } from "@shared/schema";
import type { GeneratedArticle } from "./article-generator";

export interface MediaSitePayload {
  headline: string;
  subheadline: string;
  body: string;
  keyTakeaways: string[];
  seoDescription: string;
  tags: string[];
  author: string;
  imageUrl: string;
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

export function buildMediaSitePayload(
  article: GeneratedArticle,
  signal: Signal,
  company: Company | null,
  imageUrl: string
): MediaSitePayload {
  const aiAnalysis = signal.aiAnalysis as { relevanceScore?: number } | null;
  const relevanceScore = aiAnalysis?.relevanceScore || 50;

  return {
    headline: article.headline,
    subheadline: article.subheadline,
    body: article.body + (article.sourceAttribution ? `\n\n${article.sourceAttribution}` : ""),
    keyTakeaways: article.keyTakeaways,
    seoDescription: article.seoDescription,
    tags: article.suggestedTags || [],
    author: process.env.MEDIA_SITE_AUTHOR || "Your Publication Staff",
    imageUrl,
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

    return {
      success: true,
      articleId: result.id?.toString() || result.articleId?.toString(),
      articleUrl: result.url || result.articleUrl,
    };
  } catch (error) {
    console.error("Media site publish error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to connect to media site",
    };
  }
}
