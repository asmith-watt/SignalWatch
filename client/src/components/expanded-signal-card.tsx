import { formatDistanceToNow, format } from "date-fns";
import {
  ChevronUp,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Building2,
  Clock,
  Sparkles,
  Globe,
  MapPin,
  MoreHorizontal,
  FileText,
} from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const typeColors: Record<string, string> = {
  funding: "border-emerald-500 text-emerald-600 dark:text-emerald-400",
  acquisition: "border-purple-500 text-purple-600 dark:text-purple-400",
  partnership: "border-blue-500 text-blue-600 dark:text-blue-400",
  executive: "border-amber-500 text-amber-600 dark:text-amber-400",
  product: "border-cyan-500 text-cyan-600 dark:text-cyan-400",
  earnings: "border-green-500 text-green-600 dark:text-green-400",
  regulatory: "border-red-500 text-red-600 dark:text-red-400",
  expansion: "border-indigo-500 text-indigo-600 dark:text-indigo-400",
  restructuring: "border-orange-500 text-orange-600 dark:text-orange-400",
  news: "border-blue-500 text-blue-600 dark:text-blue-400",
};

const priorityColors: Record<string, string> = {
  high: "border-red-500 text-red-600 dark:text-red-400",
  medium: "border-amber-500 text-amber-600 dark:text-amber-400",
  low: "border-green-500 text-green-600 dark:text-green-400",
};

const sentimentColors: Record<string, string> = {
  positive: "border-green-500 text-green-600 dark:text-green-400",
  negative: "border-red-500 text-red-600 dark:text-red-400",
  neutral: "border-gray-500 text-gray-600 dark:text-gray-400",
};

const statusColors: Record<string, string> = {
  new: "border-blue-500 text-blue-600 dark:text-blue-400",
  reviewing: "border-amber-500 text-amber-600 dark:text-amber-400",
  writing: "border-purple-500 text-purple-600 dark:text-purple-400",
  published: "border-green-500 text-green-600 dark:text-green-400",
};

