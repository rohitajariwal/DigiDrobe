"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  formatCurrency,
  formatDate,
  getStatusColor,
  getStatusLabel,
  DOMAIN_LABELS,
  CITATION_LABELS,
} from "@/lib/utils";
import type { Project, Attachment } from "@/lib/types";
import { ArrowLeft, Download, Paperclip, Loader2 } from "lucide-react";

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("projects")
        .select("*, attachments(*)")
        .eq("id", params.id)
        .single();

      if (data) {
        setProject(data);
        setAttachments(data.attachments || []);
      }
      setLoading(false);
    }
    load();
  }, [params.id]);

  async function requestRevision() {
    if (!revisionNotes.trim()) return;
    setSubmitting(true);

    const supabase = createClient();
    await supabase
      .from("projects")
      .update({
        status: "revision_requested",
        revision_notes: revisionNotes,
      })
      .eq("id", project!.id);

    setProject((prev) => prev ? { ...prev, status: "revision_requested", revision_notes: revisionNotes } : null);
    setRevisionNotes("");
    setSubmitting(false);
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Button variant="ghost" className="mb-6 gap-2" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" /> Back to Projects
      </Button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{project.title}</h1>
          <p className="text-muted-foreground mt-1">
            {DOMAIN_LABELS[project.domain]} &middot; Submitted {formatDate(project.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={getStatusColor(project.status)}>
            {getStatusLabel(project.status)}
          </Badge>
          <span className="font-semibold">{formatCurrency(project.price_cents)}</span>
        </div>
      </div>

      <div className="space-y-6">
        {/* Brief */}
        <Card>
          <CardHeader>
            <CardTitle>Project Brief</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="whitespace-pre-wrap">{project.brief}</p>
            <Separator />
            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <span className="text-muted-foreground">Desired Length:</span>{" "}
                <span className="font-medium">{project.desired_length || "Not specified"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Citation Style:</span>{" "}
                <span className="font-medium">{CITATION_LABELS[project.citation_style]}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Deadline:</span>{" "}
                <span className="font-medium">{project.deadline ? formatDate(project.deadline) : "Flexible"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Tier:</span>{" "}
                <span className="font-medium capitalize">{project.pricing_tier}</span>
              </div>
            </div>
            {project.special_instructions && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Special Instructions:</p>
                  <p className="text-sm">{project.special_instructions}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Attachments */}
        {attachments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="h-5 w-5" /> Attachments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {attachments.map((att) => (
                  <li key={att.id} className="flex items-center justify-between text-sm">
                    <span>{att.file_name}</span>
                    <a href={att.file_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Deliverable */}
        {(project.status === "ready" || project.status === "revised") && project.pdf_url && (
          <Card className="border-green-200 dark:border-green-900">
            <CardHeader>
              <CardTitle className="text-green-700 dark:text-green-400">Deliverable Ready</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Your deliverable has been generated and is ready for download.
              </p>
              <div className="flex gap-3">
                <a href={project.pdf_url} target="_blank" rel="noopener noreferrer">
                  <Button className="gap-2">
                    <Download className="h-4 w-4" /> Download PDF
                  </Button>
                </a>
                {project.markdown_url && (
                  <a href={project.markdown_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="gap-2">
                      <Download className="h-4 w-4" /> Download Markdown
                    </Button>
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Request Revision */}
        {(project.status === "ready" || project.status === "revised") && (
          <Card>
            <CardHeader>
              <CardTitle>Request Revision</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Describe what changes you'd like..."
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
                className="min-h-[120px]"
              />
              <Button onClick={requestRevision} disabled={submitting || !revisionNotes.trim()}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Revision Request
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
