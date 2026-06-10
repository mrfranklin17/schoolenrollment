-- =============================================================================
-- School Enrollment Platform — initial schema
-- Multi-tenant: every row is scoped by tenant_id; isolation enforced via RLS
-- (policies live in 20260610000002_rls_policies.sql).
-- FERPA-aware: student PII lives only in `students`; storage paths and audit
-- log entries use opaque UUIDs, never names.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.membership_role as enum ('school_admin', 'staff', 'guardian');

-- Custom pipeline stages map to a fixed category so application code can
-- reason about arbitrary per-tenant stages.
create type public.stage_category as enum (
  'in_progress', 'submitted', 'in_review', 'offered',
  'accepted', 'enrolled', 'waitlisted', 'declined', 'withdrawn'
);

create type public.document_status as enum ('missing', 'submitted', 'verified', 'rejected');

create type public.payment_status as enum ('not_required', 'pending', 'paid', 'waived');

create type public.offer_status as enum ('pending', 'accepted', 'declined', 'expired');

create type public.lottery_status as enum ('draft', 'run', 'finalized');

create type public.email_status as enum ('queued', 'sent', 'failed');

create type public.import_status as enum ('pending', 'processing', 'completed', 'failed');

-- ---------------------------------------------------------------------------
-- Utility: updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name text not null,
  logo_url text,
  primary_color text,
  settings jsonb not null default '{}',
  trial_ends_at timestamptz not null default now() + interval '14 days',
  subscription_status text not null default 'trialing',
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger tenants_updated_at before update on public.tenants
  for each row execute function public.set_updated_at();

-- Mirror of auth.users for profile data we can join against.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.membership_role not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index memberships_user_idx on public.memberships (user_id);
create index memberships_tenant_idx on public.memberships (tenant_id);

-- ---------------------------------------------------------------------------
-- Tenant-access helper functions (security definer so RLS policies can read
-- memberships without recursing into membership policies).
-- ---------------------------------------------------------------------------

create or replace function public.is_member_of(t uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = t and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_tenant_role(t uuid, roles public.membership_role[])
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = t
      and m.user_id = (select auth.uid())
      and m.role = any (roles)
  );
$$;

create or replace function public.is_tenant_staff(t uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.has_tenant_role(t, array['school_admin', 'staff']::public.membership_role[]);
$$;

create or replace function public.is_tenant_admin(t uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.has_tenant_role(t, array['school_admin']::public.membership_role[]);
$$;

-- ---------------------------------------------------------------------------
-- Families & students
-- ---------------------------------------------------------------------------

create table public.families (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index families_tenant_idx on public.families (tenant_id);

create trigger families_updated_at before update on public.families
  for each row execute function public.set_updated_at();

create table public.family_guardians (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  relationship text,
  created_at timestamptz not null default now(),
  unique (family_id, user_id)
);

create index family_guardians_user_idx on public.family_guardians (user_id);

create or replace function public.is_family_guardian(f uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.family_guardians fg
    where fg.family_id = f and fg.user_id = (select auth.uid())
  );
$$;

create table public.students (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  current_grade text,
  demographics jsonb not null default '{}',
  sis_id text,
  is_returning boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index students_tenant_idx on public.students (tenant_id);
create index students_family_idx on public.students (family_id);
create index students_sis_idx on public.students (tenant_id, sis_id);

create trigger students_updated_at before update on public.students
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Enrollment periods, capacity, pipeline stages
-- ---------------------------------------------------------------------------

create table public.enrollment_periods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  academic_year text not null,            -- e.g. '2026-2027'
  name text not null,                     -- e.g. 'Fall 2026 Open Enrollment'
  opens_at timestamptz,
  closes_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index enrollment_periods_tenant_idx on public.enrollment_periods (tenant_id);

create trigger enrollment_periods_updated_at before update on public.enrollment_periods
  for each row execute function public.set_updated_at();

create table public.grade_capacities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  period_id uuid not null references public.enrollment_periods (id) on delete cascade,
  grade text not null,                    -- 'K', '1', ... '12'
  seats integer not null check (seats >= 0),
  created_at timestamptz not null default now(),
  unique (period_id, grade)
);

create index grade_capacities_tenant_idx on public.grade_capacities (tenant_id);

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  key text not null,
  label text not null,
  category public.stage_category not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create index pipeline_stages_tenant_idx on public.pipeline_stages (tenant_id);

-- ---------------------------------------------------------------------------
-- Forms (versioned JSON schema)
-- ---------------------------------------------------------------------------

create table public.form_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  period_id uuid references public.enrollment_periods (id) on delete set null,
  name text not null,
  grade_levels text[],                    -- null = all grades; per-grade variants
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index form_templates_tenant_idx on public.form_templates (tenant_id);

create trigger form_templates_updated_at before update on public.form_templates
  for each row execute function public.set_updated_at();

create table public.form_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  template_id uuid not null references public.form_templates (id) on delete cascade,
  version integer not null,
  schema jsonb not null,                  -- field definitions, conditional rules, repeats
  published_at timestamptz,               -- null = draft; immutable once published
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (template_id, version)
);

create index form_versions_tenant_idx on public.form_versions (tenant_id);
create index form_versions_template_idx on public.form_versions (template_id);

-- Published form versions are immutable: applications snapshot-reference them.
create or replace function public.prevent_published_form_edit()
returns trigger
language plpgsql
as $$
begin
  if old.published_at is not null and new.schema is distinct from old.schema then
    raise exception 'published form versions are immutable';
  end if;
  return new;
end;
$$;

create trigger form_versions_immutable before update on public.form_versions
  for each row execute function public.prevent_published_form_edit();

-- ---------------------------------------------------------------------------
-- Applications
-- ---------------------------------------------------------------------------

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  period_id uuid not null references public.enrollment_periods (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  form_version_id uuid not null references public.form_versions (id),
  grade_applying text not null,
  responses jsonb not null default '{}',
  stage_id uuid not null references public.pipeline_stages (id),
  submitted_at timestamptz,
  fee_waived boolean not null default false,
  payment_status public.payment_status not null default 'not_required',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_id, student_id)
);

create index applications_tenant_idx on public.applications (tenant_id);
create index applications_family_idx on public.applications (family_id);
create index applications_stage_idx on public.applications (stage_id);
create index applications_period_grade_idx on public.applications (period_id, grade_applying);

create trigger applications_updated_at before update on public.applications
  for each row execute function public.set_updated_at();

-- Internal notes: staff-only (RLS denies guardians entirely).
create table public.application_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  author_id uuid references auth.users (id),
  body text not null,
  created_at timestamptz not null default now()
);

