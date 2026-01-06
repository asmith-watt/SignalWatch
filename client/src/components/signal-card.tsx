import { format } from "date-fns";
import {
  Bookmark,
  BookmarkCheck,
  MoreHorizontal,
  Building2,
  MapPin,
  FileEdit,
  Loader2,
  ExternalLink,
  User,
  Globe,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Signal, Company } from "@shared/schema";

interface SignalCardProps {
  signal: Signal;
  company?: Company | null;
  mode: "compact" | "editorial";
  onOpen?: () => void;
  relatedCount?: number;
  onToggleBookmark?: (id: number, bookmarked: boolean) => void;
  onMarkRead?: (id: number, read: boolean) => void;
  onAssign?: (id: number) => void;
  onCreateContent?: (id: number) => void;
  onPublishWordPress?: (id: number) => void;
  onPublishMediaSite?: (id: number) => void;
  isGeneratingArticle?: boolean;
  onGenerateArticle?: () => void;
}

interface EntityChip {
  label: string;
  type: "company" | "location" | "related";
}

interface SignalEntities {
  companies?: Array<{ name: string; relationship?: string }>;
  locations?: string[];
  people?: Array<{ name: string; role?: string }>;
  dates?: Array<{ date: string; event?: string }>;
  financials?: {
    funding?: string | null;
    revenue?: string | null;
    valuation?: string | null;
    growth?: string | null;
  };
}

interface AIAnalysis {
  keyTakeaways?: string[];
  keyPoints?: string[];
  industryImpact?: string;
  storyAngles?: string[];
  suggestedFollowUp?: string[];
  suggestedActions?: string[];
  relevanceScore?: number;
  priorityScore?: number;
  noveltyScore?: number;
  recommendedFormat?: "ignore" | "brief" | "news" | "analysis";
}

function formatMetaLine(
  company: Company | null | undefined,
  sourceName: string | null | undefined,
  sourceUrl: string | null | undefined,
  publishedAt: Date | string | null | undefined,
  gatheredAt: Date | string | null | undefined
): string {
  const parts: string[] = [];
  
  if (company?.name) {
    parts.push(company.name);
  }
  
  if (sourceName) {
    parts.push(sourceName);
  } else if (sourceUrl) {
    try {
      const url = new URL(sourceUrl.startsWith("http") ? sourceUrl : `https://${sourceUrl}`);
      parts.push(url.hostname.replace("www.", ""));
    } catch {
      parts.push("Source");
    }
  }
  
  if (publishedAt) {
    const date = typeof publishedAt === "string" ? new Date(publishedAt) : publishedAt;
    parts.push(`Source: ${format(date, "MMM d, yyyy")}`);
  }
  
  if (gatheredAt) {
    const date = typeof gatheredAt === "string" ? new Date(gatheredAt) : gatheredAt;
    parts.push(`Gathered: ${format(date, "MMM d, yyyy")}`);
  }
  
  return parts.join(" \u2022 ");
}

function deriveEntityChips(signal: Signal, company?: Company | null): EntityChip[] {
  const chips: EntityChip[] = [];
  const entities = signal.entities as SignalEntities | null;
  
  if (company?.name) {
    chips.push({ label: company.name, type: "company" });
  }
  
  if (entities?.locations && entities.locations.length > 0) {
    const locations = entities.locations.slice(0, 2);
    for (const loc of locations) {
      if (chips.length < 4) {
        chips.push({ label: loc, type: "location" });
      }
    }
  }
  
  if (entities?.companies && entities.companies.length > 0) {
    const relatedCompanies = entities.companies.filter(
      (c) => c.relationship !== "subject" && c.name !== company?.name
    );
    if (relatedCompanies.length > 0 && chips.length < 4) {
      chips.push({ label: relatedCompanies[0].name, type: "related" });
    }
  }
  
  return chips.slice(0, 4);
}

