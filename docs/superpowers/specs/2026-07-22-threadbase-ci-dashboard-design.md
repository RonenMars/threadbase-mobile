# Threadbase CI Dashboard — Design Spec

**Date:** 2026-07-22
**Repo:** `threadbase-ci-dashboard` (new public GitHub repo, deployed to Vercel)
**Purpose:** A mini-site that replaces the GitHub Actions `workflow_dispatch` UI with a dynamic branch/tag dropdown, GitHub OAuth auth, role-based access, and real-time deploy history.

---

## 1. Context

`threadbase-mobile`'s deploy workflow (`.github/workflows/deploy.yml`) accepts a free-text `deploy_ref` input that GitHub renders as a plain text box — it cannot dynamically populate branches and tags. This dashboard is a standalone web app that calls the same workflow via the GitHub API, providing a proper dropdown and a real-time history panel.

---

## 2. Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Next.js 15 (App Router) | Vercel-native; consistent with ali-sum, shalish |
| Auth | Auth.js v5 + GitHub OAuth provider | Already used across shalish and ali-sum |
| DB adapter | `@auth/drizzle-adapter` | Connects Auth.js session storage to Neon |
| ORM | Drizzle ORM | Already used with Neon in groceries-bot |
| Database | Neon (PostgreSQL serverless) | User/role storage + Auth.js adapter tables |
| UI | Tailwind v4 + shadcn | Used in ali-sum; cleanest combo in existing projects |
| Validation | zod v4 | Universal across all projects |
| Pub/sub | Upstash Redis | Bridges webhook handler → SSE clients across serverless invocations |

---

## 3. GitHub API Credential Strategy

Auth.js requests `repo` + `workflow` OAuth scopes at sign-in. The resulting access token is stored server-side in Neon (in the `accounts` table via the Drizzle adapter). All GitHub API calls (list refs, trigger dispatch, fetch runs) are made from Next.js Server Actions or API routes using this token — never from the browser. No separate PAT is needed.

---

## 4. Pages & Routes

### Pages

| Route | Access | Purpose |
|-------|--------|---------|
| `/` | public | Sign in with GitHub; redirects to `/dashboard` if already authenticated |
| `/dashboard` | deployer, admin | Dispatch form with dynamic branch/tag dropdown |
| `/history` | all roles | Real-time deploy run history |
| `/admin` | admin only | User management (add, remove, change role) |

### API Routes

| Route | Auth | Purpose |
|-------|------|---------|
| `/api/auth/[...nextauth]` | — | Auth.js handler (OAuth callbacks) |
| `/api/refs` | session | Returns branches + tags from GitHub API |
| `/api/dispatch` | deployer, admin | Triggers `workflow_dispatch` via GitHub API |
| `/api/runs` | session | Returns recent workflow runs from GitHub API |
| `/api/webhook` | HMAC only | Receives GitHub `workflow_run` events |
| `/api/events` | session | SSE stream — pushes run updates to the browser |

---

## 5. Database Schema

All four Auth.js adapter tables plus one custom table:

```sql
-- Auth.js required tables (managed by @auth/drizzle-adapter)
users (id, name, email, image, created_at)
accounts (id, user_id, provider, provider_account_id, access_token, token_type, scope)
sessions (id, user_id, session_token, expires)
verification_tokens (identifier, token, expires)

-- Custom extension
ALTER TABLE users ADD COLUMN role text NOT NULL DEFAULT 'viewer'
  CHECK (role IN ('admin', 'deployer', 'viewer'));
ALTER TABLE users ADD COLUMN github_id text UNIQUE;
```

**First-user bootstrap:** the Auth.js `signIn` callback runs a DB transaction — if `COUNT(users) = 0`, the signing-in user is inserted with `role = 'admin'`. All subsequent sign-ins default to `viewer` until an admin promotes them.

---

## 6. Dashboard — Dispatch Form (`/dashboard`)

Fields mirror the workflow's `workflow_dispatch` inputs exactly:

| Field | Type | Source |
|-------|------|--------|
| `deploy_ref` | dropdown | Branches + tags fetched from GitHub API via `/api/refs` on page load |
| `platform` | dropdown | Static: `ios`, `android`, `all` |
| `target` | dropdown | Static: `testflight`, `production` |
| `android_track` | dropdown | Static: `alpha`, `internal`, `beta`, `production` |
| `release_notes` | text input | Free text (iOS production only — shown conditionally) |

