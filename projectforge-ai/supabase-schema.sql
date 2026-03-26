-- ============================================
-- ProjectForge AI - Complete Supabase Schema
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

create type project_status as enum (
  'pending_payment',
  'pending_review',
  'in_progress',
  'ready',
  'revision_requested',
  'revised'
);

create type industry_domain as enum (
  'engineering_technical',
  'legal_compliance',
  'business_management',
  'scientific_research',
  'medical_healthcare',
  'other'
);

create type citation_style as enum (
  'apa',
  'harvard',
  'mla',
  'chicago',
  'none',
  'other'
);

create type pricing_tier as enum (
  'basic',
  'standard',
  'premium'
);

-- ============================================
-- PROFILES TABLE
-- ============================================

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  company text,
  role text not null default 'client' check (role in ('client', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- PROJECTS TABLE
-- ============================================

create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  domain industry_domain not null,
  brief text not null,
  desired_length text,
  citation_style citation_style not null default 'none',
  deadline timestamptz,
  special_instructions text,
  pricing_tier pricing_tier not null default 'basic',
  price_cents integer not null default 0,
  status project_status not null default 'pending_payment',
  stripe_payment_intent_id text,
  admin_notes text,
  revision_notes text,
  generated_markdown text,
  pdf_url text,
  markdown_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- ATTACHMENTS TABLE
-- ============================================

create table public.attachments (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade not null,
  file_name text not null,
  file_url text not null,
  file_size integer,
  mime_type text,
  created_at timestamptz not null default now()
);

-- ============================================
-- INDEXES
-- ============================================

create index idx_projects_user_id on public.projects(user_id);
create index idx_projects_status on public.projects(status);
create index idx_projects_created_at on public.projects(created_at desc);
create index idx_attachments_project_id on public.attachments(project_id);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_projects_updated
  before update on public.projects
  for each row execute function public.handle_updated_at();

create trigger on_profiles_updated
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.attachments enable row level security;

-- Profiles: users can read/update their own, admins can read all
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Projects: clients see own, admins see all
create policy "Users can view own projects"
  on public.projects for select
  using (user_id = auth.uid());

create policy "Users can insert own projects"
  on public.projects for insert
  with check (user_id = auth.uid());

create policy "Users can update own projects (limited)"
  on public.projects for update
  using (user_id = auth.uid());

create policy "Admins can view all projects"
  on public.projects for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update all projects"
  on public.projects for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Attachments: follow project access
create policy "Users can view own attachments"
  on public.attachments for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = attachments.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can insert attachments to own projects"
  on public.attachments for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = attachments.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Admins can view all attachments"
  on public.attachments for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================
-- STORAGE BUCKETS
-- ============================================

insert into storage.buckets (id, name, public)
values
  ('attachments', 'attachments', false),
  ('deliverables', 'deliverables', false);

-- Storage policies for attachments bucket
create policy "Authenticated users can upload attachments"
  on storage.objects for insert
  with check (
    bucket_id = 'attachments'
    and auth.role() = 'authenticated'
  );

create policy "Users can view own attachments in storage"
  on storage.objects for select
  using (
    bucket_id = 'attachments'
    and auth.role() = 'authenticated'
  );

-- Storage policies for deliverables bucket
create policy "Admins can upload deliverables"
  on storage.objects for insert
  with check (
    bucket_id = 'deliverables'
    and auth.role() = 'authenticated'
  );

create policy "Authenticated users can view deliverables"
  on storage.objects for select
  using (
    bucket_id = 'deliverables'
    and auth.role() = 'authenticated'
  );
