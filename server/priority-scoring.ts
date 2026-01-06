export interface PriorityInput {
  type: string;
  sentiment: string | null;
  citationsCount: number;
  relevanceScore?: number;
  noveltyScore?: number;
}

export interface PriorityResult {
  score: number;
  label: "high" | "medium" | "low";
  reason: string;
}

const TYPE_WEIGHTS: Record<string, number> = {
  regulatory: 20,
  earnings: 15,
  acquisition: 20,
  funding: 10,
  executive_change: 10,
  product_launch: 5,
  partnership: 5,
  press_release: 5,
  news: 0,
  other: 0,
  job_posting: 0,
  website_change: 0,
  social_media: 0,
};

export function computePriorityScore(input: PriorityInput): PriorityResult {
  let score = 50;
  const factors: string[] = [];

  const typeWeight = TYPE_WEIGHTS[input.type] ?? 0;
  score += typeWeight;
  if (typeWeight > 0) {
    factors.push(`type:${input.type}(+${typeWeight})`);
  }

  if (input.sentiment === "negative") {
    score += 10;
    factors.push("sentiment:negative(+10)");
  } else if (input.sentiment === "positive") {
    score += 2;
    factors.push("sentiment:positive(+2)");
  }

  const relevanceScore = input.relevanceScore ?? 0.5;
  const relevanceBoost = Math.round(relevanceScore * 20);
  score += relevanceBoost;
  if (relevanceBoost !== 10) {
    factors.push(`relevance:${(relevanceScore * 100).toFixed(0)}%(+${relevanceBoost})`);
  }

  const noveltyScore = input.noveltyScore ?? 50;
  if (noveltyScore <= 20) {
    score -= 25;
    factors.push("novelty:low(-25)");
  } else if (noveltyScore <= 40) {
    score -= 10;
    factors.push("novelty:moderate(-10)");
  } else if (noveltyScore >= 80) {
    score += 5;
    factors.push("novelty:high(+5)");
  }

  if (input.citationsCount >= 3) {
    score += 5;
    factors.push("citations:3+(+5)");
  } else if (input.citationsCount === 0) {
    score -= 5;
    factors.push("citations:none(-5)");
  }

  score = Math.max(0, Math.min(100, score));

  let label: "high" | "medium" | "low";
  if (score >= 70) {
    label = "high";
  } else if (score >= 40) {
    label = "medium";
  } else {
    label = "low";
  }

  const reason = factors.length > 0 
    ? factors.join(", ") 
    : "baseline score";

  return { score, label, reason };
}

export function getRecommendedFormat(
  priority: "high" | "medium" | "low",
  type: string,
  sentiment: string | null,
  relevanceScore?: number,
  noveltyScore?: number
): { format: "ignore" | "brief" | "news" | "analysis"; reason: string } {
  const novelty = noveltyScore ?? 50;
  const relevance = relevanceScore ?? 0.5;

  if (novelty <= 20) {
    return { format: "ignore", reason: "Low novelty score indicates repeated coverage" };
  }

  const highImpactTypes = ["regulatory", "earnings", "acquisition", "executive_change"];
  
  if (priority === "high" && highImpactTypes.includes(type)) {
    return { format: "news", reason: `High priority ${type} signal warrants full news coverage` };
  }

  if (priority === "high" && sentiment === "negative") {
    return { format: "analysis", reason: "High priority negative signal requires analysis" };
  }

  if (priority === "medium" && relevance >= 0.75) {
    return { format: "brief", reason: "Medium priority with high relevance suits brief format" };
  }

  return { format: "brief", reason: "Standard signal suitable for brief format" };
}
