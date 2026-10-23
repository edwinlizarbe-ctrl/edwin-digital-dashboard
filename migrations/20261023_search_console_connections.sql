-- Google Search Console OAuth (read-only), isolated per Edwin CRM business. Independent from GA4.
create table if not exists public.ed_search_console_connections (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  refresh_token_cipher text not null,
  selected_site_url text,
  updated_at timestamptz not null default now(),
  constraint ed_sc_site_format check (
    selected_site_url is null or selected_site_url ~* '^(sc-domain:[a-z0-9.-]{1,250}|https?://[^[:space:]]{1,300})$'
  )
);
alter table public.ed_search_console_connections enable row level security;
revoke all on table public.ed_search_console_connections from PUBLIC, anon, authenticated;
grant select,insert,update,delete on table public.ed_search_console_connections to service_role;
create table if not exists public.ed_search_console_oauth_nonces (
  nonce_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  expires_at timestamptz not null,
  constraint ed_sc_nonce_sha256 check(nonce_hash ~ '^[0-9a-f]{64}$')
);
alter table public.ed_search_console_oauth_nonces enable row level security;
revoke all on table public.ed_search_console_oauth_nonces from PUBLIC, anon, authenticated;
grant select,insert,update,delete on table public.ed_search_console_oauth_nonces to service_role;
create index if not exists ed_sc_oauth_nonces_expiry_idx on public.ed_search_console_oauth_nonces(expires_at);
-- No anon/authenticated policies: only the verified Cloudflare server accesses tokens.
