import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  Scale,
  Briefcase,
  FlaskConical,
  Code,
  ShieldCheck,
  ArrowRight,
  CheckCircle,
  Zap,
  Clock,
  Lock,
} from "lucide-react";
import { PRICING_OPTIONS } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const services = [
  { icon: FileText, title: "Technical Reports", desc: "Engineering documentation, system architecture, and technical specifications." },
  { icon: Scale, title: "Legal Analyses", desc: "Case studies, compliance reviews, regulatory assessments, and legal memos." },
  { icon: Briefcase, title: "Business Case Studies", desc: "Market analysis, strategy documents, and business planning deliverables." },
  { icon: FlaskConical, title: "Research Papers", desc: "Academic-quality research with proper citations and methodology." },
  { icon: Code, title: "Code & Documentation", desc: "Complete code packages with documentation, tests, and deployment guides." },
  { icon: ShieldCheck, title: "Compliance Documents", desc: "Regulatory compliance packages, audit reports, and policy documents." },
];

const benefits = [
  { icon: Zap, title: "AI-Powered Quality", desc: "Leveraging advanced AI to produce consultant-grade deliverables." },
  { icon: Clock, title: "Fast Turnaround", desc: "Get professional documents in hours, not weeks." },
  { icon: Lock, title: "Secure & Confidential", desc: "Your data and briefs are encrypted and never shared." },
  { icon: CheckCircle, title: "Expert Review", desc: "Every deliverable is reviewed by our team before delivery." },
];

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Professional Deliverables,{" "}
              <span className="text-primary">Powered by AI</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Submit your project brief and receive premium-quality technical reports,
              legal analyses, business cases, and more — crafted by AI and reviewed
              by experts.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href="/signup">
                <Button size="lg" className="gap-2">
                  Start Your Project <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="#pricing">
                <Button variant="outline" size="lg">
                  View Pricing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold">What We Deliver</h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            From engineering documentation to legal analyses, our platform handles
            complex professional deliverables across every domain.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Card key={service.title} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <service.icon className="h-10 w-10 text-primary mb-2" />
                <CardTitle className="text-lg">{service.title}</CardTitle>
                <CardDescription>{service.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="border-y bg-muted/50">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold">Why ProjectForge AI?</h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b) => (
              <div key={b.title} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <b.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">{b.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold">Simple, Transparent Pricing</h2>
          <p className="mt-4 text-muted-foreground">Choose the tier that fits your project needs.</p>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
          {PRICING_OPTIONS.map((option) => (
            <Card
              key={option.tier}
              className={`relative flex flex-col ${option.tier === "standard" ? "border-primary shadow-lg scale-105" : ""}`}
            >
              {option.tier === "standard" && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  Most Popular
                </div>
              )}
              <CardHeader>
                <CardTitle>{option.name}</CardTitle>
                <CardDescription>{option.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{formatCurrency(option.price_cents)}</span>
                  <span className="text-muted-foreground"> / project</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-3">
                  {option.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <div className="p-6 pt-0">
                <Link href="/signup">
                  <Button
                    className="w-full"
                    variant={option.tier === "standard" ? "default" : "outline"}
                  >
                    Get Started
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold">Ready to Forge Your Next Deliverable?</h2>
          <p className="mt-4 text-primary-foreground/80 max-w-xl mx-auto">
            Join professionals who trust ProjectForge AI for their most important documents.
          </p>
          <Link href="/signup">
            <Button size="lg" variant="secondary" className="mt-8 gap-2">
              Create Your Account <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