function renderBadges(signal: Signal): JSX.Element[] {
  const badges: JSX.Element[] = [];
  const aiAnalysis = signal.aiAnalysis as AIAnalysis | null;
  
  badges.push(
    <Badge key="type" variant="secondary" data-testid={`badge-type-${signal.id}`}>
      {signal.type.replace(/_/g, " ")}
    </Badge>
  );
  
  if (signal.priority === "high") {
    badges.push(
      <Badge key="priority" variant="default" data-testid={`badge-priority-${signal.id}`}>
        high priority
      </Badge>
    );
  } else if (signal.priority === "low") {
    badges.push(
      <Badge key="priority" variant="outline" data-testid={`badge-priority-${signal.id}`}>
        low priority
      </Badge>
    );
  }
  
  if (signal.sentiment === "negative") {
    badges.push(
      <Badge key="sentiment" variant="destructive" data-testid={`badge-sentiment-${signal.id}`}>
        negative
      </Badge>
    );
  }
  
  if (signal.contentStatus) {
    badges.push(
      <Badge key="status" variant="outline" data-testid={`badge-status-${signal.id}`}>
        {signal.contentStatus}
      </Badge>
    );
  }
  
  if (aiAnalysis?.recommendedFormat) {
    const formatVariant = aiAnalysis.recommendedFormat === "ignore" ? "outline" : "secondary";
    badges.push(
      <Badge key="format" variant={formatVariant} data-testid={`badge-format-${signal.id}`}>
        {aiAnalysis.recommendedFormat}
      </Badge>
    );
  }
  
  if (aiAnalysis?.priorityScore !== undefined && badges.length < 5) {
    badges.push(
      <Badge key="score" variant="outline" data-testid={`badge-score-${signal.id}`}>
        Score: {aiAnalysis.priorityScore}
      </Badge>
    );
  }
  
  return badges.slice(0, 5);
}

