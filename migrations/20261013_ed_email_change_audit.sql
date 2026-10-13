-- E Digital.IA · future email-change audit for verified platform administrators.
-- Apply from Supabase SQL Editor. This records changes AFTER installation only.
create table if not exists public.ed_email_change_audit(
 id bigint generated always as identity primary key,
 user_id uuid not null,
 previous_email text,
 new_email text,
 changed_at timestamptz not null default now()
);
create index if not exists ed_email_change_audit_user_date on public.ed_email_change_audit(user_id,changed_at desc);
alter table public.ed_email_change_audit enable row level security;
revoke all on public.ed_email_change_audit from anon,authenticated;
grant select on public.ed_email_change_audit to service_role;
grant usage,select on sequence public.ed_email_change_audit_id_seq to service_role;
create or replace function public.ed_audit_email_update()
returns trigger language plpgsql security definer set search_path=public,auth as $$
begin
 if new.email is distinct from old.email then
  insert into public.ed_email_change_audit(user_id,previous_email,new_email)
  values(new.id,old.email,new.email);
 end if;
 return new;
end $$;
drop trigger if exists ed_audit_email_change on auth.users;
create trigger ed_audit_email_change after update of email on auth.users
for each row when (old.email is distinct from new.email)
execute function public.ed_audit_email_update();
-- This audit table does NOT log passwords, reset tokens or Facebook credentials.
