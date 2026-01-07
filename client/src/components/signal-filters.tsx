import { useState } from "react";
import {
  Filter,
  X,
  Calendar,
  Radio,
  AlertTriangle,
  User,
  ChevronDown,
  Save,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { signalTypes } from "@shared/schema";

export interface SignalFilters {
  types: string[];
  priorities: string[];
  dateRange: string;
  assignee: string;
  status: string;
  bookmarked: boolean;
  unread: boolean;
  entityQuery: string;
  industry: string;
}

interface SignalFiltersBarProps {
  filters: SignalFilters;
  onFiltersChange: (filters: SignalFilters) => void;
  resultCount: number;
  teamMembers?: { id: string; name: string }[];
}

const priorityOptions = [
  { value: "high", label: "High Priority" },
  { value: "medium", label: "Medium Priority" },
  { value: "low", label: "Low Priority" },
];

const dateRangeOptions = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" },
];

const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "writing", label: "Writing" },
  { value: "published", label: "Published" },
];

const signalTypeLabels: Record<string, string> = {
  news: "News",
  press_release: "Press Release",
  job_posting: "Job Posting",
  funding: "Funding",
  executive_change: "Executive Change",
  product_launch: "Product Launch",
  partnership: "Partnership",
  acquisition: "Acquisition",
  website_change: "Website Change",
  social_media: "Social Media",
  regulatory: "Regulatory",
  earnings: "Earnings",
  other: "Other",
};

