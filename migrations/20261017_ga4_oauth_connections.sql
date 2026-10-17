-- OAuth GA4, one isolated Google authorization and property per Edwin CRM business.
create table if not exists public.ed_ga4_connections (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  refresh_token_cipher text not null,
  selected_property_id text,
  selected_property_name text,
  updated_at timestamptz not null default now(),
  constraint ed_ga4_property_id_format check (
    selected_property_id is null or selected_property_id ~ '^[0-9]{1,30}$'
  )
);
alter table public.ed_ga4_connections enable row level security;
revoke all on table public.ed_ga4_connections from PUBLIC, anon, authenticated;
grant select,insert,update,delete on table public.ed_ga4_connections to service_role;
create table if not exists public.ed_ga4_oauth_nonces (
  nonce_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  expires_at timestamptz not null,
  constraint ed_ga4_nonce_sha256 check(nonce_hash ~ '^[0-9a-f]{64}$')
);
alter table public.ed_ga4_oauth_nonces enable row level security;
revoke all on table public.ed_ga4_oauth_nonces from PUBLIC, anon, authenticated;
grant select,insert,update,delete on table public.ed_ga4_oauth_nonces to service_role;
create index if not exists ed_ga4_oauth_nonces_expiry_idx on public.ed_ga4_oauth_nonces(expires_at);
-- No anon/authenticated policies: only the verified Cloudflare server accesses tokens.
