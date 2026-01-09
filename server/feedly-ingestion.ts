import { storage } from "./storage";
import type { Source, InsertSignal, InsertIngestionRun } from "@shared/schema";
import { generateStableHash, checkNearDuplicate, getHostFromUrl } from "./dedupe";

let FEEDLY_ACCESS_TOKEN = process.env.FEEDLY_ACCESS_TOKEN;
const FEEDLY_REFRESH_TOKEN = process.env.FEEDLY_REFRESH_TOKEN;
const FEEDLY_API_BASE = "https://cloud.feedly.com/v3";

// Track token expiry for automatic refresh
let tokenExpiresAt: number | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!FEEDLY_REFRESH_TOKEN) {
    console.log("[Feedly] No refresh token configured, cannot refresh access token");
    return false;
  }
  
  try {
    console.log("[Feedly] Attempting to refresh access token...");
    const response = await fetch("https://cloud.feedly.com/v3/auth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refresh_token: FEEDLY_REFRESH_TOKEN,
        client_id: "feedlydev",
        client_secret: "feedlydev",
        grant_type: "refresh_token",
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Feedly] Token refresh failed:", response.status, errorText);
      return false;
    }
    
    const data = await response.json();
    FEEDLY_ACCESS_TOKEN = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in * 1000);
    console.log("[Feedly] Access token refreshed successfully, expires in", data.expires_in, "seconds");
    return true;
  } catch (error) {
    console.error("[Feedly] Error refreshing token:", error);
    return false;
  }
}

async function ensureValidToken(): Promise<boolean> {
  if (!FEEDLY_ACCESS_TOKEN) {
    return false;
  }
  
  // If we have a refresh token and the access token is expired or about to expire (within 5 min)
  if (FEEDLY_REFRESH_TOKEN && tokenExpiresAt && (Date.now() > tokenExpiresAt - 300000)) {
    return await refreshAccessToken();
  }
  
  return true;
}

interface FeedlyEntry {
  id: string;
  title?: string;
  originId?: string;
  origin?: {
    streamId?: string;
    title?: string;
    htmlUrl?: string;
  };
  alternate?: Array<{ href: string; type: string }>;
  summary?: { content: string };
  content?: { content: string };
  published?: number;
  crawled?: number;
  author?: string;
  keywords?: string[];
}

interface FeedlyStreamResponse {
  id: string;
  title?: string;
  items?: FeedlyEntry[];
  continuation?: string;
}

function normalizeCanonicalUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const trackingParams = [
      "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
      "ref", "fbclid", "gclid", "mc_cid", "mc_eid", "_ga", "_gl",
      "source", "campaign", "medium",
    ];
    trackingParams.forEach((param) => parsed.searchParams.delete(param));
    parsed.hash = "";
    let canonical = parsed.toString();
    if (canonical.endsWith("/")) {
      canonical = canonical.slice(0, -1);
    }
    return canonical;
  } catch {
    return url;
  }
}

function inferSignalType(title: string, content?: string): string {
  const text = `${title} ${content || ""}`.toLowerCase();
  if (text.includes("funding") || text.includes("raises") || text.includes("investment") || text.includes("series")) {
    return "funding";
  }
  if (text.includes("ceo") || text.includes("appoint") || text.includes("hire") || text.includes("executive")) {
    return "executive_change";
  }
  if (text.includes("launch") || text.includes("introduces") || text.includes("announces new")) {
    return "product_launch";
  }
  if (text.includes("partner") || text.includes("collaboration") || text.includes("joint venture")) {
    return "partnership";
  }
  if (text.includes("acqui") || text.includes("merger") || text.includes("buyout")) {
    return "acquisition";
  }
  if (text.includes("regulator") || text.includes("compliance") || text.includes("fda") || text.includes("usda")) {
    return "regulatory";
  }
  if (text.includes("earnings") || text.includes("revenue") || text.includes("quarterly")) {
    return "earnings";
  }
  return "news";
}

function inferSentiment(title: string, content?: string): string {
  const text = `${title} ${content || ""}`.toLowerCase();
  const positiveWords = ["growth", "success", "launch", "award", "partner", "expands", "record", "breakthrough"];
  const negativeWords = ["recall", "lawsuit", "fine", "shutdown", "layoff", "decline", "loss", "fail"];
  
  const positiveCount = positiveWords.filter((w) => text.includes(w)).length;
  const negativeCount = negativeWords.filter((w) => text.includes(w)).length;
  
  if (positiveCount > negativeCount) return "positive";
  if (negativeCount > positiveCount) return "negative";
  return "neutral";
}

