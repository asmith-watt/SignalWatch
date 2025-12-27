import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Radio } from "lucide-react";
import { SignalCard } from "@/components/signal-card";
import { SignalTimeline } from "@/components/signal-timeline";
import { SignalFiltersBar, type SignalFilters } from "@/components/signal-filters";
import { SignalDetailPanel } from "@/components/signal-detail-panel";
import { SignalFeedSkeleton } from "@/components/loading-skeleton";
import { EmptySignals, EmptyFilteredSignals } from "@/components/empty-states";
import { WordPressPublishDialog } from "@/components/wordpress-publish-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [filters, setFilters] = useState<SignalFilters>(defaultFilters);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "timeline">("list");
  const [wpPublishSignalId, setWpPublishSignalId] = useState<number | null>(null);

  const { data: signals = [], isLoading: signalsLoading } = useQuery<Signal[]>({
    queryKey: ["/api/signals"],
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

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

    if (filters.entityQuery) {
      const query = filters.entityQuery.toLowerCase();
      result = result.filter((s) => {
        const entityNames = extractEntityNames(s.entities);
        const titleMatch = s.title.toLowerCase().includes(query);
        const contentMatch = s.content?.toLowerCase().includes(query) || false;
        const summaryMatch = s.summary?.toLowerCase().includes(query) || false;
        const entityMatch = entityNames.some(name => name.includes(query));
        return titleMatch || contentMatch || summaryMatch || entityMatch;
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
  }, [signals, filters]);

  const handleBookmark = (id: number, bookmarked: boolean) => {
    updateSignalMutation.mutate({ id, updates: { isBookmarked: bookmarked } });
    if (selectedSignal?.id === id) {
      setSelectedSignal({ ...selectedSignal, isBookmarked: bookmarked });
    }
  };

  const handleMarkRead = (id: number, read: boolean) => {
    updateSignalMutation.mutate({ id, updates: { isRead: read } });
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

  const handleSignalClick = (signal: Signal) => {
    setSelectedSignal(signal);
    if (!signal.isRead) {
      handleMarkRead(signal.id, true);
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

  return (
    <div className="flex h-full">
      <div
        className={`flex-1 flex flex-col ${selectedSignal ? "w-[calc(100%-400px)]" : ""}`}
      >
        <div className="p-6 space-y-6 overflow-auto">
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
                    const company = companies.find(
                      (c) => c.id === signal.companyId
                    );
                    return (
                      <SignalCard
                        key={signal.id}
                        signal={signal}
                        companyName={company?.name}
                        showCompany
                        onBookmark={handleBookmark}
                        onMarkRead={handleMarkRead}
                        onPublishWordPress={(id) => setWpPublishSignalId(id)}
                        onEntitySelect={handleEntitySelect}
                        onClick={() => handleSignalClick(signal)}
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
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {selectedSignal && (
        <div className="w-[400px] flex-shrink-0 border-l">
          <SignalDetailPanel
            signal={selectedSignal}
            company={companies.find((c) => c.id === selectedSignal.companyId)}
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
    </div>
  );
}
