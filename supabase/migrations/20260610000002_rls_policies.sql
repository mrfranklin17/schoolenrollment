-- =============================================================================
-- Row Level Security policies — strict tenant isolation
--
-- Access model:
--   school_admin  full control within their tenant
--   staff         read/write applications, documents, notes within tenant
--   guardian      only their own family's rows within tenant
--
-- All cross-row checks go through the security-definer helpers defined in the
-- initial schema (is_member_of, is_tenant_staff, is_tenant_admin,
-- is_family_guardian) to avoid policy recursion.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- tenants
-- ---------------------------------------------------------------------------
alter table public.tenants enable row level security;

create policy "members can read their tenants"
  on public.tenants for select
  using (public.is_member_of(id));

create policy "admins can update their tenant"
  on public.tenants for update
  using (public.is_tenant_admin(id))
  with check (public.is_tenant_admin(id));

-- inserts happen only via create_tenant() (security definer); no insert policy.
-- deletes are intentionally not allowed via the API.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "users can read own profile"
  on public.profiles for select
  using (id = (select auth.uid()));

create policy "users can update own profile"
  on public.profiles for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Staff need to see guardian names/emails for applications in their tenant.
create policy "staff can read profiles of tenant members"
  on public.profiles for select
  using (
    exists (
      select 1 from public.memberships m
      where m.user_id = profiles.id
        and public.is_tenant_staff(m.tenant_id)
    )
  );

-- ---------------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------------
alter table public.memberships enable row level security;

create policy "users can read own memberships"
  on public.memberships for select
  using (user_id = (select auth.uid()));

create policy "staff can read tenant memberships"
  on public.memberships for select
  using (public.is_tenant_staff(tenant_id));

create policy "admins can manage tenant memberships"
  on public.memberships for all
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- guardian self-enrollment happens via ensure_guardian_family() (definer).

-- ---------------------------------------------------------------------------
-- families & family_guardians
-- ---------------------------------------------------------------------------
alter table public.families enable row level security;

create policy "staff can manage tenant families"
  on public.families for all
  using (public.is_tenant_staff(tenant_id))
  with check (public.is_tenant_staff(tenant_id));

create policy "guardians can read own family"
  on public.families for select
  using (public.is_family_guardian(id));

create policy "guardians can update own family"
  on public.families for update
  using (public.is_family_guardian(id))
  with check (public.is_family_guardian(id));

alter table public.family_guardians enable row level security;

create policy "guardians can read own family links"
  on public.family_guardians for select
  using (user_id = (select auth.uid()) or public.is_family_guardian(family_id));

create policy "staff can read tenant family links"
  on public.family_guardians for select
  using (
    exists (
      select 1 from public.families f
      where f.id = family_guardians.family_id
        and public.is_tenant_staff(f.tenant_id)
    )
  );

create policy "staff can manage tenant family links"
  on public.family_guardians for all
  using (
    exists (
      select 1 from public.families f
      where f.id = family_guardians.family_id
        and public.is_tenant_staff(f.tenant_id)
    )
  )
  with check (
    exists (
      select 1 from public.families f
      where f.id = family_guardians.family_id
        and public.is_tenant_staff(f.tenant_id)
    )
  );

-- ---------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------
alter table public.students enable row level security;

create policy "staff can manage tenant students"
  on public.students for all
  using (public.is_tenant_staff(tenant_id))
  with check (public.is_tenant_staff(tenant_id));

create policy "guardians can read own students"
  on public.students for select
  using (public.is_family_guardian(family_id));

create policy "guardians can add students to own family"
  on public.students for insert
  with check (public.is_family_guardian(family_id) and public.is_member_of(tenant_id));

create policy "guardians can update own students"
  on public.students for update
  using (public.is_family_guardian(family_id))
  with check (public.is_family_guardian(family_id));

-- ---------------------------------------------------------------------------
-- enrollment_periods / grade_capacities / pipeline_stages /
-- document_requirements — tenant config: members read, admins write
-- ---------------------------------------------------------------------------
alter table public.enrollment_periods enable row level security;

create policy "members can read periods"
  on public.enrollment_periods for select
  using (public.is_member_of(tenant_id));

create policy "admins can manage periods"
  on public.enrollment_periods for all
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

alter table public.grade_capacities enable row level security;

create policy "members can read capacities"
  on public.grade_capacities for select
  using (public.is_member_of(tenant_id));

create policy "admins can manage capacities"
  on public.grade_capacities for all
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

alter table public.pipeline_stages enable row level security;

create policy "members can read stages"
  on public.pipeline_stages for select
  using (public.is_member_of(tenant_id));

create policy "admins can manage stages"
  on public.pipeline_stages for all
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

alter table public.document_requirements enable row level security;

create policy "members can read document requirements"
  on public.document_requirements for select
  using (public.is_member_of(tenant_id));

create policy "admins can manage document requirements"
  on public.document_requirements for all
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- ---------------------------------------------------------------------------
-- forms
-- ---------------------------------------------------------------------------
alter table public.form_templates enable row level security;

create policy "members can read form templates"
  on public.form_templates for select
  using (public.is_member_of(tenant_id));

create policy "admins can manage form templates"
  on public.form_templates for all
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

alter table public.form_versions enable row level security;

-- Guardians may only see published versions; staff see drafts too.
create policy "members can read published form versions"
  on public.form_versions for select
  using (public.is_member_of(tenant_id) and published_at is not null);

create policy "staff can read all form versions"
  on public.form_versions for select
  using (public.is_tenant_staff(tenant_id));

