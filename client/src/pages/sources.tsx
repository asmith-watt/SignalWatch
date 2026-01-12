import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Rss,
  Globe,
  Search,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  XCircle,
  Pencil,
  Power,
  Play,
  Plus,
  Compass,
  ExternalLink,
  CloudCog,
  Loader2,
  BarChart3,
  Filter,
  ChevronDown,
} from "lucide-react";
import type { Source, Company } from "@shared/schema";

const sourceTypeLabels: Record<string, string> = {
  rss: "RSS Feed",
  feedly: "Feedly",
  crawl: "Web Crawl",
  regulator: "Regulator",
  association: "Association",
  llm: "LLM Discovery",
};

const sourceTypeIcons: Record<string, typeof Rss> = {
  rss: Rss,
  feedly: Globe,
  crawl: Search,
  regulator: AlertCircle,
  association: Globe,
  llm: RefreshCw,
};

function getStatusBadge(status: string) {
  switch (status) {
    case "verified":
      return <Badge variant="default" className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>;
    case "needs_review":
      return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" />Needs Review</Badge>;
    case "broken":
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Broken</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function SourcesTable({ 
  sources, 
  onEdit, 
  onToggle, 
  onVerify, 
  onRun,
  isLoading,
  runningSourceId,
  selectedIds,
  onSelectChange,
  onSelectAll,
}: { 
  sources: Source[];
  onEdit: (source: Source) => void;
  onToggle: (source: Source) => void;
  onVerify: (source: Source) => void;
  onRun: (source: Source) => void;
  isLoading: boolean;
  runningSourceId: number | null;
  selectedIds?: Set<number>;
  onSelectChange?: (id: number, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
}) {
  const showCheckboxes = selectedIds !== undefined && onSelectChange !== undefined;
  const allSelected = showCheckboxes && sources.length > 0 && sources.every(s => selectedIds.has(s.id));
  const someSelected = showCheckboxes && sources.some(s => selectedIds.has(s.id)) && !allSelected;
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Rss className="w-12 h-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-2">No sources found</h3>
        <p className="text-muted-foreground mb-4">Add sources to start collecting signals</p>
        <Button asChild>
          <Link href="/sources/discover">
            <Compass className="w-4 h-4 mr-2" />
            Discover Sources
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showCheckboxes && (
            <TableHead className="w-[40px]">
              <Checkbox
                checked={allSelected}
                ref={(el) => {
                  if (el) (el as any).indeterminate = someSelected;
                }}
                onCheckedChange={(checked) => onSelectAll?.(!!checked)}
                data-testid="checkbox-select-all"
              />
            </TableHead>
          )}
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Domain</TableHead>
          <TableHead>Trust</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Active</TableHead>
          <TableHead>Last Ingested</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sources.map((source) => {
          const IconComponent = sourceTypeIcons[source.sourceType] || Globe;
          const isSelected = showCheckboxes && selectedIds.has(source.id);
          return (
            <TableRow 
              key={source.id} 
              data-testid={`source-row-${source.id}`}
              className={isSelected ? "bg-muted/50" : ""}
            >
              {showCheckboxes && (
                <TableCell>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => onSelectChange?.(source.id, !!checked)}
                    data-testid={`checkbox-source-${source.id}`}
                  />
                </TableCell>
              )}
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <IconComponent className="w-4 h-4 text-muted-foreground" />
                  {source.name}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{sourceTypeLabels[source.sourceType] || source.sourceType}</Badge>
              </TableCell>
              <TableCell>
                {source.domain ? (
                  <a 
                    href={source.url || `https://${source.domain}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    {source.domain}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <div 
                    className="w-8 h-2 rounded-full bg-muted overflow-hidden"
                    title={`Trust Score: ${source.trustScore}`}
                  >
                    <div 
                      className="h-full bg-primary transition-all" 
                      style={{ width: `${source.trustScore}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{source.trustScore}</span>
                </div>
              </TableCell>
              <TableCell>{getStatusBadge(source.verificationStatus || "needs_review")}</TableCell>
              <TableCell>
                <Badge variant={source.isActive ? "default" : "secondary"}>
                  {source.isActive ? "Active" : "Disabled"}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {source.lastIngestedAt 
                  ? new Date(source.lastIngestedAt).toLocaleDateString()
                  : "Never"
                }
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => onEdit(source)}
                    data-testid={`button-edit-source-${source.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => onToggle(source)}
                    data-testid={`button-toggle-source-${source.id}`}
                  >
                    <Power className={`w-4 h-4 ${source.isActive ? "text-green-600" : "text-muted-foreground"}`} />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => onVerify(source)}
                    disabled={source.verificationStatus === "verified"}
                    data-testid={`button-verify-source-${source.id}`}
                  >
                    <CheckCircle className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => onRun(source)}
                    disabled={!source.isActive || runningSourceId !== null}
                    data-testid={`button-run-source-${source.id}`}
                  >
                    {runningSourceId === source.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default function SourcesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [marketFilter, setMarketFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [runningSourceId, setRunningSourceId] = useState<number | null>(null);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<number>>(new Set());
  const [bulkActionRunning, setBulkActionRunning] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    sourceType: "",
    url: "",
    domain: "",
    trustScore: 50,
    isActive: true,
  });

  const { data: sources = [], isLoading } = useQuery<Source[]>({
    queryKey: ["/api/sources", typeFilter, statusFilter, marketFilter, companyFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeFilter && typeFilter !== "all") params.set("type", typeFilter);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (marketFilter && marketFilter !== "all") params.set("market", marketFilter);
      if (companyFilter && companyFilter !== "all") params.set("companyId", companyFilter);
      const url = `/api/sources${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch sources");
      return res.json();
    },
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const updateSourceMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<Source> }) => {
      return apiRequest("PATCH", `/api/sources/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      toast({ title: "Source updated" });
      setEditingSource(null);
    },
    onError: () => {
      toast({ title: "Failed to update source", variant: "destructive" });
    },
  });

  const verifySourceMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/sources/${id}/verify`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      toast({ title: "Source verified" });
    },
    onError: () => {
      toast({ title: "Failed to verify source", variant: "destructive" });
    },
  });

  const handleEdit = (source: Source) => {
    setEditingSource(source);
    setEditForm({
      name: source.name,
      sourceType: source.sourceType,
      url: source.url || "",
      domain: source.domain || "",
      trustScore: source.trustScore ?? 50,
      isActive: source.isActive ?? true,
    });
  };

  const handleToggle = (source: Source) => {
    updateSourceMutation.mutate({
      id: source.id,
      updates: { isActive: !source.isActive },
    });
  };

  const handleVerify = (source: Source) => {
    verifySourceMutation.mutate(source.id);
  };

  const runSourceMutation = useMutation({
    mutationFn: async (source: Source) => {
      setRunningSourceId(source.id);
      const response = await apiRequest("POST", `/api/sources/${source.id}/run`);
      return response.json();
    },
    onSuccess: (data: { message: string; itemsFound: number; itemsCreated: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
      setRunningSourceId(null);
      toast({ 
        title: "Ingestion Complete", 
        description: data.message
      });
    },
    onError: (error: Error) => {
      setRunningSourceId(null);
      toast({ 
        title: "Ingestion Failed", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleRun = (source: Source) => {
    if (source.sourceType !== "rss") {
      toast({ 
        title: "Not Supported", 
        description: `Manual ingestion is only available for RSS sources. ${source.sourceType === "feedly" ? "Feedly sources are ingested through the Feedly API." : ""}`,
        variant: "destructive"
      });
      return;
    }
    runSourceMutation.mutate(source);
  };

  const [runningBulk, setRunningBulk] = useState<"industry" | "company" | null>(null);
  const [feedlySyncing, setFeedlySyncing] = useState(false);

  // Feedly queries
  const { data: feedlyStatus } = useQuery<{ connected: boolean; hasRefreshToken: boolean; error?: string }>({
    queryKey: ["/api/feedly/status"],
  });

  const { data: feedlySubscriptions = [], isLoading: feedlySubscriptionsLoading } = useQuery<Array<{
    id: string;
    title: string;
    website?: string;
    subscribers?: number;
    updated?: number;
    categories?: Array<{ id: string; label: string }>;
  }>>({
    queryKey: ["/api/feedly/subscriptions"],
    enabled: feedlyStatus?.connected === true,
  });

  const feedlySyncMutation = useMutation({
    mutationFn: async () => {
      setFeedlySyncing(true);
      const response = await apiRequest("POST", "/api/feedly/sync");
      return response.json();
    },
    onSuccess: (data: { sourcesProcessed: number; itemsFound: number; itemsCreated: number }) => {
      setFeedlySyncing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
      toast({
        title: "Feedly Sync Complete",
        description: `Processed ${data.sourcesProcessed} sources, found ${data.itemsFound} items, created ${data.itemsCreated} new signals`,
      });
    },
    onError: (error: Error) => {
      setFeedlySyncing(false);
      toast({
        title: "Feedly Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addFeedlySourceMutation = useMutation({
    mutationFn: async (subscription: { id: string; title: string; website?: string }) => {
      let domain: string | null = null;
      if (subscription.website) {
        try {
          const urlStr = subscription.website.startsWith("http") 
            ? subscription.website 
            : `https://${subscription.website}`;
          domain = new URL(urlStr).hostname;
        } catch {
          domain = subscription.website.replace(/^(https?:\/\/)?/, "").split("/")[0];
        }
      }
      return apiRequest("POST", "/api/sources", {
        name: subscription.title,
        sourceType: "feedly",
        url: subscription.id,
        domain,
        trustScore: 75,
        verificationStatus: "verified",
        isActive: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      toast({ title: "Feedly source added" });
    },
    onError: () => {
      toast({ title: "Failed to add Feedly source", variant: "destructive" });
    },
  });

  const runIndustrySourcesMutation = useMutation({
    mutationFn: async (industry: string) => {
      setRunningBulk("industry");
      const response = await apiRequest("POST", `/api/sources/run/industry/${encodeURIComponent(industry)}`);
      return response.json();
    },
    onSuccess: (data: { message: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
      setRunningBulk(null);
      toast({ title: "Ingestion Complete", description: data.message });
    },
    onError: () => {
      setRunningBulk(null);
      toast({ title: "Ingestion Failed", variant: "destructive" });
    },
  });

  const runCompanySourcesMutation = useMutation({
    mutationFn: async (companyId: number) => {
      setRunningBulk("company");
      const response = await apiRequest("POST", `/api/sources/run/company/${companyId}`);
      return response.json();
    },
    onSuccess: (data: { message: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
      setRunningBulk(null);
      toast({ title: "Ingestion Complete", description: data.message });
    },
    onError: () => {
      setRunningBulk(null);
      toast({ title: "Ingestion Failed", variant: "destructive" });
    },
  });

  const handleSaveEdit = () => {
    if (!editingSource) return;
    updateSourceMutation.mutate({
      id: editingSource.id,
      updates: editForm,
    });
  };

  const industries = Array.from(new Set(companies.map(c => c.industry).filter((i): i is string => Boolean(i))));

  // Stats computed from all sources (before filtering)
  const stats = useMemo(() => {
    const active = sources.filter(s => s.isActive).length;
    const inactive = sources.filter(s => !s.isActive).length;
    const verified = sources.filter(s => s.verificationStatus === "verified").length;
    const needsReview = sources.filter(s => s.verificationStatus === "needs_review" || !s.verificationStatus).length;
    const broken = sources.filter(s => s.verificationStatus === "broken").length;
    return { total: sources.length, active, inactive, verified, needsReview, broken };
  }, [sources]);

  const filteredSources = useMemo(() => {
    return sources.filter(source => {
      if (activeFilter === "active" && !source.isActive) return false;
      if (activeFilter === "disabled" && source.isActive) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!source.name.toLowerCase().includes(query) && 
            !(source.domain && source.domain.toLowerCase().includes(query))) {
          return false;
        }
      }
      return true;
    });
  }, [sources, activeFilter, searchQuery]);

  // Selection handlers
  const handleSelectChange = (id: number, selected: boolean) => {
    setSelectedSourceIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedSourceIds(new Set(filteredSources.map(s => s.id)));
    } else {
      setSelectedSourceIds(new Set());
    }
  };

  // Bulk action mutations
  const bulkToggleMutation = useMutation({
    mutationFn: async (activate: boolean) => {
      setBulkActionRunning("toggle");
      const ids = Array.from(selectedSourceIds);
      await Promise.all(ids.map(id => 
        apiRequest("PATCH", `/api/sources/${id}`, { isActive: activate })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      toast({ title: `Updated ${selectedSourceIds.size} sources` });
      setSelectedSourceIds(new Set());
      setBulkActionRunning(null);
    },
    onError: () => {
      toast({ title: "Failed to update sources", variant: "destructive" });
      setBulkActionRunning(null);
    },
  });

  const bulkVerifyMutation = useMutation({
    mutationFn: async () => {
      setBulkActionRunning("verify");
      const ids = Array.from(selectedSourceIds);
      await Promise.all(ids.map(id => 
        apiRequest("POST", `/api/sources/${id}/verify`)
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      toast({ title: `Verified ${selectedSourceIds.size} sources` });
      setSelectedSourceIds(new Set());
      setBulkActionRunning(null);
    },
    onError: () => {
      toast({ title: "Failed to verify sources", variant: "destructive" });
      setBulkActionRunning(null);
    },
  });

  const bulkRunMutation = useMutation({
    mutationFn: async () => {
      setBulkActionRunning("run");
      const ids = Array.from(selectedSourceIds);
      const rssSources = sources.filter(s => ids.includes(s.id) && s.sourceType === "rss");
      for (const source of rssSources) {
        await apiRequest("POST", `/api/sources/${source.id}/run`);
      }
      return { count: rssSources.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
      toast({ title: `Ran ingestion for ${data.count} RSS sources` });
      setSelectedSourceIds(new Set());
      setBulkActionRunning(null);
    },
    onError: () => {
      toast({ title: "Failed to run ingestion", variant: "destructive" });
      setBulkActionRunning(null);
    },
  });

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Sources</h1>
            <p className="text-muted-foreground">Manage signal sources and ingestion</p>
          </div>
          <Button asChild data-testid="button-discover-sources">
            <Link href="/sources/discover">
              <Compass className="w-4 h-4 mr-2" />
              Discover Sources
            </Link>
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold" data-testid="stat-total">{stats.total}</div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Active</span>
              <Power className="w-4 h-4 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-green-600" data-testid="stat-active">{stats.active}</div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Verified</span>
              <CheckCircle className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-blue-600" data-testid="stat-verified">{stats.verified}</div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Needs Review</span>
              <AlertCircle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-amber-600" data-testid="stat-needs-review">{stats.needsReview}</div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Broken</span>
              <XCircle className="w-4 h-4 text-red-600" />
            </div>
            <div className="text-2xl font-bold text-red-600" data-testid="stat-broken">{stats.broken}</div>
          </Card>
        </div>

        {/* Bulk Actions Bar */}
        {selectedSourceIds.size > 0 && (
          <Card className="p-3 bg-muted/50">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-medium">
                {selectedSourceIds.size} source{selectedSourceIds.size > 1 ? "s" : ""} selected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => bulkToggleMutation.mutate(true)}
                  disabled={bulkActionRunning !== null}
                  data-testid="button-bulk-enable"
                >
                  {bulkActionRunning === "toggle" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Power className="w-4 h-4 mr-1" />}
                  Enable
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => bulkToggleMutation.mutate(false)}
                  disabled={bulkActionRunning !== null}
                  data-testid="button-bulk-disable"
                >
                  {bulkActionRunning === "toggle" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Power className="w-4 h-4 mr-1" />}
                  Disable
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => bulkVerifyMutation.mutate()}
                  disabled={bulkActionRunning !== null}
                  data-testid="button-bulk-verify"
                >
                  {bulkActionRunning === "verify" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                  Verify
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => bulkRunMutation.mutate()}
                  disabled={bulkActionRunning !== null}
                  data-testid="button-bulk-run"
                >
                  {bulkActionRunning === "run" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
                  Run Ingestion
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedSourceIds(new Set())}
                  data-testid="button-clear-selection"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              </div>
            </div>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all-sources">All Sources</TabsTrigger>
            <TabsTrigger value="by-industry" data-testid="tab-by-industry">By Industry</TabsTrigger>
            <TabsTrigger value="by-company" data-testid="tab-by-company">By Company</TabsTrigger>
            <TabsTrigger value="feedly" data-testid="tab-feedly">
              <CloudCog className="w-4 h-4 mr-1" />
              Feedly
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap gap-3 mt-4 items-center">
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search sources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-[200px]"
                data-testid="input-search-sources"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]" data-testid="filter-type">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="rss">RSS Feed</SelectItem>
                <SelectItem value="feedly">Feedly</SelectItem>
                <SelectItem value="crawl">Web Crawl</SelectItem>
                <SelectItem value="regulator">Regulator</SelectItem>
                <SelectItem value="association">Association</SelectItem>
                <SelectItem value="llm">LLM Discovery</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" data-testid="filter-status">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="needs_review">Needs Review</SelectItem>
                <SelectItem value="broken">Broken</SelectItem>
              </SelectContent>
            </Select>

            <Select value={activeFilter} onValueChange={setActiveFilter}>
              <SelectTrigger className="w-[150px]" data-testid="filter-active">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="disabled">Disabled Only</SelectItem>
              </SelectContent>
            </Select>

            {activeTab === "by-industry" && (
              <>
                <Select value={marketFilter} onValueChange={setMarketFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="filter-market">
                    <SelectValue placeholder="Select Industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Industries</SelectItem>
                    {industries.map(industry => (
                      <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {marketFilter && marketFilter !== "all" && (
                  <Button
                    variant="outline"
                    onClick={() => runIndustrySourcesMutation.mutate(marketFilter)}
                    disabled={runningBulk !== null}
                    data-testid="button-run-industry-sources"
                  >
                    {runningBulk === "industry" ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Run All Sources
                      </>
                    )}
                  </Button>
                )}
              </>
            )}

            {activeTab === "by-company" && (
              <>
                <Select value={companyFilter} onValueChange={setCompanyFilter}>
                  <SelectTrigger className="w-[200px]" data-testid="filter-company">
                    <SelectValue placeholder="Select Company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    {companies.map(company => (
                      <SelectItem key={company.id} value={String(company.id)}>{company.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {companyFilter && companyFilter !== "all" && (
                  <Button
                    variant="outline"
                    onClick={() => runCompanySourcesMutation.mutate(parseInt(companyFilter))}
                    disabled={runningBulk !== null}
                    data-testid="button-run-company-sources"
                  >
                    {runningBulk === "company" ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Run All Sources
                      </>
                    )}
                  </Button>
                )}
              </>
            )}
          </div>

          <TabsContent value="all" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <SourcesTable
                  sources={filteredSources}
                  onEdit={handleEdit}
                  onToggle={handleToggle}
                  onVerify={handleVerify}
                  onRun={handleRun}
                  isLoading={isLoading}
                  runningSourceId={runningSourceId}
                  selectedIds={selectedSourceIds}
                  onSelectChange={handleSelectChange}
                  onSelectAll={handleSelectAll}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="by-industry" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <SourcesTable
                  sources={filteredSources}
                  onEdit={handleEdit}
                  onToggle={handleToggle}
                  onVerify={handleVerify}
                  onRun={handleRun}
                  isLoading={isLoading}
                  runningSourceId={runningSourceId}
                  selectedIds={selectedSourceIds}
                  onSelectChange={handleSelectChange}
                  onSelectAll={handleSelectAll}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="by-company" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <SourcesTable
                  sources={filteredSources}
                  onEdit={handleEdit}
                  onToggle={handleToggle}
                  onVerify={handleVerify}
                  onRun={handleRun}
                  isLoading={isLoading}
                  runningSourceId={runningSourceId}
                  selectedIds={selectedSourceIds}
                  onSelectChange={handleSelectChange}
                  onSelectAll={handleSelectAll}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="feedly" className="mt-4">
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CloudCog className="w-5 h-5" />
                      Feedly Connection
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {feedlyStatus?.connected && (
                      <Button
                        variant="outline"
                        onClick={() => feedlySyncMutation.mutate()}
                        disabled={feedlySyncing}
                        data-testid="button-feedly-sync"
                      >
                        {feedlySyncing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Sync Now
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {feedlyStatus?.connected ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-5 h-5" />
                      <span>Connected to Feedly</span>
                      {feedlyStatus.hasRefreshToken && (
                        <Badge variant="secondary" className="ml-2">Auto-refresh enabled</Badge>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-amber-600">
                        <AlertCircle className="w-5 h-5" />
                        <span>Feedly not connected</span>
                      </div>
                      {feedlyStatus?.error && (
                        <p className="text-sm text-muted-foreground">{feedlyStatus.error}</p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        Add your FEEDLY_ACCESS_TOKEN in the Secrets tab to connect.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {feedlyStatus?.connected && (
                <Card>
                  <CardHeader>
                    <CardTitle>Your Feedly Subscriptions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {feedlySubscriptionsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : feedlySubscriptions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No subscriptions found in your Feedly account</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Feed</TableHead>
                            <TableHead>Categories</TableHead>
                            <TableHead>Subscribers</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {feedlySubscriptions.map((sub) => {
                            const isAlreadyAdded = sources.some(s => s.sourceType === "feedly" && s.url === sub.id);
                            return (
                              <TableRow key={sub.id}>
                                <TableCell>
                                  <div className="flex flex-col gap-1">
                                    <span className="font-medium">{sub.title}</span>
                                    {sub.website && (
                                      <a
                                        href={sub.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
                                      >
                                        {sub.website}
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {sub.categories?.map((cat) => (
                                      <Badge key={cat.id} variant="outline" className="text-xs">
                                        {cat.label}
                                      </Badge>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {sub.subscribers?.toLocaleString() || "-"}
                                </TableCell>
                                <TableCell>
                                  {isAlreadyAdded ? (
                                    <Badge variant="secondary">Added</Badge>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => addFeedlySourceMutation.mutate(sub)}
                                      disabled={addFeedlySourceMutation.isPending}
                                      data-testid={`button-add-feedly-${sub.id}`}
                                    >
                                      <Plus className="w-4 h-4 mr-1" />
                                      Add
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Added Feedly Sources</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <SourcesTable
                    sources={sources.filter(s => s.sourceType === "feedly")}
                    onEdit={handleEdit}
                    onToggle={handleToggle}
                    onVerify={handleVerify}
                    onRun={handleRun}
                    isLoading={isLoading}
                    runningSourceId={runningSourceId}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={!!editingSource} onOpenChange={() => setEditingSource(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Source</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  data-testid="input-edit-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sourceType">Type</Label>
                <Select 
                  value={editForm.sourceType} 
                  onValueChange={(val) => setEditForm({ ...editForm, sourceType: val })}
                >
                  <SelectTrigger data-testid="select-edit-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rss">RSS Feed</SelectItem>
                    <SelectItem value="feedly">Feedly</SelectItem>
                    <SelectItem value="crawl">Web Crawl</SelectItem>
                    <SelectItem value="regulator">Regulator</SelectItem>
                    <SelectItem value="association">Association</SelectItem>
                    <SelectItem value="llm">LLM Discovery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  value={editForm.url}
                  onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                  data-testid="input-edit-url"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="domain">Domain</Label>
                <Input
                  id="domain"
                  value={editForm.domain}
                  onChange={(e) => setEditForm({ ...editForm, domain: e.target.value })}
                  data-testid="input-edit-domain"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trustScore">Trust Score: {editForm.trustScore}</Label>
                <Input
                  id="trustScore"
                  type="range"
                  min={0}
                  max={100}
                  value={editForm.trustScore}
                  onChange={(e) => setEditForm({ ...editForm, trustScore: parseInt(e.target.value) })}
                  data-testid="input-edit-trust"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="isActive">Active</Label>
                <Switch
                  id="isActive"
                  checked={editForm.isActive}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, isActive: checked })}
                  data-testid="switch-edit-active"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingSource(null)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSaveEdit} 
                disabled={updateSourceMutation.isPending}
                data-testid="button-save-edit"
              >
                {updateSourceMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
