import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CompanyProfileHeader } from "@/components/company-profile-header";
import { SignalCard } from "@/components/signal-card";
import { SignalTimeline } from "@/components/signal-timeline";
import { SignalFiltersBar, type SignalFilters } from "@/components/signal-filters";
import { SignalDetailPanel } from "@/components/signal-detail-panel";
import { AddCompanyDialog } from "@/components/add-company-dialog";
import { AlertConfigDialog } from "@/components/alert-config-dialog";
import { DashboardStats } from "@/components/dashboard-stats";
import {
  SignalFeedSkeleton,
  CompanyProfileSkeleton,
  DashboardStatsSkeleton,
} from "@/components/loading-skeleton";
import {
  EmptyCompanySignals,
  EmptyFilteredSignals,
  EmptyDashboard,
} from "@/components/empty-states";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Company, Signal, Alert, InsertCompany, InsertAlert } from "@shared/schema";

interface DashboardProps {
  selectedCompanyId: number | null;
  companies: Company[];
  onAddCompany: () => void;
}

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
        const name = (item as { name: string }).name;
        if (typeof name === 'string') {
          result.push(name.toLowerCase());
        }
      }
    }
  };
  
  extractNames(e.companies);
  extractNames(e.organizations);
  extractNames(e.people);
  extractNames(e.locations);
  extractNames(e.products);
  
  return result;
}