async function fetchFeedlyStream(streamId: string): Promise<FeedlyEntry[]> {
  if (!FEEDLY_ACCESS_TOKEN) {
    throw new Error("FEEDLY_ACCESS_TOKEN not configured");
  }
  
  const url = new URL(`${FEEDLY_API_BASE}/streams/contents`);
  url.searchParams.set("streamId", streamId);
  url.searchParams.set("count", "50");
  url.searchParams.set("ranked", "newest");
  
  const response = await fetch(url.toString(), {
    headers: {
      "Authorization": `Bearer ${FEEDLY_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
  
  if (!response.ok) {
    throw new Error(`Feedly API error: ${response.status} ${response.statusText}`);
  }
  
  const data: FeedlyStreamResponse = await response.json();
  return data.items || [];
}

export async function runFeedlyIngestion(): Promise<{
  sourcesProcessed: number;
  itemsFound: number;
  itemsCreated: number;
  errors: string[];
}> {
  console.log("[Feedly Ingestion] Starting Feedly ingestion run...");
  
  if (!FEEDLY_ACCESS_TOKEN) {
    console.log("[Feedly Ingestion] FEEDLY_ACCESS_TOKEN not configured, skipping");
    return { sourcesProcessed: 0, itemsFound: 0, itemsCreated: 0, errors: ["FEEDLY_ACCESS_TOKEN not configured"] };
  }
  
  // Ensure token is valid (refresh if needed)
  const tokenValid = await ensureValidToken();
  if (!tokenValid) {
    console.log("[Feedly Ingestion] Failed to validate/refresh access token");
    return { sourcesProcessed: 0, itemsFound: 0, itemsCreated: 0, errors: ["Failed to validate access token"] };
  }
  
  const sources = await storage.getAllSources();
  const feedlySources = sources.filter(
    (s) => s.sourceType === "feedly" && s.isActive && s.url
  );
  
  console.log(`[Feedly Ingestion] Found ${feedlySources.length} active Feedly sources`);
  
  let totalFound = 0;
  let totalCreated = 0;
  const errors: string[] = [];
  
  for (const source of feedlySources) {
    try {
      const result = await ingestFeedlySource(source);
      totalFound += result.itemsFound;
      totalCreated += result.itemsCreated;
      
      await storage.updateSource(source.id, {
        lastIngestedAt: new Date(),
      });
      
      console.log(`[Feedly Ingestion] Source "${source.name}": ${result.itemsFound} found, ${result.itemsCreated} created`);
    } catch (error) {
      const errMsg = `Error processing source "${source.name}": ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[Feedly Ingestion] ${errMsg}`);
      errors.push(errMsg);
    }
  }
  
  const ingestionRun: InsertIngestionRun = {
    sourceType: "feedly",
    completedAt: new Date(),
    itemsFound: totalFound,
    itemsCreated: totalCreated,
    errors: errors.length > 0 ? errors : null,
  };
  
  await storage.createIngestionRun(ingestionRun);
  
  console.log(`[Feedly Ingestion] Complete: ${feedlySources.length} sources, ${totalFound} items found, ${totalCreated} created`);
  
  return {
    sourcesProcessed: feedlySources.length,
    itemsFound: totalFound,
    itemsCreated: totalCreated,
    errors,
  };
}

async function ingestFeedlySource(source: Source): Promise<{
  itemsFound: number;
  itemsCreated: number;
}> {
  if (!source.url) {
    throw new Error("Source has no stream ID configured in URL field");
  }
  
  const streamId = source.url;
  const entries = await fetchFeedlyStream(streamId);
  
  let itemsCreated = 0;
  
  for (const entry of entries) {
    if (!entry.title) {
      continue;
    }
    
    const link = entry.alternate?.[0]?.href || entry.originId;
    if (!link) {
      continue;
    }
    
    const pubTimestamp = entry.published || entry.crawled;
    if (!pubTimestamp) {
      continue;
    }
    
    const publishedAt = new Date(pubTimestamp);
    if (isNaN(publishedAt.getTime())) {
      continue;
    }
    
    const canonicalUrl = normalizeCanonicalUrl(link);
    
    const existingByUrl = await storage.getSignalByCanonicalUrl(canonicalUrl);
    if (existingByUrl) {
      continue;
    }
    
    const titleDomainHash = generateStableHash(
      0,
      canonicalUrl,
      null,
      entry.title,
      publishedAt,
      publishedAt
    );
    
    const existingByHash = await storage.getSignalByHash(titleDomainHash);
    if (existingByHash) {
      continue;
    }
    
    const domain = getHostFromUrl(canonicalUrl);
    const candidates = await storage.getRecentSignalsForDedupe(domain);
    const dupeResult = checkNearDuplicate(entry.title, canonicalUrl, candidates);
    if (dupeResult.isNearDuplicate) {
      continue;
    }
    
    const contentText = entry.summary?.content || entry.content?.content || "";
    const signalType = inferSignalType(entry.title, contentText);
    const sentiment = inferSentiment(entry.title, contentText);
    
    const signal: InsertSignal = {
      companyId: null,
      type: signalType,
      title: entry.title,
      content: contentText || null,
      summary: contentText.slice(0, 300) || `News from ${source.name}`,
      sourceUrl: link,
      sourceName: entry.origin?.title || source.name,
      publishedAt,
      sentiment,
      priority: "medium",
      hash: titleDomainHash,
      ingestionSourceType: "feedly",
      verificationStatus: "verified",
      verificationMethod: "feedly",
      dateSource: "feedly",
      dateConfidence: 95,
      sourceId: source.id,
      providerName: "feedly",
      providerItemId: entry.id,
      canonicalUrl,
    };
    
    await storage.createSignal(signal);
    itemsCreated++;
  }
  
  return {
    itemsFound: entries.length,
    itemsCreated,
  };
}

export async function ingestSingleFeedlySource(sourceId: number): Promise<{
  itemsFound: number;
  itemsCreated: number;
}> {
  const source = await storage.getSource(sourceId);
  if (!source) {
    throw new Error(`Source ${sourceId} not found`);
  }
  
  if (source.sourceType !== "feedly") {
    throw new Error(`Source ${sourceId} is not a Feedly source`);
  }
  
  return ingestFeedlySource(source);
}

// ============================================================================
// Feedly API Functions for UI Management
// ============================================================================

export interface FeedlyCollection {
  id: string;
  label: string;
  description?: string;
  numFeeds?: number;
}

export interface FeedlySubscription {
  id: string;
  title: string;
  website?: string;
  subscribers?: number;
  updated?: number;
  categories?: Array<{ id: string; label: string }>;
}

export async function getFeedlyStatus(): Promise<{
  connected: boolean;
  hasRefreshToken: boolean;
  error?: string;
}> {
  if (!FEEDLY_ACCESS_TOKEN) {
    return { connected: false, hasRefreshToken: !!FEEDLY_REFRESH_TOKEN };
  }
  
  try {
    const response = await fetch(`${FEEDLY_API_BASE}/profile`, {
      headers: {
        "Authorization": `Bearer ${FEEDLY_ACCESS_TOKEN}`,
      },
    });
    
    if (!response.ok) {
      if (response.status === 401 && FEEDLY_REFRESH_TOKEN) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return { connected: true, hasRefreshToken: true };
        }
      }
      return { connected: false, hasRefreshToken: !!FEEDLY_REFRESH_TOKEN, error: `API error: ${response.status}` };
    }
    
    return { connected: true, hasRefreshToken: !!FEEDLY_REFRESH_TOKEN };
  } catch (error) {
    return { connected: false, hasRefreshToken: !!FEEDLY_REFRESH_TOKEN, error: String(error) };
  }
}

export async function getFeedlyCollections(): Promise<FeedlyCollection[]> {
  if (!FEEDLY_ACCESS_TOKEN) {
    throw new Error("FEEDLY_ACCESS_TOKEN not configured");
  }
  
  const tokenValid = await ensureValidToken();
  if (!tokenValid) {
    throw new Error("Feedly token is invalid or expired. Please update your credentials.");
  }
  
  const response = await fetch(`${FEEDLY_API_BASE}/collections`, {
    headers: {
      "Authorization": `Bearer ${FEEDLY_ACCESS_TOKEN}`,
    },
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Feedly authentication failed. Please refresh your credentials.");
    }
    throw new Error(`Feedly API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.map((c: any) => ({
    id: c.id,
    label: c.label,
    description: c.description,
    numFeeds: c.feeds?.length || 0,
  }));
}

export async function getFeedlySubscriptions(): Promise<FeedlySubscription[]> {
  if (!FEEDLY_ACCESS_TOKEN) {
    throw new Error("FEEDLY_ACCESS_TOKEN not configured");
  }
  
  const tokenValid = await ensureValidToken();
  if (!tokenValid) {
    throw new Error("Feedly token is invalid or expired. Please update your credentials.");
  }
  
  const response = await fetch(`${FEEDLY_API_BASE}/subscriptions`, {
    headers: {
      "Authorization": `Bearer ${FEEDLY_ACCESS_TOKEN}`,
    },
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Feedly authentication failed. Please refresh your credentials.");
    }
    throw new Error(`Feedly API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.map((s: any) => ({
    id: s.id,
    title: s.title,
    website: s.website,
    subscribers: s.subscribers,
    updated: s.updated,
    categories: s.categories,
  }));
}
