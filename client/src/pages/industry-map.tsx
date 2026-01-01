import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Network, 
  Zap, 
  Filter,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Building2,
  ArrowRightLeft,
  Sparkles,
  Link2,
  Loader2
} from "lucide-react";
import type { Company, CompanyRelationship, Signal } from "@shared/schema";

interface Node {
  id: number;
  name: string;
  industry: string | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  signalCount: number;
}

interface Edge {
  id: number;
  source: number;
  target: number;
  type: string;
  strength: number;
  isAiExtracted: boolean;
  confidence: number;
}

const relationshipColors: Record<string, string> = {
  partner: "hsl(142 76% 36%)",
  competitor: "hsl(0 84% 60%)",
  supplier: "hsl(221 83% 53%)",
  customer: "hsl(262 83% 58%)",
  acquired: "hsl(25 95% 53%)",
  investor: "hsl(47 96% 53%)",
  subsidiary: "hsl(174 72% 40%)",
  joint_venture: "hsl(280 65% 60%)",
  distributor: "hsl(199 89% 48%)",
};

const relationshipLabels: Record<string, string> = {
  partner: "Partner",
  competitor: "Competitor",
  supplier: "Supplier",
  customer: "Customer",
  acquired: "Acquired",
  investor: "Investor",
  subsidiary: "Subsidiary",
  joint_venture: "Joint Venture",
  distributor: "Distributor",
};

