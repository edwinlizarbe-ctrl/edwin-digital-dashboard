-- One Google Ads OAuth connection per business, entirely server-managed.
-- This migration only adds tables and indexes. It does not change existing CRM tables.
create table if not exists public.ed_google_ads_connections (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  refresh_token_cipher text not null,
  selected_customer_id text,
  selected_login_customer_id text,
  updated_at timestamptz not null default now(),
  constraint google_ads_customer_id_format check (
    selected_customer_id is null or selected_customer_id ~ '^[0-9]{10}$'
  ),
  constraint google_ads_login_customer_id_format check (
    selected_login_customer_id is null or selected_login_customer_id ~ '^[0-9]{10}$'
  ),
  constraint google_ads_login_requires_selection check (
    selected_login_customer_id is null or selected_customer_id is not null
  )
);
alter table public.ed_google_ads_connections enable row level security;
revoke all on table public.ed_google_ads_connections from PUBLIC, anon, authenticated;
grant select, insert, update, delete on table public.ed_google_ads_connections to service_role;

-- Nonces are random state hashes, not OAuth credentials.
create table if not exists public.ed_google_oauth_nonces (
  nonce_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  expires_at timestamptz not null,
  constraint google_oauth_nonce_hash_format check (
    nonce_hash ~ '^[a-f0-9]{64}$'
  )
);
alter table public.ed_google_oauth_nonces enable row level security;
revoke all on table public.ed_google_oauth_nonces from PUBLIC, anon, authenticated;
grant select, insert, update, delete on table public.ed_google_oauth_nonces to service_role;
create index if not exists ed_google_oauth_nonces_expiry_idx
  on public.ed_google_oauth_nonces (expires_at);

-- Intentionally no anonymous or authenticated RLS policies.
-- The Worker authorizes business ownership before making service-role requests.
-- Remove expired nonces with a trusted scheduled maintenance task.
