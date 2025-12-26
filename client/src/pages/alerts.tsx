import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Bell,
  Plus,
  MoreHorizontal,
  Trash2,
  Edit,
  Zap,
  ZapOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertConfigDialog } from "@/components/alert-config-dialog";
import { AlertTableSkeleton } from "@/components/loading-skeleton";
import { EmptyAlerts } from "@/components/empty-states";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Alert, Company, InsertAlert } from "@shared/schema";

const triggerTypeLabels: Record<string, string> = {
  any_signal: "Any Signal",
  funding_announcement: "Funding",
  executive_change: "Executive Change",
  product_launch: "Product Launch",
  partnership: "Partnership",
  acquisition: "Acquisition",
  negative_news: "Negative News",
  positive_news: "Positive News",
  job_posting_spike: "Job Posting Spike",
  custom_keyword: "Custom Keywords",
};

export function AlertsPage() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);
  const [deletingAlertId, setDeletingAlertId] = useState<number | null>(null);

  const { data: alerts = [], isLoading } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const createAlertMutation = useMutation({
    mutationFn: async (data: InsertAlert) => {
      return apiRequest("POST", "/api/alerts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      setShowCreateDialog(false);
      toast({ title: "Alert created successfully" });
    },
  });

  const updateAlertMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertAlert> }) => {
      return apiRequest("PATCH", `/api/alerts/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      setEditingAlert(null);
      toast({ title: "Alert updated successfully" });
    },
  });

  const deleteAlertMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/alerts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      setDeletingAlertId(null);
      toast({ title: "Alert deleted successfully" });
    },
  });

  const toggleAlertActive = (alert: Alert) => {
    updateAlertMutation.mutate({
      id: alert.id,
      data: { isActive: !alert.isActive },
    });
  };

  const getCompanyName = (companyId: number | null) => {
    if (!companyId) return "All Companies";
    const company = companies.find((c) => c.id === companyId);
    return company?.name || "Unknown";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Bell className="w-6 h-6" />
            Alerts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure notifications for important business signals
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-alert">
          <Plus className="w-4 h-4 mr-1.5" />
          Create Alert
        </Button>
      </div>

      {isLoading ? (
        <AlertTableSkeleton />
      ) : alerts.length === 0 ? (
        <EmptyAlerts onCreateAlert={() => setShowCreateDialog(true)} />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Alert Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert) => (
                <TableRow key={alert.id} data-testid={`alert-row-${alert.id}`}>
                  <TableCell className="font-medium">{alert.name}</TableCell>
                  <TableCell>{getCompanyName(alert.companyId)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {triggerTypeLabels[alert.triggerType] || alert.triggerType}
                    </Badge>
                    {alert.keywords && alert.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {alert.keywords.slice(0, 2).map((kw) => (
                          <Badge key={kw} variant="outline" className="text-xs">
                            {kw}
                          </Badge>
                        ))}
                        {alert.keywords.length > 2 && (
                          <span className="text-xs text-muted-foreground">
                            +{alert.keywords.length - 2} more
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="capitalize">
                    {alert.notificationChannel}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={alert.isActive || false}
                        onCheckedChange={() => toggleAlertActive(alert)}
                        data-testid={`switch-alert-${alert.id}`}
                      />
                      {alert.isActive ? (
                        <Zap className="w-4 h-4 text-amber-500" />
                      ) : (
                        <ZapOff className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`button-alert-menu-${alert.id}`}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingAlert(alert)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeletingAlertId(alert.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertConfigDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={(data) => createAlertMutation.mutate(data)}
        isLoading={createAlertMutation.isPending}
        companies={companies}
      />

      <AlertConfigDialog
        open={!!editingAlert}
        onOpenChange={(open) => !open && setEditingAlert(null)}
        onSubmit={(data) =>
          editingAlert &&
          updateAlertMutation.mutate({ id: editingAlert.id, data })
        }
        isLoading={updateAlertMutation.isPending}
        alert={editingAlert}
        companies={companies}
      />

      <AlertDialog
        open={!!deletingAlertId}
        onOpenChange={(open) => !open && setDeletingAlertId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Alert</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this alert? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deletingAlertId && deleteAlertMutation.mutate(deletingAlertId)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
