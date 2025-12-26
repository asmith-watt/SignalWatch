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

    return signals.map((s, index) => ({
      ...s,
      sourceUrl: citations[index] || citations[0] || null,
      sourceName: citations[index] ? new URL(citations[index]).hostname.replace("www.", "") : "Perplexity AI",
    }));
  } catch (error) {
    console.error(`Error fetching news for ${company.name}:`, error);
    return [];
  }
}

export async function monitorCompany(company: Company): Promise<number> {
  console.log(`Monitoring ${company.name}...`);
  const signals = await searchCompanyNews(company);
  
  let createdCount = 0;
  for (const signal of signals) {
    const hash = generateHash(signal.title + company.name);
    
    const existing = await storage.getSignalByHash(hash);
    if (existing) {
      console.log(`  Skipping duplicate: ${signal.title}`);
      continue;
    }

    const signalData: InsertSignal = {
      companyId: company.id,
      type: signal.type,
      title: signal.title,
      summary: signal.summary,
      sourceUrl: signal.sourceUrl,
      sourceName: signal.sourceName,
      publishedAt: new Date(),
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

  return createdCount;
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
    const count = await monitorCompany(company);
    results.push({ company: company.name, signalsCreated: count });
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
    const count = await monitorCompany(company);
    results.push({ company: company.name, signalsCreated: count });
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
    const count = await monitorCompany(company);
    results.push({ company: company.name, signalsCreated: count });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}

export async function monitorAllCompanies(): Promise<{ company: string; signalsCreated: number }[]> {
  const companies = await storage.getAllCompanies();
  const poultryCompanies = companies.filter(c => c.industry === "Poultry");

  console.log(`Monitoring all ${poultryCompanies.length} poultry companies...`);
  
  const results: { company: string; signalsCreated: number }[] = [];
  
  for (const company of poultryCompanies) {
    console.log(`[${results.length + 1}/${poultryCompanies.length}] Monitoring ${company.name}...`);
    const count = await monitorCompany(company);
    results.push({ company: company.name, signalsCreated: count });
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
    const count = await monitorCompany(company);
    results.push({ company: company.name, signalsCreated: count });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`${industry} monitoring complete! Processed ${results.length} companies.`);
  return results;
}
