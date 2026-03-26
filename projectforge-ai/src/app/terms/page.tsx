export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>
      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-muted-foreground">
        <p className="text-foreground font-medium">Effective Date: March 2026</p>

        <h2 className="text-xl font-semibold text-foreground">1. Service Description</h2>
        <p>
          ProjectForge AI is a professional content-creation platform operated by a content-creation
          agency. Our service allows clients to submit detailed project briefs and receive
          high-quality professional deliverables including technical reports, legal analyses,
          business case studies, engineering documentation, compliance documents, and research papers.
        </p>

        <h2 className="text-xl font-semibold text-foreground">2. Professional Use Only</h2>
        <p>
          This service is intended exclusively for legitimate professional content creation purposes.
          All deliverables produced through our platform are professional work products created for
          business, legal, technical, or academic use by the commissioning client.
        </p>

        <h2 className="text-xl font-semibold text-foreground">3. How It Works</h2>
        <p>
          Clients submit project briefs with detailed requirements. Our team reviews each brief,
          refines it if necessary, and uses advanced AI tools combined with professional expertise
          to generate high-quality deliverables. Every output is reviewed before delivery.
        </p>

        <h2 className="text-xl font-semibold text-foreground">4. Payments</h2>
        <p>
          Payments are processed securely via Stripe. Pricing is based on the selected tier
          (Basic, Standard, or Premium) and is charged as a one-time payment per project.
          All prices are displayed before submission.
        </p>

        <h2 className="text-xl font-semibold text-foreground">5. Revisions</h2>
        <p>
          Revision availability depends on the selected pricing tier. Clients may request
          revisions through their dashboard, and our team will process them promptly.
        </p>

        <h2 className="text-xl font-semibold text-foreground">6. Intellectual Property</h2>
        <p>
          Upon full payment, all deliverables become the intellectual property of the client.
          ProjectForge AI retains no rights to the generated content.
        </p>

        <h2 className="text-xl font-semibold text-foreground">7. Confidentiality</h2>
        <p>
          All project briefs, attachments, and deliverables are treated as confidential.
          We do not share client data with third parties except as necessary to deliver the service.
        </p>

        <h2 className="text-xl font-semibold text-foreground">8. Limitation of Liability</h2>
        <p>
          ProjectForge AI provides professional content creation services on a best-effort basis.
          While we strive for accuracy and quality, clients are responsible for reviewing
          deliverables before use in any official capacity.
        </p>

        <h2 className="text-xl font-semibold text-foreground">9. Contact</h2>
        <p>
          For questions about these terms, please contact us through the platform.
        </p>
      </div>
    </div>
  );
}
