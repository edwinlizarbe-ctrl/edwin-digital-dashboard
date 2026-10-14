# Google Ads OAuth — implementation plan (development branch)

Status: design prepared; **not implemented, not deployed**.
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
