import { storage } from "./storage";
import { generateTrendExplanation } from "./ai-analysis";
import type { Signal, InsertSignalMetric, InsertTrend } from "@shared/schema";

// Default freshness window in days - signals older than this are excluded from metrics/trends
const DEFAULT_FRESHNESS_WINDOW_DAYS = 60;

function getFreshnessWindowDays(): number {
  const envValue = process.env.FRESHNESS_WINDOW_DAYS;
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_FRESHNESS_WINDOW_DAYS;
}

// Filter signals to only include fresh ones with verified dates
function filterFreshSignals(signals: Signal[]): Signal[] {
  const freshnessWindowDays = getFreshnessWindowDays();
  const freshnessDate = new Date(Date.now() - freshnessWindowDays * 24 * 60 * 60 * 1000);
  
  return signals.filter(s => {
    // Exclude signals needing date review from metrics/trends
    if (s.needsDateReview) return false;
    
    // Exclude signals without publishedAt from metrics/trends
    if (!s.publishedAt) return false;
    
    // Exclude signals older than freshness window
    const signalDate = new Date(s.publishedAt);
    if (signalDate < freshnessDate) return false;
    
    return true;
  });
}

interface IndustryMetrics {
  industry: string;
  count7d: number;
  count30d: number;
  countPrev30d: number;
  themeDistribution: Record<string, number>;
  signalTypeDistribution: Record<string, number>;
}

export async function captureSignalMetrics(): Promise<{
  industriesProcessed: number;
  themesProcessed: number;
  metricsCreated: number;
}> {
  console.log("[TrendEngine] Starting metrics snapshot...");
  
  const allSignals = await storage.getAllSignals();
  const companies = await storage.getAllCompanies();
  const companyMap = new Map(companies.map(c => [c.id, c]));
  
  // Filter to only fresh signals with verified dates
  const signals = filterFreshSignals(allSignals);
  console.log(`[TrendEngine] Using ${signals.length} fresh signals out of ${allSignals.length} total`);
  
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  
  const industryMetrics: Map<string, IndustryMetrics> = new Map();
  const themeMetrics: Map<string, { count7d: number; count30d: number; countPrev30d: number }> = new Map();
  
  for (const signal of signals) {
    const company = companyMap.get(signal.companyId);
    const industry = company?.industry || "Unknown";
    const signalDate = signal.publishedAt ? new Date(signal.publishedAt) : new Date(signal.createdAt);
    
    if (!industryMetrics.has(industry)) {
      industryMetrics.set(industry, {
        industry,
        count7d: 0,
        count30d: 0,
        countPrev30d: 0,
        themeDistribution: {},
        signalTypeDistribution: {},
      });
    }
    
    const metrics = industryMetrics.get(industry)!;
    
    if (signalDate >= sevenDaysAgo) {
      metrics.count7d++;
    }
    if (signalDate >= thirtyDaysAgo) {
      metrics.count30d++;
    }
    if (signalDate >= sixtyDaysAgo && signalDate < thirtyDaysAgo) {
      metrics.countPrev30d++;
    }
    
    metrics.signalTypeDistribution[signal.type] = (metrics.signalTypeDistribution[signal.type] || 0) + 1;
    
    for (const theme of signal.themes || []) {
      metrics.themeDistribution[theme] = (metrics.themeDistribution[theme] || 0) + 1;
      
      if (!themeMetrics.has(theme)) {
        themeMetrics.set(theme, { count7d: 0, count30d: 0, countPrev30d: 0 });
      }
      const themeStat = themeMetrics.get(theme)!;
      if (signalDate >= sevenDaysAgo) themeStat.count7d++;
      if (signalDate >= thirtyDaysAgo) themeStat.count30d++;
      if (signalDate >= sixtyDaysAgo && signalDate < thirtyDaysAgo) themeStat.countPrev30d++;
    }
  }
  
  let metricsCreated = 0;
  
  for (const [industry, metrics] of Array.from(industryMetrics.entries())) {
    const delta30d = metrics.countPrev30d > 0 
      ? ((metrics.count30d - metrics.countPrev30d) / metrics.countPrev30d) * 100 
      : null;
    
    const metricRecords: InsertSignalMetric[] = [
      {
        scopeType: "industry",
        scopeId: industry,
        period: "7d",
        currentCount: metrics.count7d,
        prevCount: null,
        deltaPercent: null,
      },
      {
        scopeType: "industry",
        scopeId: industry,
        period: "30d",
        currentCount: metrics.count30d,
        prevCount: metrics.countPrev30d,
        deltaPercent: delta30d?.toFixed(2) || null,
      },
    ];
    
    for (const record of metricRecords) {
      await storage.createSignalMetric(record);
      metricsCreated++;
    }
  }
  
  for (const [theme, stats] of Array.from(themeMetrics.entries())) {
    const delta30d = stats.countPrev30d > 0 
      ? ((stats.count30d - stats.countPrev30d) / stats.countPrev30d) * 100 
      : null;
    
    const metricRecords: InsertSignalMetric[] = [
      {
        scopeType: "theme",
        scopeId: theme,
        theme: theme,
        period: "7d",
        currentCount: stats.count7d,
        prevCount: null,
        deltaPercent: null,
      },
      {
        scopeType: "theme",
        scopeId: theme,
        theme: theme,
        period: "30d",
        currentCount: stats.count30d,
        prevCount: stats.countPrev30d,
        deltaPercent: delta30d?.toFixed(2) || null,
      },
    ];
    
    for (const record of metricRecords) {
      await storage.createSignalMetric(record);
      metricsCreated++;
    }
  }
  
  console.log(`[TrendEngine] Captured ${metricsCreated} metrics for ${industryMetrics.size} industries and ${themeMetrics.size} themes`);
  
  return {
    industriesProcessed: industryMetrics.size,
    themesProcessed: themeMetrics.size,
    metricsCreated,
  };
}

