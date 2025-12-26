import { formatDistanceToNow } from "date-fns";
import {
  Newspaper,
  Megaphone,
  Briefcase,
  DollarSign,
  UserCheck,
  Package,
  Handshake,
  Building2,
  Globe,
  MessageSquare,
  FileText,
  TrendingUp,
  Bookmark,
  BookmarkCheck,
  User,
  ExternalLink,
  MoreHorizontal,
  FileEdit,
  Sparkles,
  MapPin,
  Users,
  Calendar,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Signal } from "@shared/schema";

interface SignalCardProps {
  signal: Signal;
  companyName?: string;
  showCompany?: boolean;
  onBookmark?: (id: number, bookmarked: boolean) => void;
  onMarkRead?: (id: number, read: boolean) => void;
  onAssign?: (id: number) => void;
  onCreateContent?: (id: number) => void;
  onClick?: () => void;
}

const signalTypeConfig: Record<
  string,
  { icon: typeof Newspaper; label: string; color: string }
> = {
  news: { icon: Newspaper, label: "News", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  press_release: { icon: Megaphone, label: "Press Release", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  job_posting: { icon: Briefcase, label: "Job Posting", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  funding: { icon: DollarSign, label: "Funding", color: "bg-green-500/10 text-green-600 dark:text-green-400" },
  executive_change: { icon: UserCheck, label: "Executive Change", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  product_launch: { icon: Package, label: "Product Launch", color: "bg-pink-500/10 text-pink-600 dark:text-pink-400" },
  partnership: { icon: Handshake, label: "Partnership", color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" },
  acquisition: { icon: Building2, label: "Acquisition", color: "bg-red-500/10 text-red-600 dark:text-red-400" },
  website_change: { icon: Globe, label: "Website Change", color: "bg-slate-500/10 text-slate-600 dark:text-slate-400" },
  social_media: { icon: MessageSquare, label: "Social Media", color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  regulatory: { icon: FileText, label: "Regulatory", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  earnings: { icon: TrendingUp, label: "Earnings", color: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  other: { icon: FileText, label: "Other", color: "bg-gray-500/10 text-gray-600 dark:text-gray-400" },
};

const priorityColors: Record<string, string> = {
  high: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  low: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
};

const sentimentColors: Record<string, string> = {
  positive: "text-green-600 dark:text-green-400",
  negative: "text-red-600 dark:text-red-400",
  neutral: "text-muted-foreground",
};

const contentStatusConfig: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  reviewing: { label: "Reviewing", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  writing: { label: "Writing", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  published: { label: "Published", color: "bg-green-500/10 text-green-600 dark:text-green-400" },
};

export function SignalCard({
  signal,
  companyName,
  showCompany = false,
  onBookmark,
  onMarkRead,
  onAssign,
  onCreateContent,
  onClick,
}: SignalCardProps) {
  const typeConfig = signalTypeConfig[signal.type] || signalTypeConfig.other;
  const TypeIcon = typeConfig.icon;
  const priorityColor = priorityColors[signal.priority || "medium"];
  const sentimentColor = sentimentColors[signal.sentiment || "neutral"];
  const statusConfig = contentStatusConfig[signal.contentStatus || "new"];

  const timeAgo = signal.publishedAt
    ? formatDistanceToNow(new Date(signal.publishedAt), { addSuffix: true })
    : signal.createdAt
    ? formatDistanceToNow(new Date(signal.createdAt), { addSuffix: true })
    : "";

  return (
    <Card
      className={`p-4 transition-colors hover-elevate cursor-pointer ${
        !signal.isRead ? "border-l-2 border-l-primary" : ""
      }`}
      onClick={onClick}
      data-testid={`signal-card-${signal.id}`}
    >
      <div className="flex gap-3">
        <div
          className={`flex-shrink-0 w-9 h-9 rounded-md flex items-center justify-center ${typeConfig.color}`}
        >
          <TypeIcon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <h3
                className={`text-sm font-medium leading-snug line-clamp-2 ${
                  !signal.isRead ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {signal.title}
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {showCompany && companyName && (
                  <>
                    <span className="font-medium text-foreground">{companyName}</span>
                    <span>-</span>
                  </>
                )}
                {signal.sourceName && <span>{signal.sourceName}</span>}
                {timeAgo && (
                  <>
                    <span>-</span>
                    <span>{timeAgo}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      onBookmark?.(signal.id, !signal.isBookmarked);
                    }}
                    data-testid={`button-bookmark-${signal.id}`}
                  >
                    {signal.isBookmarked ? (
                      <BookmarkCheck className="w-4 h-4 text-primary" />
                    ) : (
                      <Bookmark className="w-4 h-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {signal.isBookmarked ? "Remove bookmark" : "Bookmark"}
                </TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`button-signal-menu-${signal.id}`}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => onMarkRead?.(signal.id, !signal.isRead)}
                  >
                    {signal.isRead ? "Mark as unread" : "Mark as read"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAssign?.(signal.id)}>
                    <User className="w-4 h-4 mr-2" />
                    Assign to team member
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onCreateContent?.(signal.id)}>
                    <FileEdit className="w-4 h-4 mr-2" />
                    Create content
                  </DropdownMenuItem>
                  {signal.sourceUrl && (
                    <DropdownMenuItem asChild>
                      <a
                        href={signal.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View source
                      </a>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Original Signal Content */}
          {signal.summary && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {signal.summary}
            </p>
          )}

          {/* Signal Metadata Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className={`text-xs ${typeConfig.color}`}>
              {typeConfig.label}
            </Badge>

            {signal.priority && (
              <Badge variant="outline" className={`text-xs ${priorityColor}`}>
                {signal.priority.charAt(0).toUpperCase() + signal.priority.slice(1)} Priority
              </Badge>
            )}

            {signal.sentiment && signal.sentiment !== "neutral" && (
              <span className={`text-xs font-medium ${sentimentColor}`}>
                {signal.sentiment.charAt(0).toUpperCase() + signal.sentiment.slice(1)}
              </span>
            )}

            {signal.contentStatus && signal.contentStatus !== "new" && (
              <Badge variant="secondary" className={`text-xs ${statusConfig.color}`}>
                {statusConfig.label}
              </Badge>
            )}

            {/* AI Relevance Score - Prominent */}
            {signal.aiAnalysis && typeof signal.aiAnalysis === 'object' && (signal.aiAnalysis as any).relevanceScore && (
              <Badge className="text-xs h-5 px-1.5 gap-1 bg-primary/10 text-primary border-primary/20">
                <Sparkles className="w-2.5 h-2.5" />
                Score: {(signal.aiAnalysis as any).relevanceScore}
              </Badge>
            )}

            {signal.assignedTo && (
              <div className="flex items-center gap-1">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-xs">
                    {signal.assignedTo.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
          </div>

          {/* AI Insights Section */}
          {signal.aiAnalysis && typeof signal.aiAnalysis === 'object' && (() => {
            const analysis = signal.aiAnalysis as any;
            const takeaways = analysis.keyTakeaways || analysis.keyPoints || [];
            const industryImpact = analysis.industryImpact;
            const storyAngles = analysis.storyAngles || [];
            
            return (
              <div className="mt-2 p-2.5 rounded-md bg-primary/5 border border-primary/10 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold text-primary">AI Analysis</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Powered by Perplexity</span>
                </div>
                
                {/* Key Takeaways */}
                {takeaways.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Key Takeaways:</span>
                    <ul className="text-xs text-foreground space-y-0.5 pl-4">
                      {(takeaways as string[]).slice(0, 3).map((takeaway, i) => (
                        <li key={i} className="list-disc">{takeaway}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Industry Impact */}
                {industryImpact && (
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Industry Impact:</span>
                    <p className="text-xs text-foreground">{industryImpact}</p>
                  </div>
                )}

                {/* Story Angles */}
                {storyAngles.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Story Angles:</span>
                    <ul className="text-xs text-foreground space-y-0.5 pl-4">
                      {(storyAngles as string[]).slice(0, 2).map((angle, i) => (
                        <li key={i} className="list-disc">{angle}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Extracted Entities */}
                {signal.entities && typeof signal.entities === 'object' && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(signal.entities as any).companies?.map((c: any, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs h-5 px-1.5 gap-1">
                        <Building2 className="w-2.5 h-2.5" />
                        {c.name}
                      </Badge>
                    ))}
                    {(signal.entities as any).organizations?.map((org: string, i: number) => (
                      <Badge key={`org-${i}`} variant="secondary" className="text-xs h-5 px-1.5 gap-1">
                        <Building2 className="w-2.5 h-2.5" />
                        {org}
                      </Badge>
                    ))}
                    {(signal.entities as any).people?.map((person: any, i: number) => (
                      <Badge key={`person-${i}`} variant="outline" className="text-xs h-5 px-1.5 gap-1">
                        <Users className="w-2.5 h-2.5" />
                        {typeof person === 'string' ? person : person.name}
                      </Badge>
                    ))}
                    {(signal.entities as any).locations?.slice(0, 3).map((loc: string, i: number) => (
                      <Badge key={`loc-${i}`} variant="outline" className="text-xs h-5 px-1.5 gap-1">
                        <MapPin className="w-2.5 h-2.5" />
                        {loc}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </Card>
  );
}
