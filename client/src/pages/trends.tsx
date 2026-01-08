import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Activity, BarChart3, Calendar, Sparkles } from "lucide-react";
import type { Trend } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

const THEME_LABELS: Record<string, string> = {
  hiring_pressure: "Hiring Pressure",
  capacity_expansion: "Capacity Expansion",
  regulatory_risk: "Regulatory Risk",
  supply_chain: "Supply Chain",
  m_a_activity: "M&A Activity",
  market_expansion: "Market Expansion",
  cost_pressures: "Cost Pressures",
  sustainability: "Sustainability",
  leadership_change: "Leadership Change",
  product_innovation: "Product Innovation",
};

function formatTheme(theme: string): string {
  if (theme.startsWith("other:")) {
    return theme.replace("other:", "").replace(/_/g, " ");
  }
  return THEME_LABELS[theme] || theme.replace(/_/g, " ");
}

function formatMagnitude(magnitude: number): string {
  const cappedMagnitude = Math.min(Math.abs(magnitude), 500);
  const prefix = magnitude > 0 ? "+" : magnitude < 0 ? "-" : "";
  const suffix = Math.abs(magnitude) > 500 ? "+" : "";
  return `${prefix}${cappedMagnitude.toFixed(0)}%${suffix}`;
}

function TrendCard({ trend }: { trend: Trend }) {
  const magnitude = parseFloat(trend.magnitude || "0");
  const isUp = trend.direction === "up";
  const isDown = trend.direction === "down";
  const isEmerging = trend.direction === "emerging";
  
  const Icon = isEmerging ? Sparkles : isUp ? TrendingUp : isDown ? TrendingDown : Activity;
  const colorClass = isEmerging
    ? "text-purple-600 dark:text-purple-400"
    : isUp 
    ? "text-green-600 dark:text-green-400" 
    : isDown 
    ? "text-red-600 dark:text-red-400" 
    : "text-muted-foreground";
  
  return (
    <Card data-testid={`card-trend-${trend.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${colorClass}`} />
            <CardTitle className="text-lg">{trend.scopeId}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {isEmerging ? (
              <Badge variant="outline" className={colorClass}>
                Emerging
              </Badge>
            ) : (
              <Badge variant="outline" className={colorClass}>
                {formatMagnitude(magnitude)}
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              {trend.confidence}% confidence
            </Badge>
          </div>
        </div>
        <CardDescription className="flex items-center gap-1 text-xs">
          <Calendar className="h-3 w-3" />
          {formatDistanceToNow(new Date(trend.generatedAt), { addSuffix: true })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{trend.explanation}</p>
        
        <div className="flex flex-wrap gap-2">
          {trend.themes?.map((theme, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {formatTheme(theme)}
            </Badge>
          ))}
        </div>
        
        {trend.signalTypes && trend.signalTypes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {trend.signalTypes.map((type, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {type}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TrendSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
        <Skeleton className="h-4 w-24 mt-1" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function TrendsPage() {
  const { data: trends, isLoading } = useQuery<Trend[]>({
    queryKey: ["/api/trends"],
  });

  return (
    <div className="p-6 space-y-6" data-testid="page-trends">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Intelligence Trends</h1>
          <p className="text-muted-foreground">
            AI-generated insights on industry signal patterns
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <TrendSkeleton key={i} />)
        ) : trends && trends.length > 0 ? (
          trends.map((trend) => <TrendCard key={trend.id} trend={trend} />)
        ) : (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No Trends Yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                Trends are generated weekly based on signal patterns. 
                Make sure you have signals with themes and check back after the weekly job runs.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