export function SignalCard({
  signal,
  company,
  mode,
  onOpen,
  relatedCount = 0,
  onToggleBookmark,
  onMarkRead,
  onAssign,
  onCreateContent,
  onPublishWordPress,
  onPublishMediaSite,
  isGeneratingArticle,
  onGenerateArticle,
}: SignalCardProps) {
  const aiAnalysis = signal.aiAnalysis as AIAnalysis | null;
  const entityChips = deriveEntityChips(signal, company);
  const metaLine = formatMetaLine(
    company,
    signal.sourceName,
    signal.sourceUrl,
    signal.publishedAt,
    signal.gatheredAt
  );
  
  const keyTakeaways = aiAnalysis?.keyTakeaways || aiAnalysis?.keyPoints || [];
  const suggestedFollowUp = aiAnalysis?.suggestedFollowUp || aiAnalysis?.suggestedActions || [];

  const handleCardClick = () => {
    if (mode === "compact" && onOpen) {
      onOpen();
    }
  };

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleBookmark) {
      onToggleBookmark(signal.id, !signal.isBookmarked);
    }
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <Card
      className={`${mode === "compact" ? "hover-elevate active-elevate-2 cursor-pointer" : ""} ${
        !signal.isRead && mode === "compact" ? "border-l-2 border-l-primary" : ""
      }`}
      onClick={handleCardClick}
      data-testid={`signal-card-${signal.id}`}
    >
      <CardContent className={mode === "compact" ? "p-4" : "p-5"}>
        <div className="flex items-start justify-between gap-3">
          <h3
            className={`font-medium ${mode === "compact" ? "text-sm line-clamp-1" : "text-base"}`}
            data-testid={`signal-title-${signal.id}`}
          >
            {signal.title}
          </h3>
          
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBookmarkClick}
              data-testid={`button-bookmark-${signal.id}`}
            >
              {signal.isBookmarked ? (
                <BookmarkCheck className="w-4 h-4 text-primary" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )}
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleMenuClick}
                  data-testid={`button-menu-${signal.id}`}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkRead?.(signal.id, !signal.isRead);
                  }}
                >
                  {signal.isRead ? "Mark as unread" : "Mark as read"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onAssign?.(signal.id);
                  }}
                >
                  <User className="w-4 h-4 mr-2" />
                  Assign to team member
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateContent?.(signal.id);
                  }}
                >
                  <FileEdit className="w-4 h-4 mr-2" />
                  Create content
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onPublishWordPress?.(signal.id);
                  }}
                >
                  <Globe className="w-4 h-4 mr-2" />
                  Publish to WordPress
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onPublishMediaSite?.(signal.id);
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Publish to BakingMilling
                </DropdownMenuItem>
                {signal.sourceUrl && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        const srcUrl = signal.sourceUrl!;
                        const url = srcUrl.startsWith("//") 
                          ? "https:" + srcUrl 
                          : (!srcUrl.startsWith("http") ? "https://" + srcUrl : srcUrl);
                        window.open(url, "_blank");
                      }}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Source
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(signal.title + "\n\n" + (signal.summary || ""));
                  }}
                >
                  Copy Content
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mt-1" data-testid={`signal-meta-${signal.id}`}>
          {metaLine}
        </p>

        {signal.summary && (
          <p
            className={`text-sm mt-2 ${mode === "compact" ? "line-clamp-2" : ""}`}
            data-testid={`signal-summary-${signal.id}`}
          >
            {signal.summary}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5 mt-3" data-testid={`signal-badges-${signal.id}`}>
          {renderBadges(signal)}
        </div>

        {entityChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2" data-testid={`signal-entities-${signal.id}`}>
            {entityChips.map((chip, i) => (
              <Badge key={i} variant="outline" className="gap-1">
                {chip.type === "company" && <Building2 className="w-3 h-3" />}
                {chip.type === "location" && <MapPin className="w-3 h-3" />}
                {chip.type === "related" && <Building2 className="w-3 h-3" />}
                {chip.label}
              </Badge>
            ))}
          </div>
        )}

        {mode === "editorial" && (
          <>
            {(keyTakeaways.length > 0 || aiAnalysis?.industryImpact || aiAnalysis?.storyAngles?.length || suggestedFollowUp.length > 0) && (
              <Card className="mt-4 bg-muted/40 border-0">
                <CardContent className="p-4 space-y-4">
                  <h4 className="text-sm font-medium">AI Analysis</h4>
                  
                  {keyTakeaways.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Key Takeaways
                      </p>
                      <ul className="space-y-1">
                        {keyTakeaways.map((point, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {aiAnalysis?.industryImpact && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Industry Impact
                      </p>
                      <p className="text-sm">{aiAnalysis.industryImpact}</p>
                    </div>
                  )}
                  
                  {aiAnalysis?.storyAngles && aiAnalysis.storyAngles.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Story Angles
                      </p>
                      <ul className="space-y-1">
                        {aiAnalysis.storyAngles.map((angle, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-secondary-foreground/50 mt-1.5 flex-shrink-0" />
                            {angle}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {suggestedFollowUp.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Suggested Follow-Up
                      </p>
                      <ul className="space-y-1">
                        {suggestedFollowUp.map((item, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <p className="text-xs text-muted-foreground mt-3">
              {relatedCount > 0
                ? `Connected to ${relatedCount} related signal${relatedCount === 1 ? "" : "s"}`
                : "Connections appear as more coverage accumulates"}
            </p>

            <div className="flex flex-wrap gap-2 mt-4">
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onGenerateArticle) onGenerateArticle();
                }}
                disabled={isGeneratingArticle}
                data-testid={`button-create-article-${signal.id}`}
              >
                {isGeneratingArticle ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <FileEdit className="w-4 h-4 mr-1.5" />
                )}
                Create Article
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Legacy export for backward compatibility with existing code
export type { SignalCardProps };
