export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, FileText, Clock, TrendingUp } from "lucide-react";
import { formatCurrency, formatDate, getStatusColor, getStatusLabel, DOMAIN_LABELS } from "@/lib/utils";
import { ESTIMATED_COST_PER_PROJECT } from "@/lib/constants";
import type { Project } from "@/lib/types";
import { AdminFilters } from "@/components/admin/admin-filters";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: projects } = await supabase
    .from("projects")
    .select("*, profiles(full_name, email)")
    .order("created_at", { ascending: false });

  const allProjects = (projects || []) as (Project & { profiles: { full_name: string; email: string } })[];

  // Analytics
  const totalRevenue = allProjects
    .filter((p) => p.status !== "pending_payment")
    .reduce((sum, p) => sum + p.price_cents, 0);
  const totalOrders = allProjects.filter((p) => p.status !== "pending_payment").length;
  const pendingReview = allProjects.filter((p) => p.status === "pending_review").length;
  const estimatedApiCost = allProjects.filter((p) => p.generated_markdown).length * ESTIMATED_COST_PER_PROJECT;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Manage all projects and deliverables.</p>
      </div>

      {/* Analytics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingReview}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Est. API Cost</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${estimatedApiCost.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Project Filters + List */}
      <AdminFilters projects={allProjects} />
    </div>
  );
}
