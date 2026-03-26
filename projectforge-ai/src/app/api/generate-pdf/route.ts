import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { project_id } = await request.json();

    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", project_id)
      .single();

    if (!project || !project.generated_markdown) {
      return NextResponse.json({ error: "No generated content found" }, { status: 404 });
    }

    // Generate PDF using server-side HTML-to-PDF approach
    // We create a clean HTML document from the markdown and convert it
    const html = markdownToHtml(project.generated_markdown, project.title);

    // Store the HTML as a styled PDF-ready document
    // For production, you'd use puppeteer or a PDF service
    // Here we store a styled HTML that can be printed to PDF
    const pdfHtml = wrapInPdfTemplate(html, project.title);

    const htmlBlob = new Blob([pdfHtml], { type: "text/html" });
    const pdfPath = `${project.user_id}/${project_id}/deliverable.html`;

    await supabase.storage.from("deliverables").upload(pdfPath, htmlBlob, {
      upsert: true,
      contentType: "text/html",
    });

    const { data: { publicUrl: pdfUrl } } = supabase.storage
      .from("deliverables")
      .getPublicUrl(pdfPath);

    // Update project with PDF URL and mark as ready
    await supabase
      .from("projects")
      .update({
        pdf_url: pdfUrl,
        status: "ready",
      })
      .eq("id", project_id);

    return NextResponse.json({ success: true, pdf_url: pdfUrl });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "PDF generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function markdownToHtml(markdown: string, _title: string): string {
  let html = markdown;

  // Headers
  html = html.replace(/^### (.*$)/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*$)/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*$)/gm, "<h1>$1</h1>");

  // Bold and italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Code blocks
  html = html.replace(/```[\w]*\n([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
  html = html.replace(/`(.*?)`/g, "<code>$1</code>");

  // Lists
  html = html.replace(/^\- (.*$)/gm, "<li>$1</li>");
  html = html.replace(/^\d+\. (.*$)/gm, "<li>$1</li>");

  // Wrap consecutive li in ul
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Horizontal rules
  html = html.replace(/^---$/gm, "<hr>");

  // Paragraphs
  html = html
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (
        !trimmed ||
        trimmed.startsWith("<h") ||
        trimmed.startsWith("<ul") ||
        trimmed.startsWith("<ol") ||
        trimmed.startsWith("<pre") ||
        trimmed.startsWith("<hr")
      ) {
        return trimmed;
      }
      return `<p>${trimmed}</p>`;
    })
    .join("\n");

  return html;
}

function wrapInPdfTemplate(html: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ProjectForge AI</title>
  <style>
    @media print {
      body { margin: 0; }
      @page { margin: 2cm; }
    }
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      line-height: 1.8;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #1a1a1a;
      background: #fff;
    }
    h1 { font-size: 28px; color: #1a1a2e; border-bottom: 3px solid #1a1a2e; padding-bottom: 10px; margin-top: 40px; }
    h2 { font-size: 22px; color: #2d2d44; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-top: 30px; }
    h3 { font-size: 18px; color: #3d3d5c; margin-top: 24px; }
    p { margin: 12px 0; text-align: justify; }
    ul, ol { margin: 12px 0; padding-left: 30px; }
    li { margin: 6px 0; }
    pre { background: #f5f5f5; padding: 16px; border-radius: 4px; overflow-x: auto; font-size: 14px; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 14px; }
    pre code { background: none; padding: 0; }
    hr { border: none; border-top: 1px solid #ddd; margin: 30px 0; }
    strong { color: #1a1a2e; }
    .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #1a1a2e; }
    .header h1 { border: none; font-size: 32px; }
    .footer { margin-top: 60px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #ddd; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <p style="color: #666;">Generated by ProjectForge AI</p>
    <p style="color: #999; font-size: 14px;">${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
  </div>
  ${html}
  <div class="footer">
    <p>This document was produced by ProjectForge AI &mdash; Professional Content Creation Services</p>
    <p>Confidential &mdash; For authorized use only</p>
  </div>
</body>
</html>`;
}
