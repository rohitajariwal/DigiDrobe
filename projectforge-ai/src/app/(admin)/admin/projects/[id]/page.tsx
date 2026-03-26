"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatCurrency,
  formatDate,
  getStatusColor,
  getStatusLabel,
  DOMAIN_LABELS,
  CITATION_LABELS,
} from "@/lib/utils";
import type { Project, Attachment } from "@/lib/types";
import {
  ArrowLeft,
  Download,
  Paperclip,
  Loader2,
  Sparkles,
  FileDown,
  Mail,
  Save,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function AdminProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [adminNotes, setAdminNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("projects")
        .select("*, attachments(*), profiles(full_name, email)")
        .eq("id", params.id)
        .single();

      if (data) {
        setProject(data);
        setAttachments(data.attachments || []);
        setAdminNotes(data.admin_notes || "");
      }
      setLoading(false);
    }
    load();
  }, [params.id]);

  async function saveAdminNotes() {
    setSavingNotes(true);
    const supabase = createClient();
    await supabase
      .from("projects")
      .update({ admin_notes: adminNotes })
      .eq("id", project!.id);
    setProject((prev) => prev ? { ...prev, admin_notes: adminNotes } : null);
    setSavingNotes(false);
    setMessage("Notes saved.");
    setTimeout(() => setMessage(""), 3000);
  }

  async function handleGenerate() {
    setGenerating(true);
    setMessage("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project!.id }),
      });
      const data = await res.json();
      if (data.success) {
        setProject((prev) =>
          prev ? { ...prev, generated_markdown: data.markdown, status: "in_progress" } : null
        );
        setMessage(
          `Generated successfully! Tokens: ${data.usage.input_tokens} input, ${data.usage.output_tokens} output`
        );
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch {
      setMessage("Generation failed. Check console for details.");
    }
    setGenerating(false);
  }

  async function handleGeneratePdf() {
    setGeneratingPdf(true);
    setMessage("");
    try {
      const res = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project!.id }),
      });
      const data = await res.json();
      if (data.success) {
        setProject((prev) =>
          prev ? { ...prev, pdf_url: data.pdf_url, status: "ready" } : null
        );
        setMessage("PDF generated and project marked as Ready!");
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch {
      setMessage("PDF generation failed.");
    }
    setGeneratingPdf(false);
  }

  async function handleSendEmail() {
    setSendingEmail(true);
    setMessage("");
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project!.id, type: "ready" }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage("Email notification sent to client!");
      } else {
        setMessage(`Email error: ${data.error}`);
      }
    } catch {
      setMessage("Email sending failed.");
    }
    setSendingEmail(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-muted-foreground">Project not found.</p>
      </div>
    );
  }

  const clientInfo = project.profiles as unknown as { full_name: string; email: string } | undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Button variant="ghost" className="mb-6 gap-2" onClick={() => router.push("/admin")}>
        <ArrowLeft className="h-4 w-4" /> Back to Admin
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{project.title}</h1>
          <p className="text-muted-foreground mt-1">
            {clientInfo?.full_name || clientInfo?.email || "Unknown client"} &middot;{" "}
            {DOMAIN_LABELS[project.domain]} &middot; {formatDate(project.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={getStatusColor(project.status)}>
            {getStatusLabel(project.status)}
          </Badge>
          <span className="font-semibold text-lg">{formatCurrency(project.price_cents)}</span>
        </div>
      </div>

      {message && (
        <div className="mb-6 rounded-lg bg-primary/10 p-3 text-sm">{message}</div>
      )}

      <Tabs defaultValue="brief" className="space-y-6">
        <TabsList>
          <TabsTrigger value="brief">Brief</TabsTrigger>
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        {/* Brief Tab */}
        <TabsContent value="brief" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Brief</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-wrap">{project.brief}</p>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                <div><span className="text-muted-foreground">Client:</span>{" "}<span className="font-medium">{clientInfo?.full_name} ({clientInfo?.email})</span></div>
                <div><span className="text-muted-foreground">Length:</span>{" "}<span className="font-medium">{project.desired_length || "Not specified"}</span></div>
                <div><span className="text-muted-foreground">Citations:</span>{" "}<span className="font-medium">{CITATION_LABELS[project.citation_style]}</span></div>
                <div><span className="text-muted-foreground">Deadline:</span>{" "}<span className="font-medium">{project.deadline ? formatDate(project.deadline) : "Flexible"}</span></div>
                <div><span className="text-muted-foreground">Tier:</span>{" "}<span className="font-medium capitalize">{project.pricing_tier}</span></div>
                <div><span className="text-muted-foreground">Payment:</span>{" "}<span className="font-medium">{project.stripe_payment_intent_id ? "Paid" : "Pending"}</span></div>
              </div>
              {project.special_instructions && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1 font-medium">Special Instructions:</p>
                    <p className="text-sm">{project.special_instructions}</p>
                  </div>
                </>
              )}
              {project.revision_notes && (
                <>
                  <Separator />
                  <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg">
                    <p className="text-sm font-medium text-orange-800 dark:text-orange-400 mb-1">Revision Requested:</p>
                    <p className="text-sm">{project.revision_notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {attachments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Paperclip className="h-5 w-5" /> Attachments ({attachments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {attachments.map((att) => (
                    <li key={att.id} className="flex items-center justify-between text-sm">
                      <span>{att.file_name} {att.file_size && <span className="text-muted-foreground">({(att.file_size / 1024).toFixed(1)} KB)</span>}</span>
                      <a href={att.file_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm"><Download className="h-4 w-4" /></Button>
                      </a>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Admin Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Admin Notes (added to prompt)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add notes to refine the brief before generation. These will be included in the AI prompt..."
                className="min-h-[120px]"
              />
              <Button onClick={saveAdminNotes} disabled={savingNotes} variant="outline" className="gap-2">
                {savingNotes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Notes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Generate Tab */}
        <TabsContent value="generate" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Generate Deliverable</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Click below to generate the deliverable using Claude Opus 4.6. The system prompt
                uses prompt caching for cost efficiency. Make sure you&apos;ve reviewed the brief and added
                any admin notes before generating.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleGenerate}
                  disabled={generating}
                  size="lg"
                  className="gap-2"
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {generating ? "Generating..." : "Generate with Claude Opus 4.6"}
                </Button>

                {project.generated_markdown && (
                  <>
                    <Button
                      onClick={handleGeneratePdf}
                      disabled={generatingPdf}
                      variant="outline"
                      size="lg"
                      className="gap-2"
                    >
                      {generatingPdf ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileDown className="h-4 w-4" />
                      )}
                      Generate PDF & Mark Ready
                    </Button>

                    {project.status === "ready" && (
                      <Button
                        onClick={handleSendEmail}
                        disabled={sendingEmail}
                        variant="outline"
                        size="lg"
                        className="gap-2"
                      >
                        {sendingEmail ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Mail className="h-4 w-4" />
                        )}
                        Notify Client
                      </Button>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Markdown Preview</CardTitle>
            </CardHeader>
            <CardContent>
              {project.generated_markdown ? (
                <div className="prose prose-neutral dark:prose-invert max-w-none">
                  <ReactMarkdown>{project.generated_markdown}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No content generated yet. Go to the Generate tab to create the deliverable.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