On submit, a Server Action POSTs to `/repos/RonenMars/threadbase-mobile/actions/workflows/deploy.yml/dispatches` using the current user's OAuth token from the session.

---

## 7. Real-time History (`/history`)

### Primary path — GitHub Webhook → SSE

```
GitHub Actions run event (queued / in_progress / completed)
  → POST /api/webhook
  → Validate HMAC (X-Hub-Signature-256 vs WEBHOOK_SECRET env var)
  → Broadcast JSON payload to all open SSE connections
  → Browser updates run row in-place
```

**Why a pub/sub layer is needed:** Vercel serverless functions are isolated per invocation — the webhook handler and the SSE client run in separate instances and cannot share in-memory state. An Upstash Redis channel bridges them.

**Flow:**
- `/api/webhook` receives the event, validates HMAC, publishes to an Upstash Redis channel (`ci:run-events`)
- `/api/events` subscribes to that channel and streams incoming messages to the browser as SSE

Upstash Redis is available as a one-click Vercel marketplace integration (free tier is sufficient for a personal deploy tool).

### Fallback path — client polling

The browser polls `/api/runs` every 10 seconds when:
- The SSE connection errors or closes, or
- No SSE event has arrived within 30 seconds (stale-connection guard)

Polling stops automatically when SSE reconnects.

### What each role sees

| Element | admin | deployer | viewer |
|---------|-------|----------|--------|
| Run list (branch, platform, status, triggered-by, timestamp, link) | ✓ | ✓ | ✓ |
| Re-trigger button | ✓ | ✓ | — |

### Webhook setup (one-time, manual)

In `threadbase-mobile` → Settings → Webhooks:
- URL: `https://threadbase-ci-dashboard.vercel.app/api/webhook`
- Content type: `application/json`
- Secret: random string stored as `WEBHOOK_SECRET` on Vercel
- Event: `Workflow runs` only

---

## 8. Admin Panel (`/admin`)

A simple table of all users showing: GitHub avatar, username, email, role, joined date. Admins can:
- Change any user's role via an inline dropdown
- Remove a user (revokes dashboard access; does not affect their GitHub account)

Admins cannot remove themselves (UI disables the action for the current user's row).

---

## 9. Security

### Route protection — Next.js middleware

`middleware.ts` runs on every request and enforces role gates before rendering:

```
/dashboard          → role: deployer | admin   → else /
/history            → any authenticated user   → else /
/admin              → role: admin              → else /dashboard
/api/dispatch       → role: deployer | admin   → else 403
/api/events         → any authenticated user   → else 401
/api/refs           → any authenticated user   → else 401
/api/runs           → any authenticated user   → else 401
/api/webhook        → public, HMAC-validated   → invalid sig → 401
```

### Webhook HMAC validation

Every `POST /api/webhook` validates `X-Hub-Signature-256` against `WEBHOOK_SECRET` using `crypto.timingSafeEqual` before reading the body. Invalid signatures return 401 immediately.

### Token handling

OAuth access tokens never leave the server. The browser holds only the Auth.js session cookie. Server Actions and API routes retrieve the token from the `accounts` table on each call.

### Admin bootstrapping race condition

The "first user → admin" logic runs inside a Drizzle transaction with a `SELECT COUNT` + conditional `INSERT`. Concurrent first sign-ins cannot both win the admin seat.

---

## 10. Environment Variables

| Variable | Where set | Purpose |
|----------|-----------|---------|
| `AUTH_GITHUB_ID` | Vercel | GitHub OAuth App client ID |
| `AUTH_GITHUB_SECRET` | Vercel | GitHub OAuth App client secret |
| `AUTH_SECRET` | Vercel | Auth.js session signing secret |
| `DATABASE_URL` | Vercel (from Neon integration) | Neon connection string |
| `WEBHOOK_SECRET` | Vercel | GitHub webhook HMAC secret |
| `UPSTASH_REDIS_REST_URL` | Vercel (from Upstash integration) | Redis pub/sub endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel (from Upstash integration) | Redis auth token |
| `GITHUB_REPO` | Vercel | `RonenMars/threadbase-mobile` |
| `GITHUB_WORKFLOW_ID` | Vercel | `deploy.yml` |

---

## 11. Out of Scope

- Deploy logs / console output (GitHub UI handles this via the run link)
- Notifications (Slack, email) on run completion
- Multiple target repos (single repo hardcoded via env vars)
- Mobile-specific styling (desktop-first, used by developers only)
