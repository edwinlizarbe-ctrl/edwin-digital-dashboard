-- Google Ads per-business credentials: server-only, isolated from client API.
create table if not exists public.ed_google_ads_connections (
 business_id uuid primary key references public.businesses(id) on delete cascade,
 user_id uuid not null references auth.users(id),
 refresh_token_cipher text not null,
 selected_customer_id text,
 selected_login_customer_id text,
 updated_at timestamptz not null default now(),
 constraint google_ads_customer_id_format check (selected_customer_id is null or selected_customer_id ~ '^[0-9]{10}
);
alter table public.ed_google_ads_connections enable row level security;
revoke all on public.ed_google_ads_connections from anon, authenticated;
-- Deliberately no browser-accessible RLS policies. Worker service role accesses after membership and feature checks.

create table if not exists public.ed_google_oauth_nonces (
 nonce_hash text primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 business_id uuid not null references public.businesses(id) on delete cascade,
 expires_at timestamptz not null,
 constraint google_oauth_nonce_hash_format check (nonce_hash ~ '^[a-f0-9]{64}$')
);
alter table public.ed_google_oauth_nonces enable row level security;
revoke all on public.ed_google_oauth_nonces from anon, authenticated;
create index if not exists ed_google_oauth_nonces_expiry_idx on public.ed_google_oauth_nonces (expires_at);
-- Periodically delete expired nonce rows using a trusted maintenance job.
),
 constraint google_ads_login_customer_id_format check (selected_login_customer_id is null or selected_login_customer_id ~ '^[0-9]{10}
);
alter table public.ed_google_ads_connections enable row level security;
revoke all on public.ed_google_ads_connections from anon, authenticated;
-- Deliberately no browser-accessible RLS policies. Worker service role accesses after membership and feature checks.

create table if not exists public.ed_google_oauth_nonces (
 nonce_hash text primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 business_id uuid not null references public.businesses(id) on delete cascade,
 expires_at timestamptz not null,
 constraint google_oauth_nonce_hash_format check (nonce_hash ~ '^[a-f0-9]{64}$')
);
alter table public.ed_google_oauth_nonces enable row level security;
revoke all on public.ed_google_oauth_nonces from anon, authenticated;
create index if not exists ed_google_oauth_nonces_expiry_idx on public.ed_google_oauth_nonces (expires_at);
-- Periodically delete expired nonce rows using a trusted maintenance job.
),
 constraint google_ads_login_requires_selection check (selected_login_customer_id is null or selected_customer_id is not null)
);
alter table public.ed_google_ads_connections enable row level security;
revoke all on public.ed_google_ads_connections from anon, authenticated;
-- Deliberately no browser-accessible RLS policies. Worker service role accesses after membership and feature checks.

create table if not exists public.ed_google_oauth_nonces (
 nonce_hash text primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 business_id uuid not null references public.businesses(id) on delete cascade,
 expires_at timestamptz not null,
 constraint google_oauth_nonce_hash_format check (nonce_hash ~ '^[a-f0-9]{64}$')
);
alter table public.ed_google_oauth_nonces enable row level security;
revoke all on public.ed_google_oauth_nonces from anon, authenticated;
create index if not exists ed_google_oauth_nonces_expiry_idx on public.ed_google_oauth_nonces (expires_at);
-- Periodically delete expired nonce rows using a trusted maintenance job.
