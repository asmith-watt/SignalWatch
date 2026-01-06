import type { Company, InsertSignal } from "@shared/schema";
import { storage } from "./storage";
import { enrichSignal } from "./ai-analysis";
import { startMonitoring, updateProgress, finishMonitoring, shouldStop } from "./monitor-progress";
import { 
  generateStableHash, 
  checkNearDuplicate, 
  computeNoveltyScore 
} from "./dedupe";
import { computePriorityScore, getRecommendedFormat } from "./priority-scoring";

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

interface PerplexityResponse {
  id: string;
  model: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  citations?: string[];
}

interface ExtractedSignal {
  title: string;
  summary: string;
  type: string;
  sourceUrl: string | null;
  sourceName: string | null;
  citations: string[] | null;
  sentiment: "positive" | "negative" | "neutral";
  priority: "high" | "medium" | "low";
  publishedAt?: string;
}

const DEFAULT_MAX_SIGNAL_AGE_DAYS = 7;

function getMaxSignalAgeDays(): number {
  const envValue = process.env.MAX_SIGNAL_AGE_DAYS;
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_MAX_SIGNAL_AGE_DAYS;
}

// Legacy hash function - kept for reference, replaced by generateStableHash from dedupe.ts
function generateLegacyHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export async function searchCompanyNews(company: Company): Promise<ExtractedSignal[]> {
  if (!PERPLEXITY_API_KEY) {
    console.error("PERPLEXITY_API_KEY not configured");
    return [];
  }

  const query = `Find the latest business news about ${company.name} from the past 7 days. Focus on:
- Funding announcements or financial news
- Executive changes or leadership updates  
- Product launches or new offerings
- Partnerships or acquisitions
- Industry developments affecting them
- Regulatory or compliance news

For each news item found, provide:
1. A clear headline/title
2. A 2-3 sentence summary
3. The type (funding, executive_change, product_launch, partnership, news, press_release)
4. Whether sentiment is positive, negative, or neutral
5. Priority level (high for major announcements, medium for notable news, low for minor updates)
6. The publication date - READ IT DIRECTLY FROM THE ARTICLE PAGE (look for date bylines like "10 December 2025" or "Dec 10, 2025")

EXTREMELY IMPORTANT - DATE EXTRACTION:
- Look at the actual article page and find the date shown near the headline/byline
- The date is usually displayed near the author name or at the top of the article
- Convert whatever format you see to ISO format: YYYY-MM-DD
- If the article shows "10 December 2025", return "2025-12-10"
- If you cannot visually locate a publication date on the article, set publishedAt to null
- NEVER make up dates - if uncertain, use null
- Do not confuse dates mentioned IN the article content with the article's publication date

Return as JSON array: [{"title": "...", "summary": "...", "type": "...", "sentiment": "...", "priority": "...", "publishedAt": "YYYY-MM-DD or null"}]
If no recent news found, return empty array: []`;

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: "You are a business intelligence analyst. Return only valid JSON arrays. No markdown, no explanation text. CRITICAL: For publishedAt dates, you MUST extract the exact date shown on the article page (near the byline/headline). Never estimate or guess dates - use null if you cannot find the exact publication date on the source page."
          },
          {
            role: "user",
            content: query
          }
        ],
        temperature: 0.2,
        return_citations: true,
      }),
    });

    if (!response.ok) {
      console.error(`Perplexity API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data: PerplexityResponse = await response.json();
    const content = data.choices[0]?.message?.content || "[]";
    const citations = data.citations || [];
    
    let jsonContent = content.trim();
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

    let signals: ExtractedSignal[] = [];
    try {
      const parsed = JSON.parse(jsonContent);
      const rawSignals = Array.isArray(parsed) ? parsed : [];
      signals = rawSignals.map((s: any) => ({
        ...s,
        publishedAt: s.publishedAt || s.published_at || s.publishedDate || s.date || null,
      }));
    } catch (e) {
      console.error(`Failed to parse Perplexity response for ${company.name}:`, content);
      return [];
    }

    const now = new Date();
    const maxAgeDays = getMaxSignalAgeDays();
    const cutoffDate = new Date(now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000);

    const filteredSignals = signals.filter((s) => {
      if (!s.publishedAt) {
        console.log(`  Warning: Signal without date (will include anyway): ${s.title}`);
        return true;
      }
      
      const publishedDate = new Date(s.publishedAt);
      if (isNaN(publishedDate.getTime())) {
        console.log(`  Warning: Signal with invalid date "${s.publishedAt}" (will include anyway): ${s.title}`);
        return true;
      }
      
      if (publishedDate > now) {
        console.log(`  Fixing future date (${s.publishedAt} -> today): ${s.title}`);
        s.publishedAt = now.toISOString().split('T')[0];
      }
      
      if (publishedDate < cutoffDate) {
        console.log(`  Skipping old signal (${s.publishedAt}): ${s.title}`);
        return false;
      }
      
      return true;
    });

    if (filteredSignals.length < signals.length) {
      console.log(`  Filtered out ${signals.length - filteredSignals.length} old signals for ${company.name}`);
    }

    return filteredSignals.map((s) => {
      let sourceUrl: string | null = null;
      let sourceName = "Perplexity AI";
      
      if (citations.length > 0 && citations[0]) {
        try {
          let url = citations[0];
          if (url.startsWith("//")) {
            url = "https:" + url;
          } else if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "https://" + url;
          }
          sourceUrl = url;
          sourceName = new URL(url).hostname.replace("www.", "");
        } catch {
          sourceUrl = citations[0].startsWith("//") ? "https:" + citations[0] : 
                      (!citations[0].startsWith("http") ? "https://" + citations[0] : citations[0]);
        }
      }
      
      return {
        ...s,
        sourceUrl,
        sourceName,
        citations: citations.length > 0 ? citations.map(c => 
          c.startsWith("//") ? "https:" + c : 
          (!c.startsWith("http") ? "https://" + c : c)
        ) : [],
      };
    });
  } catch (error) {
    console.error(`Error fetching news for ${company.name}:`, error);
    return [];
  }
}

export interface MonitorResult {
  signalsCreated: number;
  signalsFound: number;
  duplicatesSkipped: number;
  nearDuplicatesSkipped: number;
}

export interface CompanyMonitorResult extends MonitorResult {
  company: string;
}

export async function monitorCompany(company: Company): Promise<MonitorResult> {
  console.log(`Monitoring ${company.name}...`);
  const signals = await searchCompanyNews(company);
  
  let createdCount = 0;
  let duplicatesSkipped = 0;
  let nearDuplicatesSkipped = 0;
  
  // Fetch recent signals for near-duplicate detection
  const recentSignals = await storage.getRecentSignalsForCompany(company.id, 14, 200);
  const candidatesForNearDupe = recentSignals.map(s => ({
    id: s.id,
    title: s.title,
    sourceUrl: s.sourceUrl,
  }));
  
  for (const signal of signals) {
    const gatheredAt = new Date();
    const publishedAt = signal.publishedAt ? new Date(signal.publishedAt) : null;
    
    // Generate new sha256-based stable hash
    const hash = generateStableHash(
      company.id,
      signal.sourceUrl,
      signal.citations,
      signal.title,
      publishedAt,
      gatheredAt
    );
    
    // Check for exact duplicate by hash
    const existing = await storage.getSignalByHash(hash);
    if (existing) {
      console.log(`  Skipping exact duplicate: ${signal.title}`);
      duplicatesSkipped++;
      continue;
    }

    // Check for near-duplicate using Jaccard similarity
    const nearDupeCheck = checkNearDuplicate(
      signal.title,
      signal.sourceUrl,
      candidatesForNearDupe
    );
    
    if (nearDupeCheck.isNearDuplicate) {
      console.log(`  Skipping near-duplicate (jaccard=${nearDupeCheck.similarity?.toFixed(2)}): ${signal.title} matches signal #${nearDupeCheck.matchedSignalId}`);
      nearDuplicatesSkipped++;
      continue;
    }

    // Compute novelty score based on similarity to recent signals
    const noveltyScore = computeNoveltyScore(signal.title, recentSignals.map(s => ({ title: s.title })));

    const signalData: InsertSignal = {
      companyId: company.id,
      type: signal.type,
      title: signal.title,
      summary: signal.summary,
      sourceUrl: signal.sourceUrl,
      sourceName: signal.sourceName,
      citations: signal.citations || [],
      publishedAt: publishedAt,
      sentiment: signal.sentiment,
      priority: signal.priority,
      isRead: false,
      isBookmarked: false,
      contentStatus: "new",
      hash,
    };

    const createdSignal = await storage.createSignal(signalData);
    console.log(`  Created signal: ${signal.title} (novelty: ${noveltyScore})`);
    
    // Add the new signal to candidates for subsequent near-dupe checks in this batch
    candidatesForNearDupe.push({
      id: createdSignal.id,
      title: signal.title,
      sourceUrl: signal.sourceUrl,
    });
    
    // Auto-enrich new signals with AI analysis
    try {
      const enrichment = await enrichSignal({
        title: signal.title,
        summary: signal.summary,
        type: signal.type,
        companyName: company.name,
        industry: company.industry || undefined,
      });
      
      // Compute deterministic priority score
      const priorityResult = computePriorityScore({
        type: signal.type,
        sentiment: signal.sentiment,
        citationsCount: signal.citations?.length || 0,
        relevanceScore: enrichment.aiAnalysis.relevanceScore,
        noveltyScore,
      });
      
      // Get recommended editorial format
      const formatRec = getRecommendedFormat(
        priorityResult.label,
        signal.type,
        signal.sentiment,
        enrichment.aiAnalysis.relevanceScore,
        noveltyScore
      );
      
      // Add novelty, priority, and format metadata to aiAnalysis
      const enrichedAiAnalysis = {
        ...enrichment.aiAnalysis,
        noveltyScore,
        dedupe: { method: "none" as const, comparedLookbackDays: 14 },
        priorityScore: priorityResult.score,
        priorityReason: priorityResult.reason,
        recommendedFormat: formatRec.format,
        recommendedReason: formatRec.reason,
      };
      
      await storage.updateSignal(createdSignal.id, {
        entities: enrichment.entities,
        aiAnalysis: enrichedAiAnalysis,
        priority: priorityResult.label,
      });
      console.log(`  Enriched signal (priority: ${priorityResult.label}/${priorityResult.score}, format: ${formatRec.format})`);
    } catch (enrichError) {
      console.error(`  Failed to enrich signal:`, enrichError);
      
      // Still compute priority without AI relevance score
      const priorityResult = computePriorityScore({
        type: signal.type,
        sentiment: signal.sentiment,
        citationsCount: signal.citations?.length || 0,
        noveltyScore,
      });
      
      const formatRec = getRecommendedFormat(
        priorityResult.label,
        signal.type,
        signal.sentiment,
        undefined,
        noveltyScore
      );
      
      await storage.updateSignal(createdSignal.id, {
        aiAnalysis: { 
          noveltyScore, 
          dedupe: { method: "none", comparedLookbackDays: 14 },
          priorityScore: priorityResult.score,
          priorityReason: priorityResult.reason,
          recommendedFormat: formatRec.format,
          recommendedReason: formatRec.reason,
        },
        priority: priorityResult.label,
      });
    }
    
    createdCount++;
  }

  return {
    signalsCreated: createdCount,
    signalsFound: signals.length,
    duplicatesSkipped,
    nearDuplicatesSkipped,
  };
}

