import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, ExternalLink, Sparkles, RefreshCw } from "lucide-react";

interface MediaSitePublishDialogProps {
  signalId: number | null;
  signalTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MediaSitePublishDialog({
  signalId,
  signalTitle,
  open,
  onOpenChange,
}: MediaSitePublishDialogProps) {
  const { toast } = useToast();
  const [style, setStyle] = useState<"news" | "analysis" | "brief">("news");
  const [forceRegenerate, setForceRegenerate] = useState(false);

  const publishMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        "POST",
        `/api/signals/${signalId}/publish-to-media`,
        { style, forceRegenerate }
      );
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        const action = data.reusedExisting ? "republished" : "generated and published";
        toast({
          title: "Published to Baking & Milling",
          description: data.articleUrl
            ? `Article ${action} successfully.`
            : `Article ${action} successfully.`,
          action: data.articleUrl ? (
            <a
              href={data.articleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:no-underline text-sm whitespace-nowrap"
              data-testid="link-published-article"
            >
              View Article
            </a>
          ) : undefined,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
        onOpenChange(false);
        setForceRegenerate(false);
      } else {
        toast({
          title: "Publishing Failed",
          description: data.error || "Failed to publish to media site",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to publish to media site",
        variant: "destructive",
      });
    },
  });

  const handlePublish = () => {
    if (signalId) {
      publishMutation.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish to Baking & Milling</DialogTitle>
          <DialogDescription>
            {signalTitle
              ? `Publish "${signalTitle}" to your external media site`
              : "Generate an article and publish to your media site"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="style">Article Style</Label>
            <Select value={style} onValueChange={(v) => setStyle(v as any)}>
              <SelectTrigger id="style" data-testid="select-media-article-style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="news">News Article</SelectItem>
                <SelectItem value="analysis">Analysis Piece</SelectItem>
                <SelectItem value="brief">Market Brief</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-4 py-2">
            <div className="space-y-0.5">
              <Label htmlFor="force-regenerate" className="cursor-pointer">Regenerate content</Label>
              <p className="text-xs text-muted-foreground">
                Create fresh article and image (uses AI credits)
              </p>
            </div>
            <Switch
              id="force-regenerate"
              checked={forceRegenerate}
              onCheckedChange={setForceRegenerate}
              data-testid="switch-force-regenerate"
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {forceRegenerate ? (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Will generate new AI article and image</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Will reuse existing content if previously published</span>
              </>
            )}
          </div>

          <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md" data-testid="media-site-info-box">
            <p className="font-medium mb-1">What happens when you publish:</p>
            <ul className="list-disc list-inside space-y-1">
              {forceRegenerate ? (
                <>
                  <li data-testid="text-info-generate">AI generates a fresh article from the signal</li>
                  <li data-testid="text-info-image">AI creates a new custom image</li>
                </>
              ) : (
                <li data-testid="text-info-reuse">Reuses existing article if available, otherwise generates new</li>
              )}
              <li data-testid="text-info-send">The article is sent to your media site</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={publishMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handlePublish}
            disabled={publishMutation.isPending}
            data-testid="button-publish-media-site"
          >
            {publishMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4 mr-2" />
                Publish
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
