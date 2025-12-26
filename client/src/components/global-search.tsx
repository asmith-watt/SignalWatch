import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Search,
  Building2,
  Radio,
  FileText,
  Loader2,
  ArrowRight,
  Clock,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import type { Company, Signal } from "@shared/schema";

interface GlobalSearchProps {
  companies: Company[];
  signals: Signal[];
  onSelectCompany: (id: number) => void;
  onSelectSignal: (signal: Signal) => void;
}

interface RecentSearch {
  type: "company" | "signal";
  id: number;
  label: string;
  timestamp: number;
}

export function GlobalSearch({
  companies,
  signals,
  onSelectCompany,
  onSelectSignal,
}: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("signalwatch-recent-searches");
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse recent searches", e);
      }
    }
  }, []);

  const addRecentSearch = useCallback((search: Omit<RecentSearch, "timestamp">) => {
    setRecentSearches((prev) => {
      const filtered = prev.filter(
        (s) => !(s.type === search.type && s.id === search.id)
      );
      const updated = [{ ...search, timestamp: Date.now() }, ...filtered].slice(
        0,
        5
      );
      localStorage.setItem("signalwatch-recent-searches", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleSelectCompany = (company: Company) => {
    addRecentSearch({
      type: "company",
      id: company.id,
      label: company.name,
    });
    onSelectCompany(company.id);
    setOpen(false);
    setQuery("");
  };

  const handleSelectSignal = (signal: Signal) => {
    const company = companies.find((c) => c.id === signal.companyId);
    addRecentSearch({
      type: "signal",
      id: signal.id,
      label: signal.title,
    });
    onSelectSignal(signal);
    setOpen(false);
    setQuery("");
  };

  const filteredCompanies = query
    ? companies.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.industry?.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const filteredSignals = query
    ? signals.filter(
        (s) =>
          s.title.toLowerCase().includes(query.toLowerCase()) ||
          s.summary?.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 h-9 rounded-md border border-input bg-background text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors w-full max-w-sm"
        data-testid="button-global-search"
      >
        <Search className="w-4 h-4" />
        <span className="flex-1 text-left">Search companies, signals...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search companies, signals, and more..."
          value={query}
          onValueChange={setQuery}
          data-testid="input-global-search"
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {!query && recentSearches.length > 0 && (
            <CommandGroup heading="Recent">
              {recentSearches.map((search) => (
                <CommandItem
                  key={`${search.type}-${search.id}`}
                  onSelect={() => {
                    if (search.type === "company") {
                      const company = companies.find((c) => c.id === search.id);
                      if (company) handleSelectCompany(company);
                    } else {
                      const signal = signals.find((s) => s.id === search.id);
                      if (signal) handleSelectSignal(signal);
                    }
                  }}
                >
                  <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                  {search.type === "company" ? (
                    <Building2 className="mr-2 h-4 w-4" />
                  ) : (
                    <Radio className="mr-2 h-4 w-4" />
                  )}
                  <span className="truncate">{search.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {filteredCompanies.length > 0 && (
            <CommandGroup heading="Companies">
              {filteredCompanies.slice(0, 5).map((company) => (
                <CommandItem
                  key={company.id}
                  onSelect={() => handleSelectCompany(company)}
                  data-testid={`search-result-company-${company.id}`}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  <span className="flex-1">{company.name}</span>
                  {company.industry && (
                    <Badge variant="secondary" className="text-xs">
                      {company.industry}
                    </Badge>
                  )}
                  <ArrowRight className="ml-2 h-4 w-4 text-muted-foreground" />
                </CommandItem>
              ))}
              {filteredCompanies.length > 5 && (
                <CommandItem
                  onSelect={() => {
                    setLocation("/");
                    setOpen(false);
                  }}
                  className="text-muted-foreground"
                >
                  View all {filteredCompanies.length} companies
                </CommandItem>
              )}
            </CommandGroup>
          )}

          {filteredCompanies.length > 0 && filteredSignals.length > 0 && (
            <CommandSeparator />
          )}

          {filteredSignals.length > 0 && (
            <CommandGroup heading="Signals">
              {filteredSignals.slice(0, 5).map((signal) => {
                const company = companies.find((c) => c.id === signal.companyId);
                return (
                  <CommandItem
                    key={signal.id}
                    onSelect={() => handleSelectSignal(signal)}
                    data-testid={`search-result-signal-${signal.id}`}
                  >
                    <Radio className="mr-2 h-4 w-4" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{signal.title}</div>
                      {company && (
                        <div className="text-xs text-muted-foreground truncate">
                          {company.name}
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs ml-2">
                      {signal.type.replace("_", " ")}
                    </Badge>
                  </CommandItem>
                );
              })}
              {filteredSignals.length > 5 && (
                <CommandItem
                  onSelect={() => {
                    setLocation("/signals");
                    setOpen(false);
                  }}
                  className="text-muted-foreground"
                >
                  View all {filteredSignals.length} signals
                </CommandItem>
              )}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
