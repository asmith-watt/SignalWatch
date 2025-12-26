import { Building2, Radio, Bell, Search, FileEdit, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: typeof Building2;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} data-testid="button-empty-action">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function EmptyCompanies({ onAddCompany }: { onAddCompany: () => void }) {
  return (
    <EmptyState
      icon={Building2}
      title="No companies yet"
      description="Start monitoring businesses by adding your first company. We'll automatically collect signals from news, job postings, and more."
      actionLabel="Add Your First Company"
      onAction={onAddCompany}
    />
  );
}

export function EmptySignals() {
  return (
    <EmptyState
      icon={Radio}
      title="No signals yet"
      description="Signals will appear here as they are collected from your monitored companies. Add companies to start receiving business intelligence."
    />
  );
}

export function EmptyFilteredSignals({ onClearFilters }: { onClearFilters: () => void }) {
  return (
    <EmptyState
      icon={Search}
      title="No matching signals"
      description="No signals match your current filters. Try adjusting your filter criteria or clearing all filters."
      actionLabel="Clear Filters"
      onAction={onClearFilters}
    />
  );
}

export function EmptyAlerts({ onCreateAlert }: { onCreateAlert: () => void }) {
  return (
    <EmptyState
      icon={Bell}
      title="No alerts configured"
      description="Set up alerts to get notified when important business signals are detected. Never miss a funding announcement, executive change, or product launch."
      actionLabel="Create Your First Alert"
      onAction={onCreateAlert}
    />
  );
}

export function EmptyCompanySignals() {
  return (
    <EmptyState
      icon={Radio}
      title="No signals for this company"
      description="We haven't collected any signals for this company yet. Signals will appear here as news, press releases, and other business events are detected."
    />
  );
}

export function EmptySearch() {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description="Try different search terms or check your spelling."
    />
  );
}

export function EmptyDashboard({ onAddCompany }: { onAddCompany: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <TrendingUp className="w-10 h-10 text-primary" />
      </div>
      <h2 className="text-2xl font-semibold mb-2">Welcome to SignalWatch</h2>
      <p className="text-muted-foreground max-w-md mb-6">
        Your B2B business intelligence platform. Start by adding companies you want to monitor, 
        and we'll automatically collect news, funding announcements, executive changes, and more.
      </p>
      <Button size="lg" onClick={onAddCompany} data-testid="button-get-started">
        Add Your First Company
      </Button>
    </div>
  );
}
