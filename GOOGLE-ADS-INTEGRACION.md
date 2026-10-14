# Google Ads OAuth — implementation plan (development branch)

Status: initial backend, isolated Supabase migration, and customer-facing connector UI implemented in development branch. **Not migrated, not end-to-end tested, and not deployed.**
Target: Edwin CRM multi-tenant Cloudflare Worker + Supabase.

## Existing code verified
- `worker.js` authenticates Supabase users, then dispatches `/api/meta/*` to `meta.js`.
- `public/app.js` displays Google Ads as "Próximamente"; its ads tabs already reserve `google`.
- `feature-access.js` has a `google_ads` entitlement defaulting to false.
- `wrangler.jsonc` routes `/api/*` through Worker.
- Production currently uses `GOOGLE_ADS_CLIENT_ID` and `GOOGLE_ADS_CLIENT_SECRET` stored as Cloudflare secrets according to setup; secrets must never enter source control.
- Google Ads API access is currently **Prueba**, with **Explorador** requested and under review. OAuth app is in Testing, limited to test users.

## Implementation boundaries
1. Keep `main` and deployed Worker untouched until separately authorized and tested.
2. Backend-only authorization code exchange; exact registered callback `/api/google-ads/callback`.
3. Protect OAuth start and callback with signed, one-time, expiring state bound to authenticated user and immutable `business_id`. Reject tampering, replay and cross-tenant access. Preserve session cookie handling and same-origin request protections.
4. Validate business membership via Supabase RLS using the user's JWT; never accept client-supplied `user_id`. Superadministrator account is not a customer business.
5. Refresh tokens are server-side only and encrypted at rest with independently configured key; never expose them in API responses, HTML or client JS. Protect writes in Supabase with service-role server-only plus strict ownership checks.
6. Support account listing, account selection, connection status, disconnect/revoke and read-only GAQL campaign metrics; ensure account IDs belong to authorized Google OAuth identity.
7. Google Ads scope `https://www.googleapis.com/auth/adwords` technically allows edits; expose **read-only backend operations** to clients. Do not implement campaign mutations.
8. Do not enable `google_ads` feature entitlement or show a functional Connect button before working endpoints and migration are verified.
9. Handle Google Ads API access-level restrictions and Google's external OAuth testing/verification separately. No claim that real customer accounts are available before both allow it.
10. Rotate any previously exposed OAuth secret before production deployment and verify the current Cloudflare value is the rotated secret.

## Recommended integration work, in order
- Add Supabase SQL migration for per-business `google_ads_connections` and authorized account selection. Explicit unique constraints and RLS; encrypted refresh token columns inaccessible to browser.
- Add `google-ads.js` Worker module, wired through `worker.js`; endpoints for start, callback, status, accounts, select, report and disconnect.
- Add dashboard UI integration and error/loading states; strictly scope requests to selected business.
- Write focused tests for state replay/cross-tenant, missing secrets, token refresh, account access, GAQL metric mapping, disconnected state.
- Verify locally or in preview Worker, secure review, then request a separate deployment decision.

## Implemented in feature/google-ads-oauth
- `google-ads.js`: authenticated endpoints `/api/google-ads/status`, `/connect`, `/callback`, `/accounts`, `/select`, `/campaigns`, `/disconnect`. Uses official Google Ads API v25 (v22 retired Oct 7, 2026). OAuth refresh tokens encrypted at rest using AES-GCM.
- `worker.js`: backend route dispatch (authenticated Supabase session).
- `migrations/20261014_google_ads_connections.sql`: private connection and one-time OAuth nonce tables with RLS enabled, no anonymous/authenticated SQL access.
- `public/app.js`: Google Ads card in Integraciones, selected account and 30-day campaigns preview, connection status in Campañas Ads.
- `.github/workflows/google-ads-check.yml`: branch syntax validation.

## Remaining release blockers (DO NOT deploy prematurely)
1. Apply the included SQL migration to the intended Supabase project after review. It has **not** been applied automatically.
2. Set `GOOGLE_ADS_ENCRYPTION_KEY` in the Cloudflare Worker as a separate secret: exactly 32 random bytes hex-encoded (64 hexadecimal characters), e.g. generated locally using `openssl rand -hex 32`. Never commit or share its value.
3. Verify the Cloudflare OAuth Client ID/secret is from the currently authorized Google Auth Platform web client; rotate any previously exposed secret.
4. Google OAuth is currently in Testing (authorized test users only). Approval for Google Ads API Explorador production access is still pending. User-facing external rollout must wait until approval and any required consent-screen verification.
5. Run branch syntax checks and OAuth/tenant isolation/integration tests with a test business. Confirm the registered redirect URI equals `https://edwin-digital-dashboard.edwinlizarbe.workers.dev/api/google-ads/callback`.
6. Verify account selection for manager/MCC hierarchies and pagination, campaign metrics/currency/attribution and token refresh/revocation. This is an initial integration, not yet production-complete.
7. Review a PR and separately authorize merge and Cloudflare deployment.