export function IndustryMapPage() {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [filterIndustry, setFilterIndustry] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [isExtracting, setIsExtracting] = useState(false);

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: relationships = [], refetch: refetchRelationships } = useQuery<CompanyRelationship[]>({
    queryKey: ["/api/relationships"],
  });

  const { data: signals = [] } = useQuery<Signal[]>({
    queryKey: ["/api/signals"],
  });

  const signalCountMap = useMemo(() => {
    const counts: Record<number, number> = {};
    signals.forEach(s => {
      counts[s.companyId] = (counts[s.companyId] || 0) + 1;
    });
    return counts;
  }, [signals]);

  const industries = useMemo(() => {
    const set = new Set<string>();
    companies.forEach(c => c.industry && set.add(c.industry));
    return Array.from(set).sort();
  }, [companies]);

  const industryColors: Record<string, string> = useMemo(() => {
    const colors: Record<string, string> = {};
    const palette = [
      "hsl(220 70% 50%)",
      "hsl(142 76% 36%)",
      "hsl(25 95% 53%)",
      "hsl(262 83% 58%)",
      "hsl(199 89% 48%)",
      "hsl(47 96% 53%)",
    ];
    industries.forEach((ind, i) => {
      colors[ind] = palette[i % palette.length];
    });
    return colors;
  }, [industries]);

  const filteredRelationships = useMemo(() => {
    return relationships.filter(r => {
      if (filterType !== "all" && r.relationshipType !== filterType) return false;
      return true;
    });
  }, [relationships, filterType]);

  const relevantCompanyIds = useMemo(() => {
    const ids = new Set<number>();
    filteredRelationships.forEach(r => {
      ids.add(r.sourceCompanyId);
      ids.add(r.targetCompanyId);
    });
    return ids;
  }, [filteredRelationships]);

  const { filteredCompanies, totalMatchingCount, isTruncated } = useMemo(() => {
    const NODE_LIMIT = 200;
    
    let matching = companies.filter(c => {
      if (filterIndustry !== "all" && c.industry !== filterIndustry) return false;
      if (filteredRelationships.length > 0 && !relevantCompanyIds.has(c.id)) return false;
      return true;
    });
    
    const total = matching.length;
    
    if (matching.length > NODE_LIMIT) {
      matching.sort((a, b) => {
        const aHasRel = relevantCompanyIds.has(a.id) ? 1 : 0;
        const bHasRel = relevantCompanyIds.has(b.id) ? 1 : 0;
        if (aHasRel !== bHasRel) return bHasRel - aHasRel;
        return (signalCountMap[b.id] || 0) - (signalCountMap[a.id] || 0);
      });
      matching = matching.slice(0, NODE_LIMIT);
    }
    
    return { filteredCompanies: matching, totalMatchingCount: total, isTruncated: total > NODE_LIMIT };
  }, [companies, filterIndustry, filteredRelationships, relevantCompanyIds, signalCountMap]);

  const [nodes, setNodes] = useState<Node[]>([]);
  const nodePositionsRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const animationIdRef = useRef<number | null>(null);
  const iterationRef = useRef(0);

  const edges: Edge[] = useMemo(() => {
    return filteredRelationships.map(r => ({
      id: r.id,
      source: r.sourceCompanyId,
      target: r.targetCompanyId,
      type: r.relationshipType,
      strength: r.strength || 1,
      isAiExtracted: r.isAiExtracted || false,
      confidence: r.confidence || 100,
    }));
  }, [filteredRelationships]);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  const visibleEdges = useMemo(() => {
    const visibleIds = new Set(filteredCompanies.map(c => c.id));
    return edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));
  }, [edges, filteredCompanies]);

  useEffect(() => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }

    const MAX_NODES = 200;
    const MAX_ITERATIONS = 200;
    const limitedCompanies = filteredCompanies.slice(0, MAX_NODES);
    
    const newNodes = limitedCompanies.map((c, i) => {
      const existing = nodePositionsRef.current.get(c.id);
      const angle = (i / Math.max(limitedCompanies.length, 1)) * 2 * Math.PI;
      const radius = Math.min(dimensions.width, dimensions.height) * 0.35;
      return {
        id: c.id,
        name: c.name,
        industry: c.industry,
        x: existing?.x ?? dimensions.width / 2 + Math.cos(angle) * radius,
        y: existing?.y ?? dimensions.height / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        signalCount: signalCountMap[c.id] || 0,
      };
    });

    if (newNodes.length === 0 || visibleEdges.length === 0) {
      setNodes(newNodes);
      return;
    }

    iterationRef.current = 0;
    const nodeMap = new Map(newNodes.map(n => [n.id, { ...n }]));

    const simulate = () => {
      iterationRef.current++;
      if (iterationRef.current > MAX_ITERATIONS) {
        const finalNodes = Array.from(nodeMap.values());
        finalNodes.forEach(n => nodePositionsRef.current.set(n.id, { x: n.x, y: n.y }));
        setNodes(finalNodes);
        animationIdRef.current = null;
        return;
      }

      const alpha = 0.1 * Math.max(0, 1 - iterationRef.current / MAX_ITERATIONS);
      const nodeArr = Array.from(nodeMap.values());

      nodeArr.forEach(n => { n.vx = 0; n.vy = 0; });

      const len = nodeArr.length;
      for (let i = 0; i < len; i++) {
        for (let j = i + 1; j < len; j++) {
          const dx = nodeArr[j].x - nodeArr[i].x;
          const dy = nodeArr[j].y - nodeArr[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 2000 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          nodeArr[i].vx -= fx;
          nodeArr[i].vy -= fy;
          nodeArr[j].vx += fx;
          nodeArr[j].vy += fy;
        }
      }

      visibleEdges.forEach(e => {
        const source = nodeMap.get(e.source);
        const target = nodeMap.get(e.target);
        if (!source || !target) return;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetDist = 150;
        const force = (dist - targetDist) * 0.05;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      });

      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;
      nodeArr.forEach(n => {
        n.vx += (centerX - n.x) * 0.001;
        n.vy += (centerY - n.y) * 0.001;
        n.x += n.vx * alpha;
        n.y += n.vy * alpha;
        n.x = Math.max(30, Math.min(dimensions.width - 30, n.x));
        n.y = Math.max(30, Math.min(dimensions.height - 30, n.y));
      });

      if (iterationRef.current % 10 === 0) {
        nodeArr.forEach(n => nodePositionsRef.current.set(n.id, { x: n.x, y: n.y }));
        setNodes([...nodeArr]);
      }

      animationIdRef.current = requestAnimationFrame(simulate);
    };

    animationIdRef.current = requestAnimationFrame(simulate);

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
    };
  }, [filteredCompanies, visibleEdges, dimensions, signalCountMap]);

  const extractRelationshipsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/relationships/extract-from-signals");
    },
    onSuccess: (data: any) => {
      refetchRelationships();
      toast({
        title: "Relationships Extracted",
        description: `Found ${data.relationshipsCreated || 0} new relationships from signals`,
      });
    },
    onError: () => {
      toast({
        title: "Extraction Failed",
        variant: "destructive",
      });
    },
  });

  const handleExtract = async () => {
    setIsExtracting(true);
    try {
      await extractRelationshipsMutation.mutateAsync();
    } finally {
      setIsExtracting(false);
    }
  };

  const handleNodeClick = (node: Node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  };

  const handleEdgeClick = (edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  };

  const getNodeRadius = (signalCount: number) => {
    return Math.max(12, Math.min(30, 12 + signalCount * 2));
  };

  const nodeById = useMemo(() => {
    const map = new Map<number, Node>();
    nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [nodes]);

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 border-b flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold">Industry Map</h1>
            <Badge variant="secondary" className="ml-2">
              {isTruncated ? `${nodes.length} of ${totalMatchingCount}` : nodes.length} companies
            </Badge>
            <Badge variant="outline">
              {visibleEdges.length} relationships
            </Badge>
            {isTruncated && (
              <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-600">
                Use filters to focus view
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Select value={filterIndustry} onValueChange={setFilterIndustry}>
              <SelectTrigger className="w-[180px]" data-testid="select-industry-filter">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Industries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                {industries.map(ind => (
                  <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]" data-testid="select-type-filter">
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Relationship Types</SelectItem>
                {Object.entries(relationshipLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setZoom(z => Math.min(z * 1.2, 3))}
              data-testid="button-zoom-in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setZoom(z => Math.max(z / 1.2, 0.3))}
              data-testid="button-zoom-out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              data-testid="button-reset-view"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>

            <Button
              onClick={handleExtract}
              disabled={isExtracting}
              data-testid="button-extract-relationships"
            >
              {isExtracting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              AI Extract
            </Button>
          </div>
        </div>

        <div 
          ref={containerRef} 
          className="flex-1 relative bg-muted/30"
        >
          {nodes.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-4">
                <Network className="h-16 w-16 mx-auto text-muted-foreground/50" />
                <h3 className="text-lg font-medium text-muted-foreground">No Relationships Yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Click "AI Extract" to automatically discover company relationships from your signals, 
                  or add relationships manually.
                </p>
                <Button onClick={handleExtract} disabled={isExtracting} data-testid="button-extract-empty">
                  {isExtracting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Extract Relationships
                </Button>
              </div>
            </div>
          ) : (
            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
              style={{ cursor: 'grab' }}
            >
              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {visibleEdges.map(edge => {
                  const source = nodeById.get(edge.source);
                  const target = nodeById.get(edge.target);
                  if (!source || !target) return null;
                  const color = relationshipColors[edge.type] || "hsl(var(--muted-foreground))";
                  const isSelected = selectedEdge?.id === edge.id;
                  return (
                    <g key={edge.id}>
                      <line
                        x1={source.x}
                        y1={source.y}
                        x2={target.x}
                        y2={target.y}
                        stroke={color}
                        strokeWidth={isSelected ? 3 : 2}
                        strokeOpacity={isSelected ? 1 : 0.6}
                        strokeDasharray={edge.isAiExtracted ? "5,3" : undefined}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleEdgeClick(edge)}
                        data-testid={`edge-${edge.id}`}
                      />
                      <text
                        x={(source.x + target.x) / 2}
                        y={(source.y + target.y) / 2 - 8}
                        fill={color}
                        fontSize="10"
                        textAnchor="middle"
                        style={{ pointerEvents: 'none' }}
                      >
                        {relationshipLabels[edge.type] || edge.type}
                      </text>
                    </g>
                  );
                })}

                {nodes.map(node => {
                  const radius = getNodeRadius(node.signalCount);
                  const color = node.industry ? industryColors[node.industry] || "hsl(var(--primary))" : "hsl(var(--primary))";
                  const isSelected = selectedNode?.id === node.id;
                  return (
                    <g key={node.id}>
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={radius + (isSelected ? 4 : 0)}
                        fill={isSelected ? "hsl(var(--primary))" : color}
                        fillOpacity={0.9}
                        stroke={isSelected ? "hsl(var(--primary-foreground))" : "hsl(var(--background))"}
                        strokeWidth={isSelected ? 3 : 2}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleNodeClick(node)}
                        data-testid={`node-${node.id}`}
                      />
                      <text
                        x={node.x}
                        y={node.y + radius + 14}
                        fill="hsl(var(--foreground))"
                        fontSize="11"
                        textAnchor="middle"
                        fontWeight={isSelected ? 600 : 400}
                        style={{ pointerEvents: 'none' }}
                      >
                        {node.name.length > 15 ? node.name.slice(0, 15) + "..." : node.name}
                      </text>
                      {node.signalCount > 0 && (
                        <text
                          x={node.x}
                          y={node.y + 4}
                          fill="white"
                          fontSize="10"
                          textAnchor="middle"
                          fontWeight={600}
                          style={{ pointerEvents: 'none' }}
                        >
                          {node.signalCount}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
          )}
        </div>

        <div className="p-3 border-t bg-background flex items-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-medium">Legend:</span>
            {Object.entries(relationshipLabels).slice(0, 5).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1">
                <div 
                  className="w-4 h-1" 
                  style={{ backgroundColor: relationshipColors[key] }}
                />
                <span>{label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1">
              <div className="w-4 border-t-2 border-dashed border-muted-foreground" />
              <span>AI Extracted</span>
            </div>
          </div>
        </div>
      </div>

      <div className="w-80 border-l bg-background flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Details</h2>
        </div>
        <ScrollArea className="flex-1 p-4">
          {selectedNode ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold" data-testid="text-selected-company">{selectedNode.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedNode.industry || "Unknown Industry"}</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Signals</span>
                  <Badge variant="secondary">{selectedNode.signalCount}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Connections</span>
                  <Badge variant="secondary">
                    {visibleEdges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).length}
                  </Badge>
                </div>
              </div>
              <Separator />
              <h4 className="font-medium text-sm">Relationships</h4>
              <div className="space-y-2">
                {visibleEdges
                  .filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
                  .map(e => {
                    const otherId = e.source === selectedNode.id ? e.target : e.source;
                    const otherNode = nodeById.get(otherId);
                    return (
                      <div 
                        key={e.id} 
                        className="p-2 rounded-md bg-muted/50 text-sm cursor-pointer hover-elevate"
                        onClick={() => handleEdgeClick(e)}
                        data-testid={`relationship-item-${e.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <Link2 className="h-3 w-3" style={{ color: relationshipColors[e.type] }} />
                          <span>{relationshipLabels[e.type]}</span>
                          {e.isAiExtracted && (
                            <Sparkles className="h-3 w-3 text-amber-500" />
                          )}
                        </div>
                        <div className="text-muted-foreground mt-1">
                          {otherNode?.name || "Unknown"}
                        </div>
                      </div>
                    );
                  })}
                {visibleEdges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).length === 0 && (
                  <p className="text-sm text-muted-foreground">No relationships found</p>
                )}
              </div>
            </div>
          ) : selectedEdge ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md" style={{ backgroundColor: `${relationshipColors[selectedEdge.type]}20` }}>
                  <ArrowRightLeft className="h-5 w-5" style={{ color: relationshipColors[selectedEdge.type] }} />
                </div>
                <div>
                  <h3 className="font-semibold">{relationshipLabels[selectedEdge.type]}</h3>
                  <p className="text-sm text-muted-foreground">Relationship</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="p-2 rounded-md bg-muted/50">
                  <span className="text-xs text-muted-foreground">From</span>
                  <p className="font-medium">{nodeById.get(selectedEdge.source)?.name || "Unknown"}</p>
                </div>
                <div className="p-2 rounded-md bg-muted/50">
                  <span className="text-xs text-muted-foreground">To</span>
                  <p className="font-medium">{nodeById.get(selectedEdge.target)?.name || "Unknown"}</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Strength</span>
                  <Badge variant="secondary">{selectedEdge.strength}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Confidence</span>
                  <Badge variant="secondary">{selectedEdge.confidence}%</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Source</span>
                  <Badge variant={selectedEdge.isAiExtracted ? "default" : "outline"}>
                    {selectedEdge.isAiExtracted ? "AI Extracted" : "Manual"}
                  </Badge>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <Network className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a company or relationship to see details</p>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

export default IndustryMapPage;
