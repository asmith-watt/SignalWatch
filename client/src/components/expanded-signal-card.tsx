import { formatDistanceToNow, format } from "date-fns";
import {
  ChevronUp,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Building2,
  Clock,
  Tag,
  Sparkles,
  Loader2,
  Send,
  User,
  MapPin,
  DollarSign,
  Calendar,
} from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Signal, Company } from "@shared/schema";

interface ExpandedSignalCardProps {
  signal: Signal;
  company: Company | undefined;
  onCollapse: () => void;
  onBookmark: (id: number, bookmarked: boolean) => void;
  onUpdateStatus: (id: number, status: string) => void;
  onUpdateNotes: (id: number, notes: string) => void;
  onEntitySelect?: (entityName: string) => void;
  onPublishWordPress?: (id: number) => void;
  onPublishMediaSite?: (id: number) => void;
}

const statusOptions = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "writing", label: "Writing" },
  { value: "published", label: "Published" },
];

const typeColors: Record<string, string> = {
  funding: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  acquisition: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  partnership: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  executive: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  product: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  earnings: "bg-green-500/10 text-green-600 dark:text-green-400",
  regulatory: "bg-red-500/10 text-red-600 dark:text-red-400",
  expansion: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  restructuring: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  news: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
};

const priorityColors: Record<string, string> = {
  high: "bg-red-500/10 text-red-600 dark:text-red-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low: "bg-green-500/10 text-green-600 dark:text-green-400",
};

