import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  runningSourceId
}: { 
  sources: Source[];
  onEdit: (source: Source) => void;
  onToggle: (source: Source) => void;
  onVerify: (source: Source) => void;
  onRun: (source: Source) => void;
  isLoading: boolean;
  runningSourceId: number | null;
}) {
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
          return (
            <TableRow key={source.id} data-testid={`source-row-${source.id}`}>
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
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [runningSourceId, setRunningSourceId] = useState<number | null>(null);
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

  const filteredSources = sources.filter(source => {
    if (activeFilter === "active" && !source.isActive) return false;
    if (activeFilter === "disabled" && source.isActive) return false;
    return true;
  });

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all-sources">All Sources</TabsTrigger>
            <TabsTrigger value="by-industry" data-testid="tab-by-industry">By Industry</TabsTrigger>
            <TabsTrigger value="by-company" data-testid="tab-by-company">By Company</TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap gap-3 mt-4">
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
                />
              </CardContent>
            </Card>
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
