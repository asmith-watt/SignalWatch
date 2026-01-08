import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Activity, Calendar, TrendingUp, X, AlertCircle } from "lucide-react";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import { SignalCard } from "@/components/signal-card";
import { SignalFeedSkeleton } from "@/components/loading-skeleton";
import { EmptySignals } from "@/components/empty-states";
import { WordPressPublishDialog } from "@/components/wordpress-publish-dialog";
import { MediaSitePublishDialog } from "@/components/media-site-publish-dialog";
import { SignalDetailPanel } from "@/components/signal-detail-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Company, Signal } from "@shared/schema";

interface ScanHistoryItem {
  date: string;
  industry: string;
  signalsFound: number;
}

interface DateStats {
  total: number;
  withVerifiedDate: number;
  needsReview: number;
  bySource: Record<string, number>;
  avgConfidence: number;
}

function formatDate(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMM d");
}

function getIndustryColor(industry: string): string {
  const colors: Record<string, string> = {
    Poultry: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
    Feed: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
    "Pet Food": "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
    "Baking & Milling": "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    "IPPE Exhibitors": "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20",
    "Feed & Grain": "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20",
    "F&G Equipment / Advertisers": "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20",
    "Data Source": "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20",
  };
  return colors[industry] || "bg-muted text-muted-foreground border-muted";
}