create index application_notes_app_idx on public.application_notes (application_id);

-- ---------------------------------------------------------------------------
-- Document checklist
-- ---------------------------------------------------------------------------

create table public.document_requirements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  period_id uuid references public.enrollment_periods (id) on delete cascade,
  name text not null,
  description text,
  required boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index document_requirements_tenant_idx on public.document_requirements (tenant_id);

create table public.application_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  requirement_id uuid not null references public.document_requirements (id) on delete cascade,
  -- Storage object path: documents/<tenant_id>/<application_id>/<doc uuid>.
  -- Opaque UUIDs only — never student names (FERPA: no PII in URLs).
  storage_path text,
  file_name text,
  status public.document_status not null default 'missing',
  rejection_reason text,
  uploaded_by uuid references auth.users (id),
  uploaded_at timestamptz,
  verified_by uuid references auth.users (id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, requirement_id)
);

create index application_documents_app_idx on public.application_documents (application_id);
create index application_documents_tenant_idx on public.application_documents (tenant_id);

create trigger application_documents_updated_at before update on public.application_documents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Audit log (append-only; written only via log_audit())
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  actor_id uuid,
  entity_type text not null,              -- 'application', 'document', 'offer', ...
  entity_id uuid not null,
  action text not null,                   -- 'stage_changed', 'document_verified', ...
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_tenant_idx on public.audit_log (tenant_id, created_at desc);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);

create or replace function public.log_audit(
  p_tenant_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_before jsonb default null,
  p_after jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (tenant_id, actor_id, entity_type, entity_id, action, before, after)
  values (p_tenant_id, (select auth.uid()), p_entity_type, p_entity_id, p_action, p_before, p_after);
end;
$$;

-- ---------------------------------------------------------------------------
-- Lottery & waitlist
-- ---------------------------------------------------------------------------

create table public.lotteries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  period_id uuid not null references public.enrollment_periods (id) on delete cascade,
  grade text,                              -- null = all grades in period
  seed text not null,                      -- stored for deterministic reruns / audit
  weights jsonb not null default '{}',     -- e.g. {"sibling": 2, "staff_child": 3, "zone": 1.5}
  status public.lottery_status not null default 'draft',
  run_at timestamptz,
  run_by uuid references auth.users (id),
  results jsonb,                           -- snapshot of full ranked output
  created_at timestamptz not null default now()
);

create index lotteries_tenant_idx on public.lotteries (tenant_id);

create table public.lottery_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  lottery_id uuid not null references public.lotteries (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  preferences jsonb not null default '{}', -- which weighted preferences applied
  weight numeric not null default 1,
  ticket numeric,                          -- deterministic draw value
  rank integer,
  created_at timestamptz not null default now(),
  unique (lottery_id, application_id)
);

create index lottery_entries_lottery_idx on public.lottery_entries (lottery_id);

