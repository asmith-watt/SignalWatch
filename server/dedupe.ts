import { createHash } from "crypto";
import type { Signal } from "@shared/schema";

const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gclid", "fbclid", "mc_cid", "mc_eid", "ref", "source"
]);

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "for", "on", "with",
  "from", "by", "at", "as", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "must", "shall", "can", "need",
  "this", "that", "these", "those", "it", "its"
]);

const BOILERPLATE_TOKENS = new Set([
  "inc", "llc", "ltd", "co", "corp", "corporation", "company",
  "reports", "announces", "launches", "unveils", "releases",
  "group", "holdings", "enterprises"
]);

export function canonicalizeUrl(url: string): string {
  if (!url) return "";
  
  let normalized = url.trim().toLowerCase();
  
  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    if (normalized.startsWith("//")) {
      normalized = "https:" + normalized;
    } else {
      normalized = "https://" + normalized;
    }
  }
  
  try {
    const parsed = new URL(normalized);
    
    const params = new URLSearchParams(parsed.search);
    for (const key of Array.from(params.keys())) {
      if (TRACKING_PARAMS.has(key) || key.startsWith("utm_")) {
        params.delete(key);
      }
    }
    
    let host = parsed.hostname.replace(/^www\./, "");
    let path = parsed.pathname.replace(/\/$/, "");
    const queryString = params.toString();
    
    return `${host}${path}${queryString ? "?" + queryString : ""}`;
  } catch {
    return normalized
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/$/, "");
  }
}

export function normalizeTitle(title: string): string {
  if (!title) return "";
  
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s-]/g, "")
    .split(/\s+/)
    .filter(token => !BOILERPLATE_TOKENS.has(token))
    .join(" ");
}

export function tokenizeForJaccard(text: string): Set<string> {
  if (!text) return new Set();
  
  const normalized = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ");
  
  const tokens = normalized.split(" ").filter(token => 
    token.length > 1 && 
    !STOPWORDS.has(token) && 
    !BOILERPLATE_TOKENS.has(token)
  );
  
  return new Set(tokens);
}

export function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 && set2.size === 0) return 1;
  if (set1.size === 0 || set2.size === 0) return 0;
  
  let intersectionSize = 0;
  const arr1 = Array.from(set1);
  for (let i = 0; i < arr1.length; i++) {
    if (set2.has(arr1[i])) intersectionSize++;
  }
  
  const unionSize = set1.size + set2.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

export function generateStableHash(
  companyId: number,
  sourceUrl: string | null,
  citations: string[] | null,
  title: string,
  publishedAt: Date | null,
  gatheredAt: Date
): string {
  let urlPart = "";
  
  if (sourceUrl) {
    urlPart = canonicalizeUrl(sourceUrl);
  } else if (citations && citations.length > 0 && citations[0]) {
    urlPart = canonicalizeUrl(citations[0]);
  }
  
  let fingerprintBase: string;
  
  if (urlPart) {
    const publishedDay = publishedAt 
      ? publishedAt.toISOString().split("T")[0]
      : gatheredAt.toISOString().split("T")[0];
    fingerprintBase = `${companyId}|${urlPart}|${publishedDay}`;
  } else {
    const normalizedTitle = normalizeTitle(title);
    const publishedDay = publishedAt 
      ? publishedAt.toISOString().split("T")[0]
      : gatheredAt.toISOString().split("T")[0];
    fingerprintBase = `${companyId}|${normalizedTitle}|${publishedDay}`;
  }
  
  return createHash("sha256").update(fingerprintBase).digest("hex");
}

export function getHostFromUrl(url: string): string {
  if (!url) return "";
  try {
    let normalized = url.trim().toLowerCase();
    if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
      normalized = "https://" + normalized;
    }
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export interface NearDupeCheckResult {
  isNearDuplicate: boolean;
  matchedSignalId?: number;
  similarity?: number;
  method?: "exact_hash" | "near_jaccard" | "none";
}

export function checkNearDuplicate(
  newTitle: string,
  newSourceUrl: string | null,
  candidates: Array<{
    id: number;
    title: string;
    sourceUrl: string | null;
  }>
): NearDupeCheckResult {
  const newTitleNormalized = normalizeTitle(newTitle);
  const newTitleTokens = tokenizeForJaccard(newTitle);
  const newHost = newSourceUrl ? getHostFromUrl(newSourceUrl) : "";
  
  for (const candidate of candidates) {
    const candidateTitleNormalized = normalizeTitle(candidate.title);
    const candidateTitleTokens = tokenizeForJaccard(candidate.title);
    const candidateHost = candidate.sourceUrl ? getHostFromUrl(candidate.sourceUrl) : "";
    
    if (newTitleNormalized === candidateTitleNormalized && newTitleNormalized !== "") {
      return {
        isNearDuplicate: true,
        matchedSignalId: candidate.id,
        similarity: 1.0,
        method: "near_jaccard"
      };
    }
    
    const similarity = jaccardSimilarity(newTitleTokens, candidateTitleTokens);
    
    if (similarity >= 0.85) {
      return {
        isNearDuplicate: true,
        matchedSignalId: candidate.id,
        similarity,
        method: "near_jaccard"
      };
    }
    
    if (newHost && candidateHost && newHost === candidateHost && similarity >= 0.75) {
      return {
        isNearDuplicate: true,
        matchedSignalId: candidate.id,
        similarity,
        method: "near_jaccard"
      };
    }
  }
  
  return { isNearDuplicate: false, method: "none" };
}

export function computeNoveltyScore(
  newTitle: string,
  candidates: Array<{ title: string }>
): number {
  if (candidates.length === 0) return 100;
  
  const newTitleTokens = tokenizeForJaccard(newTitle);
  let maxSimilarity = 0;
  
  for (const candidate of candidates) {
    const candidateTokens = tokenizeForJaccard(candidate.title);
    const similarity = jaccardSimilarity(newTitleTokens, candidateTokens);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
    }
  }
  
  const noveltyScore = Math.round((1 - maxSimilarity) * 100);
  return Math.max(0, Math.min(100, noveltyScore));
}
