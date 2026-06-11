-- Hardening pass from the Supabase security advisors:
--  1. Pin search_path on the two trigger functions that lacked it.
--  2. Trigger-only functions must not be callable via PostgREST RPC.
--  3. Security-definer RPCs that require a signed-in user must not be
--     executable by anon. (get_tenant_public stays anon-callable on purpose:
--     it powers the pre-auth school landing page and exposes only branding.)
--  4. log_audit additionally refuses unauthenticated callers.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_published_form_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.published_at is not null and new.schema is distinct from old.schema then
    raise exception 'published form versions are immutable';
  end if;
  return new;
end;
$$;

-- Trigger-only: nobody should call these over the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.prevent_published_form_edit() from public, anon, authenticated;

-- Authenticated-only RPCs.
revoke execute on function public.create_tenant(text, text) from public, anon;
revoke execute on function public.ensure_guardian_family(uuid, text) from public, anon;
revoke execute on function public.apply_offer_response(uuid, text) from public, anon;
revoke execute on function public.log_audit(uuid, text, uuid, text, jsonb, jsonb) from public, anon;

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
  if (select auth.uid()) is null then
    raise exception 'must be authenticated';
  end if;
  insert into public.audit_log (tenant_id, actor_id, entity_type, entity_id, action, before, after)
  values (p_tenant_id, (select auth.uid()), p_entity_type, p_entity_id, p_action, p_before, p_after);
end;
$$;