export async function monitorPoultryCompanies(): Promise<{ company: string; signalsCreated: number }[]> {
  const companies = await storage.getAllCompanies();
  const poultryCompanies = companies.filter(c => 
    c.industry === "Poultry" || 
    c.tags?.some(t => t.toLowerCase().includes("poultry"))
  );

  console.log(`Found ${poultryCompanies.length} poultry companies to monitor`);
  
  const results: { company: string; signalsCreated: number }[] = [];
  
  for (const company of poultryCompanies) {
    const result = await monitorCompany(company);
    results.push({ company: company.name, signalsCreated: result.signalsCreated });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}

export async function monitorUSPoultryCompanies(): Promise<{ company: string; signalsCreated: number }[]> {
  const companies = await storage.getAllCompanies();
  const usPoultryCompanies = companies.filter(c => 
    (c.country === "United States" || c.location?.includes("United States") || c.location?.match(/,\s*[A-Z]{2}$/)) &&
    (c.industry === "Poultry" || c.tags?.some(t => t.toLowerCase().includes("poultry") || t.toLowerCase().includes("eggs") || t.toLowerCase().includes("chicken") || t.toLowerCase().includes("turkey")))
  );

  console.log(`Found ${usPoultryCompanies.length} US poultry companies to monitor`);
  
  const results: { company: string; signalsCreated: number }[] = [];
  
  for (const company of usPoultryCompanies) {
    const result = await monitorCompany(company);
    results.push({ company: company.name, signalsCreated: result.signalsCreated });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}

export async function monitorCompaniesByCountry(country: string): Promise<{ company: string; signalsCreated: number }[]> {
  const companies = await storage.getAllCompanies();
  const filteredCompanies = companies.filter(c => c.country === country && c.isActive);

  console.log(`Found ${filteredCompanies.length} ${country} companies to monitor`);
  
  const results: { company: string; signalsCreated: number }[] = [];
  
  for (const company of filteredCompanies) {
    const result = await monitorCompany(company);
    results.push({ company: company.name, signalsCreated: result.signalsCreated });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}

export async function monitorAllCompanies(): Promise<CompanyMonitorResult[]> {
  const companies = await storage.getAllCompanies();
  const targetIndustries = ["Poultry", "Feed", "Pet Food", "Baking & Milling"];
  const targetCompanies = companies.filter(c => c.industry && targetIndustries.includes(c.industry));

  console.log(`Monitoring all ${targetCompanies.length} companies across ${targetIndustries.join(", ")} industries...`);
  
  startMonitoring(targetCompanies.length, 'all');
  
  const results: CompanyMonitorResult[] = [];
  let totalSignalsCreated = 0;
  
  try {
    for (const company of targetCompanies) {
      if (shouldStop()) {
        console.log("Monitoring stopped by user request");
        break;
      }
      console.log(`[${results.length + 1}/${targetCompanies.length}] Monitoring ${company.name} (${company.industry})...`);
      updateProgress(results.length + 1, company.name, totalSignalsCreated);
      const result = await monitorCompany(company);
      totalSignalsCreated += result.signalsCreated;
      results.push({ 
        company: company.name, 
        signalsCreated: result.signalsCreated,
        signalsFound: result.signalsFound,
        duplicatesSkipped: result.duplicatesSkipped,
        nearDuplicatesSkipped: result.nearDuplicatesSkipped,
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } finally {
    finishMonitoring();
  }

  console.log(`Monitoring complete! Processed ${results.length} companies.`);
  return results;
}

const industryGroups: Record<string, string[]> = {
  Poultry: ["Poultry", "Chicken", "Turkey", "Egg", "Duck", "Broiler", "Layer", "Hatchery"],
  Feed: ["Feed", "Nutrition", "Premix", "Compound"],
  "Pet Food": ["Pet Food", "Pet", "Dog Food", "Cat Food"],
};

function matchesIndustryGroup(companyIndustry: string | null, groupName: string): boolean {
  if (!companyIndustry) return false;
  const groupKeywords = industryGroups[groupName] || [groupName];
  return groupKeywords.some(keyword => 
    companyIndustry.toLowerCase().includes(keyword.toLowerCase())
  );
}

interface CompanyEnrichment {
  description: string | null;
  website: string | null;
  location: string | null;
  region: string | null;
  country: string | null;
  size: string | null;
  founded: string | null;
  linkedinUrl: string | null;
  twitterHandle: string | null;
}

export async function enrichCompanyData(company: Company): Promise<CompanyEnrichment | null> {
  if (!PERPLEXITY_API_KEY) {
    console.error("PERPLEXITY_API_KEY not configured");
    return null;
  }

  const query = `Find business information about the company "${company.name}" in the ${company.industry || "agriculture/food"} industry.

Provide the following details if available:
1. A brief description (1-2 sentences about what they do)
2. Official website URL
3. Headquarters location (city, state/country)
4. Geographic region (North America, Europe, Asia, South America, Africa, Oceania, Middle East)
5. Country
6. Company size (e.g., "1-50", "51-200", "201-500", "501-1000", "1000+", "10000+")
7. Year founded
8. LinkedIn company page URL
9. Twitter/X handle

Return as JSON object:
{
  "description": "Brief company description",
  "website": "https://...",
  "location": "City, State/Country",
  "region": "North America",
  "country": "United States",
  "size": "1000+",
  "founded": "1995",
  "linkedinUrl": "https://linkedin.com/company/...",
  "twitterHandle": "@handle"
}

For any field you cannot find reliable information for, use null.`;

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: "You are a business research assistant. Return only valid JSON with company information. Use null for any field you cannot verify.",
          },
          {
            role: "user",
            content: query,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error(`Perplexity API error: ${response.status}`);
      return null;
    }

    const data: PerplexityResponse = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return null;
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Could not parse company enrichment JSON");
      return null;
    }

    const enrichment = JSON.parse(jsonMatch[0]) as CompanyEnrichment;
    return enrichment;
  } catch (error) {
    console.error(`Error enriching company ${company.name}:`, error);
    return null;
  }
}

export async function enrichCompanies(companyIds?: number[]): Promise<{ company: string; updated: boolean; error?: string }[]> {
  const allCompanies = await storage.getAllCompanies();
  const companies = companyIds 
    ? allCompanies.filter(c => companyIds.includes(c.id))
    : allCompanies.filter(c => !c.description || !c.website);

  console.log(`Enriching ${companies.length} companies...`);
  
  const results: { company: string; updated: boolean; error?: string }[] = [];
  
  for (const company of companies) {
    console.log(`[${results.length + 1}/${companies.length}] Enriching ${company.name}...`);
    
    try {
      const enrichment = await enrichCompanyData(company);
      
      if (enrichment) {
        const updates: Partial<Company> = {};
        
        if (enrichment.description && !company.description) {
          updates.description = enrichment.description;
        }
        if (enrichment.website && !company.website) {
          updates.website = enrichment.website;
        }
        if (enrichment.location && !company.location) {
          updates.location = enrichment.location;
        }
        if (enrichment.region && !company.region) {
          updates.region = enrichment.region;
        }
        if (enrichment.country && !company.country) {
          updates.country = enrichment.country;
        }
        if (enrichment.size && !company.size) {
          updates.size = enrichment.size;
        }
        if (enrichment.founded && !company.founded) {
          updates.founded = enrichment.founded;
        }
        if (enrichment.linkedinUrl && !company.linkedinUrl) {
          updates.linkedinUrl = enrichment.linkedinUrl;
        }
        if (enrichment.twitterHandle && !company.twitterHandle) {
          updates.twitterHandle = enrichment.twitterHandle;
        }
        
        if (Object.keys(updates).length > 0) {
          await storage.updateCompany(company.id, updates);
          console.log(`  Updated ${Object.keys(updates).length} fields for ${company.name}`);
          results.push({ company: company.name, updated: true });
        } else {
          console.log(`  No new data found for ${company.name}`);
          results.push({ company: company.name, updated: false });
        }
      } else {
        results.push({ company: company.name, updated: false, error: "No enrichment data returned" });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`  Error enriching ${company.name}: ${errorMsg}`);
      results.push({ company: company.name, updated: false, error: errorMsg });
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const updatedCount = results.filter(r => r.updated).length;
  console.log(`Enrichment complete! Updated ${updatedCount}/${companies.length} companies.`);
  return results;
}

export async function monitorCompaniesByIndustry(industry: string): Promise<{ company: string; signalsCreated: number }[]> {
  const companies = await storage.getAllCompanies();
  const industryCompanies = companies.filter(c => matchesIndustryGroup(c.industry, industry));

  console.log(`Monitoring ${industryCompanies.length} ${industry} companies...`);
  
  if (industryCompanies.length === 0) {
    console.log(`No companies found for industry group: ${industry}`);
    return [];
  }
  
  startMonitoring(industryCompanies.length, 'industry', industry);
  
  const results: { company: string; signalsCreated: number }[] = [];
  let totalSignalsFound = 0;
  
  try {
    for (const company of industryCompanies) {
      if (shouldStop()) {
        console.log("Monitoring stopped by user request");
        break;
      }
      console.log(`[${results.length + 1}/${industryCompanies.length}] Monitoring ${company.name}...`);
      updateProgress(results.length + 1, company.name, totalSignalsFound);
      const result = await monitorCompany(company);
      totalSignalsFound += result.signalsCreated;
      results.push({ company: company.name, signalsCreated: result.signalsCreated });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } finally {
    finishMonitoring();
  }

  console.log(`${industry} monitoring complete! Processed ${results.length} companies.`);
  return results;
}
