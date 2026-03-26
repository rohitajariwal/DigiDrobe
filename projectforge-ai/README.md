# ProjectForge AI

Professional AI-powered deliverable platform. Clients submit project briefs and receive premium-quality technical reports, legal analyses, business cases, engineering documentation, and more.

## Architecture

Since Hostinger shared hosting cannot run Next.js server features (API routes, Server Actions, SSR), this project is designed for:

- **Frontend + API**: [Vercel](https://vercel.com) (free tier available)
- **Database + Auth + Storage**: [Supabase](https://supabase.com) (free tier available)
- **Payments**: [Stripe](https://stripe.com)
- **Email**: [Resend](https://resend.com) (free tier: 100 emails/day)
- **AI**: [Anthropic API](https://console.anthropic.com) (Claude Opus 4.6)
- **Domain**: Point your Hostinger domain to Vercel via DNS

## Tech Stack

- Next.js 15+ (App Router)
- TypeScript
- Tailwind CSS v4
- Shadcn/UI components (Radix primitives)
- Supabase Auth + PostgreSQL + Storage
- Stripe one-time payments
- Anthropic SDK with prompt caching
- Resend for transactional email
- React Markdown for preview

## Setup

### 1. External Services

1. **Supabase**: Create project at [supabase.com](https://supabase.com), run `supabase-schema.sql` in the SQL editor
2. **Stripe**: Create account, get API keys, set up webhook endpoint pointing to `/api/stripe/webhook`
3. **Anthropic**: Get API key from [console.anthropic.com](https://console.anthropic.com)
4. **Resend**: Create account, verify your domain, get API key

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
```

### 3. Database Setup

Run the SQL in `supabase-schema.sql` in your Supabase SQL editor. This creates:
- `profiles` table (auto-created on signup)
- `projects` table with status tracking
- `attachments` table
- Storage buckets for attachments and deliverables
- Row Level Security policies
- Auto-update triggers

### 4. Admin User

After creating your account through the signup page, run this SQL in Supabase to make yourself admin:

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'your-admin@email.com';
```

### 5. Local Development

```bash
npm install
npm run dev
```

### 6. Deploy to Vercel

1. Push to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add all environment variables from `.env.example`
4. Deploy

### 7. Domain Setup

In Vercel:
1. Go to Project Settings > Domains
2. Add your custom domain
3. In Hostinger DNS, add the CNAME/A records Vercel provides

### 8. Stripe Webhook

In Stripe Dashboard:
1. Go to Developers > Webhooks
2. Add endpoint: `https://yourdomain.com/api/stripe/webhook`
3. Listen for `checkout.session.completed`
4. Copy the webhook secret to `STRIPE_WEBHOOK_SECRET`

## Features

### Client Side
- Landing page with pricing
- Signup/Login with Supabase Auth
- Project submission with attachments
- Stripe checkout integration
- Order history with status tracking
- Deliverable download (PDF + Markdown)
- Revision requests

### Admin Dashboard
- Analytics (revenue, orders, API costs)
- Project list with status/domain filters
- Full project brief view with attachments
- Inline notes editor (added to AI prompt)
- One-click generation with Claude Opus 4.6
- Markdown preview
- PDF generation and storage
- Email notifications to clients
- Revision workflow

### Security
- Supabase RLS policies on all tables
- Admin-only API route protection
- Server-side API key handling
- Middleware-based auth guards
- Role-based access control
