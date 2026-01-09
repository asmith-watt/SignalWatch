import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, Database, Building2, Radio, Loader2, CheckCircle, Sparkles, Calendar, AlertTriangle, Check, RefreshCw, Link2, Brain, Info, Cloud } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Company, Signal, Article } from "@shared/schema";
import { format } from "date-fns";
import { FileText, ExternalLink } from "lucide-react";

interface DateVerificationResult {
  signalId: number;
  title: string;
  sourceUrl: string;
  storedDate: string | null;
  extractedDate: string | null;
  match: boolean;
  error?: string;
}

interface DateVerificationResponse {
  total: number;
  mismatches: number;
  couldNotExtract: number;
  errors: number;
  results: DateVerificationResult[];
}

interface DateStats {
  total: number;
  withVerifiedDate: number;
  needsReview: number;
  bySource: Record<string, number>;
  avgConfidence: number;
}

interface BackfillResult {
  processed: number;
  fixed: number;
  flaggedForReview: number;
  inaccessible: number;
  errors: number;
}

interface SourceVerificationResult {
  signalId: number;
  signalTitle: string;
  sourceUrl: string;
  articleTitle: string | null;
  matchScore: number;
  isMatch: boolean;
  error?: string;
}

interface SourceVerificationResponse {
  total: number;
  matches: number;
  mismatches: number;
  errors: number;
  results: SourceVerificationResult[];
}

interface ProductionSyncResult {
  companiesImported: number;
  companiesUpdated: number;
  signalsImported: number;
  signalsUpdated: number;
  errors: string[];
}

