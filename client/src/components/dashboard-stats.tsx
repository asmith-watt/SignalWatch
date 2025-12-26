import {
  Building2,
  Radio,
  TrendingUp,
  TrendingDown,
  Bell,
  Bookmark,
  FileEdit,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";

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
  return (
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
  );
}
