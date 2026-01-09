import Parser from "rss-parser";
import { storage } from "./storage";
import type { Source, InsertSignal, InsertIngestionRun } from "@shared/schema";
import { generateStableHash, checkNearDuplicate, getHostFromUrl } from "./dedupe";

const parser = new Parser({
  timeout: 30000,
  headers: {
    "User-Agent": "SignalWatch/1.0 (Business Intelligence Platform)",
  },
});

interface RSSItem {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  contentSnippet?: string;
  content?: string;
  guid?: string;
  creator?: string;
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

export async function runRSSIngestion(): Promise<{
  sourcesProcessed: number;
  itemsFound: number;
  itemsCreated: number;
  errors: string[];
}> {
  console.log("[RSS Ingestion] Starting RSS ingestion run...");
  
  const sources = await storage.getAllSources();
  const rssSources = sources.filter(
    (s) => s.sourceType === "rss" && s.isActive && s.url
  );
  
  console.log(`[RSS Ingestion] Found ${rssSources.length} active RSS sources`);
  
  let totalFound = 0;
  let totalCreated = 0;
  const errors: string[] = [];
  
  for (const source of rssSources) {
    try {
      const result = await ingestRSSSource(source);
      totalFound += result.itemsFound;
      totalCreated += result.itemsCreated;
      
      await storage.updateSource(source.id, {
        lastIngestedAt: new Date(),
      });
      
      console.log(`[RSS Ingestion] Source "${source.name}": ${result.itemsFound} found, ${result.itemsCreated} created`);
    } catch (error) {
      const errMsg = `Error processing source "${source.name}": ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[RSS Ingestion] ${errMsg}`);
      errors.push(errMsg);
    }
  }
  
  const ingestionRun: InsertIngestionRun = {
    sourceType: "rss",
    completedAt: new Date(),
    itemsFound: totalFound,
    itemsCreated: totalCreated,
    errors: errors.length > 0 ? errors : null,
  };
  
  await storage.createIngestionRun(ingestionRun);
  
  console.log(`[RSS Ingestion] Complete: ${rssSources.length} sources, ${totalFound} items found, ${totalCreated} created`);
  
  return {
    sourcesProcessed: rssSources.length,
    itemsFound: totalFound,
    itemsCreated: totalCreated,
    errors,
  };
}

async function ingestRSSSource(source: Source): Promise<{
  itemsFound: number;
  itemsCreated: number;
}> {
  if (!source.url) {
    throw new Error("Source has no URL configured");
  }
  
  const feed = await parser.parseURL(source.url);
  const items = feed.items || [];
  
  let itemsCreated = 0;
  
  for (const item of items) {
    if (!item.title || !item.link) {
      continue;
    }
    
    const pubDate = item.isoDate || item.pubDate;
    if (!pubDate) {
      continue;
    }
    
    const publishedAt = new Date(pubDate);
    if (isNaN(publishedAt.getTime())) {
      continue;
    }
    
    const canonicalUrl = normalizeCanonicalUrl(item.link);
    
    const existingByUrl = await storage.getSignalByCanonicalUrl(canonicalUrl);
    if (existingByUrl) {
      continue;
    }
    
    const titleDomainHash = generateStableHash(
      0,
      canonicalUrl,
      null,
      item.title,
      publishedAt,
      publishedAt
    );
    
    const existingByHash = await storage.getSignalByHash(titleDomainHash);
    if (existingByHash) {
      continue;
    }
    
    const domain = getHostFromUrl(canonicalUrl);
    const candidates = await storage.getRecentSignalsForDedupe(domain);
    const dupeResult = checkNearDuplicate(item.title, canonicalUrl, candidates);
    if (dupeResult.isNearDuplicate) {
      continue;
    }
    
    const signalType = inferSignalType(item.title, item.contentSnippet);
    const sentiment = inferSentiment(item.title, item.contentSnippet);
    
    const signal: InsertSignal = {
      companyId: null,
      type: signalType,
      title: item.title,
      content: item.content || null,
      summary: item.contentSnippet || `News from ${source.name}`,
      sourceUrl: item.link,
      sourceName: feed.title || source.name,
      publishedAt,
      sentiment,
      priority: "medium",
      hash: titleDomainHash,
      ingestionSourceType: "rss",
      verificationStatus: "verified",
      verificationMethod: "rss",
      dateSource: "rss",
      dateConfidence: 95,
      sourceId: source.id,
      providerName: "rss",
      providerItemId: item.guid || null,
      canonicalUrl,
    };
    
    await storage.createSignal(signal);
    itemsCreated++;
  }
  
  return {
    itemsFound: items.length,
    itemsCreated,
  };
}

export async function ingestSingleRSSSource(sourceId: number): Promise<{
  itemsFound: number;
  itemsCreated: number;
}> {
  const source = await storage.getSource(sourceId);
  if (!source) {
    throw new Error(`Source ${sourceId} not found`);
  }
  
  if (source.sourceType !== "rss") {
    throw new Error(`Source ${sourceId} is not an RSS source`);
  }
  
  return ingestRSSSource(source);
}
