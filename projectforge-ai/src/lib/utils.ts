import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending_payment: "bg-yellow-100 text-yellow-800",
    pending_review: "bg-blue-100 text-blue-800",
    in_progress: "bg-purple-100 text-purple-800",
    ready: "bg-green-100 text-green-800",
    revision_requested: "bg-orange-100 text-orange-800",
    revised: "bg-emerald-100 text-emerald-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending_payment: "Pending Payment",
    pending_review: "Pending Review",
    in_progress: "In Progress",
    ready: "Ready",
    revision_requested: "Revision Requested",
    revised: "Revised",
  };
  return labels[status] || status;
}

export const DOMAIN_LABELS: Record<string, string> = {
  engineering_technical: "Engineering & Technical",
  legal_compliance: "Legal & Compliance",
  business_management: "Business & Management",
  scientific_research: "Scientific Research",
  medical_healthcare: "Medical & Healthcare",
  other: "Other",
};

export const CITATION_LABELS: Record<string, string> = {
  apa: "APA",
  harvard: "Harvard",
  mla: "MLA",
  chicago: "Chicago",
  none: "None",
  other: "Other",
};
