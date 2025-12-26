import OpenAI from "openai";
import type { Signal } from "@shared/schema";

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
  }
}

Rules:
- Only include entities that are explicitly mentioned
- Be specific with financial figures - include currency
- relevanceScore: 90+ for major M&A/IPO/funding, 70-89 for exec changes/partnerships, 50-69 for general news, <50 for minor updates
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
