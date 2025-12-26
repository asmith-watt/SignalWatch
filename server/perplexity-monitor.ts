import type { Company, InsertSignal } from "@shared/schema";
import { storage } from "./storage";

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

    await storage.createSignal(signalData);
    console.log(`  Created signal: ${signal.title}`);
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

export async function monitorAllCompanies(): Promise<{ company: string; signalsCreated: number }[]> {
  const companies = await storage.getAllCompanies();
  const activeCompanies = companies.filter(c => c.isActive && c.industry !== "Data Source");

  console.log(`Monitoring ${activeCompanies.length} active companies...`);
  
  const results: { company: string; signalsCreated: number }[] = [];
  
  for (const company of activeCompanies) {
    const count = await monitorCompany(company);
    results.push({ company: company.name, signalsCreated: count });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}
