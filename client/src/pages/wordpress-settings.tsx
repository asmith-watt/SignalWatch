import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, ExternalLink } from "lucide-react";

const wordpressSchema = z.object({
  siteUrl: z.string().url("Please enter a valid URL"),
  username: z.string().min(1, "Username is required"),
  applicationPassword: z.string().min(1, "Application password is required"),
});

type WordPressFormData = z.infer<typeof wordpressSchema>;

const STORAGE_KEY = "signalwatch_wordpress_config";

export default function WordPressSettings() {
  const { toast } = useToast();
  const [connectionStatus, setConnectionStatus] = useState<"untested" | "testing" | "connected" | "failed">("untested");
  const [siteName, setSiteName] = useState<string | null>(null);

  const form = useForm<WordPressFormData>({
    resolver: zodResolver(wordpressSchema),
    defaultValues: {
      siteUrl: "",
      username: "",
      applicationPassword: "",
    },
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const config = JSON.parse(saved);
        form.reset(config);
        setConnectionStatus("connected");
        setSiteName(config.siteName || null);
      } catch (e) {
        console.error("Failed to load saved config");
      }
    }
  }, [form]);

  const testConnection = useMutation({
    mutationFn: async (data: WordPressFormData) => {
      setConnectionStatus("testing");
      const response = await apiRequest("POST", "/api/wordpress/test", data);
      return response.json();
    },
    onSuccess: (result) => {
      if (result.success) {
        setConnectionStatus("connected");
        setSiteName(result.siteName);
        const config = { ...form.getValues(), siteName: result.siteName };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        toast({
          title: "Connected",
          description: `Successfully connected to ${result.siteName}`,
        });
      } else {
        setConnectionStatus("failed");
        toast({
          title: "Connection Failed",
          description: result.error || "Could not connect to WordPress",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      setConnectionStatus("failed");
      toast({
        title: "Error",
        description: "Failed to test connection",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: WordPressFormData) => {
    testConnection.mutate(data);
  };

  const clearConfig = () => {
    localStorage.removeItem(STORAGE_KEY);
    form.reset({ siteUrl: "", username: "", applicationPassword: "" });
    setConnectionStatus("untested");
    setSiteName(null);
    toast({ title: "Cleared", description: "WordPress configuration removed" });
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">WordPress Settings</h1>
        <p className="text-muted-foreground">Configure your WordPress site to publish articles directly from signals.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Connection</CardTitle>
            {connectionStatus === "connected" && (
              <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-500/20">
                <CheckCircle className="w-3 h-3" />
                Connected
              </Badge>
            )}
            {connectionStatus === "failed" && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="w-3 h-3" />
                Failed
              </Badge>
            )}
          </div>
          {siteName && (
            <CardDescription>Connected to: {siteName}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="siteUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WordPress Site URL</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="https://yoursite.com" 
                        data-testid="input-wordpress-url"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>Your WordPress site address (without /wp-admin)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="admin" 
                        data-testid="input-wordpress-username"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="applicationPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Application Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                        data-testid="input-wordpress-password"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Create in WordPress: Users → Profile → Application Passwords
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2 pt-2">
                <Button 
                  type="submit" 
                  disabled={testConnection.isPending}
                  data-testid="button-test-connection"
                >
                  {testConnection.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    "Test Connection"
                  )}
                </Button>
                {connectionStatus === "connected" && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={clearConfig}
                    data-testid="button-clear-config"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How to Create an Application Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal list-inside space-y-2">
            <li>Log in to your WordPress admin dashboard</li>
            <li>Go to <strong>Users → Profile</strong></li>
            <li>Scroll down to <strong>Application Passwords</strong></li>
            <li>Enter a name (e.g., "SignalWatch") and click <strong>Add New Application Password</strong></li>
            <li>Copy the generated password and paste it above</li>
          </ol>
          <p className="pt-2">
            <strong>Note:</strong> Application Passwords require WordPress 5.6+ and HTTPS.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
