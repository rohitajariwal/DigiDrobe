import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { SYSTEM_PROMPT } from "@/lib/constants";
import { DOMAIN_LABELS, CITATION_LABELS } from "@/lib/utils";

function getAnthropic() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });
}

export async function POST(request: Request) {
  try {
    const anthropic = getAnthropic();
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
      .select("*, profiles(full_name, email)")
      .eq("id", project_id)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Build user prompt from project data
    const userPrompt = buildUserPrompt(project);

    // Update status to in_progress
    await supabase
      .from("projects")
      .update({ status: "in_progress" })
      .eq("id", project_id);

    // Call Anthropic with prompt caching on system prompt
    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 16000,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const markdown =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Save markdown output
    await supabase
      .from("projects")
      .update({ generated_markdown: markdown })
      .eq("id", project_id);

    // Store markdown file in Supabase storage
    const mdBlob = new Blob([markdown], { type: "text/markdown" });
    const mdPath = `${project.user_id}/${project_id}/deliverable.md`;
    await supabase.storage.from("deliverables").upload(mdPath, mdBlob, {
      upsert: true,
      contentType: "text/markdown",
    });

    const { data: { publicUrl: markdownUrl } } = supabase.storage
      .from("deliverables")
      .getPublicUrl(mdPath);

    await supabase
      .from("projects")
      .update({ markdown_url: markdownUrl })
      .eq("id", project_id);

    return NextResponse.json({
      success: true,
      markdown,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Generation failed";
    console.error("Generation error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildUserPrompt(project: Record<string, unknown>): string {
  const parts: string[] = [
    `# Project Brief`,
    ``,
    `**Title:** ${project.title}`,
    `**Industry Domain:** ${DOMAIN_LABELS[project.domain as string] || project.domain}`,
    `**Client:** ${(project.profiles as Record<string, string>)?.full_name || "Anonymous"}`,
    ``,
    `## Detailed Requirements`,
    project.brief as string,
    ``,
  ];

  if (project.desired_length) {
    parts.push(`**Desired Length:** ${project.desired_length}`);
  }

  parts.push(
    `**Citation Style:** ${CITATION_LABELS[project.citation_style as string] || project.citation_style}`
  );

  if (project.special_instructions) {
    parts.push(``, `## Special Instructions`, project.special_instructions as string);
  }

  if (project.admin_notes) {
    parts.push(``, `## Additional Notes from Review`, project.admin_notes as string);
  }

  if (project.revision_notes) {
    parts.push(
      ``,
      `## Revision Request`,
      `The client has requested the following revisions:`,
      project.revision_notes as string
    );
  }

  return parts.join("\n");
}
