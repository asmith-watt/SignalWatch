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
  FileText,
  Download,
  Send,
  History,
  CalendarCheck,
  AlertTriangle,
  Link2,
  Network,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import type { Signal, Company, Article } from "@shared/schema";

interface SignalDetailPanelProps {
  signal: Signal;
  company: Company | undefined;
  onClose: () => void;
  onBookmark: (id: number, bookmarked: boolean) => void;
  onUpdateStatus: (id: number, status: string) => void;
  onUpdateNotes: (id: number, notes: string) => void;
  onEntitySelect?: (entityName: string) => void;
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
  onEntitySelect,
}: SignalDetailPanelProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState(signal.notes || "");
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [articleStyle, setArticleStyle] = useState<"news" | "brief" | "analysis" | "signal">("signal");
  const [aiProvider, setAiProvider] = useState<"openai" | "claude">("openai");
  const [claudeModel, setClaudeModel] = useState<"claude-sonnet-4-5" | "claude-opus-4-5" | "claude-haiku-4-5">("claude-sonnet-4-5");
  const [dateVerification, setDateVerification] = useState<{
    status: "idle" | "checking" | "mismatch" | "match" | "error";
    extractedDate?: string | null;
    storedDate?: string | null;
  }>({ status: "idle" });
  const [sourceVerification, setSourceVerification] = useState<{
    status: "idle" | "checking" | "mismatch" | "match" | "error";
    articleTitle?: string | null;
    matchScore?: number;
  }>({ status: "idle" });

  // Reset verification states when signal changes
  useEffect(() => {
    setDateVerification({ status: "idle" });
    setSourceVerification({ status: "idle" });
  }, [signal.id, signal.sourceUrl]);
  const [generatedArticle, setGeneratedArticle] = useState<{
    headline: string;
    subheadline: string;
    body: string;
    whyItMatters?: string;
    keyDetails?: string[];
    whatsNext?: string;
    keyTakeaways: string[];
    seoDescription: string;
    sourceAttribution?: string;
    sourceUrl?: string | null;
  } | null>(null);

  const { data: articleHistory = [] } = useQuery<Article[]>({
    queryKey: ["/api/signals", signal.id, "articles"],
    queryFn: async () => {
      const res = await fetch(`/api/signals/${signal.id}/articles`);
      if (!res.ok) throw new Error("Failed to fetch articles");
      return res.json();
    },
  });

  interface RelatedSignalResult {
    signal: Signal;
    company: Company | null;
    sharedEntityCount: number;
    sharedEntitiesPreview: string[];
  }

  const { data: relatedSignals = [], isLoading: isLoadingRelated } = useQuery<RelatedSignalResult[]>({
    queryKey: ["/api/signals", signal.id, "related"],
    queryFn: async () => {
      const res = await fetch(`/api/signals/${signal.id}/related?limit=5&days=30`);
      if (!res.ok) throw new Error("Failed to fetch related signals");
      return res.json();
    },
  });

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

  const verifyDateMutation = useMutation({
    mutationFn: async (signalId: number) => {
      const response = await fetch(`/api/signals/verify-dates?signalId=${signalId}`);
      if (!response.ok) throw new Error("Failed to verify date");
      return response.json();
    },
    onSuccess: (data) => {
      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        if (result.error || result.extractedDate === null) {
          setDateVerification({ status: "error" });
          toast({ title: "Could not extract date from source", variant: "destructive" });
        } else if (result.match) {
          setDateVerification({ status: "match", storedDate: result.storedDate, extractedDate: result.extractedDate });
          toast({ title: "Date is correct" });
        } else {
          setDateVerification({ status: "mismatch", storedDate: result.storedDate, extractedDate: result.extractedDate });
          toast({ title: "Date mismatch found", description: `Actual: ${result.extractedDate}` });
        }
      }
    },
    onError: () => {
      setDateVerification({ status: "error" });
      toast({ title: "Failed to verify date", variant: "destructive" });
    },
  });

  const fixDateMutation = useMutation({
    mutationFn: async (signalId: number) => {
      return apiRequest("POST", "/api/signals/fix-dates", { signalIds: [signalId] });
    },
    onSuccess: (data: any) => {
      if (data.fixed > 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
        setDateVerification({ status: "match" });
        toast({ title: "Date corrected successfully" });
      } else {
        toast({ title: "Could not fix date", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Failed to fix date", variant: "destructive" });
    },
  });

  const verifySourceMutation = useMutation({
    mutationFn: async (signalId: number) => {
      const response = await fetch(`/api/signals/verify-source?signalId=${signalId}`);
      if (!response.ok) throw new Error("Failed to verify source");
      return response.json();
    },
    onSuccess: (data) => {
      if (data.error) {
        setSourceVerification({ status: "error" });
        toast({ title: data.error, variant: "destructive" });
      } else if (data.isMatch) {
        setSourceVerification({ status: "match", articleTitle: data.articleTitle, matchScore: data.matchScore });
        toast({ title: "Source URL verified", description: `${data.matchScore}% match` });
      } else {
        setSourceVerification({ status: "mismatch", articleTitle: data.articleTitle, matchScore: data.matchScore });
        toast({ 
          title: "Source may not match", 
          description: `Only ${data.matchScore}% title match`,
          variant: "destructive" 
        });
      }
    },
    onError: () => {
      setSourceVerification({ status: "error" });
      toast({ title: "Failed to verify source", variant: "destructive" });
    },
  });

  const generateArticleMutation = useMutation({
    mutationFn: async ({ signalId, style, provider, claudeModel }: { 
      signalId: number; 
      style: string; 
      provider: "openai" | "claude";
      claudeModel?: string;
    }) => {
      const res = await apiRequest("POST", `/api/signals/${signalId}/generate-article`, { 
        style, 
        provider,
        claudeModel 
      });
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedArticle(data.article);
      const modelName = data.provider === "claude" ? data.model : "GPT-4o";
      toast({ title: `Article generated with ${modelName}` });
    },
    onError: () => {
      toast({ title: "Failed to generate article", variant: "destructive" });
    },
  });

  const mediaSitePublishMutation = useMutation({
    mutationFn: async ({ signalId }: { signalId: number }) => {
      const res = await apiRequest("POST", `/api/signals/${signalId}/publish-to-media`, {});
      return res.json();
    },
    onSuccess: (data) => {
      if (data.warning) {
        toast({ 
          title: "Article Sent - Please Verify", 
          description: data.warning,
          variant: "default"
        });
      } else if (data.articleUrl) {
        toast({ 
          title: "Published Successfully", 
          description: `Article published: ${data.articleUrl}` 
        });
      } else {
        toast({ 
          title: "Published to Media Site", 
          description: data.message || "Article sent successfully" 
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/signals", signal.id, "articles"] });
    },
    onError: () => {
      toast({ title: "Failed to publish to media site", variant: "destructive" });
    },
  });

  const handleExportArticle = async (format: string) => {
    try {
      const response = await fetch(`/api/signals/${signal.id}/export/${format}`);
      if (format === "markdown") {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `article-${signal.id}.md`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `article-${signal.id}-${format}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast({ title: `Exported as ${format}` });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

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

  const displayDate = signal.publishedAt
    ? new Date(signal.publishedAt)
    : new Date(signal.createdAt);
  const hasPublishedDate = !!signal.publishedAt;

  const entities = signal.entities as {
    people?: (string | { name: string; role?: string; company?: string })[];
    organizations?: (string | { name: string })[];
    locations?: (string | { name: string })[];
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
                  {signal.sourceUrl && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-1"
                      onClick={() => {
                        setSourceVerification({ status: "checking" });
                        verifySourceMutation.mutate(signal.id);
                      }}
                      disabled={verifySourceMutation.isPending || sourceVerification.status === "checking"}
                      data-testid="button-verify-source"
                      title="Verify source URL matches signal"
                    >
                      {verifySourceMutation.isPending || sourceVerification.status === "checking" ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : sourceVerification.status === "match" ? (
                        <Check className="w-3 h-3 text-green-600" />
                      ) : sourceVerification.status === "mismatch" ? (
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                      ) : (
                        <Link2 className="w-3 h-3" />
                      )}
                    </Button>
                  )}
                </span>
              )}
              {sourceVerification.status === "mismatch" && sourceVerification.articleTitle && (
                <div className="w-full text-xs text-amber-600 dark:text-amber-400 mt-1">
                  <span className="font-medium">Source article title:</span> {sourceVerification.articleTitle}
                  <span className="ml-2 text-muted-foreground">({sourceVerification.matchScore}% match)</span>
                </div>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {hasPublishedDate ? "Published " : "Gathered "}
                {format(displayDate, "MMM d, yyyy")}
                {signal.sourceUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 ml-1"
                    onClick={() => {
                      setDateVerification({ status: "checking" });
                      verifyDateMutation.mutate(signal.id);
                    }}
                    disabled={verifyDateMutation.isPending || dateVerification.status === "checking"}
                    data-testid="button-verify-date"
                    title="Verify publication date"
                  >
                    {verifyDateMutation.isPending || dateVerification.status === "checking" ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : dateVerification.status === "match" ? (
                      <Check className="w-3 h-3 text-green-600" />
                    ) : dateVerification.status === "mismatch" ? (
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                    ) : (
                      <CalendarCheck className="w-3 h-3" />
                    )}
                  </Button>
                )}
              </span>
              {dateVerification.status === "mismatch" && dateVerification.extractedDate && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-amber-600 dark:text-amber-400">
                    Actual date: {dateVerification.extractedDate}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-5 px-2 text-xs"
                    onClick={() => fixDateMutation.mutate(signal.id)}
                    disabled={fixDateMutation.isPending}
                    data-testid="button-fix-date"
                  >
                    {fixDateMutation.isPending ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3 mr-1" />
                    )}
                    Fix
                  </Button>
                </div>
              )}
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
                    href={signal.sourceUrl.startsWith("//") ? "https:" + signal.sourceUrl : 
                          (!signal.sourceUrl.startsWith("http") ? "https://" + signal.sourceUrl : signal.sourceUrl)}
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
                      {entities.people.map((person, i) => {
                        const personName = typeof person === 'string' ? person : person.name;
                        return (
                          <Badge
                            key={`person-${i}`}
                            variant="secondary"
                            className="text-xs cursor-pointer"
                            onClick={() => onEntitySelect?.(personName)}
                            data-testid={`detail-entity-person-${i}`}
                          >
                            {personName}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                  {entities.organizations && entities.organizations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs text-muted-foreground w-20">Orgs:</span>
                      {entities.organizations.map((org, i) => {
                        const orgName = typeof org === 'string' ? org : org.name;
                        return (
                          <Badge
                            key={`org-${i}`}
                            variant="secondary"
                            className="text-xs cursor-pointer"
                            onClick={() => onEntitySelect?.(orgName)}
                            data-testid={`detail-entity-org-${i}`}
                          >
                            {orgName}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                  {entities.locations && entities.locations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs text-muted-foreground w-20">Locations:</span>
                      {entities.locations.map((loc, i) => {
                        const locName = typeof loc === 'string' ? loc : loc.name;
                        return (
                          <Badge
                            key={`loc-${i}`}
                            variant="secondary"
                            className="text-xs cursor-pointer"
                            onClick={() => onEntitySelect?.(locName)}
                            data-testid={`detail-entity-loc-${i}`}
                          >
                            {locName}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <Separator />

          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Content Publishing
            </h4>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={articleStyle}
                  onValueChange={(value: "news" | "brief" | "analysis" | "signal") => setArticleStyle(value)}
                >
                  <SelectTrigger className="w-36" data-testid="select-article-style">
                    <SelectValue placeholder="Article style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="news">Standard Article</SelectItem>
                    <SelectItem value="brief">Brief</SelectItem>
                    <SelectItem value="analysis">Analysis</SelectItem>
                    <SelectItem value="signal">Signal-First</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={aiProvider}
                  onValueChange={(value: "openai" | "claude") => setAiProvider(value)}
                >
                  <SelectTrigger className="w-28" data-testid="select-ai-provider">
                    <SelectValue placeholder="AI Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="claude">Claude</SelectItem>
                  </SelectContent>
                </Select>
                {aiProvider === "claude" && (
                  <Select
                    value={claudeModel}
                    onValueChange={(value: "claude-sonnet-4-5" | "claude-opus-4-5" | "claude-haiku-4-5") => setClaudeModel(value)}
                  >
                    <SelectTrigger className="w-32" data-testid="select-claude-model">
                      <SelectValue placeholder="Model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claude-sonnet-4-5">Sonnet 4.5</SelectItem>
                      <SelectItem value="claude-opus-4-5">Opus 4.5</SelectItem>
                      <SelectItem value="claude-haiku-4-5">Haiku 4.5</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <Button
                  variant="default"
                  size="default"
                  onClick={() => generateArticleMutation.mutate({ 
                    signalId: signal.id, 
                    style: articleStyle,
                    provider: aiProvider,
                    claudeModel: aiProvider === "claude" ? claudeModel : undefined
                  })}
                  disabled={generateArticleMutation.isPending}
                  data-testid="button-generate-article"
                >
                  {generateArticleMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4 mr-1.5" />
                  )}
                  {generateArticleMutation.isPending ? "Generating..." : "Generate"}
                </Button>
              </div>

              {generatedArticle && (
                <div className="space-y-3 p-3 bg-muted/50 rounded-md">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      Generated Headline
                    </p>
                    <p className="text-sm font-semibold">{generatedArticle.headline}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      Subheadline
                    </p>
                    <p className="text-sm text-muted-foreground">{generatedArticle.subheadline}</p>
                  </div>
                  {generatedArticle.whyItMatters && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                        Why It Matters
                      </p>
                      <p className="text-sm">{generatedArticle.whyItMatters}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      Article Body
                    </p>
                    <p className="text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {generatedArticle.body}
                    </p>
                  </div>
                  {generatedArticle.keyDetails && generatedArticle.keyDetails.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                        Key Details
                      </p>
                      <ul className="text-sm space-y-1">
                        {generatedArticle.keyDetails.map((detail, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                            {detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {generatedArticle.whatsNext && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                        What's Next
                      </p>
                      <p className="text-sm">{generatedArticle.whatsNext}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      Key Takeaways
                    </p>
                    <ul className="text-sm space-y-1">
                      {generatedArticle.keyTakeaways.map((point, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {(signal.sourceUrl || generatedArticle.sourceAttribution) && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                        Source
                      </p>
                      <p className="text-sm">
                        {signal.sourceUrl ? (
                          <a 
                            href={signal.sourceUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                            data-testid="link-article-source"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {signal.sourceName || "Original Source"}
                          </a>
                        ) : (
                          generatedArticle.sourceAttribution
                        )}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <p className="text-xs text-muted-foreground w-full mb-1">Export for CMS:</p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleExportArticle("wordpress")}
                      data-testid="button-export-wordpress"
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      WordPress
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleExportArticle("markdown")}
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      Markdown
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleExportArticle("json")}
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      JSON
                    </Button>
                  </div>
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Publish to Media Site (AI-generated image with proper licensing):</p>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        mediaSitePublishMutation.mutate({ signalId: signal.id });
                      }}
                      disabled={mediaSitePublishMutation.isPending}
                      data-testid="button-send-to-media-site"
                    >
                      {mediaSitePublishMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      {mediaSitePublishMutation.isPending ? "Publishing..." : "Send to Media Site"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {articleHistory.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Article History ({articleHistory.length})
                </h4>
                <div className="space-y-2">
                  {articleHistory.map((article) => (
                    <div
                      key={article.id}
                      className="p-3 bg-muted/50 rounded-md space-y-1"
                      data-testid={`article-history-${article.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium line-clamp-2">{article.headline}</p>
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {article.publishedTo === "media_site" ? "Media Site" : 
                           article.publishedTo === "wordpress" ? "WordPress" : 
                           article.publishedTo || "Export"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{format(new Date(article.createdAt), "MMM d, yyyy h:mm a")}</span>
                        <span className="capitalize">{article.style} style</span>
                      </div>
                      {article.externalUrl && (
                        <a
                          href={article.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View Published Article
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Network className="w-4 h-4" />
              Related Signals
            </h4>
            {isLoadingRelated ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading related signals...
              </div>
            ) : relatedSignals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No related signals found</p>
            ) : (
              <div className="space-y-2">
                {relatedSignals.map((result) => (
                  <div
                    key={result.signal.id}
                    className="p-3 bg-muted/50 rounded-md space-y-1.5 hover-elevate cursor-pointer"
                    data-testid={`related-signal-${result.signal.id}`}
                    onClick={() => {
                      window.location.hash = `signal-${result.signal.id}`;
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium line-clamp-2">{result.signal.title}</p>
                      <Badge variant="outline" className="shrink-0 text-xs capitalize">
                        {result.signal.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      {result.company && <span>{result.company.name}</span>}
                      {result.signal.publishedAt && (
                        <span>{formatDistanceToNow(new Date(result.signal.publishedAt), { addSuffix: true })}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        {result.sharedEntityCount} shared {result.sharedEntityCount === 1 ? 'entity' : 'entities'}
                      </Badge>
                      {result.sharedEntitiesPreview.slice(0, 3).map((name) => (
                        <Badge key={name} variant="outline" className="text-xs">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