export function ExpandedSignalCard({
  signal,
  company,
  onCollapse,
  onBookmark,
  onUpdateStatus,
  onUpdateNotes,
  onEntitySelect,
  onPublishWordPress,
  onPublishMediaSite,
}: ExpandedSignalCardProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState(signal.notes || "");
  const [isSaving, setIsSaving] = useState(false);

  const analyzeSignalMutation = useMutation({
    mutationFn: async (signalId: number) => {
      return apiRequest("POST", `/api/signals/${signalId}/analyze`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
      toast({ title: "Signal analyzed successfully" });
    },
    onError: () => {
      toast({ title: "Failed to analyze signal", variant: "destructive" });
    },
  });

  const handleSaveNotes = async () => {
    setIsSaving(true);
    onUpdateNotes(signal.id, notes);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setIsSaving(false);
    toast({ title: "Notes saved" });
  };

  const publishedAt = signal.publishedAt ? new Date(signal.publishedAt) : new Date(signal.createdAt);
  const analysis = signal.aiAnalysis as Record<string, unknown> | null;
  const entities = signal.entities as Record<string, unknown> | null;

  const renderEntities = () => {
    if (!entities) return null;
    
    const sections = [
      { key: "people", label: "People", icon: User },
      { key: "organizations", label: "Organizations", icon: Building2 },
      { key: "locations", label: "Locations", icon: MapPin },
      { key: "financials", label: "Financials", icon: DollarSign },
      { key: "dates", label: "Dates", icon: Calendar },
    ];

    return (
      <div className="space-y-3">
        {sections.map(({ key, label, icon: Icon }) => {
          const rawItems = entities[key];
          if (!rawItems || !Array.isArray(rawItems) || rawItems.length === 0) return null;
          const items = rawItems as Array<string | { name: string; role?: string; amount?: string }>;
          
          return (
            <div key={key}>
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                <Icon className="w-4 h-4" />
                {label}
              </div>
              <div className="flex flex-wrap gap-1">
                {items.map((item, i) => {
                  const name = typeof item === "string" ? item : item.name;
                  const detail = typeof item === "object" ? (item.role || item.amount) : undefined;
                  return (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => onEntitySelect?.(name)}
                      data-testid={`entity-${key}-${i}`}
                    >
                      {name}
                      {detail && <span className="ml-1 opacity-70">({detail})</span>}
                    </Badge>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="border-primary/20" data-testid={`expanded-signal-${signal.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Badge className={typeColors[signal.type] || typeColors.news}>
                {signal.type}
              </Badge>
              <Badge className={priorityColors[signal.priority || "medium"]}>
                {signal.priority || "medium"} priority
              </Badge>
              {company && (
                <Badge variant="outline">
                  <Building2 className="w-3 h-3 mr-1" />
                  {company.name}
                </Badge>
              )}
            </div>
            <h3 className="text-lg font-semibold leading-tight">{signal.title}</h3>
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatDistanceToNow(publishedAt, { addSuffix: true })}
              </span>
              <span>{format(publishedAt, "MMM d, yyyy")}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onBookmark(signal.id, !signal.isBookmarked)}
              data-testid="button-bookmark"
            >
              {signal.isBookmarked ? (
                <BookmarkCheck className="w-4 h-4 text-primary" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onCollapse}
              data-testid="button-collapse"
            >
              <ChevronUp className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {signal.summary && (
          <p className="text-muted-foreground">{signal.summary}</p>
        )}

        {signal.content && (
          <div className="text-sm">
            <p className="whitespace-pre-wrap">{signal.content}</p>
          </div>
        )}

        {signal.sourceUrl && (
          <a
            href={signal.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            data-testid="link-source"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View Source
          </a>
        )}

        {company?.description && (
          <div className="bg-muted/50 rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                About {company.name}
              </h4>
              <span className="text-xs text-muted-foreground">Powered by Perplexity</span>
            </div>
            <p className="text-sm text-muted-foreground">{company.description}</p>
            {(company.industry || company.location) && (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {company.industry && <span>Industry: {company.industry}</span>}
                {company.location && <span>Location: {company.location}</span>}
                {company.founded && <span>Founded: {company.founded}</span>}
                {company.size && <span>Size: {company.size}</span>}
              </div>
            )}
          </div>
        )}

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Status & Actions
              </h4>
              <div className="space-y-3">
                <Select
                  value={signal.contentStatus || "new"}
                  onValueChange={(value) => onUpdateStatus(signal.id, value)}
                >
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex flex-wrap gap-2">
                  {!analysis && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => analyzeSignalMutation.mutate(signal.id)}
                      disabled={analyzeSignalMutation.isPending}
                      data-testid="button-analyze"
                    >
                      {analyzeSignalMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-1" />
                      )}
                      Analyze
                    </Button>
                  )}
                  {onPublishWordPress && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onPublishWordPress(signal.id)}
                      data-testid="button-publish-wp"
                    >
                      <Send className="w-4 h-4 mr-1" />
                      WordPress
                    </Button>
                  )}
                  {onPublishMediaSite && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onPublishMediaSite(signal.id)}
                      data-testid="button-publish-media"
                    >
                      <Send className="w-4 h-4 mr-1" />
                      Baking Milling
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Notes</h4>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add editorial notes..."
                className="min-h-[80px]"
                data-testid="textarea-notes"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSaveNotes}
                disabled={isSaving || notes === (signal.notes || "")}
                className="mt-2"
                data-testid="button-save-notes"
              >
                {isSaving ? "Saving..." : "Save Notes"}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {analysis && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  AI Analysis
                </h4>
                <div className="space-y-3 text-sm">
                  {Array.isArray(analysis.keyTakeaways) && analysis.keyTakeaways.length > 0 ? (
                    <div>
                      <span className="font-medium text-muted-foreground">Key Takeaways:</span>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        {(analysis.keyTakeaways as string[]).map((t, i) => (
                          <li key={i}>{String(t)}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {typeof analysis.industryImpact === "string" ? (
                    <div>
                      <span className="font-medium text-muted-foreground">Industry Impact:</span>
                      <p className="mt-1">{analysis.industryImpact}</p>
                    </div>
                  ) : null}
                  {Array.isArray(analysis.storyAngles) && analysis.storyAngles.length > 0 ? (
                    <div>
                      <span className="font-medium text-muted-foreground">Story Angles:</span>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        {(analysis.storyAngles as string[]).map((a, i) => (
                          <li key={i}>{String(a)}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {entities && Object.keys(entities).length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Extracted Entities</h4>
                {renderEntities()}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