create table public.waitlist_positions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  period_id uuid not null references public.enrollment_periods (id) on delete cascade,
  grade text not null,
  application_id uuid not null references public.applications (id) on delete cascade,
  rank integer not null,
  created_at timestamptz not null default now(),
  unique (period_id, grade, application_id)
);

create index waitlist_positions_tenant_idx on public.waitlist_positions (tenant_id);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  status public.offer_status not null default 'pending',
  extended_at timestamptz not null default now(),
  expires_at timestamptz,
  responded_at timestamptz,
  extended_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index offers_application_idx on public.offers (application_id);
create index offers_tenant_idx on public.offers (tenant_id);

create trigger offers_updated_at before update on public.offers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Communications
-- ---------------------------------------------------------------------------

create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  key text not null,                       -- 'submission_received', 'decision', ...
  name text not null,
  subject text not null,
  body text not null,                      -- supports {{merge_fields}}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create trigger email_templates_updated_at before update on public.email_templates
  for each row execute function public.set_updated_at();

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  application_id uuid references public.applications (id) on delete set null,
  recipient_email text not null,
  template_key text,
  subject text not null,
  status public.email_status not null default 'queued',
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index email_log_tenant_idx on public.email_log (tenant_id, created_at desc);
create index email_log_application_idx on public.email_log (application_id);

-- ---------------------------------------------------------------------------
-- SIS interoperability (CSV import/export; provider API connectors later)
-- ---------------------------------------------------------------------------

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kind text not null default 'roster',     -- returning-student roster CSV
  file_name text,
  column_mapping jsonb not null default '{}',
  status public.import_status not null default 'pending',
  stats jsonb,                              -- {created: n, updated: n, skipped: n}
  error text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger import_jobs_updated_at before update on public.import_jobs
  for each row execute function public.set_updated_at();

create table public.export_mappings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  kind text not null default 'flat_csv',    -- 'flat_csv' | 'oneroster'
  mapping jsonb not null default '{}',       -- output column -> source field
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger export_mappings_updated_at before update on public.export_mappings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RPCs used by the app (security definer where they must cross RLS atomically)
-- ---------------------------------------------------------------------------

-- Public branding lookup for the pre-auth school landing page; exposes only
-- non-sensitive fields.
create or replace function public.get_tenant_public(p_slug text)
returns table (id uuid, slug text, name text, logo_url text, primary_color text)
language sql
security definer
set search_path = ''
stable
as $$
  select t.id, t.slug, t.name, t.logo_url, t.primary_color
  from public.tenants t
  where t.slug = p_slug;
$$;

-- Self-serve school signup: creates the tenant, its default pipeline stages,
-- and makes the caller school_admin — atomically.
create or replace function public.create_tenant(p_slug text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  insert into public.tenants (slug, name) values (p_slug, p_name)
  returning id into v_tenant_id;

  insert into public.memberships (tenant_id, user_id, role)
  values (v_tenant_id, v_uid, 'school_admin');

  insert into public.pipeline_stages (tenant_id, key, label, category, position) values
    (v_tenant_id, 'started',      'Started',      'in_progress', 0),
    (v_tenant_id, 'submitted',    'Submitted',    'submitted',   1),
    (v_tenant_id, 'under_review', 'Under Review', 'in_review',   2),
    (v_tenant_id, 'offered',      'Offered',      'offered',     3),
    (v_tenant_id, 'accepted',     'Accepted',     'accepted',    4),
    (v_tenant_id, 'enrolled',     'Enrolled',     'enrolled',    5),
    (v_tenant_id, 'waitlisted',   'Waitlisted',   'waitlisted',  6),
    (v_tenant_id, 'declined',     'Declined',     'declined',    7);

  return v_tenant_id;
end;
$$;

-- Parent signing up to apply at a school: ensures a guardian membership and a
-- family record exist for the caller in that tenant. Returns the family id.
create or replace function public.ensure_guardian_family(p_tenant_id uuid, p_family_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_family_id uuid;
  v_name text;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  insert into public.memberships (tenant_id, user_id, role)
  values (p_tenant_id, v_uid, 'guardian')
  on conflict (tenant_id, user_id) do nothing;

  select fg.family_id into v_family_id
  from public.family_guardians fg
  join public.families f on f.id = fg.family_id
  where fg.user_id = v_uid and f.tenant_id = p_tenant_id
  limit 1;

  if v_family_id is not null then
    return v_family_id;
  end if;

  select coalesce(
    nullif(p_family_name, ''),
    nullif(split_part((select p.full_name from public.profiles p where p.id = v_uid), ' ', 2), '') || ' Family',
    'My Family'
  ) into v_name;

  insert into public.families (tenant_id, name)
  values (p_tenant_id, v_name)
  returning id into v_family_id;

  insert into public.family_guardians (family_id, user_id)
  values (v_family_id, v_uid);

  return v_family_id;
end;
$$;
