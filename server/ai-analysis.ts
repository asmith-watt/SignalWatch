import OpenAI from "openai";
import type { Signal, Company, RelationshipType, relationshipTypes, signalThemes } from "@shared/schema";

// Theme taxonomy for classification
export const THEME_TAXONOMY = [
  "hiring_pressure",
  "capacity_expansion",
  "regulatory_risk",
  "supply_chain",
  "m_a_activity",
  "market_expansion",
  "cost_pressures",
  "sustainability",
  "leadership_change",
  "product_innovation",
] as const;

export type ThemeTaxonomy = (typeof THEME_TAXONOMY)[number];

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface SignalAnalysis {
  summary: string;
  keyPoints: string[];
  sentiment: "positive" | "negative" | "neutral";
  priority: "high" | "medium" | "low";
  suggestedActions: string[];
  entities: {
    people: string[];
    organizations: string[];
    locations: string[];
  };
  relatedTopics: string[];
}

export async function analyzeSignal(signal: {
  title: string;
  content?: string | null;
  type: string;
  companyName?: string;
}): Promise<SignalAnalysis> {
  const prompt = `Analyze this business signal and provide structured insights.

Company: ${signal.companyName || "Unknown"}
Signal Type: ${signal.type}
Title: ${signal.title}
Content: ${signal.content || "No additional content available"}

Provide a JSON response with the following structure:
{
  "summary": "A 1-2 sentence summary of the signal",
  "keyPoints": ["Array of 2-4 key takeaways"],
  "sentiment": "positive" | "negative" | "neutral",
  "priority": "high" | "medium" | "low" (high for funding, acquisitions, major exec changes),
  "suggestedActions": ["Array of 1-3 recommended actions for the editorial team"],
  "entities": {
    "people": ["Names of people mentioned"],
    "organizations": ["Names of organizations mentioned"],
    "locations": ["Locations mentioned"]
  },
  "relatedTopics": ["Array of 2-4 related topics or tags"]
}

Return ONLY valid JSON, no markdown or explanation.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_completion_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    return JSON.parse(content) as SignalAnalysis;
  } catch (error) {
    console.error("Error analyzing signal:", error);
    // Return default analysis on error
    return {
      summary: signal.title,
      keyPoints: ["Unable to analyze signal at this time"],
      sentiment: "neutral",
      priority: "medium",
      suggestedActions: ["Review signal manually"],
      entities: {
        people: [],
        organizations: [],
        locations: [],
      },
      relatedTopics: [],
    };
  }
}

export interface SignalEnrichment {
  entities: {
    people: Array<{ name: string; role?: string; company?: string }>;
    companies: Array<{ name: string; relationship: string }>;
    locations: string[];
    financials: {
      revenue?: string;
      growth?: string;
      valuation?: string;
      funding?: string;
    };
    dates: Array<{ event: string; date: string }>;
  };
  aiAnalysis: {
    keyTakeaways: string[];
    industryImpact: string;
    competitorImplications: string[];
    storyAngles: string[];
    suggestedFollowUp: string[];
    relevanceScore: number;
  };
  publicationDate?: string | null;
}

export async function enrichSignal(signal: {
  title: string;
  summary?: string | null;
  content?: string | null;
  type: string;
  companyName?: string;
  industry?: string;
}): Promise<SignalEnrichment> {
  const prompt = `You are a business intelligence analyst. Analyze this signal and extract detailed entities and insights.

Company: ${signal.companyName || "Unknown"}
Industry: ${signal.industry || "Unknown"}
Signal Type: ${signal.type}
Title: ${signal.title}
Summary: ${signal.summary || ""}
Content: ${signal.content || ""}

Return a JSON object with this exact structure:
{
  "entities": {
    "people": [{"name": "Full Name", "role": "Title/Role", "company": "Company Name"}],
    "companies": [{"name": "Company Name", "relationship": "subject|partner|competitor|acquirer|target|investor|parent|subsidiary"}],
    "locations": ["Country or City names"],
    "financials": {
      "revenue": "Revenue figure if mentioned",
      "growth": "Growth percentage if mentioned",
      "valuation": "Valuation if mentioned",
      "funding": "Funding amount if mentioned"
    },
    "dates": [{"event": "What happens", "date": "When (Q1 2025, March 2025, etc.)"}]
  },
  "aiAnalysis": {
    "keyTakeaways": ["3-5 bullet points of the most important insights"],
    "industryImpact": "One sentence describing impact on the ${signal.industry || "industry"}",
    "competitorImplications": ["How this affects competitors or related companies"],
    "storyAngles": ["2-3 potential article angles for editorial team"],
    "suggestedFollowUp": ["What to monitor next, who to contact, what to research"],
    "relevanceScore": 0-100
  },
  "publicationDate": "YYYY-MM-DD or null"
}

Rules:
- Only include entities that are explicitly mentioned
- Be specific with financial figures - include currency
- relevanceScore: 90+ for major M&A/IPO/funding, 70-89 for exec changes/partnerships, 50-69 for general news, <50 for minor updates
- publicationDate: Extract the EXACT article publication date if mentioned in the content. Use YYYY-MM-DD format. If no date is found, set to null. NEVER guess or invent dates.
- Return ONLY valid JSON, no explanation`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    return JSON.parse(content) as SignalEnrichment;
  } catch (error) {
    console.error("Error enriching signal:", error);
    return {
      entities: {
        people: [],
        companies: [{ name: signal.companyName || "Unknown", relationship: "subject" }],
        locations: [],
        financials: {},
        dates: [],
      },
      aiAnalysis: {
        keyTakeaways: ["Unable to analyze - manual review needed"],
        industryImpact: "Unknown",
        competitorImplications: [],
        storyAngles: [],
        suggestedFollowUp: ["Review signal manually"],
        relevanceScore: 50,
      },
    };
  }
}

export async function batchEnrichSignals(
  signals: Array<{
    id: number;
    title: string;
    summary?: string | null;
    content?: string | null;
    type: string;
    companyName?: string;
    industry?: string;
  }>
): Promise<Map<number, SignalEnrichment>> {
  const results = new Map<number, SignalEnrichment>();
  
  const batchSize = 2;
  for (let i = 0; i < signals.length; i += batchSize) {
    const batch = signals.slice(i, i + batchSize);
    const enrichments = await Promise.allSettled(
      batch.map((signal) => enrichSignal(signal))
    );
    
    batch.forEach((signal, index) => {
      const result = enrichments[index];
      if (result.status === "fulfilled") {
        results.set(signal.id, result.value);
      }
    });
    
    if (i + batchSize < signals.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  
  return results;
}

export async function batchAnalyzeSignals(
  signals: Array<{
    id: number;
    title: string;
    content?: string | null;
    type: string;
    companyName?: string;
  }>
): Promise<Map<number, SignalAnalysis>> {
  const results = new Map<number, SignalAnalysis>();
  
  // Process in batches to avoid rate limiting
  const batchSize = 3;
  for (let i = 0; i < signals.length; i += batchSize) {
    const batch = signals.slice(i, i + batchSize);
    const analyses = await Promise.allSettled(
      batch.map((signal) => analyzeSignal(signal))
    );
    
    batch.forEach((signal, index) => {
      const result = analyses[index];
      if (result.status === "fulfilled") {
        results.set(signal.id, result.value);
      }
    });
    
    // Small delay between batches
    if (i + batchSize < signals.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  
  return results;
}

export interface ExtractedRelationship {
  sourceCompanyName: string;
  targetCompanyName: string;
  relationshipType: string;
  description: string;
  confidence: number;
}

export async function extractRelationshipsFromSignal(
  signal: Signal,
  allCompanies: Company[]
): Promise<ExtractedRelationship[]> {
  const companyNames = allCompanies.map(c => c.name);
  const companyNamesStr = companyNames.slice(0, 100).join(", ");

  const prompt = `Analyze this business signal and identify any company relationships mentioned.

Signal Title: ${signal.title}
Signal Content: ${signal.content || ""}
Signal Type: ${signal.type}

Known companies in our system (partial list):
${companyNamesStr}

Look for relationships between companies such as:
- partner: Business partners, joint projects
- competitor: Direct competitors in the market
- supplier: One company supplies products/services to another
- customer: One company buys from another
- acquired: One company acquired another
- investor: One company invested in another
- subsidiary: One company is a subsidiary of another
- joint_venture: Companies created a joint venture together
- distributor: One company distributes products for another

Return a JSON array of relationships found. Each relationship should have:
{
  "sourceCompanyName": "Name of first company",
  "targetCompanyName": "Name of second company",
  "relationshipType": "partner|competitor|supplier|customer|acquired|investor|subsidiary|joint_venture|distributor",
  "description": "Brief description of the relationship",
  "confidence": 70-100 (how confident you are this relationship exists)
}

Only include relationships where BOTH companies are clearly mentioned or implied.
Return an empty array [] if no clear relationships are found.
Return ONLY valid JSON, no markdown or explanation.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_completion_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return [];
    }

    const parsed = JSON.parse(content);
    const relationships = Array.isArray(parsed) ? parsed : (parsed.relationships || []);
    
    const validTypes = new Set([
      "partner", "competitor", "supplier", "customer", 
      "acquired", "investor", "subsidiary", "joint_venture", "distributor"
    ]);
    
    return relationships.filter((r: ExtractedRelationship) => 
      r.sourceCompanyName && 
      typeof r.sourceCompanyName === "string" &&
      r.targetCompanyName && 
      typeof r.targetCompanyName === "string" &&
      r.relationshipType &&
      typeof r.relationshipType === "string" &&
      validTypes.has(r.relationshipType) &&
      typeof r.confidence === "number" &&
      r.confidence >= 70
    );
  } catch (error) {
    console.error("Error extracting relationships:", error);
    return [];
  }
}

