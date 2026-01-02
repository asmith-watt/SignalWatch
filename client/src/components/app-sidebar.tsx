import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Building2,
  Radio,
  Bell,
  Users,
  Settings,
  Search,
  Plus,
  ChevronDown,
  Globe,
  Briefcase,
  TrendingUp,
  RefreshCw,
  Database,
  Network,
  Square,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import type { Company } from "@shared/schema";

interface MonitorProgress {
  isRunning: boolean;
  total: number;
  current: number;
  currentCompany: string | null;
  signalsFound: number;
  type?: string | null;
  industryName?: string;
}

interface AppSidebarProps {
  companies: Company[];
  selectedCompanyId: number | null;
  onSelectCompany: (id: number) => void;
  onClearSelection: () => void;
  onAddCompany: () => void;
  signalCounts: Record<number, number>;
}

const navigationItems = [
  { title: "Dashboard", url: "/", icon: TrendingUp },
  { title: "All Signals", url: "/signals", icon: Radio },
  { title: "Industry Map", url: "/industry-map", icon: Network },
  { title: "Alerts", url: "/alerts", icon: Bell },
  { title: "Team", url: "/team", icon: Users },
  { title: "WordPress", url: "/wordpress", icon: Globe },
  { title: "Data", url: "/data", icon: Database },
];

const industryGroups: Record<string, string[]> = {
  Poultry: ["Poultry", "Chicken", "Turkey", "Egg", "Duck", "Broiler", "Layer", "Hatchery"],
  Feed: ["Feed", "Nutrition", "Premix", "Compound"],
  "Pet Food": ["Pet Food", "Pet", "Dog Food", "Cat Food"],
};

function getIndustryGroup(industry: string | null): string {
  if (!industry) return "Poultry";
  for (const [group, industries] of Object.entries(industryGroups)) {
    if (industries.some((i) => industry.toLowerCase().includes(i.toLowerCase()))) {
      return group;
    }
  }
  return "Poultry";
}

function getCompanyInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function AppSidebar({
  companies,
  selectedCompanyId,
  onSelectCompany,
  onClearSelection,
  onAddCompany,
  signalCounts,
}: AppSidebarProps) {
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Poultry: true,
    Technology: true,
    Finance: true,
    Healthcare: true,
  });
  const [updatingGroup, setUpdatingGroup] = useState<string | null>(null);
  const [updatingCompany, setUpdatingCompany] = useState<number | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const { toast } = useToast();

  const { data: progress } = useQuery<MonitorProgress>({
    queryKey: ["/api/monitor/progress"],
    refetchInterval: (query) => {
      const data = query.state.data as MonitorProgress | undefined;
      return data?.isRunning || isMonitoring ? 1000 : 5000;
    },
  });

  useEffect(() => {
    if (progress && !progress.isRunning && isMonitoring) {
      setIsMonitoring(false);
    }
  }, [progress, isMonitoring]);

  const showProgressBar = progress?.isRunning || isMonitoring;
  const progressPercent = progress?.total ? Math.round((progress.current / progress.total) * 100) : 0;

  const stopMonitorMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/monitor/stop");
    },
    onSuccess: () => {
      toast({
        title: "Sync stopped",
        description: "The monitoring process has been stopped",
      });
      setIsMonitoring(false);
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async (industry: string) => {
      setUpdatingGroup(industry);
      setIsMonitoring(true);
      return apiRequest("POST", `/api/monitor/industry/${encodeURIComponent(industry)}`);
    },
    onSuccess: (data: any, industry: string) => {
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      const companiesChecked = data.companiesMonitored || 0;
      const totalSignals = data.results?.reduce((sum: number, r: any) => sum + r.signalsCreated, 0) || 0;
      if (companiesChecked === 0) {
        toast({
          title: `No ${industry} companies`,
          description: "No companies found to monitor in this group",
        });
      } else {
        toast({
          title: `${industry} update complete`,
          description: `Checked ${companiesChecked} companies, found ${totalSignals} new signals`,
        });
      }
      setUpdatingGroup(null);
      setIsMonitoring(false);
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Could not update signals. Please try again.",
        variant: "destructive",
      });
      setUpdatingGroup(null);
      setIsMonitoring(false);
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async (companyId: number) => {
      setUpdatingCompany(companyId);
      setIsMonitoring(true);
      return apiRequest("POST", `/api/monitor/company/${companyId}`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
      toast({
        title: "Company updated",
        description: data.message || `Found ${data.signalsCreated || 0} new signals for ${data.company}`,
      });
      setUpdatingCompany(null);
      setIsMonitoring(false);
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Could not update company signals.",
        variant: "destructive",
      });
      setUpdatingCompany(null);
      setIsMonitoring(false);
    },
  });

  const filteredCompanies = companies.filter((company) =>
    company.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedCompanies = filteredCompanies.reduce(
    (acc, company) => {
      const group = getIndustryGroup(company.industry);
      if (!acc[group]) acc[group] = [];
      acc[group].push(company);
      return acc;
    },
    {} as Record<string, Company[]>
  );

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary">
            <Radio className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-semibold">SignalWatch</h1>
            <p className="text-xs text-muted-foreground">Business Intelligence</p>
          </div>
        </div>
      </SidebarHeader>

      {showProgressBar && progress?.isRunning && (
        <div className="px-4 py-3 border-b border-sidebar-border bg-muted/30" data-testid="sidebar-progress">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-foreground">
                Syncing {progress.industryName || "companies"}...
              </span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  {progressPercent}%
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => stopMonitorMutation.mutate()}
                  disabled={stopMonitorMutation.isPending}
                  data-testid="button-stop-sync"
                >
                  <Square className="h-3 w-3" />
                  Stop
                </Button>
              </div>
            </div>
            <Progress value={progressPercent} className="h-1.5" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate max-w-[140px]">
                {progress.currentCompany || "Starting..."}
              </span>
              <span>
                {progress.signalsFound} found
              </span>
            </div>
          </div>
        </div>
      )}

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {item.url === "/" ? (
                    <SidebarMenuButton
                      isActive={location === item.url}
                      onClick={() => {
                        onClearSelection();
                        setLocation("/");
                      }}
                      data-testid={`nav-${item.title.toLowerCase().replace(" ", "-")}`}
                    >
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                    >
                      <Link 
                        href={item.url} 
                        data-testid={`nav-${item.title.toLowerCase().replace(" ", "-")}`}
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between gap-2 px-2">
            <span className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Companies
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onAddCompany}
              data-testid="button-add-company"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-2 pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search companies..."
                  className="h-8 pl-8 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-companies"
                />
              </div>
            </div>

            <div className="space-y-1">
              {Object.entries(groupedCompanies).map(([group, groupCompanies]) => (
                <Collapsible
                  key={group}
                  open={expandedGroups[group]}
                  onOpenChange={() => toggleGroup(group)}
                >
                  <div className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    <CollapsibleTrigger className="flex items-center gap-2 flex-1 hover-elevate rounded-md py-1 -my-1 px-1 -mx-1">
                      <span className="flex items-center gap-2">
                        {group === "Poultry" && <Building2 className="w-3 h-3" />}
                        {group === "Feed" && <Building2 className="w-3 h-3" />}
                        {group === "Pet Food" && <Building2 className="w-3 h-3" />}
                        {group}
                      </span>
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        {groupCompanies.length}
                      </Badge>
                      <ChevronDown
                        className={`w-3 h-3 transition-transform ${
                          expandedGroups[group] ? "rotate-180" : ""
                        }`}
                      />
                    </CollapsibleTrigger>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 ml-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateGroupMutation.mutate(group);
                      }}
                      disabled={updatingGroup === group}
                      data-testid={`button-update-${group.toLowerCase()}`}
                    >
                      <RefreshCw className={`w-3 h-3 ${updatingGroup === group ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                  <CollapsibleContent>
                    <SidebarMenu className="mt-1">
                      {groupCompanies.map((company) => (
                        <SidebarMenuItem key={company.id} className="group/company">
                          <div className="flex items-center w-full">
                            <SidebarMenuButton
                              isActive={selectedCompanyId === company.id}
                              onClick={() => onSelectCompany(company.id)}
                              className="h-auto py-2 flex-1"
                              data-testid={`company-item-${company.id}`}
                            >
                              <Avatar className="h-8 w-8 rounded-md flex-shrink-0">
                                <AvatarFallback className="rounded-md text-xs bg-muted">
                                  {getCompanyInitials(company.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">
                                  {company.name}
                                </div>
                                {company.industry && (
                                  <div className="text-xs text-muted-foreground truncate">
                                    {company.industry}
                                  </div>
                                )}
                              </div>
                              {signalCounts[company.id] > 0 && (
                                <Badge variant="default" className="h-5 px-1.5 text-xs bg-primary text-primary-foreground flex-shrink-0">
                                  {signalCounts[company.id]} new
                                </Badge>
                              )}
                            </SidebarMenuButton>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 flex-shrink-0 opacity-0 group-hover/company:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateCompanyMutation.mutate(company.id);
                              }}
                              disabled={updatingCompany === company.id}
                              data-testid={`button-update-company-${company.id}`}
                            >
                              <RefreshCw className={`w-3 h-3 ${updatingCompany === company.id ? "animate-spin" : ""}`} />
                            </Button>
                          </div>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>

            {filteredCompanies.length === 0 && (
              <div className="px-4 py-8 text-center">
                <Building2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? "No companies found" : "No companies yet"}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={onAddCompany}
                  data-testid="button-add-first-company"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Add Company
                </Button>
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/settings" data-testid="nav-settings">
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
