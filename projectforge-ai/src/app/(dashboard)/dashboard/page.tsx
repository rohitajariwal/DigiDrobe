export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Download } from "lucide-react";
import { formatCurrency, formatDate, getStatusColor, getStatusLabel, DOMAIN_LABELS } from "@/lib/utils";
import type { Project } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">My Projects</h1>
          <p className="text-muted-foreground mt-1">Manage your project submissions and deliverables.</p>
        </div>
        <Link href="/dashboard/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> New Project
          </Button>
        </Link>
      </div>

      {!projects || projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
            <p className="text-muted-foreground mb-4">Submit your first project brief to get started.</p>
            <Link href="/dashboard/new">
              <Button>Create Your First Project</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {(projects as Project[]).map((project) => (
            <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{project.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {DOMAIN_LABELS[project.domain]} &middot; {formatDate(project.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(project.status)}>
                      {getStatusLabel(project.status)}
                    </Badge>
                    <span className="text-sm font-semibold">{formatCurrency(project.price_cents)}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">{project.brief}</p>
                  {project.status === "ready" && project.pdf_url && (
                    <div className="mt-3">
                      <Badge variant="secondary" className="gap-1">
                        <Download className="h-3 w-3" /> Deliverable Ready
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