export async function generateTrends(): Promise<{
  trendsGenerated: number;
  errors: number;
}> {
  console.log("[TrendEngine] Starting trend generation...");
  
  const allSignals = await storage.getAllSignals();
  const companies = await storage.getAllCompanies();
  const companyMap = new Map(companies.map(c => [c.id, c]));
  
  // Filter to only fresh signals with verified dates for trend analysis
  const signals = filterFreshSignals(allSignals);
  console.log(`[TrendEngine] Using ${signals.length} fresh signals out of ${allSignals.length} total for trends`);
  
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  
  interface IndustryData {
    count30d: number;
    countPrev30d: number;
    themes: Record<string, number>;
    signalTypes: Record<string, number>;
  }
  
  const industryData: Map<string, IndustryData> = new Map();
  
  for (const signal of signals) {
    const company = companyMap.get(signal.companyId);
    const industry = company?.industry || "Unknown";
    const signalDate = signal.publishedAt ? new Date(signal.publishedAt) : new Date(signal.createdAt);
    
    if (!industryData.has(industry)) {
      industryData.set(industry, {
        count30d: 0,
        countPrev30d: 0,
        themes: {},
        signalTypes: {},
      });
    }
    
    const data = industryData.get(industry)!;
    
    if (signalDate >= thirtyDaysAgo) {
      data.count30d++;
      data.signalTypes[signal.type] = (data.signalTypes[signal.type] || 0) + 1;
      for (const theme of signal.themes || []) {
        data.themes[theme] = (data.themes[theme] || 0) + 1;
      }
    }
    if (signalDate >= sixtyDaysAgo && signalDate < thirtyDaysAgo) {
      data.countPrev30d++;
    }
  }
  
  let trendsGenerated = 0;
  let errors = 0;
  
  for (const [industry, data] of Array.from(industryData.entries())) {
    if (data.count30d < 10) {
      continue;
    }
    
    // Baseline guardrail: If prev_30d < 25, treat as "emerging" activity
    // This prevents misleading percentages from low baselines (e.g., 10→120 = 1100%)
    const isEmerging = data.countPrev30d < 25;
    
    let deltaPercent: number | null = null;
    let direction: "up" | "down" | "flat" | "emerging" = "emerging";
    let confidence = 60; // Base confidence for emerging trends
    
    if (!isEmerging) {
      // Only calculate delta if we have meaningful baseline (>=10 signals in prev period)
      deltaPercent = ((data.count30d - data.countPrev30d) / data.countPrev30d) * 100;
      
      // Skip if change is too small
      if (Math.abs(deltaPercent) < 25) {
        continue;
      }
      
      direction = deltaPercent > 0 ? "up" : deltaPercent < 0 ? "down" : "flat";
      confidence = Math.min(95, 50 + Math.abs(deltaPercent) / 2);
    }
    
    const topThemes = Object.entries(data.themes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([theme]) => theme);
    
    const topSignalTypes = Object.entries(data.signalTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type);
    
    try {
      // Use 0 for magnitude when emerging (no baseline comparison)
      const magnitudeValue = deltaPercent ?? 0;
      
      const explanation = await generateTrendExplanation({
        scopeType: "industry",
        scopeId: industry,
        themes: topThemes,
        signalTypes: topSignalTypes,
        direction: isEmerging ? "emerging" : direction,
        magnitude: magnitudeValue,
        signalCount: data.count30d,
        timeWindow: "30d",
        isEmerging,
      });
      
      const trend: InsertTrend = {
        scopeType: "industry",
        scopeId: industry,
        signalTypes: topSignalTypes,
        themes: topThemes,
        timeWindow: "30d",
        direction: isEmerging ? "emerging" : direction,
        magnitude: isEmerging ? null : magnitudeValue.toFixed(2),
        confidence: Math.round(confidence),
        explanation,
      };
      
      await storage.createTrend(trend);
      trendsGenerated++;
      const logMsg = isEmerging 
        ? `  [TrendEngine] Generated emerging trend for ${industry}: ${data.count30d} signals`
        : `  [TrendEngine] Generated trend for ${industry}: ${direction} ${Math.abs(magnitudeValue).toFixed(0)}%`;
      console.log(logMsg);
    } catch (error) {
      console.error(`  [TrendEngine] Error generating trend for ${industry}:`, error);
      errors++;
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(`[TrendEngine] Generated ${trendsGenerated} trends (${errors} errors)`);
  
  return { trendsGenerated, errors };
}

export async function runDailyMetricsJob(): Promise<void> {
  console.log("[TrendEngine] Running daily metrics job...");
  
  try {
    const result = await captureSignalMetrics();
    console.log(`[TrendEngine] Daily metrics complete: ${result.metricsCreated} metrics captured`);
    
    await storage.createActivityLog({
      userId: null,
      action: "daily_metrics_captured",
      entityType: "system",
      entityId: null,
      details: result,
    });
  } catch (error) {
    console.error("[TrendEngine] Daily metrics job failed:", error);
    
    await storage.createActivityLog({
      userId: null,
      action: "daily_metrics_failed",
      entityType: "system",
      entityId: null,
      details: { error: error instanceof Error ? error.message : String(error) },
    });
  }
}

export async function runWeeklyTrendsJob(): Promise<void> {
  console.log("[TrendEngine] Running weekly trends job...");
  
  try {
    const result = await generateTrends();
    console.log(`[TrendEngine] Weekly trends complete: ${result.trendsGenerated} trends generated`);
    
    await storage.createActivityLog({
      userId: null,
      action: "weekly_trends_generated",
      entityType: "system",
      entityId: null,
      details: result,
    });
  } catch (error) {
    console.error("[TrendEngine] Weekly trends job failed:", error);
    
    await storage.createActivityLog({
      userId: null,
      action: "weekly_trends_failed",
      entityType: "system",
      entityId: null,
      details: { error: error instanceof Error ? error.message : String(error) },
    });
  }
}
