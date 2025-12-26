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