export function DataManagementPage() {
  const { toast } = useToast();
  const [companiesCSV, setCompaniesCSV] = useState("");
  const [signalsCSV, setSignalsCSV] = useState("");
  const [enrichIndustry, setEnrichIndustry] = useState<string>("all");
  const [dateVerifyLimit, setDateVerifyLimit] = useState<string>("50");
  const [dateVerificationResults, setDateVerificationResults] = useState<DateVerificationResponse | null>(null);
  const [selectedMismatches, setSelectedMismatches] = useState<Set<number>>(new Set());
  const [backfillLimit, setBackfillLimit] = useState<string>("100");
  const [lastBackfillResult, setLastBackfillResult] = useState<BackfillResult | null>(null);
  const [sourceVerifyLimit, setSourceVerifyLimit] = useState<string>("50");
  const [sourceVerificationResults, setSourceVerificationResults] = useState<SourceVerificationResponse | null>(null);
  const [syncResult, setSyncResult] = useState<ProductionSyncResult | null>(null);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isPushingToProd, setIsPushingToProd] = useState(false);
  const [productionUrl, setProductionUrl] = useState(() => {
    return localStorage.getItem("signalwatch_production_url") || "";
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: signals = [] } = useQuery<Signal[]>({
    queryKey: ["/api/signals"],
  });

  const { data: articles = [], isLoading: isLoadingArticles } = useQuery<Article[]>({
    queryKey: ["/api/articles"],
  });

  const { data: dateStats, refetch: refetchDateStats } = useQuery<DateStats>({
    queryKey: ["/api/signals/date-stats"],
  });

  const importCompaniesMutation = useMutation({
    mutationFn: async (csv: string) => {
      return apiRequest("POST", "/api/import/companies", { csv });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: `Imported ${data.imported} of ${data.total} companies` });
      setCompaniesCSV("");
    },
    onError: () => {
      toast({ title: "Failed to import companies", variant: "destructive" });
    },
  });

  const importSignalsMutation = useMutation({
    mutationFn: async (csv: string) => {
      return apiRequest("POST", "/api/import/signals", { csv });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
      toast({ title: `Imported ${data.imported} of ${data.total} signals` });
      setSignalsCSV("");
    },
    onError: () => {
      toast({ title: "Failed to import signals", variant: "destructive" });
    },
  });

  const enrichCompaniesMutation = useMutation({
    mutationFn: async (industry?: string) => {
      const body = industry && industry !== "all" ? { industry } : {};
      return apiRequest("POST", "/api/companies/enrich", body);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ 
        title: "Enrichment Complete", 
        description: `Updated ${data.companiesUpdated} of ${data.companiesProcessed} companies with AI data` 
      });
    },
    onError: () => {
      toast({ title: "Failed to enrich companies", variant: "destructive" });
    },
  });

  const analyzeAllSignalsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/signals/analyze-all", {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
      toast({ 
        title: "Analysis Complete", 
        description: `Analyzed ${data.analyzed} signals (${data.failed} failed)` 
      });
    },
    onError: () => {
      toast({ title: "Failed to analyze signals", variant: "destructive" });
    },
  });

  const verifyDatesMutation = useMutation({
    mutationFn: async (limit: number) => {
      const response = await fetch(`/api/signals/verify-dates?limit=${limit}&onlyMismatches=true`);
      if (!response.ok) throw new Error("Failed to verify dates");
      return response.json() as Promise<DateVerificationResponse>;
    },
    onSuccess: (data) => {
      setDateVerificationResults(data);
      const fixable = data.results.filter(r => r.extractedDate !== null);
      setSelectedMismatches(new Set(fixable.map(r => r.signalId)));
      toast({ 
        title: "Date Verification Complete", 
        description: `Found ${data.mismatches} mismatches, ${fixable.length} fixable` 
      });
    },
    onError: () => {
      toast({ title: "Failed to verify dates", variant: "destructive" });
    },
  });

  const fixDatesMutation = useMutation({
    mutationFn: async (signalIds: number[]) => {
      return apiRequest("POST", "/api/signals/fix-dates", { signalIds });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
      toast({ 
        title: "Dates Fixed", 
        description: `Fixed ${data.fixed} signals, ${data.errors} errors` 
      });
      setDateVerificationResults(null);
      setSelectedMismatches(new Set());
    },
    onError: () => {
      toast({ title: "Failed to fix dates", variant: "destructive" });
    },
  });

  const backfillDatesMutation = useMutation({
    mutationFn: async (limit: number) => {
      const response = await fetch(`/api/admin/dates/backfill?limit=${limit}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Backfill failed");
      }
      return response.json() as Promise<BackfillResult>;
    },
    onSuccess: (data) => {
      setLastBackfillResult(data);
      refetchDateStats();
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
      toast({
        title: "Date Backfill Complete",
        description: `Processed ${data.processed}: ${data.fixed} fixed, ${data.flaggedForReview} need review, ${data.inaccessible} inaccessible`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Backfill Failed", description: error.message, variant: "destructive" });
    },
  });

  const verifySourcesMutation = useMutation({
    mutationFn: async (limit: number) => {
      const response = await fetch(`/api/signals/verify-sources?limit=${limit}&onlyMismatches=true`);
      if (!response.ok) throw new Error("Failed to verify sources");
      return response.json() as Promise<SourceVerificationResponse>;
    },
    onSuccess: (data) => {
      setSourceVerificationResults(data);
      toast({ 
        title: "Source Verification Complete", 
        description: `Found ${data.mismatches} mismatches out of ${data.total} checked` 
      });
    },
    onError: () => {
      toast({ title: "Failed to verify sources", variant: "destructive" });
    },
  });

  const importAllDataMutation = useMutation({
    mutationFn: async (data: { companies: Company[]; signals: Signal[]; alerts?: unknown[] }): Promise<ProductionSyncResult> => {
      const response = await fetch("/api/import/all-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Import failed with status ${response.status}`);
      }
      return response.json();
    },
    onSuccess: (data: ProductionSyncResult) => {
      setSyncResult(data);
      setSyncProgress(100);
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
      setSyncLogs(prev => [
        ...prev,
        `Import complete!`,
        `Companies: ${data.companiesImported} new, ${data.companiesUpdated} updated`,
        `Signals: ${data.signalsImported} new, ${data.signalsUpdated} updated`,
        ...(data.errors.length > 0 ? [`Errors: ${data.errors.length}`] : [])
      ]);
      toast({ 
        title: "Import Complete", 
        description: `Imported ${data.companiesImported + data.signalsImported} new records` 
      });
    },
    onError: (error: Error) => {
      setSyncProgress(0);
      setSyncLogs(prev => [...prev, `Import failed: ${error.message}`]);
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const handleDownloadExport = async () => {
    setIsExporting(true);
    setSyncLogs([`Starting export...`]);
    setSyncResult(null);
    setSyncProgress(0);
    
    try {
      setSyncLogs(prev => [...prev, `Fetching all data from database...`]);
      setSyncProgress(30);
      
      const response = await fetch("/api/export/all-data");
      if (!response.ok) throw new Error(`Export failed with status ${response.status}`);
      
      const data = await response.json();
      setSyncProgress(70);
      setSyncLogs(prev => [
        ...prev, 
        `Found ${data.companies?.length || 0} companies`,
        `Found ${data.signals?.length || 0} signals`,
        `Found ${data.alerts?.length || 0} alerts`,
        `Preparing download...`
      ]);
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `signalwatch-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      setSyncProgress(100);
      setSyncLogs(prev => [...prev, `Export downloaded successfully!`]);
      toast({ title: "Export downloaded", description: `${data.companies?.length || 0} companies, ${data.signals?.length || 0} signals` });
    } catch (error: unknown) {
      setSyncProgress(0);
      const message = error instanceof Error ? error.message : "Unknown error";
      setSyncLogs(prev => [...prev, `Export failed: ${message}`]);
      toast({ title: "Export failed", description: message, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setSyncLogs([`Reading file: ${file.name}...`]);
    setSyncResult(null);
    setSyncProgress(10);
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      setSyncProgress(20);
      setSyncLogs(prev => [
        ...prev,
        `Parsed ${data.companies?.length || 0} companies`,
        `Parsed ${data.signals?.length || 0} signals`,
        `Parsed ${data.alerts?.length || 0} alerts`,
        `Starting import...`
      ]);
      
      setSyncProgress(40);
      importAllDataMutation.mutate({ 
        companies: data.companies || [], 
        signals: data.signals || [],
        alerts: data.alerts || []
      });
    } catch (error: unknown) {
      setSyncProgress(0);
      const message = error instanceof Error ? error.message : "Unknown error";
      setSyncLogs(prev => [...prev, `Failed to parse file: ${message}`]);
      toast({ title: "Invalid file format", variant: "destructive" });
    }
    
    e.target.value = "";
  };

  const handleProductionUrlChange = (url: string) => {
    setProductionUrl(url);
    localStorage.setItem("signalwatch_production_url", url);
  };

  const handlePushToProduction = async () => {
    if (!productionUrl.trim()) {
      toast({ title: "Please enter production URL", variant: "destructive" });
      return;
    }

    setIsPushingToProd(true);
    setSyncLogs([`Starting push to production...`]);
    setSyncResult(null);
    setSyncProgress(0);

    try {
      // Step 1: Export from dev
      setSyncLogs(prev => [...prev, `Fetching data from development...`]);
      setSyncProgress(20);

      const exportResponse = await fetch("/api/export/all-data");
      if (!exportResponse.ok) throw new Error(`Export failed with status ${exportResponse.status}`);

      const data = await exportResponse.json();
      setSyncProgress(40);
      setSyncLogs(prev => [
        ...prev,
        `Found ${data.companies?.length || 0} companies`,
        `Found ${data.signals?.length || 0} signals`,
        `Found ${data.alerts?.length || 0} alerts`,
        `Pushing to production: ${productionUrl}...`
      ]);

      // Step 2: Push to production
      const prodUrl = productionUrl.replace(/\/$/, ""); // Remove trailing slash
      const importResponse = await fetch(`${prodUrl}/api/import/all-data`, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companies: data.companies || [],
          signals: data.signals || [],
          alerts: data.alerts || []
        }),
      });

      if (!importResponse.ok) {
        const errorData = await importResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Production import failed with status ${importResponse.status}`);
      }

      const result: ProductionSyncResult = await importResponse.json();
      setSyncResult(result);
      setSyncProgress(100);
      setSyncLogs(prev => [
        ...prev,
        `Push complete!`,
        `Companies: ${result.companiesImported} new, ${result.companiesUpdated} updated`,
        `Signals: ${result.signalsImported} new, ${result.signalsUpdated} updated`,
        ...(result.errors.length > 0 ? [`Errors: ${result.errors.length}`] : [])
      ]);
      toast({
        title: "Push to Production Complete",
        description: `Synced ${result.companiesImported + result.signalsImported} new records`
      });
    } catch (error: unknown) {
      setSyncProgress(0);
      const message = error instanceof Error ? error.message : "Unknown error";
      setSyncLogs(prev => [...prev, `Push failed: ${message}`]);
      toast({ title: "Push to production failed", description: message, variant: "destructive" });
    } finally {
      setIsPushingToProd(false);
    }
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setter(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Data Management</h1>
          <p className="text-muted-foreground mt-1">Export and import your company and signal data</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Companies</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary">{companies.length} total</Badge>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  data-testid="button-export-companies"
                >
                  <a href="/api/export/companies.csv" download>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Signals</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary">{signals.length} total</Badge>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  data-testid="button-export-signals"
                >
                  <a href="/api/export/signals.csv" download>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">AI Enrichment</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <Select value={enrichIndustry} onValueChange={setEnrichIndustry}>
                  <SelectTrigger data-testid="select-enrich-industry">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Industries</SelectItem>
                    <SelectItem value="Poultry">Poultry</SelectItem>
                    <SelectItem value="Feed">Feed</SelectItem>
                    <SelectItem value="Pet Food">Pet Food</SelectItem>
                    <SelectItem value="Baking & Milling">Baking & Milling</SelectItem>
                    <SelectItem value="IPPE Exhibitors">IPPE Exhibitors</SelectItem>
                    <SelectItem value="Feed & Grain">Feed & Grain</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={() => enrichCompaniesMutation.mutate(enrichIndustry)}
                  disabled={enrichCompaniesMutation.isPending}
                  data-testid="button-enrich-companies"
                >
                  {enrichCompaniesMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Enrich Companies
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">AI Analysis</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">
                  {signals.filter(s => !s.aiAnalysis).length} signals pending analysis
                </p>
                <Button
                  size="sm"
                  onClick={() => analyzeAllSignalsMutation.mutate()}
                  disabled={analyzeAllSignalsMutation.isPending}
                  data-testid="button-analyze-signals"
                >
                  {analyzeAllSignalsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Brain className="h-4 w-4 mr-2" />
                  )}
                  Analyze All Signals
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Production Sync</CardTitle>
            </div>
            <CardDescription>
              Push data from development to production
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="production-url">Production URL</Label>
                <input
                  id="production-url"
                  type="text"
                  value={productionUrl}
                  onChange={(e) => handleProductionUrlChange(e.target.value)}
                  placeholder="https://your-app.replit.app"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="input-production-url"
                />
                <p className="text-xs text-muted-foreground">
                  Enter your production app URL (saved automatically)
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handlePushToProduction}
                  disabled={isPushingToProd || !productionUrl.trim()}
                  data-testid="button-push-to-production"
                >
                  {isPushingToProd ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Push to Production
                </Button>

                <Button
                  variant="outline"
                  onClick={handleDownloadExport}
                  disabled={isExporting}
                  data-testid="button-download-export"
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Download Export
                </Button>
                
                <div className="relative">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportFile}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={importAllDataMutation.isPending}
                    data-testid="input-import-file"
                  />
                  <Button
                    variant="outline"
                    disabled={importAllDataMutation.isPending}
                    data-testid="button-upload-import"
                  >
                    {importAllDataMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Import from File
                  </Button>
                </div>
              </div>

              {(syncProgress > 0 || syncLogs.length > 0) && (
                <div className="space-y-3">
                  <Progress value={syncProgress} className="h-2" />
                  
                  <div className="bg-muted rounded-md p-3 max-h-40 overflow-y-auto">
                    <div className="space-y-1 font-mono text-xs">
                      {syncLogs.map((log, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-muted-foreground">{String(i + 1).padStart(2, "0")}.</span>
                          <span className={log.includes("complete") || log.includes("success") ? "text-green-600 dark:text-green-400" : log.includes("failed") || log.includes("Error") ? "text-red-600 dark:text-red-400" : ""}>{log}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {syncResult && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-background border rounded-md p-3 text-center">
                        <div className="text-2xl font-bold text-green-600">{syncResult.companiesImported}</div>
                        <div className="text-xs text-muted-foreground">Companies Added</div>
                      </div>
                      <div className="bg-background border rounded-md p-3 text-center">
                        <div className="text-2xl font-bold text-blue-600">{syncResult.companiesUpdated}</div>
                        <div className="text-xs text-muted-foreground">Companies Updated</div>
                      </div>
                      <div className="bg-background border rounded-md p-3 text-center">
                        <div className="text-2xl font-bold text-green-600">{syncResult.signalsImported}</div>
                        <div className="text-xs text-muted-foreground">Signals Added</div>
                      </div>
                      <div className="bg-background border rounded-md p-3 text-center">
                        <div className="text-2xl font-bold text-blue-600">{syncResult.signalsUpdated}</div>
                        <div className="text-xs text-muted-foreground">Signals Updated</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-muted-foreground" />
              <CardTitle>AI Features Overview</CardTitle>
            </div>
            <CardDescription>
              Understanding how AI enrichment and analysis work in SignalWatch
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h4 className="font-medium">AI Company Enrichment</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Uses Perplexity AI to research and fill in missing company data. This includes:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Company descriptions and overviews</li>
                  <li>Official website URLs</li>
                  <li>LinkedIn and Twitter profiles</li>
                  <li>Founding year and company size</li>
                </ul>
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    <strong>When to run:</strong> After importing new companies or when you notice missing profile data.
                    Run manually as needed - not scheduled.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  <h4 className="font-medium">AI Signal Analysis</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Uses OpenAI (GPT-4o) to analyze signals and extract editorial insights. This includes:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Key takeaways and story angles</li>
                  <li>Industry impact assessment</li>
                  <li>Competitor implications</li>
                  <li>Entity extraction (people, companies, financials)</li>
                  <li>Relevance and priority scoring</li>
                </ul>
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    <strong>When to run:</strong> Click "Analyze All" to batch-process all unanalyzed signals. 
                    Signals already analyzed are skipped. Individual signals can also be analyzed from their detail page.
                    Processing time varies based on the number of signals and API response times.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Import Data</CardTitle>
            </div>
            <CardDescription>
              Upload CSV files to import companies or signals into the database
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="companies">
              <TabsList className="mb-4">
                <TabsTrigger value="companies" data-testid="tab-import-companies">Companies</TabsTrigger>
                <TabsTrigger value="signals" data-testid="tab-import-signals">Signals</TabsTrigger>
              </TabsList>

              <TabsContent value="companies" className="space-y-4">
                <div className="space-y-2">
                  <Label>Upload Companies CSV</Label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => handleFileUpload(e, setCompaniesCSV)}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground"
                    data-testid="input-companies-file"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Or paste CSV content</Label>
                  <Textarea
                    placeholder="id,name,website,industry,..."
                    value={companiesCSV}
                    onChange={(e) => setCompaniesCSV(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                    data-testid="input-companies-csv"
                  />
                </div>
                <Button
                  onClick={() => importCompaniesMutation.mutate(companiesCSV)}
                  disabled={!companiesCSV || importCompaniesMutation.isPending}
                  data-testid="button-import-companies"
                >
                  {importCompaniesMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Import Companies
                </Button>
              </TabsContent>

              <TabsContent value="signals" className="space-y-4">
                <div className="space-y-2">
                  <Label>Upload Signals CSV</Label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => handleFileUpload(e, setSignalsCSV)}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground"
                    data-testid="input-signals-file"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Or paste CSV content</Label>
                  <Textarea
                    placeholder="id,company_id,type,title,..."
                    value={signalsCSV}
                    onChange={(e) => setSignalsCSV(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                    data-testid="input-signals-csv"
                  />
                </div>
                <Button
                  onClick={() => importSignalsMutation.mutate(signalsCSV)}
                  disabled={!signalsCSV || importSignalsMutation.isPending}
                  data-testid="button-import-signals"
                >
                  {importSignalsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Import Signals
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  After importing, use the Date Verification and Source URL Verification sections below to check data quality.
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Date Verification</CardTitle>
            </div>
            <CardDescription>
              Verify and backfill publication dates from source articles. Track data quality and fix missing dates.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {dateStats && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Date Quality Overview</span>
                  <Button variant="ghost" size="sm" onClick={() => refetchDateStats()} data-testid="button-refresh-stats">
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{dateStats.withVerifiedDate}</div>
                    <div className="text-xs text-muted-foreground">Verified</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{dateStats.needsReview}</div>
                    <div className="text-xs text-muted-foreground">Needs Review</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{dateStats.total}</div>
                    <div className="text-xs text-muted-foreground">Total Signals</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{dateStats.avgConfidence}%</div>
                    <div className="text-xs text-muted-foreground">Avg Confidence</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  <span>By source:</span>
                  {Object.entries(dateStats.bySource).sort((a, b) => b[1] - a[1]).map(([source, count]) => (
                    <Badge key={source} variant="outline" className="text-xs capitalize">
                      {source}: {count}
                    </Badge>
                  ))}
                </div>
                <Progress 
                  value={dateStats.total > 0 ? (dateStats.withVerifiedDate / dateStats.total) * 100 : 0} 
                  className="h-2"
                />
                <div className="text-xs text-muted-foreground text-center">
                  {dateStats.total > 0 
                    ? `${((dateStats.withVerifiedDate / dateStats.total) * 100).toFixed(1)}% of signals have verified dates`
                    : "No signals yet"}
                </div>
              </div>
            )}

            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Batch Backfill</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Automatically extract dates from source URLs for signals with unknown date sources. Checks URL accessibility and extracts publication dates from HTML metadata.
              </p>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Label htmlFor="backfill-limit">Signals to process:</Label>
                  <Select value={backfillLimit} onValueChange={setBackfillLimit}>
                    <SelectTrigger className="w-24" data-testid="select-backfill-limit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                      <SelectItem value="500">500</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => backfillDatesMutation.mutate(parseInt(backfillLimit))}
                  disabled={backfillDatesMutation.isPending}
                  data-testid="button-backfill-dates"
                >
                  {backfillDatesMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4 mr-2" />
                  )}
                  Run Backfill
                </Button>
              </div>
              {lastBackfillResult && (
                <div className="flex items-center gap-3 flex-wrap text-sm">
                  <Badge variant="secondary">{lastBackfillResult.processed} processed</Badge>
                  <Badge className="bg-green-100 text-green-800">{lastBackfillResult.fixed} fixed</Badge>
                  <Badge variant="outline">{lastBackfillResult.flaggedForReview} flagged</Badge>
                  <Badge variant="destructive">{lastBackfillResult.inaccessible} inaccessible</Badge>
                  {lastBackfillResult.errors > 0 && (
                    <Badge variant="destructive">{lastBackfillResult.errors} errors</Badge>
                  )}
                </div>
              )}
            </div>

            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Manual Date Check</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="verify-limit">Signals to check:</Label>
                  <Select value={dateVerifyLimit} onValueChange={setDateVerifyLimit}>
                    <SelectTrigger className="w-24" data-testid="select-verify-limit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => verifyDatesMutation.mutate(parseInt(dateVerifyLimit))}
                  disabled={verifyDatesMutation.isPending}
                  variant="outline"
                  data-testid="button-verify-dates"
                >
                  {verifyDatesMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Scan for Mismatches
                </Button>
              </div>
            </div>

            {dateVerificationResults && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <Badge variant="secondary">
                    {dateVerificationResults.total} scanned
                  </Badge>
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {dateVerificationResults.mismatches} mismatches
                  </Badge>
                  <Badge variant="outline">
                    {dateVerificationResults.couldNotExtract} unreadable
                  </Badge>
                </div>

                {dateVerificationResults.results.filter(r => r.extractedDate).length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        Fixable mismatches ({selectedMismatches.size} selected):
                      </span>
                      <Button
                        size="sm"
                        onClick={() => fixDatesMutation.mutate(Array.from(selectedMismatches))}
                        disabled={selectedMismatches.size === 0 || fixDatesMutation.isPending}
                        data-testid="button-fix-dates"
                      >
                        {fixDatesMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4 mr-2" />
                        )}
                        Fix Selected
                      </Button>
                    </div>

                    <div className="max-h-64 overflow-y-auto border rounded-md">
                      <table className="w-full text-sm">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            <th className="p-2 text-left w-8">
                              <input
                                type="checkbox"
                                checked={selectedMismatches.size === dateVerificationResults.results.filter(r => r.extractedDate).length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedMismatches(new Set(
                                      dateVerificationResults.results
                                        .filter(r => r.extractedDate)
                                        .map(r => r.signalId)
                                    ));
                                  } else {
                                    setSelectedMismatches(new Set());
                                  }
                                }}
                              />
                            </th>
                            <th className="p-2 text-left">Signal</th>
                            <th className="p-2 text-left">Stored</th>
                            <th className="p-2 text-left">Actual</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dateVerificationResults.results
                            .filter(r => r.extractedDate)
                            .map((result) => (
                              <tr key={result.signalId} className="border-t">
                                <td className="p-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedMismatches.has(result.signalId)}
                                    onChange={(e) => {
                                      const newSet = new Set(selectedMismatches);
                                      if (e.target.checked) {
                                        newSet.add(result.signalId);
                                      } else {
                                        newSet.delete(result.signalId);
                                      }
                                      setSelectedMismatches(newSet);
                                    }}
                                  />
                                </td>
                                <td className="p-2">
                                  <div className="truncate max-w-xs" title={result.title}>
                                    {result.title}
                                  </div>
                                </td>
                                <td className="p-2 text-destructive whitespace-nowrap">
                                  {result.storedDate || "None"}
                                </td>
                                <td className="p-2 text-green-600 dark:text-green-400 whitespace-nowrap">
                                  {result.extractedDate}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Source URL Verification</CardTitle>
            </div>
            <CardDescription>
              Verify source URLs by checking if article headlines match signal titles. Helps identify signals pointing to wrong articles.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="source-verify-limit">Signals to check:</Label>
                <Select value={sourceVerifyLimit} onValueChange={setSourceVerifyLimit}>
                  <SelectTrigger className="w-24" data-testid="select-source-verify-limit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => verifySourcesMutation.mutate(parseInt(sourceVerifyLimit))}
                disabled={verifySourcesMutation.isPending}
                data-testid="button-verify-sources"
              >
                {verifySourcesMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Scan for Mismatches
              </Button>
            </div>

            {sourceVerificationResults && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <Badge variant="secondary">
                    {sourceVerificationResults.total} scanned
                  </Badge>
                  <Badge variant="default" className="bg-green-600 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    {sourceVerificationResults.matches} matches
                  </Badge>
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {sourceVerificationResults.mismatches} mismatches
                  </Badge>
                  <Badge variant="outline">
                    {sourceVerificationResults.errors} errors
                  </Badge>
                </div>

                {sourceVerificationResults.results.length > 0 && (
                  <div className="max-h-64 overflow-y-auto border rounded-md">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="p-2 text-left">Signal Title</th>
                          <th className="p-2 text-left">Article Title</th>
                          <th className="p-2 text-left w-20">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sourceVerificationResults.results.map((result) => (
                          <tr key={result.signalId} className="border-t">
                            <td className="p-2">
                              <div className="truncate max-w-xs" title={result.signalTitle}>
                                {result.signalTitle}
                              </div>
                            </td>
                            <td className="p-2">
                              {result.error ? (
                                <span className="text-muted-foreground italic">{result.error}</span>
                              ) : (
                                <div className="truncate max-w-xs" title={result.articleTitle || ""}>
                                  {result.articleTitle || "N/A"}
                                </div>
                              )}
                            </td>
                            <td className="p-2">
                              <Badge 
                                variant={result.isMatch ? "default" : "destructive"}
                                className={result.isMatch ? "bg-green-600" : ""}
                              >
                                {result.matchScore}%
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Published Articles</CardTitle>
            </div>
            <CardDescription>
              Articles generated and published from signals
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingArticles ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : articles.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No articles published yet. Generate and publish articles from the signal detail panel.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">Headline</th>
                      <th className="text-left p-2 font-medium">Style</th>
                      <th className="text-left p-2 font-medium">Published To</th>
                      <th className="text-left p-2 font-medium">Created</th>
                      <th className="text-left p-2 font-medium">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {articles.map((article) => (
                      <tr key={article.id} className="border-b hover-elevate" data-testid={`row-article-${article.id}`}>
                        <td className="p-2">
                          <div className="max-w-md truncate" title={article.headline}>
                            {article.headline}
                          </div>
                        </td>
                        <td className="p-2">
                          <Badge variant="outline" className="capitalize">
                            {article.style}
                          </Badge>
                        </td>
                        <td className="p-2">
                          <Badge variant="secondary">
                            {article.publishedTo}
                          </Badge>
                        </td>
                        <td className="p-2 text-muted-foreground whitespace-nowrap">
                          {article.createdAt ? format(new Date(article.createdAt), "MMM d, yyyy") : "N/A"}
                        </td>
                        <td className="p-2">
                          {article.externalUrl ? (
                            <a 
                              href={article.externalUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline inline-flex items-center gap-1"
                              data-testid={`link-article-${article.id}`}
                            >
                              View <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">CSV Format Reference</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="font-medium mb-1">Companies CSV columns:</p>
              <code className="text-xs bg-muted p-2 rounded block overflow-x-auto">
                id, name, website, industry, description, logo_url, location, region, country, size, founded, tags, product_types, rss_feed_url, linkedin_url, twitter_handle, is_active, created_at, updated_at
              </code>
            </div>
            <div>
              <p className="font-medium mb-1">Signals CSV columns:</p>
              <code className="text-xs bg-muted p-2 rounded block overflow-x-auto">
                id, company_id, type, title, content, summary, source_url, source_name, published_at, sentiment, entities, priority, is_read, is_bookmarked, assigned_to, content_status, notes, ai_analysis, hash, created_at
              </code>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default DataManagementPage;