export function Dashboard({
  selectedCompanyId,
  companies,
  onAddCompany,
}: DashboardProps) {
  const { toast } = useToast();
  const [filters, setFilters] = useState<SignalFilters>(defaultFilters);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [showAlertDialog, setShowAlertDialog] = useState(false);

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);

  const { data: allSignals = [], isLoading: signalsLoading } = useQuery<Signal[]>({
    queryKey: ["/api/signals"],
  });

  const { data: alerts = [] } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
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

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: InsertCompany) => {
      if (editingCompany) {
        return apiRequest("PATCH", `/api/companies/${editingCompany.id}`, data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setEditingCompany(null);
      toast({ title: "Company updated successfully" });
    },
  });

  const createAlertMutation = useMutation({
    mutationFn: async (data: InsertAlert) => {
      return apiRequest("POST", "/api/alerts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      setShowAlertDialog(false);
      toast({ title: "Alert created successfully" });
    },
  });

  const filteredSignals = useMemo(() => {
    let result = Array.isArray(allSignals) ? allSignals : [];

    if (selectedCompanyId) {
      result = result.filter((s) => s.companyId === selectedCompanyId);
    }

    if (filters.types.length > 0) {
      result = result.filter((s) => filters.types.includes(s.type));
    }

    if (filters.priorities.length > 0) {
      result = result.filter((s) => filters.priorities.includes(s.priority || "medium"));
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
        const signalDate = s.publishedAt ? new Date(s.publishedAt) : new Date(s.createdAt);
        return signalDate >= startDate;
      });
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

    return result.sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt) : new Date(a.createdAt);
      const dateB = b.publishedAt ? new Date(b.publishedAt) : new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });
  }, [allSignals, selectedCompanyId, filters]);

  const stats = useMemo(() => {
    const signals = selectedCompanyId
      ? allSignals.filter((s) => s.companyId === selectedCompanyId)
      : allSignals;

    return {
      companyCount: companies.length,
      signalCount: signals.length,
      unreadSignalCount: signals.filter((s) => !s.isRead).length,
      alertCount: alerts.filter((a) => a.isActive).length,
      bookmarkedCount: signals.filter((s) => s.isBookmarked).length,
      inProgressCount: signals.filter(
        (s) => s.contentStatus === "reviewing" || s.contentStatus === "writing"
      ).length,
    };
  }, [allSignals, companies, alerts, selectedCompanyId]);

  const lastSignalDate = useMemo(() => {
    const companySignals = selectedCompanyId
      ? allSignals.filter((s) => s.companyId === selectedCompanyId)
      : [];

    if (companySignals.length === 0) return undefined;

    const latest = companySignals.reduce((latest, signal) => {
      const signalDate = signal.publishedAt
        ? new Date(signal.publishedAt)
        : new Date(signal.createdAt);
      return signalDate > latest ? signalDate : latest;
    }, new Date(0));

    return formatDistanceToNow(latest, { addSuffix: true });
  }, [allSignals, selectedCompanyId]);

  const handleBookmark = (id: number, bookmarked: boolean) => {
    updateSignalMutation.mutate({ id, updates: { isBookmarked: bookmarked } });
    if (selectedSignal?.id === id) {
      setSelectedSignal({ ...selectedSignal, isBookmarked: bookmarked });
    }
  };

  const handleMarkRead = (id: number, read: boolean) => {
    updateSignalMutation.mutate({ id, updates: { isRead: read } });
  };

  const handleEntitySelect = (entityName: string) => {
    setFilters({ ...filters, entityQuery: entityName });
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

  const clearFilters = () => {
    setFilters(defaultFilters);
  };

  if (companies.length === 0) {
    return <EmptyDashboard onAddCompany={onAddCompany} />;
  }

  return (
    <div className="flex h-full">
      <div className={`flex-1 flex flex-col ${selectedSignal ? "w-[calc(100%-400px)]" : ""}`}>
        <div className="p-6 space-y-6 overflow-auto">
          {!selectedCompanyId ? (
            <>
              {signalsLoading ? (
                <DashboardStatsSkeleton />
              ) : (
                <DashboardStats {...stats} />
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Recent Signals</h2>
                </div>

                <SignalFiltersBar
                  filters={filters}
                  onFiltersChange={setFilters}
                  resultCount={filteredSignals.length}
                />

                {signalsLoading ? (
                  <SignalFeedSkeleton />
                ) : filteredSignals.length === 0 ? (
                  filters !== defaultFilters ? (
                    <EmptyFilteredSignals onClearFilters={clearFilters} />
                  ) : (
                    <EmptyCompanySignals />
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
              </div>
            </>
          ) : selectedCompany ? (
            <>
              {signalsLoading ? (
                <CompanyProfileSkeleton />
              ) : (
                <CompanyProfileHeader
                  company={selectedCompany}
                  signalCount={stats.signalCount}
                  alertCount={stats.alertCount}
                  lastSignalDate={lastSignalDate}
                  onEdit={() => setEditingCompany(selectedCompany)}
                  onConfigureAlerts={() => setShowAlertDialog(true)}
                  onExport={() => {
                    toast({ title: "Export feature coming soon" });
                  }}
                  onArchive={() => {
                    toast({ title: "Archive feature coming soon" });
                  }}
                />
              )}

              <Tabs defaultValue="signals" className="mt-6">
                <TabsList>
                  <TabsTrigger value="signals" data-testid="tab-signals">
                    Signals
                  </TabsTrigger>
                  <TabsTrigger value="timeline" data-testid="tab-timeline">
                    Timeline
                  </TabsTrigger>
                  <TabsTrigger value="alerts" data-testid="tab-alerts">
                    Alerts ({stats.alertCount})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="signals" className="mt-4 space-y-4">
                  <SignalFiltersBar
                    filters={filters}
                    onFiltersChange={setFilters}
                    resultCount={filteredSignals.length}
                  />

                  {signalsLoading ? (
                    <SignalFeedSkeleton />
                  ) : filteredSignals.length === 0 ? (
                    filters !== defaultFilters ? (
                      <EmptyFilteredSignals onClearFilters={clearFilters} />
                    ) : (
                      <EmptyCompanySignals />
                    )
                  ) : (
                    <div className="space-y-3">
                      {filteredSignals.map((signal) => (
                        <SignalCard
                          key={signal.id}
                          signal={signal}
                          onBookmark={handleBookmark}
                          onMarkRead={handleMarkRead}
                          onEntitySelect={handleEntitySelect}
                          onClick={() => handleSignalClick(signal)}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="timeline" className="mt-4">
                  {signalsLoading ? (
                    <SignalFeedSkeleton />
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

                <TabsContent value="alerts" className="mt-4">
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Alert configuration for {selectedCompany.name}</p>
                    <button
                      className="text-primary underline mt-2"
                      onClick={() => setShowAlertDialog(true)}
                    >
                      Configure Alerts
                    </button>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          ) : null}
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
            onEntitySelect={handleEntitySelect}
          />
        </div>
      )}

      <AddCompanyDialog
        open={!!editingCompany}
        onOpenChange={(open) => !open && setEditingCompany(null)}
        onSubmit={(data) => updateCompanyMutation.mutate(data)}
        isLoading={updateCompanyMutation.isPending}
        company={editingCompany}
      />

      <AlertConfigDialog
        open={showAlertDialog}
        onOpenChange={setShowAlertDialog}
        onSubmit={(data) => createAlertMutation.mutate(data)}
        isLoading={createAlertMutation.isPending}
        companies={companies}
        preselectedCompanyId={selectedCompanyId}
      />
    </div>
  );
}
