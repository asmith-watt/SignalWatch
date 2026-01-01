import {
  Globe,
  MapPin,
  Users,
  Calendar,
  ExternalLink,
  Edit,
  Bell,
  Download,
  Archive,
  MoreHorizontal,
  Radio,
  Clock,
  AlertCircle,
  StickyNote,
  Sparkles,
  Loader2,
} from "lucide-react";
import { SiLinkedin, SiX } from "react-icons/si";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Company } from "@shared/schema";

interface CompanyProfileHeaderProps {
  company: Company;
  signalCount: number;
  alertCount: number;
  lastSignalDate?: string;
  onEdit: () => void;
  onConfigureAlerts: () => void;
  onExport: () => void;
  onArchive: () => void;
  onEnrich?: () => void;
  isEnriching?: boolean;
}

function getCompanyInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function CompanyProfileHeader({
  company,
  signalCount,
  alertCount,
  lastSignalDate,
  onEdit,
  onConfigureAlerts,
  onExport,
  onArchive,
  onEnrich,
  isEnriching,
}: CompanyProfileHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 rounded-lg">
            {company.logoUrl && <AvatarImage src={company.logoUrl} alt={company.name} />}
            <AvatarFallback className="rounded-lg text-xl bg-primary/10 text-primary">
              {getCompanyInitials(company.name)}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold" data-testid="text-company-name">
                {company.name}
              </h1>
              {!company.isActive && (
                <Badge variant="secondary" className="text-xs">
                  Archived
                </Badge>
              )}
            </div>

            {company.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 max-w-xl">
                {company.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="link-company-website"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[160px]">
                    {company.website.replace(/^https?:\/\//, "")}
                  </span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}

              {company.linkedinUrl && (
                <a
                  href={company.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <SiLinkedin className="w-3.5 h-3.5" />
                </a>
              )}

              {company.twitterHandle && (
                <a
                  href={`https://twitter.com/${company.twitterHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <SiX className="w-3 h-3" />
                  <span>@{company.twitterHandle}</span>
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEdit} data-testid="button-edit-company">
            <Edit className="w-4 h-4 mr-1.5" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={onConfigureAlerts} data-testid="button-configure-alerts">
            <Bell className="w-4 h-4 mr-1.5" />
            Alerts
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="button-company-menu">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEnrich && (
                <DropdownMenuItem onClick={onEnrich} disabled={isEnriching}>
                  {isEnriching ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  {isEnriching ? "Enriching..." : "AI Enrich Data"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onExport}>
                <Download className="w-4 h-4 mr-2" />
                Export data
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onArchive} className="text-destructive">
                <Archive className="w-4 h-4 mr-2" />
                Archive company
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {company.industry && (
          <div className="flex items-center gap-2 text-sm">
            <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
              <Globe className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Industry</div>
              <div className="font-medium">{company.industry}</div>
            </div>
          </div>
        )}

        {company.size && (
          <div className="flex items-center gap-2 text-sm">
            <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
              <Users className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Size</div>
              <div className="font-medium">{company.size}</div>
            </div>
          </div>
        )}

        {company.location && (
          <div className="flex items-center gap-2 text-sm">
            <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
              <MapPin className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Location</div>
              <div className="font-medium">{company.location}</div>
            </div>
          </div>
        )}

        {company.founded && (
          <div className="flex items-center gap-2 text-sm">
            <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Founded</div>
              <div className="font-medium">{company.founded}</div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-6 py-3 px-4 rounded-lg bg-muted/50">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium" data-testid="text-signal-count">{signalCount}</span>
          <span className="text-sm text-muted-foreground">Signals</span>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Last signal: {lastSignalDate || "None"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium">{alertCount}</span>
          <span className="text-sm text-muted-foreground">Active alerts</span>
        </div>

        {company.tags && company.tags.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            {company.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {company.tags.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{company.tags.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
