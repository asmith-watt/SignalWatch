import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, ExternalLink, AlertCircle } from "lucide-react";
import { Link } from "wouter";

interface WordPressPublishDialogProps {
  signalId: number | null;
  signalTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STORAGE_KEY = "signalwatch_wordpress_config";

export function WordPressPublishDialog({
  signalId,
  signalTitle,
  open,
  onOpenChange,
}: WordPressPublishDialogProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<"draft" | "publish">("draft");
  const [style, setStyle] = useState<"news" | "analysis" | "brief">("news");
  const [config, setConfig] = useState<{
    siteUrl: string;
    username: string;
    applicationPassword: string;
    siteName?: string;
  } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch (e) {
        setConfig(null);
      }
    } else {
      setConfig(null);
    }
  }, [open]);

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!signalId || !config) return;
      const response = await apiRequest("POST", `/api/signals/${signalId}/publish-wordpress`, {
        ...config,
        status,
        style,
      });
      return response.json();
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
        toast({
          title: "Published to WordPress",
          description: (
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Article created as {status}</span>
              {result.postUrl && (
                <a
                  href={result.postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  View
                </a>
              )}
            </div>
          ),
        });
        onOpenChange(false);
      } else {
        toast({
          title: "Publish Failed",
          description: result.error || "Could not publish to WordPress",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to publish article",
        variant: "destructive",
      });
    },
  });

  const handlePublish = () => {
    publishMutation.mutate();
  };

  if (!config) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>WordPress Not Configured</DialogTitle>
            <DialogDescription>
              You need to set up your WordPress connection first.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 p-4 rounded-md bg-muted">
            <AlertCircle className="w-5 h-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Go to WordPress Settings to connect your site.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Link href="/wordpress">
              <Button onClick={() => onOpenChange(false)}>
                Go to Settings
              </Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish to WordPress</DialogTitle>
          <DialogDescription>
            {signalTitle ? `Publish "${signalTitle}" to ${config.siteName || config.siteUrl}` : "Generate an article and publish to WordPress"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="style">Article Style</Label>
            <Select value={style} onValueChange={(v) => setStyle(v as any)}>
              <SelectTrigger id="style" data-testid="select-article-style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="news">News Article</SelectItem>
                <SelectItem value="analysis">Analysis Piece</SelectItem>
                <SelectItem value="brief">Market Brief</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Post Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger id="status" data-testid="select-post-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Save as Draft</SelectItem>
                <SelectItem value="publish">Publish Immediately</SelectItem>
              </SelectContent>
            </Select>
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
            data-testid="button-publish-wordpress"
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
