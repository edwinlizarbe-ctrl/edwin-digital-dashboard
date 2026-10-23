-- Brásper: dedicated restricted editor. Apply before inviting Ana.
-- Existing admin/client accounts and memberships remain unchanged.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin','client','blog_editor'));

-- Defense in depth: a blog-only JWT cannot query sites directly via PostgREST.
-- Other CRM data tables already have RLS enabled and no direct client policies.
drop policy if exists ed_brasper_blog_editor_no_sites on public.sites;
create policy ed_brasper_blog_editor_no_sites on public.sites
 as restrictive for all to authenticated
 using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','client')))
 with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','client')));
