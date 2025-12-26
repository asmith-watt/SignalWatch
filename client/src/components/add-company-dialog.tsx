import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { Company, InsertCompany } from "@shared/schema";

const formSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  website: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  industry: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  size: z.string().optional(),
  founded: z.string().optional(),
  linkedinUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  twitterHandle: z.string().optional(),
  rssFeedUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type FormData = z.infer<typeof formSchema>;

interface AddCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InsertCompany) => void;
  isLoading?: boolean;
  company?: Company | null;
}

const industryOptions = [
  "Technology",
  "SaaS",
  "AI/ML",
  "Cybersecurity",
  "Cloud",
  "Fintech",
  "Banking",
  "Insurance",
  "Healthcare",
  "Biotech",
  "E-commerce",
  "Media",
  "Manufacturing",
  "Energy",
  "Real Estate",
  "Education",
  "Consumer",
  "Other",
];

const sizeOptions = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1001-5000",
  "5001-10000",
  "10001+",
];

export function AddCompanyDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  company,
}: AddCompanyDialogProps) {
  const isEditing = !!company;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: company?.name || "",
      website: company?.website || "",
      industry: company?.industry || "",
      description: company?.description || "",
      location: company?.location || "",
      size: company?.size || "",
      founded: company?.founded || "",
      linkedinUrl: company?.linkedinUrl || "",
      twitterHandle: company?.twitterHandle || "",
      rssFeedUrl: company?.rssFeedUrl || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: company?.name || "",
        website: company?.website || "",
        industry: company?.industry || "",
        description: company?.description || "",
        location: company?.location || "",
        size: company?.size || "",
        founded: company?.founded || "",
        linkedinUrl: company?.linkedinUrl || "",
        twitterHandle: company?.twitterHandle || "",
        rssFeedUrl: company?.rssFeedUrl || "",
      });
    }
  }, [open, company, form]);

  const handleSubmit = (data: FormData) => {
    const cleanData: InsertCompany = {
      name: data.name,
      website: data.website || null,
      industry: data.industry || null,
      description: data.description || null,
      location: data.location || null,
      size: data.size || null,
      founded: data.founded || null,
      linkedinUrl: data.linkedinUrl || null,
      twitterHandle: data.twitterHandle || null,
      rssFeedUrl: data.rssFeedUrl || null,
      tags: company?.tags || null,
      logoUrl: company?.logoUrl || null,
      isActive: company?.isActive ?? true,
    };
    onSubmit(cleanData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Company" : "Add Company"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update company information and monitoring settings."
              : "Add a new company to monitor for business signals."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">
                Basic Information
              </h3>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Acme Corporation"
                        {...field}
                        data-testid="input-company-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://example.com"
                          {...field}
                          data-testid="input-company-website"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="industry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Industry</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-company-industry">
                            <SelectValue placeholder="Select industry" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {industryOptions.map((industry) => (
                            <SelectItem key={industry} value={industry}>
                              {industry}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief description of the company..."
                        className="resize-none"
                        rows={3}
                        {...field}
                        data-testid="textarea-company-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., San Francisco, CA"
                          {...field}
                          data-testid="input-company-location"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Size</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-company-size">
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sizeOptions.map((size) => (
                            <SelectItem key={size} value={size}>
                              {size} employees
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="founded"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Founded</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., 2015"
                          {...field}
                          data-testid="input-company-founded"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">
                Social & Monitoring
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="linkedinUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>LinkedIn URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://linkedin.com/company/..."
                          {...field}
                          data-testid="input-company-linkedin"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="twitterHandle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Twitter/X Handle</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., acmecorp"
                          {...field}
                          data-testid="input-company-twitter"
                        />
                      </FormControl>
                      <FormDescription>Without the @ symbol</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="rssFeedUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RSS Feed URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://example.com/feed.xml"
                        {...field}
                        data-testid="input-company-rss"
                      />
                    </FormControl>
                    <FormDescription>
                      Company blog or news RSS feed for automatic signal collection
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} data-testid="button-save-company">
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? "Save Changes" : "Add Company"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