create policy "admins can manage form versions"
  on public.form_versions for all
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- ---------------------------------------------------------------------------
-- applications
-- ---------------------------------------------------------------------------
alter table public.applications enable row level security;

create policy "staff can manage tenant applications"
  on public.applications for all
  using (public.is_tenant_staff(tenant_id))
  with check (public.is_tenant_staff(tenant_id));

create policy "guardians can read own applications"
  on public.applications for select
  using (public.is_family_guardian(family_id));

create policy "guardians can create own applications"
  on public.applications for insert
  with check (public.is_family_guardian(family_id) and public.is_member_of(tenant_id));

-- Guardians can edit drafts only; once submitted, changes go through staff.
create policy "guardians can update own draft applications"
  on public.applications for update
  using (public.is_family_guardian(family_id) and submitted_at is null)
  with check (public.is_family_guardian(family_id));

-- ---------------------------------------------------------------------------
-- application_notes — internal; guardians have NO access
-- ---------------------------------------------------------------------------
alter table public.application_notes enable row level security;

create policy "staff can manage tenant notes"
  on public.application_notes for all
  using (public.is_tenant_staff(tenant_id))
  with check (public.is_tenant_staff(tenant_id));

-- ---------------------------------------------------------------------------
-- application_documents
-- ---------------------------------------------------------------------------
alter table public.application_documents enable row level security;

create policy "staff can manage tenant documents"
  on public.application_documents for all
  using (public.is_tenant_staff(tenant_id))
  with check (public.is_tenant_staff(tenant_id));

create policy "guardians can read own application documents"
  on public.application_documents for select
  using (
    exists (
      select 1 from public.applications a
      where a.id = application_documents.application_id
        and public.is_family_guardian(a.family_id)
    )
  );

create policy "guardians can upsert own application documents"
  on public.application_documents for insert
  with check (
    exists (
      select 1 from public.applications a
      where a.id = application_documents.application_id
        and public.is_family_guardian(a.family_id)
    )
  );

create policy "guardians can update own application documents"
  on public.application_documents for update
  using (
    status in ('missing', 'submitted', 'rejected')
    and exists (
      select 1 from public.applications a
      where a.id = application_documents.application_id
        and public.is_family_guardian(a.family_id)
    )
  )
  with check (
    -- guardians cannot self-verify
    status in ('missing', 'submitted')
    and exists (
      select 1 from public.applications a
      where a.id = application_documents.application_id
        and public.is_family_guardian(a.family_id)
    )
  );

-- ---------------------------------------------------------------------------
-- audit_log — append-only via log_audit(); staff read
-- ---------------------------------------------------------------------------
alter table public.audit_log enable row level security;

create policy "staff can read tenant audit log"
  on public.audit_log for select
  using (public.is_tenant_staff(tenant_id));

-- no insert/update/delete policies: writes only via security definer function.

-- ---------------------------------------------------------------------------
-- lottery & waitlist
-- ---------------------------------------------------------------------------
alter table public.lotteries enable row level security;

create policy "admins can manage lotteries"
  on public.lotteries for all
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

create policy "staff can read lotteries"
  on public.lotteries for select
  using (public.is_tenant_staff(tenant_id));

alter table public.lottery_entries enable row level security;

create policy "admins can manage lottery entries"
  on public.lottery_entries for all
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

create policy "staff can read lottery entries"
  on public.lottery_entries for select
  using (public.is_tenant_staff(tenant_id));

alter table public.waitlist_positions enable row level security;

create policy "staff can manage waitlist"
  on public.waitlist_positions for all
  using (public.is_tenant_staff(tenant_id))
  with check (public.is_tenant_staff(tenant_id));

create policy "guardians can see own waitlist positions"
  on public.waitlist_positions for select
  using (
    exists (
      select 1 from public.applications a
      where a.id = waitlist_positions.application_id
        and public.is_family_guardian(a.family_id)
    )
  );

alter table public.offers enable row level security;

create policy "staff can manage offers"
  on public.offers for all
  using (public.is_tenant_staff(tenant_id))
  with check (public.is_tenant_staff(tenant_id));

create policy "guardians can read own offers"
  on public.offers for select
  using (
    exists (
      select 1 from public.applications a
      where a.id = offers.application_id
        and public.is_family_guardian(a.family_id)
    )
  );

create policy "guardians can respond to own offers"
  on public.offers for update
  using (
    status = 'pending'
    and exists (
      select 1 from public.applications a
      where a.id = offers.application_id
        and public.is_family_guardian(a.family_id)
    )
  )
  with check (
    status in ('accepted', 'declined')
    and exists (
      select 1 from public.applications a
      where a.id = offers.application_id
        and public.is_family_guardian(a.family_id)
    )
  );

-- ---------------------------------------------------------------------------
-- communications
-- ---------------------------------------------------------------------------
alter table public.email_templates enable row level security;

create policy "staff can read email templates"
  on public.email_templates for select
  using (public.is_tenant_staff(tenant_id));

create policy "admins can manage email templates"
  on public.email_templates for all
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

alter table public.email_log enable row level security;

create policy "staff can read email log"
  on public.email_log for select
  using (public.is_tenant_staff(tenant_id));

-- sends are written by the server (service role bypasses RLS).

-- ---------------------------------------------------------------------------
-- interop
-- ---------------------------------------------------------------------------
alter table public.import_jobs enable row level security;

create policy "admins can manage import jobs"
  on public.import_jobs for all
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

alter table public.export_mappings enable row level security;

create policy "admins can manage export mappings"
  on public.export_mappings for all
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));
