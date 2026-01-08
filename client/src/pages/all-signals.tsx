import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Radio } from "lucide-react";
import { SignalCard } from "@/components/signal-card";
import { SignalTimeline } from "@/components/signal-timeline";
import { SignalFiltersBar, type SignalFilters } from "@/components/signal-filters";
import { SignalFeedSkeleton } from "@/components/loading-skeleton";
import { EmptySignals, EmptyFilteredSignals } from "@/components/empty-states";
import { WordPressPublishDialog } from "@/components/wordpress-publish-dialog";
import { MediaSitePublishDialog } from "@/components/media-site-publish-dialog";
import { SignalDetailPanel } from "@/components/signal-detail-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Company, Signal } from "@shared/schema";

const defaultFilters: SignalFilters = {
  types: [],
  priorities: [],
  dateRange: "all",
  assignee: "all",
  status: "all",
  bookmarked: false,
  unread: false,
  entityQuery: "",
  industry: "all",
};

function extractEntityNames(entities: unknown): string[] {
  if (!entities || typeof entities !== 'object') return [];
  const result: string[] = [];
  const e = entities as Record<string, unknown>;
  
  const extractNames = (arr: unknown) => {
    if (!Array.isArray(arr)) return;
    for (const item of arr) {
      if (typeof item === 'string') {
        result.push(item.toLowerCase());
      } else if (item && typeof item === 'object' && 'name' in item) {
        result.push(String((item as { name: string }).name).toLowerCase());
      }
    }
  };
  
  extractNames(e.people);
  extractNames(e.organizations);
  extractNames(e.locations);
  extractNames(e.financials);
  extractNames(e.dates);
  
  return result;
}

export function AllSignalsPage() {
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  
  const getInitialFilters = (): SignalFilters => {
    const params = new URLSearchParams(searchString);
    const industry = params.get("industry");
    return {
      ...defaultFilters,
      industry: industry || "all",
    };
  };

  const [filters, setFilters] = useState<SignalFilters>(getInitialFilters);
  const [viewMode, setViewMode] = useState<"list" | "timeline">("list");
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [wpPublishSignalId, setWpPublishSignalId] = useState<number | null>(null);
  const [mediaSitePublishSignalId, setMediaSitePublishSignalId] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const industry = params.get("industry");
    if (industry && industry !== filters.industry) {
      setFilters(prev => ({ ...prev, industry }));
    }
  }, [searchString]);

  const { data: signals = [], isLoading: signalsLoading } = useQuery<Signal[]>({
    queryKey: ["/api/signals"],
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
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

  const filteredSignals = useMemo(() => {
    let result = [...signals];

    if (filters.types.length > 0) {
      result = result.filter((s) => filters.types.includes(s.type));
    }

    if (filters.priorities.length > 0) {
      result = result.filter((s) =>
        filters.priorities.includes(s.priority || "medium")
      );
    }

    if (filters.status !== "all") {
      result = result.filter((s) => s.contentStatus === filters.status);
    }

    if (filters.bookmarked) {
      result = result.filter((s) => s.isBookmarked);
    }

    if (filters.unread) {
      result = result.filter((s) => !s.isRead);
    }

    if (filters.entityQuery && filters.entityQuery.trim() !== "") {
      const query = filters.entityQuery.toLowerCase().trim();
      result = result.filter((signal) => {
        const entityNames = extractEntityNames(signal.entities);
        return entityNames.some(name => name.includes(query));
      });
    }

    if (filters.industry && filters.industry !== "all") {
      result = result.filter((signal) => {
        const company = companyMap.get(signal.companyId);
        return company?.industry === filters.industry;
      });
    }

    if (filters.dateRange !== "all") {
      const now = new Date();
      let startDate: Date;

      switch (filters.dateRange) {
        case "today":
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case "week":
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case "month":
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case "quarter":
          startDate = new Date(now.setMonth(now.getMonth() - 3));
          break;
        default:
          startDate = new Date(0);
      }

      result = result.filter((s) => {
        const signalDate = s.publishedAt
          ? new Date(s.publishedAt)
          : new Date(s.createdAt);
        return signalDate >= startDate;
      });
    }

    return result.sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt) : new Date(a.createdAt);
      const dateB = b.publishedAt ? new Date(b.publishedAt) : new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });
  }, [signals, filters, companyMap]);

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

  const handleEntitySelect = (entityName: string) => {
    setFilters({ ...filters, entityQuery: entityName });
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
  };

  const hasActiveFilters =
    filters.types.length > 0 ||
    filters.priorities.length > 0 ||
    filters.dateRange !== "all" ||
    filters.status !== "all" ||
    filters.bookmarked ||
    filters.unread ||
    filters.entityQuery !== "";

  const selectedCompany = selectedSignal ? companyMap.get(selectedSignal.companyId) : undefined;

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            <div>
              <h1 className="text-2xl font-semibold flex items-center gap-2">
                <Radio className="w-6 h-6" />
                All Signals
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                View and manage signals from all monitored companies
              </p>
            </div>

            <SignalFiltersBar
              filters={filters}
              onFiltersChange={setFilters}
              resultCount={filteredSignals.length}
            />

            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "timeline")}>
              <TabsList>
                <TabsTrigger value="list">List View</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>

              <TabsContent value="list" className="mt-4">
                {signalsLoading ? (
                  <SignalFeedSkeleton />
                ) : filteredSignals.length === 0 ? (
                  hasActiveFilters ? (
                    <EmptyFilteredSignals onClearFilters={clearFilters} />
                  ) : (
                    <EmptySignals />
                  )
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
              </TabsContent>

              <TabsContent value="timeline" className="mt-4">
                {signalsLoading ? (
                  <SignalFeedSkeleton />
                ) : filteredSignals.length === 0 ? (
                  hasActiveFilters ? (
                    <EmptyFilteredSignals onClearFilters={clearFilters} />
                  ) : (
                    <EmptySignals />
                  )
                ) : (
                  <SignalTimeline
                    signals={filteredSignals}
                    companies={companies}
                    onBookmark={handleBookmark}
                    onMarkRead={handleMarkRead}
                    onSignalClick={handleSignalClick}
                    onEntitySelect={handleEntitySelect}
                  />
                )}
              </TabsContent>
            </Tabs>
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
            onEntitySelect={handleEntitySelect}
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
