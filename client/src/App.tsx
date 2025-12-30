import { useState, useMemo } from "react";
import { Switch, Route } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { GlobalSearch } from "@/components/global-search";
import { AddCompanyDialog } from "@/components/add-company-dialog";
import { Dashboard } from "@/pages/dashboard";
import { AllSignalsPage } from "@/pages/all-signals";
import { AlertsPage } from "@/pages/alerts";
import WordPressSettings from "@/pages/wordpress-settings";
import DataManagementPage from "@/pages/data-management";
import NotFound from "@/pages/not-found";
import { useToast } from "@/hooks/use-toast";
import type { Company, Signal, InsertCompany } from "@shared/schema";

function MainLayout() {
  const { toast } = useToast();
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [showAddCompanyDialog, setShowAddCompanyDialog] = useState(false);

  const { data: companies = [], isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: signals = [] } = useQuery<Signal[]>({
    queryKey: ["/api/signals"],
  });

  const createCompanyMutation = useMutation({
    mutationFn: async (data: InsertCompany) => {
      return apiRequest("POST", "/api/companies", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setShowAddCompanyDialog(false);
      toast({ title: "Company added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add company", variant: "destructive" });
    },
  });

  const signalCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    signals.forEach((signal) => {
      if (!signal.isRead) {
        counts[signal.companyId] = (counts[signal.companyId] || 0) + 1;
      }
    });
    return counts;
  }, [signals]);

  const handleSelectCompany = (id: number) => {
    setSelectedCompanyId((prev) => (prev === id ? null : id));
  };

  const handleSelectSignal = (signal: Signal) => {
    setSelectedCompanyId(signal.companyId);
  };

  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar
          companies={companies}
          selectedCompanyId={selectedCompanyId}
          onSelectCompany={handleSelectCompany}
          onAddCompany={() => setShowAddCompanyDialog(true)}
          signalCounts={signalCounts}
        />

        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-4 h-14 px-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <GlobalSearch
                companies={companies}
                signals={signals}
                onSelectCompany={handleSelectCompany}
                onSelectSignal={handleSelectSignal}
              />
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </header>

          <main className="flex-1 overflow-hidden">
            <Switch>
              <Route path="/">
                <Dashboard
                  selectedCompanyId={selectedCompanyId}
                  companies={companies}
                  onAddCompany={() => setShowAddCompanyDialog(true)}
                />
              </Route>
              <Route path="/signals">
                <AllSignalsPage />
              </Route>
              <Route path="/alerts">
                <AlertsPage />
              </Route>
              <Route path="/team">
                <div className="p-6">
                  <h1 className="text-2xl font-semibold">Team</h1>
                  <p className="text-muted-foreground mt-2">
                    Team collaboration features coming soon.
                  </p>
                </div>
              </Route>
              <Route path="/settings">
                <div className="p-6">
                  <h1 className="text-2xl font-semibold">Settings</h1>
                  <p className="text-muted-foreground mt-2">
                    Application settings coming soon.
                  </p>
                </div>
              </Route>
              <Route path="/wordpress">
                <WordPressSettings />
              </Route>
              <Route path="/data">
                <DataManagementPage />
              </Route>
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>

      <AddCompanyDialog
        open={showAddCompanyDialog}
        onOpenChange={setShowAddCompanyDialog}
        onSubmit={(data) => createCompanyMutation.mutate(data)}
        isLoading={createCompanyMutation.isPending}
      />
    </SidebarProvider>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="signalwatch-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <MainLayout />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
