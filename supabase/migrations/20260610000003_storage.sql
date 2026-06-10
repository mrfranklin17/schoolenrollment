-- =============================================================================
-- Storage: private `documents` bucket for uploaded enrollment documents.
--
-- Object path convention (opaque UUIDs only — no student PII in paths):
--   <tenant_id>/<application_id>/<document_id>
--
-- Access is via short-lived signed URLs generated server-side; these policies
-- gate who may create/read the underlying objects.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  10485760, -- 10 MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp']
)
on conflict (id) do nothing;

-- Staff of the tenant (first path segment) can do anything with tenant objects.
create policy "staff can manage tenant documents"
  on storage.objects for all
  using (
    bucket_id = 'documents'
    and public.is_tenant_staff(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'documents'
    and public.is_tenant_staff(((storage.foldername(name))[1])::uuid)
  );

-- Guardians can upload/read objects under applications that belong to their
-- family (second path segment is the application id).
create policy "guardians can read own application files"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.applications a
      where a.id = ((storage.foldername(name))[2])::uuid
        and public.is_family_guardian(a.family_id)
    )
  );

create policy "guardians can upload own application files"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and exists (
      select 1 from public.applications a
      where a.id = ((storage.foldername(name))[2])::uuid
        and a.tenant_id = ((storage.foldername(name))[1])::uuid
        and public.is_family_guardian(a.family_id)
    )
  );

create policy "guardians can replace own application files"
  on storage.objects for update
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.applications a
      where a.id = ((storage.foldername(name))[2])::uuid
        and public.is_family_guardian(a.family_id)
    )
  );
