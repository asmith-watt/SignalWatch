import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import { Activity, Calendar, TrendingUp } from "lucide-react";

interface ScanHistoryItem {
  date: string;
  industry: string;
  signalsFound: number;
}

function formatDate(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMM d");
}

function getIndustryColor(industry: string): string {
  const colors: Record<string, string> = {
    Poultry: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
    Feed: "bg-green-500/10 text-green-700 dark:text-green-400",
    "Pet Food": "bg-purple-500/10 text-purple-700 dark:text-purple-400",
    "AI/ML": "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    SaaS: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
    Fintech: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    Cloud: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
  };
  return colors[industry] || "bg-muted text-muted-foreground";
}

export function ScanHistory() {
  const { data: history = [], isLoading } = useQuery<ScanHistoryItem[]>({
    queryKey: ["/api/monitor/history"],
  });

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-20 w-full" />
        </div>
      </Card>
    );
  }

  const groupedByDate = history.reduce((acc, item) => {
    if (!acc[item.date]) {
      acc[item.date] = [];
    }
    acc[item.date].push(item);
    return acc;
  }, {} as Record<string, ScanHistoryItem[]>);

  const dates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  if (dates.length === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Activity className="w-4 h-4" />
          <span className="text-sm">No scan history available</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4" data-testid="scan-history-card">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium text-sm">Recent Scans</h3>
        </div>

        <div className="space-y-3">
          {dates.map((date) => {
            const items = groupedByDate[date];
            const totalSignals = items.reduce((sum, i) => sum + i.signalsFound, 0);

            return (
              <div key={date} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{formatDate(date)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <TrendingUp className="w-3 h-3" />
                    <span data-testid={`scan-total-${date}`}>{totalSignals} signals</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pl-5">
                  {items.map((item) => (
                    <Badge
                      key={`${date}-${item.industry}`}
                      variant="secondary"
                      className={`text-xs ${getIndustryColor(item.industry)}`}
                      data-testid={`scan-badge-${date}-${item.industry}`}
                    >
                      {item.industry}: {item.signalsFound}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
