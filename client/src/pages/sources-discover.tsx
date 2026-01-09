import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export default function SourcesDiscoverPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("domain");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("none");
  const [domainInput, setDomainInput] = useState("");
  const [marketInput, setMarketInput] = useState("any");
  const [keywordsInput, setKeywordsInput] = useState("");
  const [discoveredSources, setDiscoveredSources] = useState<DiscoveredSource[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const discoverDomainMutation = useMutation({
    mutationFn: async (params: { domain?: string; companyId?: number; market?: string }) => {
      return apiRequest("POST", "/api/sources/discover/domain", params);
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
      return apiRequest("POST", "/api/sources/discover/web", params);
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
      return apiRequest("POST", "/api/sources", {
        name: source.name,
        sourceType: source.type,
        url: source.url,
        domain: source.domain,
        trustScore: Math.round(source.confidence),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      toast({ title: "Source added successfully" });
    },
    onError: () => {
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

  const industries = Array.from(new Set(companies.map(c => c.industry).filter((i): i is string => Boolean(i))));

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
              Company / Domain
            </TabsTrigger>
            <TabsTrigger value="web" data-testid="tab-web-discovery">
              <Globe className="w-4 h-4 mr-2" />
              Open Web
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
                        <SelectItem value="none">No company</SelectItem>
                        {companies.map(company => (
                          <SelectItem key={company.id} value={String(company.id)}>
                            {company.name}
                          </SelectItem>
                        ))}
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
                        <Button
                          size="sm"
                          onClick={() => addSourceMutation.mutate(source)}
                          disabled={addSourceMutation.isPending}
                          data-testid={`button-add-source-${source.id}`}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Source
                        </Button>
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
