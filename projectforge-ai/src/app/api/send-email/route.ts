import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

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

    const { project_id, type } = await request.json();

    const { data: project } = await supabase
      .from("projects")
      .select("*, profiles(email, full_name)")
      .eq("id", project_id)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const clientEmail = (project.profiles as { email: string; full_name: string })?.email;
    const clientName = (project.profiles as { email: string; full_name: string })?.full_name || "Client";

    if (!clientEmail) {
      return NextResponse.json({ error: "Client email not found" }, { status: 400 });
    }

    let subject: string;
    let htmlContent: string;

    if (type === "ready") {
      subject = `Your Deliverable is Ready: ${project.title}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1a1a2e; padding: 20px; text-align: center;">
            <h1 style="color: #fff; margin: 0;">ProjectForge AI</h1>
          </div>
          <div style="padding: 30px; background: #fff;">
            <h2>Hello ${clientName},</h2>
            <p>Great news! Your deliverable for <strong>"${project.title}"</strong> is ready for download.</p>
            <p>Log in to your dashboard to view and download the completed document.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/projects/${project.id}"
                 style="background: #1a1a2e; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Your Deliverable
              </a>
            </div>
            <p style="color: #666;">Thank you for choosing ProjectForge AI.</p>
          </div>
          <div style="text-align: center; padding: 15px; color: #999; font-size: 12px;">
            ProjectForge AI - Professional Content Creation Services
          </div>
        </div>
      `;
    } else {
      subject = `Update on Your Project: ${project.title}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1a1a2e; padding: 20px; text-align: center;">
            <h1 style="color: #fff; margin: 0;">ProjectForge AI</h1>
          </div>
          <div style="padding: 30px; background: #fff;">
            <h2>Hello ${clientName},</h2>
            <p>There's an update on your project <strong>"${project.title}"</strong>.</p>
            <p>Current status: <strong>${project.status.replace(/_/g, " ").toUpperCase()}</strong></p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/projects/${project.id}"
                 style="background: #1a1a2e; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Project
              </a>
            </div>
          </div>
        </div>
      `;
    }

    const { error: emailError } = await getResend().emails.send({
      from: process.env.EMAIL_FROM || "ProjectForge AI <noreply@projectforge.ai>",
      to: clientEmail,
      subject,
      html: htmlContent,
    });

    if (emailError) {
      return NextResponse.json({ error: emailError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Email sending failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