export function ExpandedSignalCard({
  signal,
  company,
  onCollapse,
  onBookmark,
  onEntitySelect,
  onPublishWordPress,
  onPublishMediaSite,
}: ExpandedSignalCardProps) {
  const { toast } = useToast();

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

  const publishedAt = signal.publishedAt ? new Date(signal.publishedAt) : null;
  const gatheredAt = new Date(signal.createdAt);
  const analysis = signal.aiAnalysis as {
    keyTakeaways?: string[];
    keyPoints?: string[];
    industryImpact?: string;
    storyAngles?: string[];
    relevanceScore?: number;
    priorityScore?: number;
  } | null;
  const entities = signal.entities as Record<string, unknown> | null;

  const keyTakeaways = analysis?.keyTakeaways || analysis?.keyPoints || [];
  const industryImpact = analysis?.industryImpact;
  const storyAngles = analysis?.storyAngles || [];
  const relevanceScore = analysis?.relevanceScore || analysis?.priorityScore;

  const entityChips: Array<{ label: string; type: "company" | "location" | "org" }> = [];
  if (company?.name) {
    entityChips.push({ label: company.name, type: "company" });
  }
  if (entities?.locations && Array.isArray(entities.locations)) {
    for (const loc of entities.locations.slice(0, 3)) {
      const locName = typeof loc === 'string' ? loc : (loc as { name: string }).name;
      if (entityChips.length < 6) {
        entityChips.push({ label: locName, type: "location" });
      }
    }
  }
  if (entities?.organizations && Array.isArray(entities.organizations)) {
    for (const org of entities.organizations.slice(0, 2)) {
      const orgName = typeof org === 'string' ? org : (org as { name: string }).name;
      if (orgName !== company?.name && entityChips.length < 6) {
        entityChips.push({ label: orgName, type: "org" });
      }
    }
  }

  const hasAnalysis = keyTakeaways.length > 0 || industryImpact || storyAngles.length > 0;

  return (
    <Card data-testid={`expanded-signal-${signal.id}`}>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-muted-foreground" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-semibold leading-tight">{signal.title}</h3>
              <div className="flex items-center gap-1 flex-shrink-0">
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" data-testid="button-menu">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {!analysis && (
                      <DropdownMenuItem 
                        onClick={() => analyzeSignalMutation.mutate(signal.id)}
                        disabled={analyzeSignalMutation.isPending}
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        {analyzeSignalMutation.isPending ? "Analyzing..." : "AI Analyze"}
                      </DropdownMenuItem>
                    )}
                    {onPublishWordPress && (
                      <DropdownMenuItem onClick={() => onPublishWordPress(signal.id)}>
                        WordPress
                      </DropdownMenuItem>
                    )}
                    {onPublishMediaSite && (
                      <DropdownMenuItem onClick={() => onPublishMediaSite(signal.id)}>
                        Baking Milling Site
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={onCollapse}>
                      <ChevronUp className="w-4 h-4 mr-2" />
                      Collapse
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-sm text-muted-foreground">
              {company && <span className="font-medium">{company.name}</span>}
              {company && <span>-</span>}
              {signal.sourceName && (
                <>
                  <span className="flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    {signal.sourceName}
                  </span>
                  <span>-</span>
                </>
              )}
              {publishedAt && (
                <>
                  <span>Source: {format(publishedAt, "M/d/yyyy")}</span>
                  <span>-</span>
                </>
              )}
              <span>Gathered: {format(gatheredAt, "M/d/yyyy")}</span>
            </div>

            {(signal.content || signal.summary) && (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                {signal.content || signal.summary}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Badge variant="outline" className={typeColors[signal.type] || typeColors.news}>
                {signal.type.replace("_", " ")}
              </Badge>
              <Badge variant="outline" className={priorityColors[signal.priority || "medium"]}>
                {(signal.priority || "medium").charAt(0).toUpperCase() + (signal.priority || "medium").slice(1)} Priority
              </Badge>
              {signal.sentiment && signal.sentiment !== "neutral" && (
                <Badge variant="outline" className={sentimentColors[signal.sentiment]}>
                  {signal.sentiment.charAt(0).toUpperCase() + signal.sentiment.slice(1)}
                </Badge>
              )}
              {signal.contentStatus && (
                <Badge variant="outline" className={statusColors[signal.contentStatus] || ""}>
                  {signal.contentStatus.charAt(0).toUpperCase() + signal.contentStatus.slice(1)}
                </Badge>
              )}
              {relevanceScore && (
                <Badge variant="outline" className="border-purple-500 text-purple-600 dark:text-purple-400 gap-1">
                  <Sparkles className="w-3 h-3" />
                  Score: {relevanceScore}
                </Badge>
              )}
              {signal.sourceUrl && (
                <a
                  href={signal.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline ml-auto"
                  data-testid="link-source"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Source
                </a>
              )}
            </div>
          </div>
        </div>

        {hasAnalysis && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center gap-2 text-primary">
                <Sparkles className="w-4 h-4" />
                AI Analysis
              </h4>
              <span className="text-xs text-muted-foreground">Powered by Perplexity</span>
            </div>

            {keyTakeaways.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Key Takeaways:</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {keyTakeaways.map((point, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-foreground/60 mt-2 flex-shrink-0" />
                      {String(point)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {industryImpact && (
              <div>
                <p className="text-sm font-medium mb-1">Industry Impact:</p>
                <p className="text-sm text-muted-foreground">{String(industryImpact)}</p>
              </div>
            )}

            {storyAngles.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Story Angles:</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {storyAngles.map((angle, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-foreground/60 mt-2 flex-shrink-0" />
                      {String(angle)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {entityChips.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                {entityChips.map((chip, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="gap-1.5 cursor-pointer"
                    onClick={() => onEntitySelect?.(chip.label)}
                    data-testid={`entity-chip-${i}`}
                  >
                    {chip.type === "company" && <Building2 className="w-3 h-3" />}
                    {chip.type === "location" && <MapPin className="w-3 h-3" />}
                    {chip.type === "org" && <Building2 className="w-3 h-3" />}
                    {chip.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {!hasAnalysis && (
          <div className="bg-muted/30 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground mb-2">No AI analysis available yet</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => analyzeSignalMutation.mutate(signal.id)}
              disabled={analyzeSignalMutation.isPending}
              data-testid="button-analyze"
            >
              <Sparkles className="w-4 h-4 mr-1" />
              {analyzeSignalMutation.isPending ? "Analyzing..." : "Analyze with AI"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
