import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Building2,
  Radio,
  TrendingUp,
  TrendingDown,
  Bell,
  Bookmark,
  FileEdit,
  RefreshCw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface MonitorProgress {
  isRunning: boolean;
  total: number;
  current: number;
  currentCompany: string | null;
  startedAt: string | null;
  type: 'all' | 'industry' | 'company' | null;
  industryName?: string;
  signalsFound: number;
}

interface DashboardStatsProps {
  companyCount: number;
  signalCount: number;
  unreadSignalCount: number;
  alertCount: number;
  bookmarkedCount: number;
  inProgressCount: number;
  signalTrend?: number;
}

interface StatCardProps {
  title: string;
  value: number | string;
  icon: typeof Building2;
  trend?: number;
  description?: string;
}

function StatCard({ title, value, icon: Icon, trend, description }: StatCardProps) {
  const hasTrend = trend !== undefined && trend !== 0;
  const isPositive = trend && trend > 0;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-semibold" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, "-")}`}>
              {value}
            </p>
            {hasTrend && (
              <span
                className={`flex items-center text-xs font-medium ${
                  isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="w-3 h-3 mr-0.5" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-0.5" />
                )}
                {Math.abs(trend)}%
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
    </Card>
  );
}

export function DashboardStats({
  companyCount,
  signalCount,
  unreadSignalCount,
  alertCount,
  bookmarkedCount,
  inProgressCount,
  signalTrend,
}: DashboardStatsProps) {
  const { toast } = useToast();
  const [isMonitoring, setIsMonitoring] = useState(false);

  const { data: progress } = useQuery<MonitorProgress>({
    queryKey: ["/api/monitor/progress"],
    refetchInterval: isMonitoring ? 1000 : false,
    enabled: isMonitoring,
  });

  useEffect(() => {
    if (progress && !progress.isRunning && isMonitoring) {
      setIsMonitoring(false);
    }
  }, [progress, isMonitoring]);

  const updateAllMutation = useMutation({
    mutationFn: async () => {
      setIsMonitoring(true);
      return apiRequest("POST", "/api/monitor/all");
    },
    onSuccess: (data: any) => {
      setIsMonitoring(false);
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      const totalSignals = data.results?.reduce((sum: number, r: any) => sum + r.signalsCreated, 0) || 0;
      toast({
        title: "Monitoring complete",
        description: `Checked ${data.companiesMonitored || 0} companies, found ${totalSignals} new signals`,
      });
    },
    onError: () => {
      setIsMonitoring(false);
      toast({
        title: "Monitoring failed",
        description: "Could not update signals. Please try again.",
        variant: "destructive",
      });
    },
  });

  const progressPercent = progress?.total ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Overview</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => updateAllMutation.mutate()}
          disabled={updateAllMutation.isPending || isMonitoring}
          data-testid="button-update-all-signals"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${updateAllMutation.isPending || isMonitoring ? "animate-spin" : ""}`} />
          {updateAllMutation.isPending || isMonitoring ? "Updating..." : "Update All Signals"}
        </Button>
      </div>

      {isMonitoring && progress?.isRunning && (
        <Card className="p-4 bg-muted/50" data-testid="progress-card">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                Checking companies for new signals...
              </span>
              <span className="text-muted-foreground">
                {progress.current} / {progress.total} ({progressPercent}%)
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate max-w-xs" data-testid="progress-current-company">
                {progress.currentCompany ? `Checking: ${progress.currentCompany}` : "Starting..."}
              </span>
              <span data-testid="progress-signals-found">
                {progress.signalsFound} signals found
              </span>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Companies"
          value={companyCount}
          icon={Building2}
          description="Monitored"
        />
        <StatCard
          title="Signals"
          value={signalCount}
          icon={Radio}
          trend={signalTrend}
          description="Total collected"
        />
        <StatCard
          title="Unread"
          value={unreadSignalCount}
          icon={Bell}
          description="Need review"
        />
        <StatCard
          title="Bookmarked"
          value={bookmarkedCount}
          icon={Bookmark}
          description="Saved for later"
        />
        <StatCard
          title="In Progress"
          value={inProgressCount}
          icon={FileEdit}
          description="Content work"
        />
        <StatCard
          title="Alerts"
          value={alertCount}
          icon={Bell}
          description="Active rules"
        />
      </div>
    </div>
  );
}
