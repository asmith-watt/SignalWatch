import type { Company, InsertSignal } from "@shared/schema";
import { storage } from "./storage";
import { enrichSignal } from "./ai-analysis";

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
}

function generateHash(content: string): string {
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

Return as JSON array: [{"title": "...", "summary": "...", "type": "...", "sentiment": "...", "priority": "..."}]
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
            content: "You are a business intelligence analyst. Return only valid JSON arrays. No markdown, no explanation text."
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
      signals = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error(`Failed to parse Perplexity response for ${company.name}:`, content);
      return [];
    }

    return signals.map((s) => {
      let sourceUrl: string | null = null;
      let sourceName = "Perplexity AI";
      
      if (citations.length > 0 && citations[0]) {
        try {
          sourceUrl = citations[0];
          sourceName = new URL(citations[0]).hostname.replace("www.", "");
        } catch {
          sourceUrl = citations[0];
        }
      }
      
      return {
        ...s,
        sourceUrl,
        sourceName,
        citations: citations.length > 0 ? citations : [],
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
}

export async function monitorCompany(company: Company): Promise<MonitorResult> {
  console.log(`Monitoring ${company.name}...`);
  const signals = await searchCompanyNews(company);
  
  let createdCount = 0;
  let duplicatesSkipped = 0;
  
  for (const signal of signals) {
    const hash = generateHash(signal.title + company.name);
    
    const existing = await storage.getSignalByHash(hash);
    if (existing) {
      console.log(`  Skipping duplicate: ${signal.title}`);
      duplicatesSkipped++;
      continue;
    }

    const signalData: InsertSignal = {
      companyId: company.id,
      type: signal.type,
      title: signal.title,
      summary: signal.summary,
      sourceUrl: signal.sourceUrl,
      sourceName: signal.sourceName,
      citations: signal.citations || [],
      publishedAt: null,
      sentiment: signal.sentiment,
      priority: signal.priority,
      isRead: false,
      isBookmarked: false,
      contentStatus: "new",
      hash,
    };

    const createdSignal = await storage.createSignal(signalData);
    console.log(`  Created signal: ${signal.title}`);
    
    // Auto-enrich new signals with AI analysis
    try {
      const enrichment = await enrichSignal({
        title: signal.title,
        summary: signal.summary,
        type: signal.type,
        companyName: company.name,
        industry: company.industry || undefined,
      });
      
      await storage.updateSignal(createdSignal.id, {
        entities: enrichment.entities,
        aiAnalysis: enrichment.aiAnalysis,
      });
      console.log(`  Enriched signal with AI analysis (score: ${enrichment.aiAnalysis.relevanceScore})`);
    } catch (enrichError) {
      console.error(`  Failed to enrich signal:`, enrichError);
    }
    
    createdCount++;
  }

  return {
    signalsCreated: createdCount,
    signalsFound: signals.length,
    duplicatesSkipped,
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

export async function monitorAllCompanies(): Promise<{ company: string; signalsCreated: number }[]> {
  const companies = await storage.getAllCompanies();
  const targetIndustries = ["Poultry", "Feed", "Pet Food"];
  const targetCompanies = companies.filter(c => c.industry && targetIndustries.includes(c.industry));

  console.log(`Monitoring all ${targetCompanies.length} companies across Poultry, Feed, and Pet Food industries...`);
  
  const results: { company: string; signalsCreated: number }[] = [];
  
  for (const company of targetCompanies) {
    console.log(`[${results.length + 1}/${targetCompanies.length}] Monitoring ${company.name} (${company.industry})...`);
    const result = await monitorCompany(company);
    results.push({ company: company.name, signalsCreated: result.signalsCreated });
    await new Promise(resolve => setTimeout(resolve, 1000));
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
  
  const results: { company: string; signalsCreated: number }[] = [];
  
  for (const company of industryCompanies) {
    console.log(`[${results.length + 1}/${industryCompanies.length}] Monitoring ${company.name}...`);
    const result = await monitorCompany(company);
    results.push({ company: company.name, signalsCreated: result.signalsCreated });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`${industry} monitoring complete! Processed ${results.length} companies.`);
  return results;
}
