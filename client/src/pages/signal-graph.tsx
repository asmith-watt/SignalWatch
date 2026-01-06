import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  GitBranch, 
  Search, 
  Building2, 
  Calendar,
  Network,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";
import { SignalDetailPanel } from "@/components/signal-detail-panel";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Signal, Company } from "@shared/schema";

interface RelatedSignalResult {
  signal: Signal;
  company: Company | null;
  sharedEntityCount: number;
  sharedEntitiesPreview: string[];
}

export function SignalGraphPage() {
  const { toast } = useToast();
  const [selectedSignalId, setSelectedSignalId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: signals = [], isLoading: signalsLoading } = useQuery<Signal[]>({
    queryKey: ["/api/signals"],
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: relatedSignals = [], isLoading: relatedLoading } = useQuery<RelatedSignalResult[]>({
    queryKey: ["/api/signals", selectedSignalId, "related"],
    enabled: !!selectedSignalId,
  });

  const bookmarkMutation = useMutation({
    mutationFn: async ({ id, bookmarked }: { id: number; bookmarked: boolean }) => {
      return apiRequest("PATCH", `/api/signals/${id}`, { isBookmarked: bookmarked });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest("PATCH", `/api/signals/${id}`, { contentStatus: status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
    },
  });

  const notesMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes: string }) => {
      return apiRequest("PATCH", `/api/signals/${id}`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
      toast({ title: "Notes saved" });
    },
  });

  const handleBookmark = (id: number, bookmarked: boolean) => {
    bookmarkMutation.mutate({ id, bookmarked });
  };

  const handleUpdateStatus = (id: number, status: string) => {
    statusMutation.mutate({ id, status });
  };

  const handleUpdateNotes = (id: number, notes: string) => {
    notesMutation.mutate({ id, notes });
  };

  const filteredSignals = signals.filter((signal) =>
    signal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    signal.summary?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const recentSignals = filteredSignals.slice(0, 50);

  const handleSelectSignal = (signalId: number) => {
    setSelectedSignalId(signalId === selectedSignalId ? null : signalId);
  };

  const selectedSignal = signals.find((s) => s.id === selectedSignalId);
  const selectedCompany = selectedSignal ? companies.find((c) => c.id === selectedSignal.companyId) : undefined;

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-6 border-b">
          <div className="flex items-center gap-3 mb-2">
            <GitBranch className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold">Signal Graph</h1>
          </div>
          <p className="text-muted-foreground">
            Explore connections between signals through shared entities like companies, people, and topics.
          </p>
        </div>

        <div className="p-4 border-b">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search signals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-signal-search"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {signalsLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))
            ) : recentSignals.length === 0 ? (
              <div className="text-center py-12">
                <Network className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No signals found</p>
              </div>
            ) : (
              recentSignals.map((signal) => (
                <Card
                  key={signal.id}
                  className={`cursor-pointer transition-colors ${
                    selectedSignalId === signal.id
                      ? "ring-2 ring-primary"
                      : "hover-elevate"
                  }`}
                  onClick={() => handleSelectSignal(signal.id)}
                  data-testid={`signal-card-${signal.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm line-clamp-2">
                          {signal.title}
                        </h3>
                        {signal.summary && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {signal.summary}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {signal.type}
                          </Badge>
                          {signal.publishedAt && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(signal.publishedAt), "MMM d, yyyy")}
                            </span>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="w-96 border-l flex flex-col bg-muted/30">
        <div className="p-4 border-b bg-background">
          <h2 className="font-semibold">Related Signals</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {selectedSignal
              ? "Signals connected through shared entities"
              : "Select a signal to see connections"}
          </p>
        </div>

        <ScrollArea className="flex-1">
          {!selectedSignalId ? (
            <div className="p-6 text-center">
              <Network className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Click on a signal to explore its connections
              </p>
            </div>
          ) : relatedLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : relatedSignals.length === 0 ? (
            <div className="p-6 text-center">
              <GitBranch className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No related signals found
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                This signal may not share entities with other signals yet
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {relatedSignals.map((result) => (
                <Card
                  key={result.signal.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => handleSelectSignal(result.signal.id)}
                  data-testid={`related-signal-${result.signal.id}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium line-clamp-2">
                          {result.signal.title}
                        </h4>
                        {result.company && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            <span>{result.company.name}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            {result.sharedEntityCount} shared {result.sharedEntityCount === 1 ? "entity" : "entities"}
                          </Badge>
                        </div>
                        {result.sharedEntitiesPreview.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {result.sharedEntitiesPreview.map((entity, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="text-xs"
                              >
                                {entity}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>

      </div>

      {selectedSignal && (
        <div className="w-[400px] flex-shrink-0 border-l">
          <SignalDetailPanel
            signal={selectedSignal}
            company={selectedCompany}
            onClose={() => setSelectedSignalId(null)}
            onBookmark={handleBookmark}
            onUpdateStatus={handleUpdateStatus}
            onUpdateNotes={handleUpdateNotes}
          />
        </div>
      )}
    </div>
  );
}