// Theme extraction interface
export interface ThemeExtractionResult {
  themes: string[];
  confidence: number;
}

/**
 * Extract themes from a signal using AI
 * Returns 1-5 normalized themes from the taxonomy, with fallback to "other:tag" for unmatched concepts
 */
export async function extractThemesFromSignal(signal: {
  title: string;
  content?: string | null;
  summary?: string | null;
  type: string;
  companyName?: string;
  industry?: string;
}): Promise<ThemeExtractionResult> {
  const themeTaxonomyStr = THEME_TAXONOMY.join(", ");
  
  const prompt = `Classify this business signal into 1-5 themes from our taxonomy.

Signal Title: ${signal.title}
Signal Summary: ${signal.summary || ""}
Signal Content: ${signal.content || ""}
Signal Type: ${signal.type}
Company: ${signal.companyName || "Unknown"}
Industry: ${signal.industry || "Unknown"}

Theme Taxonomy (use these exact values):
- hiring_pressure: Job postings, workforce changes, layoffs, hiring freezes
- capacity_expansion: New facilities, plant expansions, production increases
- regulatory_risk: Compliance issues, FDA/EPA actions, policy changes
- supply_chain: Supplier changes, logistics, raw material sourcing
- m_a_activity: Mergers, acquisitions, divestitures, IPOs
- market_expansion: New markets, geographic expansion, new customer segments
- cost_pressures: Price increases, margin compression, cost cutting
- sustainability: ESG, environmental initiatives, renewable energy, carbon reduction
- leadership_change: Executive appointments, departures, board changes
- product_innovation: New products, R&D, technology launches, patents

Rules:
1. Return 1-5 themes that best match the signal
2. Use ONLY themes from the taxonomy above
3. If a major concept isn't covered by taxonomy, add as "other:short_tag" (e.g., "other:bankruptcy")
4. Order themes by relevance (most relevant first)

Return JSON:
{
  "themes": ["theme1", "theme2"],
  "confidence": 70-100
}

Return ONLY valid JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_completion_tokens: 256,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    const themes = Array.isArray(parsed.themes) ? parsed.themes : [];
    
    // Validate themes against taxonomy or allow other: prefix
    const validThemes = themes.filter((t: string) => 
      typeof t === "string" && 
      (THEME_TAXONOMY.includes(t as ThemeTaxonomy) || t.startsWith("other:"))
    ).slice(0, 5);

    return {
      themes: validThemes.length > 0 ? validThemes : ["other:unclassified"],
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 50,
    };
  } catch (error) {
    console.error("Error extracting themes:", error);
    return {
      themes: ["other:error"],
      confidence: 0,
    };
  }
}

/**
 * Batch extract themes from multiple signals
 */
export async function batchExtractThemes(
  signals: Array<{
    id: number;
    title: string;
    content?: string | null;
    summary?: string | null;
    type: string;
    companyName?: string;
    industry?: string;
  }>
): Promise<Map<number, ThemeExtractionResult>> {
  const results = new Map<number, ThemeExtractionResult>();
  
  // Process in batches to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < signals.length; i += batchSize) {
    const batch = signals.slice(i, i + batchSize);
    const extractions = await Promise.allSettled(
      batch.map((signal) => extractThemesFromSignal(signal))
    );
    
    batch.forEach((signal, index) => {
      const result = extractions[index];
      if (result.status === "fulfilled") {
        results.set(signal.id, result.value);
      } else {
        results.set(signal.id, { themes: ["other:error"], confidence: 0 });
      }
    });
    
    // Small delay between batches
    if (i + batchSize < signals.length) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  
  return results;
}

/**
 * Generate AI explanation for a trend
 */
export async function generateTrendExplanation(trend: {
  scopeType: string;
  scopeId: string;
  themes: string[];
  signalTypes: string[];
  direction: string;
  magnitude: number;
  signalCount: number;
  timeWindow: string;
}): Promise<string> {
  const directionWord = trend.direction === "up" ? "increased" : trend.direction === "down" ? "decreased" : "remained stable";
  const magnitudeStr = trend.magnitude ? `${Math.abs(trend.magnitude).toFixed(0)}%` : "marginally";
  
  const prompt = `Write a concise 2-3 sentence trend summary for an editorial intelligence report.

Scope: ${trend.scopeType} - ${trend.scopeId}
Signal activity has ${directionWord} by ${magnitudeStr} over the past ${trend.timeWindow}.
Signal count: ${trend.signalCount}
Top themes: ${trend.themes.join(", ") || "general activity"}
Signal types: ${trend.signalTypes.join(", ") || "various"}

Write a professional, factual summary that:
1. States the trend clearly
2. Highlights the key theme(s) driving it
3. Suggests what this might mean for the industry

Return ONLY the summary text, no JSON or formatting.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 200,
    });

    return response.choices[0]?.message?.content?.trim() || 
      `Signal activity in ${trend.scopeId} has ${directionWord} by ${magnitudeStr} in the past ${trend.timeWindow}.`;
  } catch (error) {
    console.error("Error generating trend explanation:", error);
    return `Signal activity in ${trend.scopeId} has ${directionWord} by ${magnitudeStr} in the past ${trend.timeWindow}.`;
  }
}