export function AllSignalsPage() {
  const searchString = useSearch();
  
  const getInitialSelection = () => {
    const params = new URLSearchParams(searchString);
    const industry = params.get("industry");
    const date = params.get("date");
    if (industry) {
      return { industry, date: date || null };
    }
    return null;
  };

  const [selectedFilter, setSelectedFilter] = useState<{ industry: string; date: string | null } | null>(getInitialSelection);
  const [showUnknownDates, setShowUnknownDates] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [wpPublishSignalId, setWpPublishSignalId] = useState<number | null>(null);
  const [mediaSitePublishSignalId, setMediaSitePublishSignalId] = useState<number | null>(null);
  const [daysToShow, setDaysToShow] = useState(7);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const industry = params.get("industry");
    const date = params.get("date");
    if (industry) {
      setSelectedFilter({ industry, date: date || null });
    }
  }, [searchString]);

  const { data: history = [], isLoading: historyLoading } = useQuery<ScanHistoryItem[]>({
    queryKey: ["/api/monitor/history"],
  });

  const { data: signals = [], isLoading: signalsLoading } = useQuery<Signal[]>({
    queryKey: ["/api/signals"],
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: dateStats } = useQuery<DateStats>({
    queryKey: ["/api/signals/date-stats"],
  });

  const companyMap = useMemo(() => {
    const map = new Map<number, Company>();
    companies.forEach(c => map.set(c.id, c));
    return map;
  }, [companies]);

  const updateSignalMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: number;
      updates: Partial<Signal>;
    }) => {
      return apiRequest("PATCH", `/api/signals/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
    },
  });

  const allGroupedHistory = useMemo(() => {
    const grouped = history.reduce((acc, item) => {
      if (!acc[item.date]) {
        acc[item.date] = [];
      }
      acc[item.date].push(item);
      return acc;
    }, {} as Record<string, ScanHistoryItem[]>);
    
    return Object.keys(grouped)
      .sort((a, b) => b.localeCompare(a))
      .map(date => ({
        date,
        items: grouped[date],
        totalSignals: grouped[date].reduce((sum, i) => sum + i.signalsFound, 0),
      }));
  }, [history]);

  const groupedHistory = useMemo(() => {
    return allGroupedHistory.slice(0, daysToShow);
  }, [allGroupedHistory, daysToShow]);

  const hasMoreHistory = allGroupedHistory.length > daysToShow;

  const filteredSignals = useMemo(() => {
    // Special case: show signals needing date review
    if (showUnknownDates) {
      return signals.filter((signal) => signal.needsDateReview === true)
        .sort((a, b) => {
          const dateA = new Date(a.gatheredAt);
          const dateB = new Date(b.gatheredAt);
          return dateB.getTime() - dateA.getTime();
        });
    }
    
    if (!selectedFilter) return [];
    
    const { industry, date } = selectedFilter;

    return signals.filter((signal) => {
      const company = companyMap.get(signal.companyId);
      if (!company || company.industry !== industry) return false;
      
      if (date) {
        const signalDate = signal.publishedAt
          ? new Date(signal.publishedAt)
          : new Date(signal.createdAt);
        const signalDateKey = signalDate.toISOString().slice(0, 10);
        if (signalDateKey !== date) return false;
      }
      
      return true;
    }).sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt) : new Date(a.createdAt);
      const dateB = b.publishedAt ? new Date(b.publishedAt) : new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });
  }, [signals, selectedFilter, companyMap, showUnknownDates]);

  const handleBadgeClick = (industry: string, date: string) => {
    setShowUnknownDates(false);
    if (selectedFilter?.industry === industry && selectedFilter?.date === date) {
      setSelectedFilter(null);
      setSelectedSignal(null);
    } else {
      setSelectedFilter({ industry, date });
      setSelectedSignal(null);
    }
  };

  const handleUnknownDatesClick = () => {
    if (showUnknownDates) {
      setShowUnknownDates(false);
    } else {
      setSelectedFilter(null);
      setShowUnknownDates(true);
      setSelectedSignal(null);
    }
  };

  const handleBookmark = (id: number, bookmarked: boolean) => {
    updateSignalMutation.mutate({ id, updates: { isBookmarked: bookmarked } });
    if (selectedSignal?.id === id) {
      setSelectedSignal({ ...selectedSignal, isBookmarked: bookmarked });
    }
  };

  const handleMarkRead = (id: number, read: boolean) => {
    updateSignalMutation.mutate({ id, updates: { isRead: read } });
    if (selectedSignal?.id === id) {
      setSelectedSignal({ ...selectedSignal, isRead: read });
    }
  };

  const handleSignalClick = (signal: Signal) => {
    if (!signal.isRead) {
      handleMarkRead(signal.id, true);
    }
    setSelectedSignal(selectedSignal?.id === signal.id ? null : signal);
  };

  const handleUpdateStatus = (id: number, status: string) => {
    updateSignalMutation.mutate({ id, updates: { contentStatus: status } });
    if (selectedSignal?.id === id) {
      setSelectedSignal({ ...selectedSignal, contentStatus: status });
    }
  };

  const handleUpdateNotes = (id: number, notes: string) => {
    updateSignalMutation.mutate({ id, updates: { notes } });
    if (selectedSignal?.id === id) {
      setSelectedSignal({ ...selectedSignal, notes });
    }
  };

  const selectedCompany = selectedSignal ? companyMap.get(selectedSignal.companyId) : undefined;

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            <div>
              <h1 className="text-2xl font-semibold flex items-center gap-2">
                <Activity className="w-6 h-6" />
                Recent Signals
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Browse signals by scan date and industry
              </p>
            </div>

            {historyLoading ? (
              <Card className="p-4">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              </Card>
            ) : groupedHistory.length === 0 ? (
              <Card className="p-6">
                <div className="flex flex-col items-center justify-center text-center py-8">
                  <Activity className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No scan history yet</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Signal monitoring runs daily at 6:00 AM UTC. Check back after the first scan completes.
                  </p>
                </div>
              </Card>
            ) : (
              <Card className="p-4" data-testid="recent-scans-panel">
                <div className="space-y-4">
                  {groupedHistory.map(({ date, items, totalSignals }) => (
                    <div key={date} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">{formatDate(date)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <TrendingUp className="w-3 h-3" />
                          <span>{totalSignals} signals</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 pl-5">
                        {items.map((item) => {
                          const isSelected = selectedFilter?.industry === item.industry && selectedFilter?.date === date;
                          return (
                            <Badge
                              key={`${date}-${item.industry}`}
                              variant="secondary"
                              className={`text-xs cursor-pointer border ${getIndustryColor(item.industry)} ${
                                isSelected ? "ring-2 ring-primary ring-offset-1" : ""
                              }`}
                              onClick={() => handleBadgeClick(item.industry, date)}
                              data-testid={`scan-badge-${date}-${item.industry}`}
                            >
                              {item.industry}: {item.signalsFound}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {hasMoreHistory && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => setDaysToShow(prev => prev + 7)}
                      data-testid="button-show-more-history"
                    >
                      Show More
                    </Button>
                  )}
                </div>
              </Card>
            )}

            {dateStats && dateStats.needsReview > 0 && (
              <Button
                variant={showUnknownDates ? "default" : "outline"}
                className="flex items-center gap-2"
                onClick={handleUnknownDatesClick}
                data-testid="button-unknown-dates-filter"
              >
                <AlertCircle className="w-4 h-4" />
                <span>Signals with Unknown Date: {dateStats.needsReview}</span>
                {showUnknownDates && (
                  <X className="w-3 h-3 ml-1" />
                )}
              </Button>
            )}

            {(selectedFilter || showUnknownDates) && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-medium">
                      {showUnknownDates 
                        ? "Signals with Unknown Date"
                        : `${selectedFilter?.industry}${selectedFilter?.date ? ` - ${formatDate(selectedFilter.date)}` : " - All Dates"}`
                      }
                    </h2>
                    <Badge variant="outline" className="text-xs">
                      {filteredSignals.length} signals
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedFilter(null);
                      setShowUnknownDates(false);
                      setSelectedSignal(null);
                    }}
                    data-testid="button-clear-filter"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                </div>

                {signalsLoading ? (
                  <SignalFeedSkeleton />
                ) : filteredSignals.length === 0 ? (
                  <EmptySignals />
                ) : (
                  <div className="space-y-3">
                    {filteredSignals.map((signal) => {
                      const company = companyMap.get(signal.companyId);
                      return (
                        <SignalCard
                          key={signal.id}
                          signal={signal}
                          company={company}
                          mode="compact"
                          onOpen={() => handleSignalClick(signal)}
                          onToggleBookmark={handleBookmark}
                          onMarkRead={handleMarkRead}
                          onPublishWordPress={(id) => setWpPublishSignalId(id)}
                          onPublishMediaSite={(id) => setMediaSitePublishSignalId(id)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {selectedSignal && (
        <div className="w-[400px] flex-shrink-0 border-l">
          <SignalDetailPanel
            signal={selectedSignal}
            company={selectedCompany}
            onClose={() => setSelectedSignal(null)}
            onBookmark={handleBookmark}
            onUpdateStatus={handleUpdateStatus}
            onUpdateNotes={handleUpdateNotes}
          />
        </div>
      )}

      <WordPressPublishDialog
        signalId={wpPublishSignalId}
        signalTitle={signals.find((s) => s.id === wpPublishSignalId)?.title}
        open={wpPublishSignalId !== null}
        onOpenChange={(open) => !open && setWpPublishSignalId(null)}
      />

      <MediaSitePublishDialog
        signalId={mediaSitePublishSignalId}
        signalTitle={signals.find((s) => s.id === mediaSitePublishSignalId)?.title}
        open={mediaSitePublishSignalId !== null}
        onOpenChange={(open) => !open && setMediaSitePublishSignalId(null)}
      />
    </div>
  );
}
