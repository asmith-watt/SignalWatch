import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
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
  Rss,
  Globe,
  Search,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Plus,
  Building2,
  Compass,
  ExternalLink,
  Upload,
  ListPlus,
  Factory,
  PlayCircle,
  Pause,
  X,
  FileSpreadsheet,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import type { Company } from "@shared/schema";

interface DiscoveredSource {
  id: string;
  name: string;
  type: "rss" | "crawl" | "regulator" | "association";
  url: string;
  domain: string;
  verified: boolean;
  sampleTitles?: string[];
  lastUpdated?: string;
  confidence: number;
}

interface QueueItem {
  id: string;
  name: string;
  type: "company" | "domain";
  companyId?: number;
  domain?: string;
  status: "pending" | "running" | "completed" | "failed";
  sourcesFound: number;
}

interface CoverageItem {
  id: number;
  name: string;
  industry: string | null;
  website: string | null;
  sourceCount: number;
  hasWebsite: boolean;
}

interface CoverageData {
  coverage: CoverageItem[];
  totalCompanies: number;
  companiesWithSources: number;
  companiesWithoutSources: number;
}

export default function SourcesDiscoverPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("domain");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("none");
  const [domainInput, setDomainInput] = useState("");
  const [marketInput, setMarketInput] = useState("any");
  const [keywordsInput, setKeywordsInput] = useState("");
  const [discoveredSources, setDiscoveredSources] = useState<DiscoveredSource[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [addedSourceUrls, setAddedSourceUrls] = useState<Set<string>>(new Set());
  const [addingSourceId, setAddingSourceId] = useState<string | null>(null);
  const [companySearch, setCompanySearch] = useState("");

  // Batch discovery state
  const [discoveryQueue, setDiscoveryQueue] = useState<QueueItem[]>([]);
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const [queueProgress, setQueueProgress] = useState({ current: 0, total: 0 });
  const [csvInput, setCsvInput] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState<string>("none");
  const [selectedCompaniesForBatch, setSelectedCompaniesForBatch] = useState<Set<number>>(new Set());
  const queueAbortRef = useRef(false);

  // Gap analysis state
  const [gapIndustryFilter, setGapIndustryFilter] = useState<string>("all");
  const [gapShowOnlyNoCoverage, setGapShowOnlyNoCoverage] = useState(false);

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: coverageData } = useQuery<CoverageData>({
    queryKey: ["/api/sources/coverage"],
  });

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(companySearch.toLowerCase())
  );

  const industries = Array.from(new Set(companies.map(c => c.industry).filter((i): i is string => Boolean(i))));

  // Filtered coverage for Gap Analysis
  const filteredCoverage = (coverageData?.coverage || []).filter(item => {
    if (gapIndustryFilter !== "all" && item.industry !== gapIndustryFilter) return false;
    if (gapShowOnlyNoCoverage && item.sourceCount > 0) return false;
    return true;
  });

  const discoverDomainMutation = useMutation({
    mutationFn: async (params: { domain?: string; companyId?: number; market?: string }) => {
      const response = await apiRequest("POST", "/api/sources/discover/domain", params);
      return response.json();
    },
    onSuccess: (data: any) => {
      setDiscoveredSources(data.sources || []);
      toast({ 
        title: "Discovery complete", 
        description: `Found ${data.sources?.length || 0} potential sources` 
      });
      setIsDiscovering(false);
    },
    onError: () => {
      toast({ title: "Discovery failed", variant: "destructive" });
      setIsDiscovering(false);
    },
  });

  const discoverWebMutation = useMutation({
    mutationFn: async (params: { market: string; keywords: string }) => {
      const response = await apiRequest("POST", "/api/sources/discover/web", params);
      return response.json();
    },
    onSuccess: (data: any) => {
      setDiscoveredSources(data.sources || []);
      toast({ 
        title: "Discovery complete", 
        description: `Found ${data.sources?.length || 0} verified sources` 
      });
      setIsDiscovering(false);
    },
    onError: () => {
      toast({ title: "Discovery failed", variant: "destructive" });
      setIsDiscovering(false);
    },
  });

  const addSourceMutation = useMutation({
    mutationFn: async (source: DiscoveredSource) => {
      setAddingSourceId(source.id);
      return apiRequest("POST", "/api/sources", {
        name: source.name,
        sourceType: source.type,
        url: source.url,
        domain: source.domain,
        trustScore: Math.round(source.confidence),
      });
    },
    onSuccess: (_, source) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      setAddedSourceUrls(prev => new Set(prev).add(source.url));
      setAddingSourceId(null);
      toast({ title: "Source added successfully" });
    },
    onError: () => {
      setAddingSourceId(null);
      toast({ title: "Failed to add source", variant: "destructive" });
    },
  });

  const handleDomainDiscover = () => {
    setIsDiscovering(true);
    setDiscoveredSources([]);
    
    const params: { domain?: string; companyId?: number; market?: string } = {};
    if (domainInput) params.domain = domainInput;
    if (selectedCompanyId && selectedCompanyId !== "none") params.companyId = parseInt(selectedCompanyId);
    if (marketInput && marketInput !== "any") params.market = marketInput;
    
    discoverDomainMutation.mutate(params);
  };

  const handleWebDiscover = () => {
    if (!marketInput || marketInput === "any" || !keywordsInput) {
      toast({ title: "Please enter market and keywords", variant: "destructive" });
      return;
    }
    setIsDiscovering(true);
    setDiscoveredSources([]);
    discoverWebMutation.mutate({ market: marketInput, keywords: keywordsInput });
  };

  // Batch discovery functions
  const addCompanyToQueue = (company: Company) => {
    if (discoveryQueue.some(q => q.companyId === company.id)) return;
    setDiscoveryQueue(prev => [...prev, {
      id: `company-${company.id}`,
      name: company.name,
      type: "company",
      companyId: company.id,
      status: "pending",
      sourcesFound: 0,
    }]);
  };

  const addDomainToQueue = (domain: string) => {
    const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!cleanDomain || discoveryQueue.some(q => q.domain === cleanDomain)) return;
    setDiscoveryQueue(prev => [...prev, {
      id: `domain-${cleanDomain}`,
      name: cleanDomain,
      type: "domain",
      domain: cleanDomain,
      status: "pending",
      sourcesFound: 0,
    }]);
  };

  const removeFromQueue = (id: string) => {
    setDiscoveryQueue(prev => prev.filter(q => q.id !== id));
  };

  const clearQueue = () => {
    if (isQueueRunning) {
      queueAbortRef.current = true;
    }
    setDiscoveryQueue([]);
    setIsQueueRunning(false);
  };

  const parseCSVInput = () => {
    const lines = csvInput.split(/[\n,]/).map(l => l.trim()).filter(Boolean);
    const newItems: QueueItem[] = [];
    
    for (const line of lines) {
      // Check if it's a company name (match against existing companies)
      const matchedCompany = companies.find(c => 
        c.name.toLowerCase() === line.toLowerCase()
      );
      
      if (matchedCompany && !discoveryQueue.some(q => q.companyId === matchedCompany.id)) {
        newItems.push({
          id: `company-${matchedCompany.id}`,
          name: matchedCompany.name,
          type: "company",
          companyId: matchedCompany.id,
          status: "pending",
          sourcesFound: 0,
        });
      } else if (!matchedCompany) {
        // Treat as domain
        const cleanDomain = line.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        if (cleanDomain && !discoveryQueue.some(q => q.domain === cleanDomain)) {
          newItems.push({
            id: `domain-${cleanDomain}`,
            name: cleanDomain,
            type: "domain",
            domain: cleanDomain,
            status: "pending",
            sourcesFound: 0,
          });
        }
      }
    }
    
    setDiscoveryQueue(prev => [...prev, ...newItems]);
    setCsvInput("");
    toast({ title: `Added ${newItems.length} items to queue` });
  };

  const addIndustryToQueue = () => {
    if (selectedIndustry === "none") return;
    const industryCompanies = companies.filter(c => c.industry === selectedIndustry);
    const newItems: QueueItem[] = [];
    
    for (const company of industryCompanies) {
      if (!discoveryQueue.some(q => q.companyId === company.id)) {
        newItems.push({
          id: `company-${company.id}`,
          name: company.name,
          type: "company",
          companyId: company.id,
          status: "pending",
          sourcesFound: 0,
        });
      }
    }
    
    setDiscoveryQueue(prev => [...prev, ...newItems]);
    toast({ title: `Added ${newItems.length} companies from ${selectedIndustry}` });
  };

  const addSelectedCompaniesToQueue = () => {
    const newItems: QueueItem[] = [];
    for (const companyId of Array.from(selectedCompaniesForBatch)) {
      const company = companies.find(c => c.id === companyId);
      if (company && !discoveryQueue.some(q => q.companyId === company.id)) {
        newItems.push({
          id: `company-${company.id}`,
          name: company.name,
          type: "company",
          companyId: company.id,
          status: "pending",
          sourcesFound: 0,
        });
      }
    }
    setDiscoveryQueue(prev => [...prev, ...newItems]);
    setSelectedCompaniesForBatch(new Set());
    toast({ title: `Added ${newItems.length} companies to queue` });
  };

  const stopQueue = () => {
    queueAbortRef.current = true;
    setIsQueueRunning(false);
    // Mark any running items back to pending so they can be retried
    setDiscoveryQueue(prev => prev.map(q => 
      q.status === "running" ? { ...q, status: "pending" } : q
    ));
    toast({ title: "Queue stopped" });
  };

  const runDiscoveryQueue = async () => {
    const pendingItems = discoveryQueue.filter(q => q.status === "pending");
    if (pendingItems.length === 0) return;
    
    setIsQueueRunning(true);
    queueAbortRef.current = false;
    setQueueProgress({ current: 0, total: pendingItems.length });
    
    // Clear discovered sources for this batch run to maintain provenance
    setDiscoveredSources([]);
    
    for (let i = 0; i < pendingItems.length; i++) {
      // Check abort before starting each item
      if (queueAbortRef.current) {
        break;
      }
      
      const item = pendingItems[i];
      setQueueProgress({ current: i + 1, total: pendingItems.length });
      
      // Update status to running
      setDiscoveryQueue(prev => prev.map(q => 
        q.id === item.id ? { ...q, status: "running" } : q
      ));
      
      try {
        const params: { domain?: string; companyId?: number } = {};
        if (item.type === "company" && item.companyId) {
          params.companyId = item.companyId;
        } else if (item.domain) {
          params.domain = item.domain;
        }
        
        const response = await apiRequest("POST", "/api/sources/discover/domain", params);
        const data = await response.json();
        const sourcesFound = data.sources?.length || 0;
        
        // Add discovered sources to the batch results
        setDiscoveredSources(prev => [...prev, ...(data.sources || [])]);
        
        // Update status to completed
        setDiscoveryQueue(prev => prev.map(q => 
          q.id === item.id ? { ...q, status: "completed", sourcesFound } : q
        ));
      } catch {
        setDiscoveryQueue(prev => prev.map(q => 
          q.id === item.id ? { ...q, status: "failed" } : q
        ));
      }
      
      // Check abort after each item completes
      if (queueAbortRef.current) {
        break;
      }
    }
    
    // Only show completion if not aborted
    if (!queueAbortRef.current) {
      setIsQueueRunning(false);
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      toast({ title: "Batch discovery completed" });
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Discover Sources</h1>
          <p className="text-muted-foreground">Find new signal sources to add to your collection</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="domain" data-testid="tab-domain-discovery">
              <Building2 className="w-4 h-4 mr-2" />
              Single
            </TabsTrigger>
            <TabsTrigger value="batch" data-testid="tab-batch-discovery">
              <ListPlus className="w-4 h-4 mr-2" />
              Batch
            </TabsTrigger>
            <TabsTrigger value="web" data-testid="tab-web-discovery">
              <Globe className="w-4 h-4 mr-2" />
              Open Web
            </TabsTrigger>
            <TabsTrigger value="gap" data-testid="tab-gap-analysis">
              <BarChart3 className="w-4 h-4 mr-2" />
              Gap Analysis
            </TabsTrigger>
          </TabsList>

          <TabsContent value="domain" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Company Domain Discovery</CardTitle>
                <CardDescription>
                  Discover RSS feeds, news pages, and crawlable content from company domains
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company">Select Company</Label>
                    <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                      <SelectTrigger data-testid="select-company">
                        <SelectValue placeholder="Choose a company" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2">
                          <Input
                            placeholder="Search companies..."
                            value={companySearch}
                            onChange={(e) => setCompanySearch(e.target.value)}
                            className="h-8"
                            data-testid="input-company-search"
                          />
                        </div>
                        <SelectItem value="none">No company</SelectItem>
                        {filteredCompanies.slice(0, 50).map(company => (
                          <SelectItem key={company.id} value={String(company.id)}>
                            {company.name}
                          </SelectItem>
                        ))}
                        {filteredCompanies.length > 50 && (
                          <div className="px-2 py-1 text-xs text-muted-foreground">
                            Showing first 50 of {filteredCompanies.length} results...
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="domain">Or Enter Domain</Label>
                    <Input
                      id="domain"
                      placeholder="example.com"
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value)}
                      data-testid="input-domain"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="market">Market / Industry</Label>
                    <Select value={marketInput} onValueChange={setMarketInput}>
                      <SelectTrigger data-testid="select-market">
                        <SelectValue placeholder="Select market" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any market</SelectItem>
                        {industries.map(industry => (
                          <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button 
                  onClick={handleDomainDiscover}
                  disabled={isDiscovering || ((selectedCompanyId === "none" || !selectedCompanyId) && !domainInput)}
                  data-testid="button-discover-domain"
                >
                  {isDiscovering ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Discovering...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Discover Sources
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="batch" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left side: Add to queue */}
              <div className="space-y-4">
                {/* CSV/Text Input */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5" />
                      Import List
                    </CardTitle>
                    <CardDescription>
                      Paste company names or domains (one per line or comma-separated)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      placeholder="Enter company names or domains...&#10;stripe.com&#10;OpenAI&#10;figma.com"
                      value={csvInput}
                      onChange={(e) => setCsvInput(e.target.value)}
                      rows={4}
                      data-testid="textarea-csv-input"
                    />
                    <Button 
                      onClick={parseCSVInput}
                      disabled={!csvInput.trim()}
                      data-testid="button-parse-csv"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Add to Queue
                    </Button>
                  </CardContent>
                </Card>

                {/* Industry Batch */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Factory className="w-5 h-5" />
                      Industry Batch
                    </CardTitle>
                    <CardDescription>
                      Add all companies from an industry to the queue
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2">
                      <Select value={selectedIndustry} onValueChange={setSelectedIndustry}>
                        <SelectTrigger className="flex-1" data-testid="select-batch-industry">
                          <SelectValue placeholder="Select industry" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Select industry...</SelectItem>
                          {industries.map(industry => (
                            <SelectItem key={industry} value={industry}>
                              {industry} ({companies.filter(c => c.industry === industry).length})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        onClick={addIndustryToQueue}
                        disabled={selectedIndustry === "none"}
                        data-testid="button-add-industry"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add All
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Company Picker */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      Select Companies
                    </CardTitle>
                    <CardDescription>
                      Pick individual companies to add to the queue
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input
                      placeholder="Search companies..."
                      value={companySearch}
                      onChange={(e) => setCompanySearch(e.target.value)}
                      data-testid="input-batch-company-search"
                    />
                    <div className="max-h-[200px] overflow-y-auto border rounded-md">
                      {filteredCompanies.slice(0, 50).map(company => (
                        <label
                          key={company.id}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedCompaniesForBatch.has(company.id)}
                            onCheckedChange={(checked) => {
                              setSelectedCompaniesForBatch(prev => {
                                const next = new Set(prev);
                                if (checked) next.add(company.id);
                                else next.delete(company.id);
                                return next;
                              });
                            }}
                            data-testid={`checkbox-company-${company.id}`}
                          />
                          <span className="text-sm">{company.name}</span>
                          {company.industry && (
                            <Badge variant="outline" className="text-xs ml-auto">{company.industry}</Badge>
                          )}
                        </label>
                      ))}
                    </div>
                    {selectedCompaniesForBatch.size > 0 && (
                      <Button onClick={addSelectedCompaniesToQueue} data-testid="button-add-selected-companies">
                        <Plus className="w-4 h-4 mr-2" />
                        Add {selectedCompaniesForBatch.size} Companies
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right side: Queue */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Discovery Queue</CardTitle>
                      <CardDescription>
                        {discoveryQueue.length} items | {discoveryQueue.filter(q => q.status === "pending").length} pending
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {!isQueueRunning ? (
                        <Button
                          onClick={runDiscoveryQueue}
                          disabled={discoveryQueue.filter(q => q.status === "pending").length === 0}
                          data-testid="button-run-queue"
                        >
                          <PlayCircle className="w-4 h-4 mr-2" />
                          Run Discovery
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={stopQueue}
                          data-testid="button-stop-queue"
                        >
                          <Pause className="w-4 h-4 mr-2" />
                          Stop
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={clearQueue}
                        disabled={discoveryQueue.length === 0}
                        data-testid="button-clear-queue"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {isQueueRunning && (
                    <div className="mt-3">
                      <Progress value={(queueProgress.current / queueProgress.total) * 100} />
                      <p className="text-xs text-muted-foreground mt-1">
                        Processing {queueProgress.current} of {queueProgress.total}...
                      </p>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {discoveryQueue.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ListPlus className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No items in queue</p>
                      <p className="text-sm">Add companies or domains to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {discoveryQueue.map(item => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 rounded-md border"
                          data-testid={`queue-item-${item.id}`}
                        >
                          <div className="flex items-center gap-2">
                            {item.type === "company" ? (
                              <Building2 className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <Globe className="w-4 h-4 text-muted-foreground" />
                            )}
                            <span className="text-sm font-medium">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.status === "pending" && (
                              <Badge variant="secondary">Pending</Badge>
                            )}
                            {item.status === "running" && (
                              <Badge variant="outline" className="text-blue-600">
                                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                Running
                              </Badge>
                            )}
                            {item.status === "completed" && (
                              <Badge variant="default" className="bg-green-600">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                {item.sourcesFound} found
                              </Badge>
                            )}
                            {item.status === "failed" && (
                              <Badge variant="destructive">Failed</Badge>
                            )}
                            {item.status === "pending" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => removeFromQueue(item.id)}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="web" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Open Web Discovery</CardTitle>
                <CardDescription>
                  Search the web for verified industry sources, regulators, and associations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="webMarket">Market / Industry</Label>
                    <Select value={marketInput} onValueChange={setMarketInput}>
                      <SelectTrigger data-testid="select-web-market">
                        <SelectValue placeholder="Select market" />
                      </SelectTrigger>
                      <SelectContent>
                        {industries.map(industry => (
                          <SelectItem key={industry} value={industry || ""}>{industry}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="keywords">Keywords</Label>
                    <Input
                      id="keywords"
                      placeholder="e.g., poultry news, feed industry"
                      value={keywordsInput}
                      onChange={(e) => setKeywordsInput(e.target.value)}
                      data-testid="input-keywords"
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleWebDiscover}
                  disabled={isDiscovering || !marketInput || marketInput === "any" || !keywordsInput}
                  data-testid="button-discover-web"
                >
                  {isDiscovering ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Compass className="w-4 h-4 mr-2" />
                      Search Web
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gap" className="mt-4 space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold" data-testid="stat-total-companies">
                    {coverageData?.totalCompanies || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Total Companies</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-green-600" data-testid="stat-with-sources">
                    {coverageData?.companiesWithSources || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">With Sources</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-amber-600" data-testid="stat-without-sources">
                    {coverageData?.companiesWithoutSources || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">No Sources</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold" data-testid="stat-coverage-rate">
                    {coverageData?.totalCompanies && coverageData.totalCompanies > 0
                      ? Math.round((coverageData.companiesWithSources / coverageData.totalCompanies) * 100) 
                      : 0}%
                  </div>
                  <p className="text-sm text-muted-foreground">Coverage Rate</p>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label>Industry:</Label>
                    <Select value={gapIndustryFilter} onValueChange={setGapIndustryFilter}>
                      <SelectTrigger className="w-[200px]" data-testid="select-gap-industry">
                        <SelectValue placeholder="All industries" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Industries</SelectItem>
                        {industries.map(industry => (
                          <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={gapShowOnlyNoCoverage}
                      onCheckedChange={(checked) => setGapShowOnlyNoCoverage(!!checked)}
                      data-testid="checkbox-no-coverage-only"
                    />
                    <span className="text-sm">Show only companies without sources</span>
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Coverage Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Source Coverage by Company
                </CardTitle>
                <CardDescription>
                  {filteredCoverage.length} companies shown (sorted by coverage, lowest first)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Industry</TableHead>
                        <TableHead>Website</TableHead>
                        <TableHead className="text-center">Sources</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCoverage.map((item) => (
                        <TableRow key={item.id} data-testid={`coverage-row-${item.id}`}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>
                            {item.industry && (
                              <Badge variant="outline">{item.industry}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.hasWebsite ? (
                              <a 
                                href={item.website!} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-1"
                              >
                                <Globe className="w-3 h-3" />
                                Visit
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-sm">None</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.sourceCount === 0 ? (
                              <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                No sources
                              </Badge>
                            ) : (
                              <Badge variant="default" className="bg-green-600">
                                {item.sourceCount} source{item.sourceCount !== 1 ? 's' : ''}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.hasWebsite && item.sourceCount === 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedCompanyId(item.id.toString());
                                  setActiveTab("domain");
                                  setTimeout(() => {
                                    const btn = document.querySelector('[data-testid="button-discover-domain"]');
                                    if (btn instanceof HTMLButtonElement) btn.click();
                                  }, 100);
                                }}
                                data-testid={`button-discover-${item.id}`}
                              >
                                <Search className="w-3 h-3 mr-1" />
                                Discover
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {discoveredSources.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Discovered Sources</CardTitle>
              <CardDescription>
                {discoveredSources.length} potential sources found
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Sample Content</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discoveredSources.map((source) => (
                    <TableRow key={source.id} data-testid={`discovered-source-${source.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Rss className="w-4 h-4 text-muted-foreground" />
                          {source.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{source.type.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell>
                        <a 
                          href={source.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          {source.domain}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </TableCell>
                      <TableCell>
                        {source.verified ? (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Unverified
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <div 
                            className="w-12 h-2 rounded-full bg-muted overflow-hidden"
                          >
                            <div 
                              className="h-full bg-primary transition-all" 
                              style={{ width: `${source.confidence}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{source.confidence}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {source.sampleTitles && source.sampleTitles.length > 0 ? (
                          <div className="text-sm text-muted-foreground truncate">
                            {source.sampleTitles[0]}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {addedSourceUrls.has(source.url) ? (
                          <Badge variant="secondary" className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Added
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => addSourceMutation.mutate(source)}
                            disabled={addingSourceId !== null}
                            data-testid={`button-add-source-${source.id}`}
                          >
                            {addingSourceId === source.id ? (
                              <>
                                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                                Adding...
                              </>
                            ) : (
                              <>
                                <Plus className="w-4 h-4 mr-1" />
                                Add Source
                              </>
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {discoveredSources.length === 0 && !isDiscovering && (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center text-center">
                <Compass className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">Ready to Discover</h3>
                <p className="text-muted-foreground max-w-md">
                  Select a company or enter a domain to discover RSS feeds and crawlable content,
                  or search the open web for industry sources.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
