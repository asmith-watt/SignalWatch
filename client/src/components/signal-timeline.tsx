import { format, isToday, isYesterday, isThisWeek, isThisMonth } from "date-fns";
import { Calendar, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SignalCard } from "./signal-card";
import type { Signal, Company } from "@shared/schema";

interface SignalTimelineProps {
  signals: Signal[];
  companies: Company[];
  onBookmark?: (id: number, bookmarked: boolean) => void;
  onMarkRead?: (id: number, read: boolean) => void;
  onAssign?: (id: number) => void;
  onCreateContent?: (id: number) => void;
  onSignalClick?: (signal: Signal) => void;
  onEntitySelect?: (entityName: string) => void;
}

interface TimelineGroup {
  label: string;
  date: Date;
  signals: Signal[];
}

function getUTCDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function groupSignalsByDate(signals: Signal[]): TimelineGroup[] {
  const groups: Record<string, Signal[]> = {};
  const groupOrder: string[] = [];

  signals.forEach((signal) => {
    const date = signal.publishedAt
      ? new Date(signal.publishedAt)
      : new Date(signal.createdAt);
    const dateKey = getUTCDateKey(date);

    if (!groups[dateKey]) {
      groups[dateKey] = [];
      groupOrder.push(dateKey);
    }
    groups[dateKey].push(signal);
  });

  return groupOrder.map((dateKey) => {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    let label: string;

    if (isToday(date)) {
      label = "Today";
    } else if (isYesterday(date)) {
      label = "Yesterday";
    } else if (isThisWeek(date)) {
      label = format(date, "EEEE", { useAdditionalDayOfYearTokens: false });
    } else if (isThisMonth(date)) {
      label = format(date, "MMMM d");
    } else {
      label = format(date, "MMMM d, yyyy");
    }

    return {
      label,
      date,
      signals: groups[dateKey],
    };
  });
}

export function SignalTimeline({
  signals,
  companies,
  onBookmark,
  onMarkRead,
  onAssign,
  onCreateContent,
  onSignalClick,
  onEntitySelect,
}: SignalTimelineProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const timelineGroups = groupSignalsByDate(signals);
  const companyMap = new Map(companies.map((c) => [c.id, c]));

  const toggleGroup = (dateKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  };

  if (signals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Calendar className="w-12 h-12 mb-4 text-muted-foreground/50" />
        <h3 className="text-lg font-medium mb-1">No signals yet</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Signals will appear here as they are collected from your monitored companies.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-[18px] top-0 bottom-0 w-px bg-border" />

      <div className="space-y-6">
        {timelineGroups.map((group) => {
          const dateKey = format(group.date, "yyyy-MM-dd");
          const isCollapsed = collapsedGroups.has(dateKey);

          return (
            <div key={dateKey} className="relative" data-testid={`timeline-group-${dateKey}`}>
              <div className="sticky top-0 z-10 bg-background pb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative pl-10 font-medium"
                  onClick={() => toggleGroup(dateKey)}
                >
                  <div className="absolute left-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    {isCollapsed ? (
                      <ChevronRight className="w-3 h-3 text-primary-foreground" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-primary-foreground" />
                    )}
                  </div>
                  <span>{group.label}</span>
                  <span className="ml-2 text-muted-foreground font-normal">
                    ({group.signals.length} signals)
                  </span>
                </Button>
              </div>

              {!isCollapsed && (
                <div className="pl-10 space-y-3">
                  {group.signals.map((signal) => {
                    const company = companyMap.get(signal.companyId);
                    return (
                      <div key={signal.id} className="relative">
                        <div className="absolute -left-[22px] top-4 w-2 h-2 rounded-full bg-muted-foreground/30" />
                        <SignalCard
                          signal={signal}
                          company={company}
                          mode="compact"
                          onOpen={() => onSignalClick?.(signal)}
                          onToggleBookmark={onBookmark}
                          onMarkRead={onMarkRead}
                          onAssign={onAssign}
                          onCreateContent={onCreateContent}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
