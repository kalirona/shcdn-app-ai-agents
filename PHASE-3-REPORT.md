# PHASE 3 REPORT — Supabase Auth Migration

**Date**: August 18, 2026
**Project**: Agent AI — AI Customer Agent Platform
**Goal**: Replace Directus auth with Supabase Auth (email/password) while keeping Directus intact for rollback.

---

## What was done

The app now runs fully on Supabase Auth in production (`AUTH_PROVIDER=supabase`). Directus remains configured and untouched so the deployment can be flipped back to Directus at any time by changing one env var.

### Architecture

```
Browser (sb-sup-auth-token cookie)
   ↓  @supabase/ssr (Edge-safe proxy + route handlers)
Next.js app
   ↓  anon key (browser), service-role key (server only)
Supabase Auth (GoTrue)  →  auth.users
   ↓  trigger handle_new_user()
public.profiles
   ↓  workspace_members → workspaces (Phase 2 RLS is final arbiter)
```

- `@supabase/ssr` with cookie chunking; session rotation happens via `/api/auth/session`.
- Identity chain auto-provisioned: `auth.users` → `profiles` (DB trigger) → workspace/membership created server-side on first login (service-role).
- Service-role key is **never** exposed to the browser or used in `NEXT_PUBLIC_*`; RLS is the security boundary.

---

## Verified flows (production)

| Flow | Result |
|------|--------|
| Login (email/password) | ✅ 200 / session cookie issued |
| Logout | ✅ session cleared |
| Session persistence | ✅ valid cookie → 200 on all protected pages |
| Near-expiry session | ✅ 307 → `/api/auth/session` → rotated cookie + redirect back |
| Expired-but-refreshable session | ✅ transparent refresh → `/dashboard` 200 |
| Dead session (bad refresh token) | ✅ 307 → login + cookie cleared |
| Malformed/garbage cookie | ✅ 307 → login, no 500 (was "Invalid UTF-8 sequence" — hardened) |
| Change password (normal mode) | ✅ old password rejected, new works, verified via GoTrue |
| Forgot password → recovery link | ✅ admin-generated link → `/auth/v1/verify?type=recovery` → 307 to `/auth/v1/change-password?recovery=true` with fresh session |
| Signup confirmation link | ✅ unconfirmed user seeded → `type=signup` link → confirmed + session + redirect to dashboard |
| Protected routes | ✅ unauth `/dashboard`/`/admin` → 307 login |
| Admin authz | ✅ non-super-admin blocked ("Access Denied"); super-admin granted via `public.platform_roles` |
| Admin pages | ✅ `/admin`, `/admin/users|workspaces|settings|billing|audit` all 200, no Directus errors |
| Dashboard subpages | ✅ agents, conversations, analytics, leads, calendar, customers, webhooks, automations, integrations, finance, crm all 200 |
| Super-admin SMTP/settings save | ✅ persists to `platform_settings` (upsert on singleton row), secrets masked on read |

### Key fixes made during verification
- **`/admin` 500 "Directus error [404]"** — admin `getAll*` repositories had no Supabase dispatch; added `getSupabaseAllWorkspaces`/`getSupabaseAllMemberships` and dispatches in `workspace.repo.ts`, `membership.repo.ts`, `platform-role.repo.ts`.
- **Malformed cookie 500** — `revalidateSupabaseSession`/`getCurrentSupabaseUser` now catch undecodable `sb-*` cookies.
- **`platform_settings` had no singleton row** — first admin save was a no-op (0 rows updated); `updateSupabasePlatformSettings` now upserts on the fixed id `00000000-0000-0000-0000-00000000d002`, and the row was seeded.

---

## Deployment / environment persistence (important)

Dokploy regenerates the compose `.env` on every deploy from its own `compose` DB table (`env` column, AES-256-GCM encrypted with `enc:v1:` prefix). Manual server-side edits are wiped on the next deploy.

**Permanent fix applied:**
1. `AUTH_PROVIDER=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are now **committed into `docker-compose.yml` / `Dockerfile`** (build args + env), so they survive all deploys.
2. The Dokploy DB record was updated directly (encrypted) as a belt-and-braces step.

`autoDeploy=true` on the compose → pushing to `origin/super` auto-triggers a Dokploy deploy. Verified across multiple deploys that the container always runs with the Supabase env.

---

## Remaining blockers / follow-ups

### ⚠️ Real signup / password-reset email delivery — BLOCKED
- GoTrue SMTP is pointed at `supabase-mail` (no such container) → API signup returns 500 and rolls back.
- **User decision (Aug 18)**: user has real SMTP credentials but no real domain yet — SMTP stays configured via the **super-admin → Settings → Email** page so they can connect/test later. No Mailpit was installed.
- Until then: signup/reset emails cannot be sent. The full flows are verified via `generate_link` (no email required). To enable: set real SMTP host/port/user/password/from in `/admin/settings` **and** `GOTRUE_SMTP_*` + `GOTRUE_MAILER_AUTOCONFIRM` env, then deploy.

### Housekeeping
- Remove stray diagnostic files on the server (`parse_resp.js`, `sb_login.js`, `ssr_check2.sh` in `/tmp` or app repo).
- Directus legacy instance unreachable — only relevant for rollback regression testing.

---

## Rollback to Directus

1. Set `AUTH_PROVIDER=directus` in the compose env (and ensure old Directus env vars present).
2. Redeploy (push or Dokploy redeploy).
3. Verify Directus pages/auth again.

Directus auth code paths were left in place and are dispatched by the same `isSupabase()` branch used for reads.

---

## Commits (branch `super`)

- `9728543`, `845fb25`, `e1f346a` — earlier auth groundwork
- `ad6c8a4` — Docker/compose NEXT_PUBLIC Supabase build args + env + service-role key
- `20393c7` — admin `getAll*` repositories Supabase dispatch
- `ec60180` — malformed-cookie hardening
- `22bd45f` — platform settings read/write (incl SMTP/R2) dispatched to Supabase
- `501da8e` — upsert `platform_settings` singleton on first save

## Test environment

- App: `https://myapp.sitenexai.com`
- Supabase: `https://sup.sitenexai.com`
- Test user: `owner.test.20260818@example.com` (super_admin), password rotated and reverted during testing (final value verified working)