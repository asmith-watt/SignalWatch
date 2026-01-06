import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Globe,
  Calendar,
  Building2,
  MapPin,
  Brain,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Loader2,
  FileText,
  Copy,
  Check,
  Tag,
  User,
  Clock,
  Network,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useState } from "react";
import type { Signal, Company } from "@shared/schema";

export function SignalDetailPage() {
  const [, params] = useRoute("/signals/:id");
  const signalId = params?.id ? parseInt(params.id) : null;
  const { toast } = useToast();
  
  const [editorialInsightsOpen, setEditorialInsightsOpen] = useState(true);
  const [entitiesOpen, setEntitiesOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [articleStyle, setArticleStyle] = useState<"news" | "brief" | "analysis" | "signal">("news");

  const { data: signal, isLoading: signalLoading } = useQuery<Signal>({
    queryKey: ["/api/signals", signalId],
    enabled: !!signalId,
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: relatedSignals = [], isLoading: relatedLoading } = useQuery<Array<{
    signal: Signal;
    company: Company | null;
    sharedEntityCount: number;
    sharedEntitiesPreview: string[];
  }>>({
    queryKey: ["/api/signals", signalId, "related"],
    enabled: !!signalId,
  });

  const company = companies.find(c => c.id === signal?.companyId);

  const bookmarkMutation = useMutation({
    mutationFn: async ({ id, bookmarked }: { id: number; bookmarked: boolean }) => {
      return apiRequest("PATCH", `/api/signals/${id}`, { isBookmarked: bookmarked });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
    },
  });

  const analyzeSignalMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/signals/${id}/analyze`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/signals", signalId] });
      toast({ title: "Signal analyzed successfully" });
    },
    onError: () => {
      toast({ title: "Analysis failed", variant: "destructive" });
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes: string }) => {
      return apiRequest("PATCH", `/api/signals/${id}`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/signals", signalId] });
      toast({ title: "Notes saved" });
    },
  });

  const handleCopyContent = async () => {
    if (!signal) return;
    const text = `${signal.title}\n\n${signal.content || signal.summary || ""}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!signalId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Invalid signal ID</p>
      </div>
    );
  }

  if (signalLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!signal) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">Signal not found</p>
        <Link href="/signals">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Signals
          </Button>
        </Link>
      </div>
    );
  }

  const entities = signal.entities as {
    people?: (string | { name: string; role?: string; company?: string })[];
    organizations?: (string | { name: string })[];
    locations?: (string | { name: string })[];
    companies?: { name: string; relationship?: string }[];
    financials?: { funding?: string; revenue?: string; growth?: string };
  } | null;

  const aiAnalysis = signal.aiAnalysis as {
    keyPoints?: string[];
    keyTakeaways?: string[];
    suggestedActions?: string[];
    suggestedFollowUp?: string[];
    relatedTopics?: string[];
    industryImpact?: string;
    storyAngles?: string[];
    recommendedFormat?: string;
    relevanceScore?: number;
    priorityScore?: number;
    noveltyScore?: number;
    competitorImplications?: string[];
  } | null;

  const keyTakeaways = aiAnalysis?.keyTakeaways || aiAnalysis?.keyPoints || [];
  const industryImpact = aiAnalysis?.industryImpact;
  const storyAngles = aiAnalysis?.storyAngles || [];
  const suggestedFollowUp = aiAnalysis?.suggestedFollowUp || aiAnalysis?.suggestedActions || [];
  const hasEditorialInsights = keyTakeaways.length > 0 || industryImpact || storyAngles.length > 0 || suggestedFollowUp.length > 0;

  const displayDate = signal.publishedAt
    ? new Date(signal.publishedAt)
    : new Date(signal.createdAt);

  const priorityColors: Record<string, string> = {
    high: "bg-red-500/10 text-red-600 dark:text-red-400",
    medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    low: "bg-green-500/10 text-green-600 dark:text-green-400",
  };

  const sentimentColors: Record<string, string> = {
    positive: "bg-green-500/10 text-green-600 dark:text-green-400",
    negative: "bg-red-500/10 text-red-600 dark:text-red-400",
    neutral: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  };

  return (
    <ScrollArea className="h-full">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/signals">
            <Button variant="ghost" size="sm" data-testid="button-back-to-signals">
              <ArrowLeft className="w-4 h-4 mr-2" />
              All Signals
            </Button>
          </Link>
        </div>

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl font-bold leading-tight" data-testid="text-signal-title">
              {signal.title}
            </h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => bookmarkMutation.mutate({ id: signal.id, bookmarked: !signal.isBookmarked })}
              data-testid="button-bookmark"
            >
              {signal.isBookmarked ? (
                <BookmarkCheck className="w-6 h-6 text-primary" />
              ) : (
                <Bookmark className="w-6 h-6" />
              )}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {company && (
              <Badge variant="outline" className="gap-1">
                <Building2 className="w-3 h-3" />
                {company.name}
              </Badge>
            )}
            {company?.industry && (
              <Badge variant="secondary">{company.industry}</Badge>
            )}
            <Badge className={priorityColors[signal.priority || "medium"]}>
              {signal.priority} priority
            </Badge>
            {signal.sentiment && (
              <Badge className={sentimentColors[signal.sentiment]}>
                {signal.sentiment}
              </Badge>
            )}
            <Badge variant="outline">{signal.type}</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {format(displayDate, "MMM d, yyyy 'at' h:mm a")}
            </span>
            {signal.sourceName && (
              <span className="flex items-center gap-1.5">
                <Globe className="w-4 h-4" />
                {signal.sourceName}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {formatDistanceToNow(displayDate, { addSuffix: true })}
            </span>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Signal Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {signal.content ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p>{signal.content}</p>
                  </div>
                ) : signal.summary ? (
                  <p className="text-muted-foreground">{signal.summary}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No content available
                  </p>
                )}

                <div className="flex flex-wrap gap-2 pt-4">
                  {signal.sourceUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={signal.sourceUrl.startsWith("//") ? "https:" + signal.sourceUrl : 
                              (!signal.sourceUrl.startsWith("http") ? "https://" + signal.sourceUrl : signal.sourceUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="link-source"
                      >
                        <ExternalLink className="w-4 h-4 mr-1.5" />
                        View Source
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={handleCopyContent} data-testid="button-copy">
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
              </CardContent>
            </Card>

            {hasEditorialInsights && (
              <Card>
                <Collapsible open={editorialInsightsOpen} onOpenChange={setEditorialInsightsOpen}>
                  <CardHeader className="pb-3">
                    <CollapsibleTrigger className="flex items-center justify-between w-full" data-testid="collapsible-editorial-insights">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Brain className="w-5 h-5" />
                        Editorial Insights
                      </CardTitle>
                      {editorialInsightsOpen ? (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      )}
                    </CollapsibleTrigger>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="space-y-6 pt-0">
                      {keyTakeaways.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                            Key Takeaways
                          </h4>
                          <ul className="space-y-2">
                            {keyTakeaways.map((point, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {industryImpact && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                            Industry Impact
                          </h4>
                          <p className="text-sm leading-relaxed">{industryImpact}</p>
                        </div>
                      )}

                      {storyAngles.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                            Story Angles
                          </h4>
                          <ul className="space-y-2">
                            {storyAngles.map((angle, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-secondary-foreground/50 mt-2 flex-shrink-0" />
                                <span>{angle}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {suggestedFollowUp.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                            Suggested Follow-Up
                          </h4>
                          <ul className="space-y-2">
                            {suggestedFollowUp.map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {aiAnalysis?.relevanceScore !== undefined && (
                        <div className="flex flex-wrap gap-4 pt-2">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-primary">{aiAnalysis.relevanceScore}</div>
                            <div className="text-xs text-muted-foreground">Relevance</div>
                          </div>
                          {aiAnalysis.priorityScore !== undefined && (
                            <div className="text-center">
                              <div className="text-2xl font-bold">{aiAnalysis.priorityScore}</div>
                              <div className="text-xs text-muted-foreground">Priority Score</div>
                            </div>
                          )}
                          {aiAnalysis.recommendedFormat && (
                            <div className="text-center">
                              <Badge variant="outline" className="text-sm capitalize">
                                {aiAnalysis.recommendedFormat}
                              </Badge>
                              <div className="text-xs text-muted-foreground mt-1">Recommended Format</div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            )}

            {entities && (
              <Card>
                <Collapsible open={entitiesOpen} onOpenChange={setEntitiesOpen}>
                  <CardHeader className="pb-3">
                    <CollapsibleTrigger className="flex items-center justify-between w-full" data-testid="collapsible-entities">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Tag className="w-5 h-5" />
                        Extracted Entities
                      </CardTitle>
                      {entitiesOpen ? (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      )}
                    </CollapsibleTrigger>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="space-y-4 pt-0">
                      {entities.people && entities.people.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <User className="w-4 h-4" />
                            People
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {entities.people.map((person, i) => {
                              const personName = typeof person === 'string' ? person : person.name;
                              const role = typeof person === 'object' ? person.role : undefined;
                              return (
                                <Badge key={i} variant="secondary" className="gap-1">
                                  {personName}
                                  {role && <span className="text-muted-foreground">({role})</span>}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {entities.companies && entities.companies.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            Companies
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {entities.companies.map((org, i) => (
                              <Badge key={i} variant="outline" className="gap-1">
                                {org.name}
                                {org.relationship && (
                                  <span className="text-muted-foreground">({org.relationship})</span>
                                )}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {entities.locations && entities.locations.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            Locations
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {entities.locations.map((loc, i) => {
                              const locName = typeof loc === 'string' ? loc : loc.name;
                              return (
                                <Badge key={i} variant="outline">
                                  {locName}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {entities.financials && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground">Financial Data</h4>
                          <div className="flex flex-wrap gap-4">
                            {entities.financials.funding && (
                              <div>
                                <span className="text-xs text-muted-foreground">Funding:</span>
                                <span className="ml-1 font-medium">{entities.financials.funding}</span>
                              </div>
                            )}
                            {entities.financials.revenue && (
                              <div>
                                <span className="text-xs text-muted-foreground">Revenue:</span>
                                <span className="ml-1 font-medium">{entities.financials.revenue}</span>
                              </div>
                            )}
                            {entities.financials.growth && (
                              <div>
                                <span className="text-xs text-muted-foreground">Growth:</span>
                                <span className="ml-1 font-medium">{entities.financials.growth}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Editorial Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Add notes about this signal..."
                  value={notes || signal.notes || ""}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[100px]"
                  data-testid="textarea-notes"
                />
                <Button
                  size="sm"
                  onClick={async () => {
                    setIsSaving(true);
                    await updateNotesMutation.mutateAsync({ id: signal.id, notes });
                    setIsSaving(false);
                  }}
                  disabled={isSaving}
                  data-testid="button-save-notes"
                >
                  {isSaving ? "Saving..." : "Save Notes"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {company && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Company
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h3 className="font-semibold">{company.name}</h3>
                    {company.industry && (
                      <p className="text-sm text-muted-foreground">{company.industry}</p>
                    )}
                  </div>
                  {company.location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      {company.location}
                    </div>
                  )}
                  {company.description && (
                    <p className="text-sm text-muted-foreground">{company.description}</p>
                  )}
                  {company.website && (
                    <Button variant="outline" size="sm" asChild className="w-full">
                      <a href={company.website} target="_blank" rel="noopener noreferrer">
                        <Globe className="w-4 h-4 mr-2" />
                        Visit Website
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Network className="w-5 h-5" />
                  Related Signals
                </CardTitle>
              </CardHeader>
              <CardContent>
                {relatedLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : relatedSignals.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">No related signals yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Connections appear as more coverage accumulates
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {relatedSignals.slice(0, 5).map((result) => (
                      <Link key={result.signal.id} href={`/signals/${result.signal.id}`}>
                        <div className="p-3 rounded-md border hover-elevate cursor-pointer" data-testid={`related-signal-${result.signal.id}`}>
                          <h4 className="text-sm font-medium line-clamp-2">{result.signal.title}</h4>
                          {result.company && (
                            <p className="text-xs text-muted-foreground mt-1">{result.company.name}</p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {result.sharedEntityCount} shared
                            </Badge>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Article Generation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  value={articleStyle}
                  onValueChange={(value: "news" | "brief" | "analysis" | "signal") => setArticleStyle(value)}
                >
                  <SelectTrigger data-testid="select-article-style">
                    <SelectValue placeholder="Article style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="news">Standard Article</SelectItem>
                    <SelectItem value="brief">Brief</SelectItem>
                    <SelectItem value="analysis">Analysis</SelectItem>
                    <SelectItem value="signal">Signal-First</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="w-full" data-testid="button-generate-article">
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Article
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
