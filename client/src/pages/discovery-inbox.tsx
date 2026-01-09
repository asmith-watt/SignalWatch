import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Inbox,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Rss,
  Globe,
  Search,
  ExternalLink,
} from "lucide-react";
import type { Signal, Company } from "@shared/schema";

const sourceTypeLabels: Record<string, string> = {
  rss: "RSS",
  feedly: "Feedly",
  crawl: "Crawl",
  regulator: "Regulator",
  association: "Association",
  llm_discovery: "LLM Discovery",
};

function getSourceTypeBadge(sourceType: string | null) {
  const type = sourceType || "llm_discovery";
  const colors: Record<string, string> = {
    rss: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    feedly: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    crawl: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    regulator: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    association: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    llm_discovery: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  };
  return (
    <Badge variant="outline" className={colors[type] || ""}>
      {sourceTypeLabels[type] || type}
    </Badge>
  );
}

function getVerificationBadge(status: string | null) {
  switch (status) {
    case "verified":
      return <Badge variant="default" className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>;
    case "rejected":
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
    default:
      return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" />Unverified</Badge>;
  }
}

export default function DiscoveryInboxPage() {
  const { toast } = useToast();
  const [selectedSignals, setSelectedSignals] = useState<Set<number>>(new Set());
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>("all");

  const { data: signals = [], isLoading } = useQuery<Signal[]>({
    queryKey: ["/api/signals"],
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const companyMap = new Map(companies.map(c => [c.id, c]));

  const discoverySignals = signals.filter(signal => {
    const isDiscovery = signal.ingestionSourceType === "llm_discovery" || 
                        signal.verificationStatus === "unverified";
    if (!isDiscovery) return false;
    if (sourceTypeFilter && sourceTypeFilter !== "all" && signal.ingestionSourceType !== sourceTypeFilter) return false;
    return true;
  });

  const updateSignalMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<Signal> }) => {
      return apiRequest("PATCH", `/api/signals/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
    },
  });

  const handleVerify = (signalId: number) => {
    toast({ 
      title: "Verify Signal", 
      description: "Full verification will be available in PR3" 
    });
  };

  const handleReject = (signalId: number) => {
    updateSignalMutation.mutate({
      id: signalId,
      updates: { verificationStatus: "rejected" },
    }, {
      onSuccess: () => {
        toast({ title: "Signal rejected" });
        setSelectedSignals(prev => {
          const next = new Set(prev);
          next.delete(signalId);
          return next;
        });
      },
    });
  };

  const handleBulkReject = () => {
    selectedSignals.forEach(id => {
      updateSignalMutation.mutate({ id, updates: { verificationStatus: "rejected" } });
    });
    toast({ title: `Rejected ${selectedSignals.size} signals` });
    setSelectedSignals(new Set());
  };

  const toggleSelect = (id: number) => {
    setSelectedSignals(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedSignals.size === discoverySignals.length) {
      setSelectedSignals(new Set());
    } else {
      setSelectedSignals(new Set(discoverySignals.map(s => s.id)));
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Inbox className="w-6 h-6" />
              Discovery Inbox
            </h1>
            <p className="text-muted-foreground">
              Review and verify signals discovered by LLM or unverified sources
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedSignals.size > 0 && (
              <Button 
                variant="destructive" 
                onClick={handleBulkReject}
                data-testid="button-bulk-reject"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject Selected ({selectedSignals.size})
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Select value={sourceTypeFilter} onValueChange={setSourceTypeFilter}>
            <SelectTrigger className="w-[180px]" data-testid="filter-source-type">
              <SelectValue placeholder="All Source Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Source Types</SelectItem>
              <SelectItem value="llm_discovery">LLM Discovery</SelectItem>
              <SelectItem value="rss">RSS</SelectItem>
              <SelectItem value="feedly">Feedly</SelectItem>
              <SelectItem value="crawl">Crawl</SelectItem>
              <SelectItem value="regulator">Regulator</SelectItem>
              <SelectItem value="association">Association</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-sm">
            {discoverySignals.length} signals to review
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : discoverySignals.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
                <h3 className="text-lg font-medium mb-2">All Caught Up!</h3>
                <p className="text-muted-foreground max-w-md">
                  No unverified signals or LLM discoveries to review. 
                  All signals have been verified or processed.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedSignals.size === discoverySignals.length && discoverySignals.length > 0}
                        onCheckedChange={toggleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead>Signal</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Source Type</TableHead>
                    <TableHead>Verification</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discoverySignals.map((signal) => {
                    const company = signal.companyId ? companyMap.get(signal.companyId) : null;
                    return (
                      <TableRow key={signal.id} data-testid={`inbox-signal-${signal.id}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedSignals.has(signal.id)}
                            onCheckedChange={() => toggleSelect(signal.id)}
                            data-testid={`checkbox-signal-${signal.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[300px]">
                            <div className="font-medium truncate">{signal.title}</div>
                            {signal.sourceUrl && (
                              <a 
                                href={signal.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                              >
                                {signal.sourceName || "Source"}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {company ? (
                            <Badge variant="outline">{company.name}</Badge>
                          ) : (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {getSourceTypeBadge(signal.ingestionSourceType)}
                        </TableCell>
                        <TableCell>
                          {getVerificationBadge(signal.verificationStatus)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {signal.publishedAt 
                            ? new Date(signal.publishedAt).toLocaleDateString()
                            : "Unknown"
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              data-testid={`button-view-signal-${signal.id}`}
                            >
                              <Link href={`/signals/${signal.id}`}>
                                <Eye className="w-4 h-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleVerify(signal.id)}
                              disabled={signal.verificationStatus === "verified"}
                              data-testid={`button-verify-signal-${signal.id}`}
                            >
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleReject(signal.id)}
                              disabled={signal.verificationStatus === "rejected"}
                              data-testid={`button-reject-signal-${signal.id}`}
                            >
                              <XCircle className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
