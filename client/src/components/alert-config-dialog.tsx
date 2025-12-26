import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Plus, Bell, Zap } from "lucide-react";
import { useState } from "react";
import type { Alert, InsertAlert, Company } from "@shared/schema";

const formSchema = z.object({
  name: z.string().min(1, "Alert name is required"),
  companyId: z.number().nullable(),
  triggerType: z.string().min(1, "Trigger type is required"),
  keywords: z.array(z.string()).optional(),
  notificationChannel: z.string().default("dashboard"),
  isActive: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

interface AlertConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InsertAlert) => void;
  isLoading?: boolean;
  alert?: Alert | null;
  companies: Company[];
  preselectedCompanyId?: number | null;
}

const triggerTypeOptions = [
  { value: "any_signal", label: "Any New Signal", description: "Notify on any new signal" },
  { value: "funding_announcement", label: "Funding Announcement", description: "New funding rounds or investments" },
  { value: "executive_change", label: "Executive Change", description: "C-level or key personnel changes" },
  { value: "product_launch", label: "Product Launch", description: "New product or feature announcements" },
  { value: "partnership", label: "Partnership", description: "New partnerships or collaborations" },
  { value: "acquisition", label: "Acquisition", description: "M&A activity" },
  { value: "negative_news", label: "Negative News", description: "Negative sentiment coverage" },
  { value: "positive_news", label: "Positive News", description: "Positive sentiment coverage" },
  { value: "job_posting_spike", label: "Job Posting Spike", description: "Unusual increase in job postings" },
  { value: "custom_keyword", label: "Custom Keywords", description: "Match specific keywords" },
];

const notificationChannelOptions = [
  { value: "dashboard", label: "Dashboard Only" },
  { value: "email", label: "Email" },
  { value: "slack", label: "Slack" },
];

export function AlertConfigDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  alert,
  companies,
  preselectedCompanyId,
}: AlertConfigDialogProps) {
  const isEditing = !!alert;
  const [keywordInput, setKeywordInput] = useState("");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: alert?.name || "",
      companyId: alert?.companyId || preselectedCompanyId || null,
      triggerType: alert?.triggerType || "",
      keywords: alert?.keywords || [],
      notificationChannel: alert?.notificationChannel || "dashboard",
      isActive: alert?.isActive ?? true,
    },
  });

  const watchTriggerType = form.watch("triggerType");
  const watchKeywords = form.watch("keywords") || [];

  const handleAddKeyword = () => {
    if (keywordInput.trim() && !watchKeywords.includes(keywordInput.trim())) {
      form.setValue("keywords", [...watchKeywords, keywordInput.trim()]);
      setKeywordInput("");
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    form.setValue(
      "keywords",
      watchKeywords.filter((k) => k !== keyword)
    );
  };

  const handleSubmit = (data: FormData) => {
    const cleanData: InsertAlert = {
      name: data.name,
      companyId: data.companyId,
      triggerType: data.triggerType,
      keywords: data.keywords || null,
      notificationChannel: data.notificationChannel,
      isActive: data.isActive,
      createdBy: null,
    };
    onSubmit(cleanData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            {isEditing ? "Edit Alert" : "Create Alert"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update alert settings and notification preferences."
              : "Set up notifications for specific business signals."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alert Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Competitor Funding Alerts"
                      {...field}
                      data-testid="input-alert-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="companyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company</FormLabel>
                  <Select
                    onValueChange={(value) =>
                      field.onChange(value === "all" ? null : Number(value))
                    }
                    value={field.value?.toString() || "all"}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-alert-company">
                        <SelectValue placeholder="Select company" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="all">All Companies</SelectItem>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id.toString()}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Leave as "All Companies" to monitor across your entire watchlist
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="triggerType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trigger Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-alert-trigger">
                        <SelectValue placeholder="What should trigger this alert?" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {triggerTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div>
                            <div className="font-medium">{option.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {option.description}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchTriggerType === "custom_keyword" && (
              <FormField
                control={form.control}
                name="keywords"
                render={() => (
                  <FormItem>
                    <FormLabel>Keywords</FormLabel>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add keyword..."
                          value={keywordInput}
                          onChange={(e) => setKeywordInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddKeyword();
                            }
                          }}
                          data-testid="input-alert-keyword"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={handleAddKeyword}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      {watchKeywords.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {watchKeywords.map((keyword) => (
                            <Badge
                              key={keyword}
                              variant="secondary"
                              className="gap-1 pr-1"
                            >
                              {keyword}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 p-0 hover:bg-transparent"
                                onClick={() => handleRemoveKeyword(keyword)}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <FormDescription>
                      Alert triggers when any of these keywords appear in signals
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="notificationChannel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notification Channel</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-alert-channel">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {notificationChannelOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Alert Active
                    </FormLabel>
                    <FormDescription>
                      Receive notifications when this alert triggers
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-alert-active"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} data-testid="button-save-alert">
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? "Save Changes" : "Create Alert"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
