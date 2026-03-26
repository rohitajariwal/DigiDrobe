"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate, getStatusColor, getStatusLabel, DOMAIN_LABELS } from "@/lib/utils";
import type { Project } from "@/lib/types";

interface AdminFiltersProps {
  projects: (Project & { profiles: { full_name: string; email: string } })[];
}

export function AdminFilters({ projects }: AdminFiltersProps) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [domainFilter, setDomainFilter] = useState("all");

  const filtered = projects.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (domainFilter !== "all" && p.domain !== domainFilter) return false;
    return true;
  });

  return (
    <div>
      <div className="flex flex-wrap gap-4 mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending_review">Pending Review</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="revision_requested">Revision Requested</SelectItem>
            <SelectItem value="revised">Revised</SelectItem>
          </SelectContent>
        </Select>

        <Select value={domainFilter} onValueChange={setDomainFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by domain" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Domains</SelectItem>
            {Object.entries(DOMAIN_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground self-center">
          {filtered.length} project{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No projects match the current filters.
            </CardContent>
          </Card>
        ) : (
          filtered.map((project) => (
            <Link key={project.id} href={`/admin/projects/${project.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{project.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {project.profiles?.full_name || project.profiles?.email} &middot;{" "}
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
                  <p className="text-sm text-muted-foreground line-clamp-1">{project.brief}</p>
                  {project.deadline && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Deadline: {formatDate(project.deadline)}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
