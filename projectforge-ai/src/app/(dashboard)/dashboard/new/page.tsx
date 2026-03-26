"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRICING_OPTIONS, type PricingTier, type IndustryDomain, type CitationStyle } from "@/lib/types";
import { formatCurrency, DOMAIN_LABELS, CITATION_LABELS } from "@/lib/utils";
import { CheckCircle, Loader2 } from "lucide-react";

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTier, setSelectedTier] = useState<PricingTier>("standard");
  const [files, setFiles] = useState<File[]>([]);

  const [form, setForm] = useState({
    title: "",
    domain: "" as IndustryDomain | "",
    brief: "",
    desired_length: "",
    citation_style: "none" as CitationStyle,
    deadline: "",
    special_instructions: "",
  });

  function updateForm(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.domain || !form.brief) {
      setError("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const tierOption = PRICING_OPTIONS.find((p) => p.tier === selectedTier)!;

      // Create project
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          title: form.title,
          domain: form.domain,
          brief: form.brief,
          desired_length: form.desired_length || null,
          citation_style: form.citation_style,
          deadline: form.deadline || null,
          special_instructions: form.special_instructions || null,
          pricing_tier: selectedTier,
          price_cents: tierOption.price_cents,
          status: "pending_payment",
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Upload attachments
      for (const file of files) {
        const filePath = `${user.id}/${project.id}/${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("attachments")
          .upload(filePath, file);

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from("attachments")
            .getPublicUrl(filePath);

          await supabase.from("attachments").insert({
            project_id: project.id,
            file_name: file.name,
            file_url: publicUrl,
            file_size: file.size,
            mime_type: file.type,
          });
        }
      }

      // Create Stripe payment intent
      const res = await fetch("/api/stripe/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          amount: tierOption.price_cents,
        }),
      });

      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      } else {
        throw new Error("Failed to create payment session");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">New Project</h1>
        <p className="text-muted-foreground mt-1">Submit your project brief and requirements.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
        )}

        {/* Project Details */}
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>Describe your project requirements in detail.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Project Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Comprehensive Market Analysis for Fintech Startup"
                value={form.title}
                onChange={(e) => updateForm("title", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Industry Domain *</Label>
              <Select value={form.domain} onValueChange={(v) => updateForm("domain", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select domain" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOMAIN_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brief">Detailed Project Brief / Requirements *</Label>
              <Textarea
                id="brief"
                placeholder="Provide a comprehensive description of what you need, including scope, objectives, target audience, and any specific requirements..."
                value={form.brief}
                onChange={(e) => updateForm("brief", e.target.value)}
                className="min-h-[200px]"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="desired_length">Desired Length (words or pages)</Label>
                <Input
                  id="desired_length"
                  placeholder="e.g., 5000 words or 20 pages"
                  value={form.desired_length}
                  onChange={(e) => updateForm("desired_length", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Citation Style</Label>
                <Select value={form.citation_style} onValueChange={(v) => updateForm("citation_style", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CITATION_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline</Label>
              <Input
                id="deadline"
                type="date"
                value={form.deadline}
                onChange={(e) => updateForm("deadline", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="attachments">Attachments</Label>
              <Input
                id="attachments"
                type="file"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                className="cursor-pointer"
              />
              {files.length > 0 && (
                <p className="text-sm text-muted-foreground">{files.length} file(s) selected</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">Special Instructions</Label>
              <Textarea
                id="instructions"
                placeholder="Any additional instructions, preferences, or formatting requirements..."
                value={form.special_instructions}
                onChange={(e) => updateForm("special_instructions", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Pricing Tier */}
        <Card>
          <CardHeader>
            <CardTitle>Select Your Tier</CardTitle>
            <CardDescription>Choose the pricing tier that fits your needs.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {PRICING_OPTIONS.map((option) => (
                <div
                  key={option.tier}
                  onClick={() => setSelectedTier(option.tier)}
                  className={`cursor-pointer rounded-lg border-2 p-4 transition-colors ${
                    selectedTier === option.tier
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-semibold">{option.name}</div>
                  <div className="text-2xl font-bold mt-1">{formatCurrency(option.price_cents)}</div>
                  <p className="text-sm text-muted-foreground mt-2">{option.description}</p>
                  <ul className="mt-3 space-y-1">
                    {option.features.map((f) => (
                      <li key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle className="h-3 w-3 text-green-500 shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading} size="lg">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Proceed to Payment ({formatCurrency(PRICING_OPTIONS.find((p) => p.tier === selectedTier)!.price_cents)})
          </Button>
        </div>
      </form>
    </div>
  );
}
