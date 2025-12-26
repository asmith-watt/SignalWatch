import { formatDistanceToNow, format } from "date-fns";
import {
  X,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  User,
  FileEdit,
  Copy,
  Check,
  Clock,
  Globe,
  Brain,
  Tag,
  MessageSquare,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
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

interface SignalDetailPanelProps {
  signal: Signal;
  company: Company | undefined;
  onClose: () => void;
  onBookmark: (id: number, bookmarked: boolean) => void;
  onUpdateStatus: (id: number, status: string) => void;
  onUpdateNotes: (id: number, notes: string) => void;
  teamMembers?: { id: string; name: string }[];
}

const statusOptions = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "writing", label: "Writing" },
  { value: "published", label: "Published" },
];

export function SignalDetailPanel({
  signal,
  company,
  onClose,
  onBookmark,
  onUpdateStatus,
  onUpdateNotes,
}: SignalDetailPanelProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState(signal.notes || "");
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

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
    await onUpdateNotes(signal.id, notes);
    setIsSaving(false);
  };

  const handleCopyContent = async () => {
    const text = `${signal.title}\n\n${signal.content || signal.summary || ""}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const publishedDate = signal.publishedAt
    ? new Date(signal.publishedAt)
    : new Date(signal.createdAt);

  const entities = signal.entities as {
    people?: string[];
    organizations?: string[];
    locations?: string[];
  } | null;

  const aiAnalysis = signal.aiAnalysis as {
    keyPoints?: string[];
    suggestedActions?: string[];
    relatedTopics?: string[];
  } | null;

  return (
    <div className="h-full flex flex-col border-l bg-background">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Signal Details</h2>
        <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-detail" aria-label="Close signal details">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-xl font-semibold leading-tight" data-testid="text-signal-title">
                {signal.title}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onBookmark(signal.id, !signal.isBookmarked)}
              >
                {signal.isBookmarked ? (
                  <BookmarkCheck className="w-5 h-5 text-primary" />
                ) : (
                  <Bookmark className="w-5 h-5" />
                )}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {company && (
                <span className="font-medium text-foreground">{company.name}</span>
              )}
              {signal.sourceName && (
                <span className="flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5" />
                  {signal.sourceName}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {format(publishedDate, "MMM d, yyyy 'at' h:mm a")}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{signal.type.replace("_", " ")}</Badge>
              {signal.priority && signal.priority !== "medium" && (
                <Badge variant="outline">{signal.priority} priority</Badge>
              )}
              {signal.sentiment && signal.sentiment !== "neutral" && (
                <Badge
                  variant="outline"
                  className={
                    signal.sentiment === "positive"
                      ? "text-green-600 border-green-500/30"
                      : "text-red-600 border-red-500/30"
                  }
                >
                  {signal.sentiment}
                </Badge>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <FileEdit className="w-4 h-4" />
              Content
            </h4>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {signal.content ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {signal.content}
                </p>
              ) : signal.summary ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {signal.summary}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No content available
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {signal.sourceUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={signal.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-4 h-4 mr-1.5" />
                    View Source
                  </a>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleCopyContent}>
                {copied ? (
                  <Check className="w-4 h-4 mr-1.5" />
                ) : (
                  <Copy className="w-4 h-4 mr-1.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => analyzeSignalMutation.mutate(signal.id)}
                disabled={analyzeSignalMutation.isPending}
                data-testid="button-analyze-signal"
              >
                {analyzeSignalMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-1.5" />
                )}
                {analyzeSignalMutation.isPending ? "Analyzing..." : "AI Analyze"}
              </Button>
            </div>
          </div>

          {aiAnalysis && (
            <>
              <Separator />
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Brain className="w-4 h-4" />
                  AI Analysis
                </h4>

                {aiAnalysis.keyPoints && aiAnalysis.keyPoints.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Key Points
                    </p>
                    <ul className="space-y-1.5">
                      {aiAnalysis.keyPoints.map((point, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiAnalysis.suggestedActions &&
                  aiAnalysis.suggestedActions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Suggested Actions
                      </p>
                      <ul className="space-y-1.5">
                        {aiAnalysis.suggestedActions.map((action, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            </>
          )}

          {entities && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Entities
                </h4>
                <div className="space-y-2">
                  {entities.people && entities.people.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs text-muted-foreground w-20">People:</span>
                      {entities.people.map((person) => (
                        <Badge key={person} variant="secondary" className="text-xs">
                          {person}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {entities.organizations && entities.organizations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs text-muted-foreground w-20">Orgs:</span>
                      {entities.organizations.map((org) => (
                        <Badge key={org} variant="secondary" className="text-xs">
                          {org}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {entities.locations && entities.locations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs text-muted-foreground w-20">Locations:</span>
                      {entities.locations.map((loc) => (
                        <Badge key={loc} variant="secondary" className="text-xs">
                          {loc}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <Separator />

          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <User className="w-4 h-4" />
              Workflow
            </h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Content Status</label>
                <Select
                  value={signal.contentStatus || "new"}
                  onValueChange={(value) => onUpdateStatus(signal.id, value)}
                >
                  <SelectTrigger className="mt-1" data-testid="select-content-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Notes
            </h4>
            <Textarea
              placeholder="Add notes about this signal..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="resize-none"
              data-testid="textarea-signal-notes"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveNotes}
              disabled={isSaving || notes === (signal.notes || "")}
              data-testid="button-save-notes"
            >
              {isSaving ? "Saving..." : "Save Notes"}
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
