export type ProjectStatus =
  | "pending_payment"
  | "pending_review"
  | "in_progress"
  | "ready"
  | "revision_requested"
  | "revised";

export type IndustryDomain =
  | "engineering_technical"
  | "legal_compliance"
  | "business_management"
  | "scientific_research"
  | "medical_healthcare"
  | "other";

export type CitationStyle =
  | "apa"
  | "harvard"
  | "mla"
  | "chicago"
  | "none"
  | "other";

export type PricingTier = "basic" | "standard" | "premium";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  role: "client" | "admin";
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  domain: IndustryDomain;
  brief: string;
  desired_length: string | null;
  citation_style: CitationStyle;
  deadline: string | null;
  special_instructions: string | null;
  pricing_tier: PricingTier;
  price_cents: number;
  status: ProjectStatus;
  stripe_payment_intent_id: string | null;
  admin_notes: string | null;
  revision_notes: string | null;
  generated_markdown: string | null;
  pdf_url: string | null;
  markdown_url: string | null;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  project_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

export interface PricingOption {
  tier: PricingTier;
  name: string;
  description: string;
  price_cents: number;
  features: string[];
}

export const PRICING_OPTIONS: PricingOption[] = [
  {
    tier: "basic",
    name: "Basic",
    description: "Essential deliverable with standard depth",
    price_cents: 4900,
    features: [
      "Up to 2,000 words",
      "Standard formatting",
      "Basic citations",
      "3-day delivery",
    ],
  },
  {
    tier: "standard",
    name: "Standard",
    description: "Comprehensive deliverable with detailed analysis",
    price_cents: 9900,
    features: [
      "Up to 5,000 words",
      "Professional formatting",
      "Full citations & references",
      "2-day delivery",
      "1 revision included",
    ],
  },
  {
    tier: "premium",
    name: "Premium",
    description: "Enterprise-grade deliverable with maximum depth",
    price_cents: 19900,
    features: [
      "Up to 15,000 words",
      "Executive formatting",
      "Complete bibliography",
      "Priority 1-day delivery",
      "Unlimited revisions",
      "Appendices & supplements",
    ],
  },
];
