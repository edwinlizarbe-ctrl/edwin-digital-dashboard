-- E Digital.IA · Tenant-managed integration access / manual plan label.
-- Apply in Supabase SQL Editor. Requires Cloudflare secret SUPABASE_SERVICE_ROLE_KEY.
-- No changes to existing login, profiles, sites, or subscription payments.
create table if not exists public.ed_business_features (
 business_id uuid primary key references public.businesses(id) on delete cascade,
 plan text not null default 'premium' check (plan in ('free','premium')),
 features jsonb not null default '{"ga4":true,"search_console":false,"social_organic":false,"hotmart":false,"shopify":false,"meta_ads":true,"google_ads":false,"tiktok_ads":false,"linkedin_ads":false}'::jsonb,
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
create or replace function public.ed_features_touch_update()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end $$;
drop trigger if exists ed_features_updated on public.ed_business_features;
create trigger ed_features_updated before update on public.ed_business_features
for each row execute function public.ed_features_touch_update();
alter table public.ed_business_features enable row level security;
-- No select/write policies for customer roles. The API verifies tenant membership
-- with the user's JWT and performs server-side feature operations with service_role.
revoke all on public.ed_business_features from anon,authenticated;
-- Realtime publication is intentionally NOT enabled for entitlement records.

-- Explicitly grant only the backend service account access to this table.
grant select, insert, update, delete on public.ed_business_features to service_role;
