-- Guardians can accept/decline offers, but RLS (correctly) blocks them from
-- updating submitted applications. This definer function moves the
-- application to the accepted/declined stage after verifying the caller is a
-- guardian of the application's family with a matching resolved offer.

create or replace function public.apply_offer_response(
  p_application_id uuid,
  p_response text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_family_id uuid;
  v_stage_id uuid;
  v_category public.stage_category;
begin
  if p_response not in ('accepted', 'declined') then
    raise exception 'invalid response';
  end if;
  v_category := p_response::public.stage_category;

  select a.tenant_id, a.family_id into v_tenant_id, v_family_id
  from public.applications a
  where a.id = p_application_id;

  if v_tenant_id is null then
    raise exception 'application not found';
  end if;

  if not exists (
    select 1 from public.family_guardians fg
    where fg.family_id = v_family_id and fg.user_id = (select auth.uid())
  ) then
    raise exception 'not authorized';
  end if;

  -- Only act if the family actually resolved an offer this way.
  if not exists (
    select 1 from public.offers o
    where o.application_id = p_application_id and o.status = p_response
  ) then
    raise exception 'no matching offer';
  end if;

  select s.id into v_stage_id
  from public.pipeline_stages s
  where s.tenant_id = v_tenant_id and s.category = v_category
  order by s.position
  limit 1;

  if v_stage_id is null then
    raise exception 'pipeline stage missing for %', p_response;
  end if;

  update public.applications set stage_id = v_stage_id where id = p_application_id;
end;
$$;
