-- Re-enrollment support: imported rosters create families keyed by a guardian
-- invite email. When that guardian signs in, ensure_guardian_family() claims
-- the imported family so returning students are pre-populated.

alter table public.families add column if not exists invite_email text;

create index if not exists families_invite_email_idx
  on public.families (tenant_id, lower(invite_email));

create or replace function public.ensure_guardian_family(p_tenant_id uuid, p_family_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text;
  v_family_id uuid;
  v_name text;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  insert into public.memberships (tenant_id, user_id, role)
  values (p_tenant_id, v_uid, 'guardian')
  on conflict (tenant_id, user_id) do nothing;

  -- Already linked to a family in this tenant?
  select fg.family_id into v_family_id
  from public.family_guardians fg
  join public.families f on f.id = fg.family_id
  where fg.user_id = v_uid and f.tenant_id = p_tenant_id
  limit 1;

  if v_family_id is not null then
    return v_family_id;
  end if;

  -- Claim an imported (re-enrollment) family matching this user's email.
  select p.email into v_email from public.profiles p where p.id = v_uid;

  select f.id into v_family_id
  from public.families f
  where f.tenant_id = p_tenant_id
    and f.invite_email is not null
    and lower(f.invite_email) = lower(coalesce(v_email, ''))
  limit 1;

  if v_family_id is not null then
    insert into public.family_guardians (family_id, user_id)
    values (v_family_id, v_uid)
    on conflict (family_id, user_id) do nothing;
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
