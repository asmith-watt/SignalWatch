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
import { Download, Upload, Database, Building2, Radio, Loader2, CheckCircle } from "lucide-react";
import type { Company, Signal } from "@shared/schema";

export function DataManagementPage() {
  const { toast } = useToast();
  const [companiesCSV, setCompaniesCSV] = useState("");
  const [signalsCSV, setSignalsCSV] = useState("");

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: signals = [] } = useQuery<Signal[]>({
    queryKey: ["/api/signals"],
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Companies</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
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
              <div className="flex items-center justify-between">
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
        </div>

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
              </TabsContent>
            </Tabs>
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