export function SignalFiltersBar({
  filters,
  onFiltersChange,
  resultCount,
  teamMembers = [],
}: SignalFiltersBarProps) {
  const [typePopoverOpen, setTypePopoverOpen] = useState(false);
  const [priorityPopoverOpen, setPriorityPopoverOpen] = useState(false);

  const activeFilterCount =
    filters.types.length +
    filters.priorities.length +
    (filters.dateRange !== "all" ? 1 : 0) +
    (filters.assignee !== "all" ? 1 : 0) +
    (filters.status !== "all" ? 1 : 0) +
    (filters.bookmarked ? 1 : 0) +
    (filters.unread ? 1 : 0) +
    (filters.entityQuery ? 1 : 0) +
    (filters.industry !== "all" ? 1 : 0);

  const handleTypeToggle = (type: string) => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter((t) => t !== type)
      : [...filters.types, type];
    onFiltersChange({ ...filters, types: newTypes });
  };

  const handlePriorityToggle = (priority: string) => {
    const newPriorities = filters.priorities.includes(priority)
      ? filters.priorities.filter((p) => p !== priority)
      : [...filters.priorities, priority];
    onFiltersChange({ ...filters, priorities: newPriorities });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      types: [],
      priorities: [],
      dateRange: "all",
      assignee: "all",
      status: "all",
      bookmarked: false,
      unread: false,
      entityQuery: "",
      industry: "all",
    });
  };

  const removeFilter = (filterType: string, value?: string) => {
    switch (filterType) {
      case "type":
        onFiltersChange({
          ...filters,
          types: filters.types.filter((t) => t !== value),
        });
        break;
      case "priority":
        onFiltersChange({
          ...filters,
          priorities: filters.priorities.filter((p) => p !== value),
        });
        break;
      case "dateRange":
        onFiltersChange({ ...filters, dateRange: "all" });
        break;
      case "assignee":
        onFiltersChange({ ...filters, assignee: "all" });
        break;
      case "status":
        onFiltersChange({ ...filters, status: "all" });
        break;
      case "bookmarked":
        onFiltersChange({ ...filters, bookmarked: false });
        break;
      case "unread":
        onFiltersChange({ ...filters, unread: false });
        break;
      case "entityQuery":
        onFiltersChange({ ...filters, entityQuery: "" });
        break;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search entities..."
            value={filters.entityQuery}
            onChange={(e) => onFiltersChange({ ...filters, entityQuery: e.target.value })}
            className="w-48 pl-8 h-8"
            data-testid="input-entity-search"
          />
        </div>

        <Popover open={typePopoverOpen} onOpenChange={setTypePopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-filter-type">
              <Radio className="w-4 h-4 mr-1.5" />
              Signal Type
              {filters.types.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">
                  {filters.types.length}
                </Badge>
              )}
              <ChevronDown className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" align="start">
            <div className="space-y-2">
              {signalTypes.map((type) => (
                <div key={type} className="flex items-center gap-2">
                  <Checkbox
                    id={`type-${type}`}
                    checked={filters.types.includes(type)}
                    onCheckedChange={() => handleTypeToggle(type)}
                  />
                  <Label
                    htmlFor={`type-${type}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {signalTypeLabels[type] || type}
                  </Label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={priorityPopoverOpen} onOpenChange={setPriorityPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-filter-priority">
              <AlertTriangle className="w-4 h-4 mr-1.5" />
              Priority
              {filters.priorities.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">
                  {filters.priorities.length}
                </Badge>
              )}
              <ChevronDown className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-3" align="start">
            <div className="space-y-2">
              {priorityOptions.map((option) => (
                <div key={option.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`priority-${option.value}`}
                    checked={filters.priorities.includes(option.value)}
                    onCheckedChange={() => handlePriorityToggle(option.value)}
                  />
                  <Label
                    htmlFor={`priority-${option.value}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Select
          value={filters.dateRange}
          onValueChange={(value) => onFiltersChange({ ...filters, dateRange: value })}
        >
          <SelectTrigger className="w-[140px] h-8" data-testid="select-date-range">
            <Calendar className="w-4 h-4 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {dateRangeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(value) => onFiltersChange({ ...filters, status: value })}
        >
          <SelectTrigger className="w-[130px] h-8" data-testid="select-status">
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

        {teamMembers.length > 0 && (
          <Select
            value={filters.assignee}
            onValueChange={(value) => onFiltersChange({ ...filters, assignee: value })}
          >
            <SelectTrigger className="w-[140px] h-8" data-testid="select-assignee">
              <User className="w-4 h-4 mr-1.5" />
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All members</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {teamMembers.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex items-center gap-3 ml-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="filter-bookmarked"
              checked={filters.bookmarked}
              onCheckedChange={(checked) =>
                onFiltersChange({ ...filters, bookmarked: checked as boolean })
              }
            />
            <Label htmlFor="filter-bookmarked" className="text-sm cursor-pointer">
              Bookmarked
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="filter-unread"
              checked={filters.unread}
              onCheckedChange={(checked) =>
                onFiltersChange({ ...filters, unread: checked as boolean })
              }
            />
            <Label htmlFor="filter-unread" className="text-sm cursor-pointer">
              Unread
            </Label>
          </div>
        </div>

        <div className="flex-1" />

        <span className="text-sm text-muted-foreground" data-testid="text-result-count">
          {resultCount} signals
        </span>
      </div>

      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Active filters:</span>

          {filters.types.map((type) => (
            <Badge
              key={type}
              variant="secondary"
              className="gap-1 pr-1"
            >
              {signalTypeLabels[type] || type}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter("type", type)}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          ))}

          {filters.priorities.map((priority) => (
            <Badge
              key={priority}
              variant="secondary"
              className="gap-1 pr-1"
            >
              {priority} priority
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter("priority", priority)}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          ))}

          {filters.dateRange !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {dateRangeOptions.find((o) => o.value === filters.dateRange)?.label}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter("dateRange")}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          )}

          {filters.bookmarked && (
            <Badge variant="secondary" className="gap-1 pr-1">
              Bookmarked
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter("bookmarked")}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          )}

          {filters.unread && (
            <Badge variant="secondary" className="gap-1 pr-1">
              Unread
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter("unread")}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          )}

          {filters.entityQuery && (
            <Badge variant="default" className="gap-1 pr-1">
              <Search className="w-3 h-3" />
              {filters.entityQuery}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter("entityQuery")}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-6"
            onClick={clearAllFilters}
            data-testid="button-clear-filters"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
