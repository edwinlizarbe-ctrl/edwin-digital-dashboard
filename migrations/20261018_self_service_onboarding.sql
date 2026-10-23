-- Registro autoservicio: creación atómica e idempotente de la primera empresa.
-- REVISAR antes de aplicar. No desactiva RLS, no abre INSERT en businesses/business_members,
-- no concede rol admin y no modifica el trigger edwin_auth_user_created.

create table if not exists public.ed_business_owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.ed_business_owners enable row level security;
revoke all on public.ed_business_owners from public, anon, authenticated;
-- Sin políticas: solo la función SECURITY DEFINER escribe en esta tabla.

create or replace function public.ed_onboard_business(p_name text)
returns table (id uuid, name text, slug text, created boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_key text;
  v_biz public.businesses%rowtype;
begin
  if v_uid is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'client') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  -- Serializa solicitudes simultáneas del mismo usuario (doble clic / reintentos).
  perform pg_advisory_xact_lock(hashtextextended('ed_onboard_business:' || v_uid::text, 0));

  -- Idempotencia: con membresía previa (invitado, cliente existente o reintento) se devuelve esa empresa.
  select b.* into v_biz
    from public.business_members m
    join public.businesses b on b.id = m.business_id
   where m.user_id = v_uid
   order by b.created_at asc
   limit 1;
  if found then
    return query select v_biz.id, v_biz.name, v_biz.slug, false;
    return;
  end if;

  v_name := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  if char_length(v_name) < 2 or char_length(v_name) > 80 or v_name ~ '[<>[:cntrl:]]' then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  v_key := regexp_replace(lower(translate(v_name,
    'áàäâãéèëêíìïîóòöôõúùüûñÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑ',
    'aaaaaeeeeiiiiooooouuuunAAAAAEEEEIIIIOOOOOUUUUN')), '[^a-z0-9]', '', 'g');
  if v_key in ('edwindigital','edwin','edigital','edwincrm','brasper','admin','administrador','crm') then
    raise exception 'reserved_name' using errcode = '22023';
  end if;

  insert into public.businesses (name, slug)
  values (v_name, 'crm-' || replace(gen_random_uuid()::text, '-', ''))
  returning * into v_biz;

  insert into public.business_members (business_id, user_id) values (v_biz.id, v_uid);
  insert into public.ed_business_owners (user_id, business_id) values (v_uid, v_biz.id);

  return query select v_biz.id, v_biz.name, v_biz.slug, true;
end;
$$;

revoke all on function public.ed_onboard_business(text) from public, anon;
grant execute on function public.ed_onboard_business(text) to authenticated;
