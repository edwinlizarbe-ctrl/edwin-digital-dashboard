-- Google Business Profile: segregated OAuth credentials per business.
-- Apply manually after review. Never enable client-facing access before Google API approval.
create table if not exists public.ed_gbp_connections (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  refresh_token_cipher text not null,
  selected_location text,
  selected_title text,
  updated_at timestamptz not null default now(),
  constraint ed_gbp_location_format check (selected_location is null or selected_location ~ '^locations/[0-9]{1,30}$')
);
create table if not exists public.ed_gbp_oauth_nonces (
  nonce_hash text primary key check (nonce_hash ~ '^[a-f0-9]{64}$'),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);
create index if not exists ed_gbp_nonces_expiry on public.ed_gbp_oauth_nonces(expires_at);
alter table public.ed_gbp_connections enable row level security;
alter table public.ed_gbp_oauth_nonces enable row level security;
revoke all on public.ed_gbp_connections from public, anon, authenticated;
revoke all on public.ed_gbp_oauth_nonces from public, anon, authenticated;
grant select,insert,update,delete on public.ed_gbp_connections to service_role;
grant select,insert,update,delete on public.ed_gbp_oauth_nonces to service_role;
-- Periodically delete expired nonces with a separately authorized maintenance job.