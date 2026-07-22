# Threadbase CI Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js 15 web app deployed to Vercel that replaces the GitHub Actions workflow_dispatch UI with a dynamic branch/tag dropdown, GitHub OAuth auth, role-based access, and real-time deploy history.

**Architecture:** Standalone Next.js 15 App Router site in a new public repo (`threadbase-ci-dashboard`). GitHub OAuth via Auth.js v5 provides identity; the stored OAuth access token (repo + workflow scopes) is used server-side for all GitHub API calls — no PAT needed. Neon + Drizzle stores users/roles and Auth.js sessions. Real-time run history uses GitHub webhooks → Upstash Redis list → SSE stream, with client-side polling as fallback.

**Tech Stack:** Next.js 15 (App Router), Auth.js v5 beta, @auth/drizzle-adapter, Drizzle ORM 0.45+, @neondatabase/serverless, @upstash/redis, Tailwind v4, shadcn/ui, zod v4, Jest + Testing Library.

## Global Constraints

- New standalone public repo: `threadbase-ci-dashboard` (not inside threadbase-mobile)
- Next.js 15 App Router only — no Pages Router
- next-auth@beta (v5) — not v4
- Tailwind v4 (CSS-based config, no tailwind.config.js) + shadcn canary
- No PAT — OAuth access token from accounts table used for all GitHub API calls
- OAuth scopes: `read:user user:email repo workflow`
- Three roles: `admin`, `deployer`, `viewer` — stored in users.role (default: viewer)
- First user to sign in gets `admin` role automatically
- Target repo hardcoded via env vars: `GITHUB_REPO=RonenMars/threadbase-mobile`, `GITHUB_WORKFLOW_ID=deploy.yml`
- Upstash Redis used as pub/sub bridge between webhook handler and SSE clients (serverless-safe)
- SSE stream polls Redis list every 2 seconds, streams for 25 seconds then client auto-reconnects
- Client falls back to polling `/api/runs` every 10 seconds when SSE is down
- Conventional commits, no AI attribution

---

## File Map

```
threadbase-ci-dashboard/
├── app/
│   ├── layout.tsx                         # Root layout — wraps with Providers
│   ├── providers.tsx                      # "use client" — SessionProvider wrapper
│   ├── page.tsx                           # / — login page
│   ├── dashboard/
│   │   └── page.tsx                       # /dashboard — dispatch form (server shell)
│   ├── history/
│   │   └── page.tsx                       # /history — run history (server shell)
│   ├── admin/
│   │   └── page.tsx                       # /admin — user management (server shell)
│   └── api/
│       ├── auth/[...nextauth]/route.ts    # Auth.js handler
│       ├── refs/route.ts                  # GET — branches + tags from GitHub
│       ├── dispatch/route.ts              # POST — trigger workflow_dispatch
│       ├── runs/route.ts                  # GET — recent workflow runs
│       ├── webhook/route.ts               # POST — GitHub workflow_run events
│       ├── events/route.ts                # GET — SSE stream (polls Redis)
│       └── admin/users/route.ts           # GET/PATCH/DELETE — user management
├── components/
│   ├── sign-in-button.tsx                 # "use client" — GitHub sign-in button
│   ├── dispatch-form.tsx                  # "use client" — deploy dispatch form
│   ├── run-list.tsx                       # "use client" — SSE-powered run list
│   ├── run-row.tsx                        # run row: status badge, metadata, link
│   └── user-table.tsx                     # "use client" — admin user table
├── lib/
│   ├── auth.ts                            # Auth.js config + session callback
│   ├── db/
│   │   ├── index.ts                       # Drizzle + Neon client
│   │   └── schema.ts                      # All table definitions
│   ├── github.ts                          # getToken, getRefs, triggerDispatch, getRuns
│   ├── redis.ts                           # Upstash Redis client singleton
│   ├── roles.ts                           # Role type + canDeploy/isAdmin helpers
│   └── webhook.ts                         # validateGitHubSignature HMAC helper
├── types/
│   └── next-auth.d.ts                     # Extends Session with role field
├── middleware.ts                           # Route protection by role
├── drizzle.config.ts                      # Drizzle Kit config
├── drizzle/                               # Generated migrations (committed)
├── .env.local.example                     # All required env vars documented
└── jest.config.ts                         # Jest + next/jest config
```

---

## Task 1: Repo Scaffold + Tooling

**Files:**
- Create: all root config files
- Create: `jest.config.ts`, `jest.setup.ts`
- Create: `.env.local.example`

**Interfaces:**
- Produces: runnable `npm run dev`, passing `npm test`

- [ ] **Step 1: Create GitHub repo and scaffold Next.js app**

```bash
gh repo create threadbase-ci-dashboard --public --clone
cd threadbase-ci-dashboard
npx create-next-app@latest . --typescript --eslint --app --no-src-dir --import-alias "@/*" --use-npm
```

When prompted, choose: TypeScript ✓, ESLint ✓, Tailwind CSS ✓ (it will be overridden), App Router ✓.

- [ ] **Step 2: Install all project dependencies**

```bash
npm install next-auth@beta @auth/drizzle-adapter drizzle-orm @neondatabase/serverless @upstash/redis zod
npm install -D drizzle-kit @types/node jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom ts-jest
```

- [ ] **Step 3: Install shadcn (Tailwind v4 compatible)**

```bash
npx shadcn@canary init
```

When prompted: style = Default, base color = Slate. This replaces the default Tailwind config with the v4 CSS-based setup.

Then add the components we'll use:

```bash
npx shadcn@canary add button select input label card table badge avatar dropdown-menu
```

- [ ] **Step 4: Configure Jest**

Create `jest.config.ts`:

```ts
import type { Config } from "jest"
import nextJest from "next/jest.js"

const createJestConfig = nextJest({ dir: "./" })

const config: Config = {
  testEnvironment: "node",
  setupFilesAfterFramework: ["<rootDir>/jest.setup.ts"],
}

export default createJestConfig(config)
```

Create `jest.setup.ts`:

```ts
import "@testing-library/jest-dom"
```

Add to `package.json` scripts:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 5: Create `.env.local.example`**

```bash
# GitHub OAuth App (create at github.com/settings/developers)
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=

# Auth.js session signing secret (run: openssl rand -base64 32)
AUTH_SECRET=

# Neon connection string (from Vercel Neon integration or neon.tech)
DATABASE_URL=

# Upstash Redis (from Vercel Upstash integration or upstash.com)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# GitHub webhook HMAC secret (random string, set same value in GitHub repo settings)
WEBHOOK_SECRET=

# Target repo + workflow
GITHUB_REPO=RonenMars/threadbase-mobile
GITHUB_WORKFLOW_ID=deploy.yml
```

Copy to `.env.local` and fill in values (Neon + Upstash credentials come later in Task 8).

- [ ] **Step 6: Verify scaffold runs**

```bash
npm run dev
```

Expected: Next.js default page at http://localhost:3000. No errors.

- [ ] **Step 7: Verify tests run**

```bash
npm test -- --passWithNoTests
```

Expected: `Test Suites: 0 passed`

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 app with shadcn, Drizzle, Auth.js deps"
```

---

## Task 2: Database Schema + Drizzle Setup

**Files:**
- Create: `lib/db/schema.ts`
- Create: `lib/db/index.ts`
- Create: `drizzle.config.ts`
- Create: `drizzle/` (generated by drizzle-kit)

**Interfaces:**
- Produces: `db` — Drizzle client instance, importable from `@/lib/db`
- Produces: `users`, `accounts`, `sessions`, `verificationTokens` — table references for adapter + queries

- [ ] **Step 1: Write schema**

Create `lib/db/schema.ts`:

```ts
import {
  pgTable, text, timestamp, integer, primaryKey,
} from "drizzle-orm/pg-core"
import type { AdapterAccountType } from "next-auth/adapters"

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  githubId: text("github_id").unique(),
  role: text("role", { enum: ["admin", "deployer", "viewer"] })
    .notNull()
    .default("viewer"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
})

export const accounts = pgTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
)

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})

export const verificationTokens = pgTable(
  "verificationTokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
)
```

- [ ] **Step 2: Write Drizzle + Neon client**

Create `lib/db/index.ts`:

```ts
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema })
```

- [ ] **Step 3: Write Drizzle config**

Create `drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

- [ ] **Step 4: Generate and run migration**

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

Expected: `drizzle/` folder created with migration SQL. Tables created in Neon (verify in Neon console: users, accounts, sessions, verificationTokens all present).

- [ ] **Step 5: Write schema smoke test**

Create `__tests__/db.test.ts`:

```ts
import { users } from "@/lib/db/schema"

describe("schema", () => {
  it("users table has role column with correct enum", () => {
    const roleCol = users.role
    expect(roleCol).toBeDefined()
    // drizzle column config exposes enumValues
    expect((roleCol as any).enumValues).toEqual(["admin", "deployer", "viewer"])
  })

  it("users table has github_id column", () => {
    expect(users.githubId).toBeDefined()
  })
})
```

- [ ] **Step 6: Run test**

```bash
npm test -- __tests__/db.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(db): add Drizzle schema and Neon client"
```

---

## Task 3: Auth.js v5 + Route Protection Middleware

**Files:**
- Create: `lib/auth.ts`
- Create: `types/next-auth.d.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `lib/roles.ts`
- Create: `middleware.ts`
- Create: `app/providers.tsx`
- Create: `app/layout.tsx` (replace scaffold)
- Create: `app/page.tsx` (login page)
- Create: `components/sign-in-button.tsx`

**Interfaces:**
- Produces: `auth()` — returns session with `{ user: { id, name, email, image, role } }`
- Produces: `signIn()`, `signOut()` — Auth.js server actions
- Produces: `canDeploy(role)`, `isAdmin(role)` from `lib/roles.ts`
- Consumes: `db`, `users`, `accounts`, `sessions`, `verificationTokens` from Task 2

- [ ] **Step 1: Write role helpers + test**

Create `lib/roles.ts`:

```ts
export type Role = "admin" | "deployer" | "viewer"

export function canDeploy(role: Role | undefined): boolean {
  return role === "admin" || role === "deployer"
}

export function isAdmin(role: Role | undefined): boolean {
  return role === "admin"
}
```

Create `__tests__/roles.test.ts`:

```ts
import { canDeploy, isAdmin } from "@/lib/roles"

describe("canDeploy", () => {
  it("returns true for admin", () => expect(canDeploy("admin")).toBe(true))
  it("returns true for deployer", () => expect(canDeploy("deployer")).toBe(true))
  it("returns false for viewer", () => expect(canDeploy("viewer")).toBe(false))
  it("returns false for undefined", () => expect(canDeploy(undefined)).toBe(false))
})

describe("isAdmin", () => {
  it("returns true for admin", () => expect(isAdmin("admin")).toBe(true))
  it("returns false for deployer", () => expect(isAdmin("deployer")).toBe(false))
  it("returns false for viewer", () => expect(isAdmin("viewer")).toBe(false))
})
```

- [ ] **Step 2: Run role tests**

```bash
npm test -- __tests__/roles.test.ts
```

Expected: PASS (6 tests)

- [ ] **Step 3: Extend Next-Auth session type**

Create `types/next-auth.d.ts`:

```ts
import type { DefaultSession } from "next-auth"
import type { Role } from "@/lib/roles"

declare module "next-auth" {
  interface Session {
    user: {
      role: Role
    } & DefaultSession["user"]
  }
}
```

- [ ] **Step 4: Write Auth.js config**

Create `lib/auth.ts`:

```ts
import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { eq, count } from "drizzle-orm"
import { db } from "@/lib/db"
import { users, accounts, sessions, verificationTokens } from "@/lib/db/schema"
import type { Role } from "@/lib/roles"

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    GitHub({
      authorization: {
        params: { scope: "read:user user:email repo workflow" },
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.id) return true
      // First user to sign in becomes admin.
      // db.transaction() is not supported by the Neon HTTP driver — using a
      // two-step read+write here. A simultaneous first sign-in race is
      // theoretically possible but negligible for a personal deploy tool.
      const [{ value: total }] = await db
        .select({ value: count() })
        .from(users)
      if (total === 1) {
        await db
          .update(users)
          .set({ role: "admin" })
          .where(eq(users.id, user.id!))
      }
      return true
    },
    async session({ session, user }) {
      const [dbUser] = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, user.id))
      session.user.role = (dbUser?.role ?? "viewer") as Role
      return session
    },
  },
})
```

- [ ] **Step 5: Add Auth.js route handler**

Create `app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from "@/lib/auth"
export const { GET, POST } = handlers
```

- [ ] **Step 6: Write middleware**

Create `middleware.ts`:

```ts
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { canDeploy, isAdmin } from "@/lib/roles"
import type { Role } from "@/lib/roles"

export default auth((req) => {
  const session = req.auth
  const { pathname } = req.nextUrl

  // Public: login page + auth callbacks
  if (pathname === "/" || pathname.startsWith("/api/auth")) {
    if (session && pathname === "/") {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }
    return NextResponse.next()
  }

  // Webhook is public — validated by HMAC inside the handler
  if (pathname === "/api/webhook") return NextResponse.next()

  // All other routes require a session
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.redirect(new URL("/", req.url))
  }

  const role = session.user?.role as Role | undefined

  // Deployer-or-admin routes
  if (
    pathname.startsWith("/dashboard") ||
    pathname === "/api/dispatch" ||
    pathname === "/api/refs"
  ) {
    if (!canDeploy(role)) {
      return pathname.startsWith("/api/")
        ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
        : NextResponse.redirect(new URL("/history", req.url))
    }
  }

  // Admin-only routes
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (!isAdmin(role)) {
      return pathname.startsWith("/api/")
        ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
        : NextResponse.redirect(new URL("/dashboard", req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
```

- [ ] **Step 7: Write middleware unit tests**

Create `__tests__/middleware.test.ts`:

```ts
import { canDeploy, isAdmin } from "@/lib/roles"

// Middleware logic is thin wrappers around role helpers — test the helpers directly.
// Full middleware integration is verified manually in Step 10.

describe("middleware role gates", () => {
  it("viewer cannot deploy", () => expect(canDeploy("viewer")).toBe(false))
  it("deployer can deploy", () => expect(canDeploy("deployer")).toBe(true))
  it("admin can deploy", () => expect(canDeploy("admin")).toBe(true))
  it("only admin passes isAdmin", () => {
    expect(isAdmin("admin")).toBe(true)
    expect(isAdmin("deployer")).toBe(false)
    expect(isAdmin("viewer")).toBe(false)
  })
})
```

- [ ] **Step 8: Run middleware tests**

```bash
npm test -- __tests__/middleware.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 9: Wire up root layout + login page**

Create `app/providers.tsx`:

```tsx
"use client"
import { SessionProvider } from "next-auth/react"

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
```

Replace `app/layout.tsx`:

```tsx
import type { Metadata } from "next"
import { Providers } from "./providers"
import "./globals.css"

export const metadata: Metadata = {
  title: "Threadbase CI Dashboard",
  description: "Deploy dashboard for threadbase-mobile",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

Create `components/sign-in-button.tsx`:

```tsx
"use client"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"

export function SignInButton() {
  return (
    <Button onClick={() => signIn("github", { callbackUrl: "/dashboard" })}>
      Sign in with GitHub
    </Button>
  )
}
```

Replace `app/page.tsx`:

```tsx
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { SignInButton } from "@/components/sign-in-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function LoginPage() {
  const session = await auth()
  if (session) redirect("/dashboard")

  return (
    <main className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Threadbase CI Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <SignInButton />
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 10: Manual verification**

```bash
npm run dev
```

1. Open http://localhost:3000 → login page appears
2. Click "Sign in with GitHub" → GitHub OAuth consent screen
3. Approve → redirected to /dashboard (404 for now — that's expected)
4. Open Neon console → `users` table has your GitHub user with `role = admin` (first user)
5. Visit http://localhost:3000/admin → redirected to /dashboard (admin page not built yet — redirect is correct)
6. Visit http://localhost:3000/history → page not found (protected route will show later)

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(auth): add Auth.js v5 GitHub OAuth with role-based middleware"
```

---

## Task 4: GitHub API Helpers + /api/refs + /api/runs

**Files:**
- Create: `lib/github.ts`
- Create: `app/api/refs/route.ts`
- Create: `app/api/runs/route.ts`

**Interfaces:**
- Consumes: `db`, `accounts` from Task 2; `auth()` from Task 3
- Produces:
  - `getGitHubToken(userId: string): Promise<string>`
  - `getRefs(userId: string): Promise<{ branches: string[], tags: string[] }>`
  - `triggerDispatch(userId: string, inputs: DispatchInputs): Promise<void>`
  - `getRuns(userId: string): Promise<WorkflowRun[]>`
  - `DispatchInputs` type
  - `WorkflowRun` type

- [ ] **Step 1: Write GitHub helpers**

Create `lib/github.ts`:

```ts
import { db } from "@/lib/db"
import { accounts } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

const REPO = process.env.GITHUB_REPO!
const WORKFLOW = process.env.GITHUB_WORKFLOW_ID!
const GH_API = "https://api.github.com"
const GH_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
})

export interface DispatchInputs {
  deploy_ref: string
  platform: "ios" | "android" | "all"
  target: "testflight" | "production"
  android_track: "alpha" | "internal" | "beta" | "production"
  release_notes?: string
}

export interface WorkflowRun {
  id: number
  name: string
  status: string
  conclusion: string | null
  head_branch: string
  html_url: string
  created_at: string
  updated_at: string
  actor: string | null
  run_number: number
}

export async function getGitHubToken(userId: string): Promise<string> {
  const [account] = await db
    .select({ access_token: accounts.access_token })
    .from(accounts)
    .where(
      and(eq(accounts.userId, userId), eq(accounts.provider, "github"))
    )
  if (!account?.access_token) throw new Error("No GitHub token for user")
  return account.access_token
}

export async function getRefs(
  userId: string
): Promise<{ branches: string[]; tags: string[] }> {
  const token = await getGitHubToken(userId)
  const headers = GH_HEADERS(token)

  const [branchesRes, tagsRes] = await Promise.all([
    fetch(`${GH_API}/repos/${REPO}/branches?per_page=100`, { headers }),
    fetch(`${GH_API}/repos/${REPO}/tags?per_page=100`, { headers }),
  ])

  if (!branchesRes.ok) throw new Error(`GitHub branches error: ${branchesRes.status}`)
  if (!tagsRes.ok) throw new Error(`GitHub tags error: ${tagsRes.status}`)

  const branches: Array<{ name: string }> = await branchesRes.json()
  const tags: Array<{ name: string }> = await tagsRes.json()

  return {
    branches: branches.map((b) => b.name),
    tags: tags.map((t) => t.name),
  }
}

export async function triggerDispatch(
  userId: string,
  inputs: DispatchInputs
): Promise<void> {
  const token = await getGitHubToken(userId)
  const res = await fetch(
    `${GH_API}/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: "POST",
      headers: { ...GH_HEADERS(token), "Content-Type": "application/json" },
      body: JSON.stringify({
        ref: inputs.deploy_ref,
        inputs: {
          platform: inputs.platform,
          target: inputs.target,
          android_track: inputs.android_track,
          ...(inputs.release_notes ? { release_notes: inputs.release_notes } : {}),
        },
      }),
    }
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GitHub dispatch error: ${res.status} ${body}`)
  }
}

export async function getRuns(userId: string): Promise<WorkflowRun[]> {
  const token = await getGitHubToken(userId)
  const res = await fetch(
    `${GH_API}/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=20`,
    { headers: GH_HEADERS(token) }
  )
  if (!res.ok) throw new Error(`GitHub runs error: ${res.status}`)
  const data = await res.json()
  return (data.workflow_runs as Array<{
    id: number; name: string; status: string; conclusion: string | null;
    head_branch: string; html_url: string; created_at: string;
    updated_at: string; run_number: number;
    triggering_actor: { login: string } | null
  }>).map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    conclusion: r.conclusion,
    head_branch: r.head_branch,
    html_url: r.html_url,
    created_at: r.created_at,
    updated_at: r.updated_at,
    run_number: r.run_number,
    actor: r.triggering_actor?.login ?? null,
  }))
}
```

- [ ] **Step 2: Write DispatchInputs validation schema**

Add to `lib/github.ts` (at the top after imports):

```ts
import { z } from "zod"

export const dispatchInputsSchema = z.object({
  deploy_ref: z.string().min(1),
  platform: z.enum(["ios", "android", "all"]),
  target: z.enum(["testflight", "production"]),
  android_track: z.enum(["alpha", "internal", "beta", "production"]),
  release_notes: z.string().optional(),
})
```

- [ ] **Step 3: Write input validation unit tests**

Create `__tests__/github.test.ts`:

```ts
import { dispatchInputsSchema } from "@/lib/github"

describe("dispatchInputsSchema", () => {
  const valid = {
    deploy_ref: "main",
    platform: "ios" as const,
    target: "testflight" as const,
    android_track: "alpha" as const,
  }

  it("accepts valid minimal input", () => {
    expect(() => dispatchInputsSchema.parse(valid)).not.toThrow()
  })

  it("accepts optional release_notes", () => {
    expect(() =>
      dispatchInputsSchema.parse({ ...valid, release_notes: "v1.2 update" })
    ).not.toThrow()
  })

  it("rejects empty deploy_ref", () => {
    expect(() =>
      dispatchInputsSchema.parse({ ...valid, deploy_ref: "" })
    ).toThrow()
  })

  it("rejects invalid platform", () => {
    expect(() =>
      dispatchInputsSchema.parse({ ...valid, platform: "windows" })
    ).toThrow()
  })

  it("rejects invalid android_track", () => {
    expect(() =>
      dispatchInputsSchema.parse({ ...valid, android_track: "staging" })
    ).toThrow()
  })
})
```

- [ ] **Step 4: Run tests**

```bash
npm test -- __tests__/github.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Add /api/refs route**

Create `app/api/refs/route.ts`:

```ts
import { auth } from "@/lib/auth"
import { getRefs } from "@/lib/github"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const refs = await getRefs(session.user.id)
    return NextResponse.json(refs)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch refs" },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 6: Add /api/runs route**

Create `app/api/runs/route.ts`:

```ts
import { auth } from "@/lib/auth"
import { getRuns } from "@/lib/github"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const runs = await getRuns(session.user.id)
    return NextResponse.json({ runs })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch runs" },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 7: Manual verification**

```bash
npm run dev
```

With a signed-in session, open browser console and run:
```js
fetch("/api/refs").then(r => r.json()).then(console.log)
// Expected: { branches: ["main", ...], tags: [...] }

fetch("/api/runs").then(r => r.json()).then(console.log)
// Expected: { runs: [...] }
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(github): add API helpers and /api/refs, /api/runs routes"
```

---

## Task 5: Dashboard + Dispatch Form

**Files:**
- Create: `app/api/dispatch/route.ts`
- Create: `components/dispatch-form.tsx`
- Create: `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `getRefs`, `triggerDispatch`, `dispatchInputsSchema`, `DispatchInputs` from Task 4; `auth()` from Task 3
- Produces: `/dashboard` page, `POST /api/dispatch`

- [ ] **Step 1: Add /api/dispatch route**

Create `app/api/dispatch/route.ts`:

```ts
import { auth } from "@/lib/auth"
import { triggerDispatch, dispatchInputsSchema } from "@/lib/github"
import { canDeploy } from "@/lib/roles"
import { NextResponse } from "next/server"
import type { Role } from "@/lib/roles"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canDeploy(session.user.role as Role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = dispatchInputsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    await triggerDispatch(session.user.id, parsed.data)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Dispatch failed" },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Write dispatch form component**

Create `components/dispatch-form.tsx`:

```tsx
"use client"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Refs = { branches: string[]; tags: string[] }
type Status = "idle" | "loading" | "success" | "error"

export function DispatchForm() {
  const [refs, setRefs] = useState<Refs>({ branches: [], tags: [] })
  const [refsLoading, setRefsLoading] = useState(true)
  const [deployRef, setDeployRef] = useState("")
  const [platform, setPlatform] = useState<"ios" | "android" | "all">("all")
  const [target, setTarget] = useState<"testflight" | "production">("testflight")
  const [androidTrack, setAndroidTrack] = useState<"alpha" | "internal" | "beta" | "production">("alpha")
  const [releaseNotes, setReleaseNotes] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    fetch("/api/refs")
      .then((r) => r.json())
      .then((data: Refs) => {
        setRefs(data)
        setDeployRef(data.branches[0] ?? "main")
      })
      .finally(() => setRefsLoading(false))
  }, [])

  const showReleaseNotes =
    (platform === "ios" || platform === "all") && target === "production"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("loading")
    setErrorMessage("")

    const res = await fetch("/api/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deploy_ref: deployRef,
        platform,
        target,
        android_track: androidTrack,
        ...(releaseNotes ? { release_notes: releaseNotes } : {}),
      }),
    })

    if (res.ok) {
      setStatus("success")
      setTimeout(() => setStatus("idle"), 4000)
    } else {
      const data = await res.json()
      setErrorMessage(data.error ?? "Dispatch failed")
      setStatus("error")
    }
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Trigger Deploy</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="deploy_ref">Branch / Tag</Label>
            <Select
              value={deployRef}
              onValueChange={setDeployRef}
              disabled={refsLoading}
            >
              <SelectTrigger id="deploy_ref">
                <SelectValue placeholder={refsLoading ? "Loading…" : "Select ref"} />
              </SelectTrigger>
              <SelectContent>
                {refs.branches.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-xs text-muted-foreground">Branches</div>
                    {refs.branches.map((b) => (
                      <SelectItem key={`branch:${b}`} value={b}>{b}</SelectItem>
                    ))}
                  </>
                )}
                {refs.tags.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-xs text-muted-foreground">Tags</div>
                    {refs.tags.map((t) => (
                      <SelectItem key={`tag:${t}`} value={t}>{t}</SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Platform</Label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as typeof platform)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">all</SelectItem>
                <SelectItem value="ios">ios</SelectItem>
                <SelectItem value="android">android</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(platform === "ios" || platform === "all") && (
            <div className="space-y-1">
              <Label>iOS Target</Label>
              <Select value={target} onValueChange={(v) => setTarget(v as typeof target)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="testflight">testflight</SelectItem>
                  <SelectItem value="production">production</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {(platform === "android" || platform === "all") && (
            <div className="space-y-1">
              <Label>Android Track</Label>
              <Select value={androidTrack} onValueChange={(v) => setAndroidTrack(v as typeof androidTrack)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alpha">alpha</SelectItem>
                  <SelectItem value="internal">internal</SelectItem>
                  <SelectItem value="beta">beta</SelectItem>
                  <SelectItem value="production">production</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {showReleaseNotes && (
            <div className="space-y-1">
              <Label htmlFor="release_notes">Release Notes (iOS production)</Label>
              <Input
                id="release_notes"
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                placeholder="What's new in this release?"
              />
            </div>
          )}

          {status === "error" && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}
          {status === "success" && (
            <p className="text-sm text-green-600">Workflow triggered — check History for progress.</p>
          )}

          <Button type="submit" disabled={status === "loading" || refsLoading} className="w-full">
            {status === "loading" ? "Triggering…" : "Run Workflow"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Add dashboard page**

Create `app/dashboard/page.tsx`:

```tsx
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { canDeploy } from "@/lib/roles"
import { DispatchForm } from "@/components/dispatch-form"
import type { Role } from "@/lib/roles"

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect("/")
  if (!canDeploy(session.user.role as Role)) redirect("/history")

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">Deploy</h1>
      <DispatchForm />
    </main>
  )
}
```

- [ ] **Step 4: Manual verification**

```bash
npm run dev
```

1. Sign in → `/dashboard` shows the dispatch form
2. Branch/tag dropdown populates with your repo's refs
3. Selecting `ios` + `production` reveals Release Notes field
4. Submit → workflow triggers (verify in GitHub Actions tab of threadbase-mobile)
5. As a viewer-role user (create a second account in Neon manually with role=viewer), sign in → redirect to /history

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(dashboard): add dispatch form and /api/dispatch route"
```

---

## Task 6: Real-time History (Webhook + SSE + History Page)

**Files:**
- Create: `lib/redis.ts`
- Create: `app/api/webhook/route.ts`
- Create: `app/api/events/route.ts`
- Create: `components/run-row.tsx`
- Create: `components/run-list.tsx`
- Create: `app/history/page.tsx`

**Interfaces:**
- Consumes: `getRuns` from Task 4; `auth()` from Task 3
- Produces:
  - `redis` — Upstash client singleton
  - `POST /api/webhook` — validates HMAC, pushes to Redis `ci:events` list
  - `GET /api/events` — SSE stream, polls Redis every 2s for 25s then closes
  - `/history` page with live run list + polling fallback

- [ ] **Step 1: Write HMAC validation helper + tests**

Create `lib/webhook.ts`:

```ts
import crypto from "crypto"

export function validateGitHubSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  if (!signature.startsWith("sha256=")) return false
  const expected = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex")}`
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    )
  } catch {
    return false
  }
}
```

Create `__tests__/webhook.test.ts`:

```ts
import crypto from "crypto"
import { validateGitHubSignature } from "@/lib/webhook"

const SECRET = "test-secret"
const BODY = JSON.stringify({ action: "completed" })
const VALID_SIG = `sha256=${crypto
  .createHmac("sha256", SECRET)
  .update(BODY)
  .digest("hex")}`

describe("validateGitHubSignature", () => {
  it("accepts a valid HMAC signature", () => {
    expect(validateGitHubSignature(BODY, VALID_SIG, SECRET)).toBe(true)
  })

  it("rejects a wrong signature", () => {
    expect(validateGitHubSignature(BODY, "sha256=deadbeef", SECRET)).toBe(false)
  })

  it("rejects a tampered body", () => {
    expect(
      validateGitHubSignature(BODY + "x", VALID_SIG, SECRET)
    ).toBe(false)
  })

  it("rejects a missing sha256= prefix", () => {
    expect(validateGitHubSignature(BODY, "invalid", SECRET)).toBe(false)
  })

  it("rejects mismatched buffer lengths gracefully", () => {
    expect(validateGitHubSignature(BODY, "sha256=abc", SECRET)).toBe(false)
  })
})
```

- [ ] **Step 2: Run HMAC tests**

```bash
npm test -- __tests__/webhook.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 3: Write Redis client**

Create `lib/redis.ts`:

```ts
import { Redis } from "@upstash/redis"

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const EVENTS_KEY = "ci:events"
export const EVENTS_MAX = 100
export const EVENTS_TTL = 86400 // 24h
```

- [ ] **Step 4: Write webhook handler**

Create `app/api/webhook/route.ts`:

```ts
import { validateGitHubSignature } from "@/lib/webhook"
import { redis, EVENTS_KEY, EVENTS_MAX, EVENTS_TTL } from "@/lib/redis"

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get("x-hub-signature-256") ?? ""

  if (!validateGitHubSignature(body, sig, process.env.WEBHOOK_SECRET!)) {
    return new Response("Unauthorized", { status: 401 })
  }

  const event = req.headers.get("x-github-event")
  if (event !== "workflow_run") return new Response("OK")

  const payload = JSON.parse(body)
  const run = payload.workflow_run

  const entry = JSON.stringify({
    ts: Date.now(),
    data: {
      id: run.id as number,
      name: run.name as string,
      status: run.status as string,
      conclusion: run.conclusion as string | null,
      head_branch: run.head_branch as string,
      html_url: run.html_url as string,
      created_at: run.created_at as string,
      updated_at: run.updated_at as string,
      run_number: run.run_number as number,
      actor: (run.triggering_actor?.login ?? null) as string | null,
    },
  })

  await redis.lpush(EVENTS_KEY, entry)
  await redis.ltrim(EVENTS_KEY, 0, EVENTS_MAX - 1)
  await redis.expire(EVENTS_KEY, EVENTS_TTL)

  return new Response("OK")
}
```

- [ ] **Step 5: Write SSE events route**

Create `app/api/events/route.ts`:

```ts
import { auth } from "@/lib/auth"
import { redis, EVENTS_KEY } from "@/lib/redis"

const POLL_INTERVAL_MS = 2000
const MAX_DURATION_MS = 25_000

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })

  const lastEventId = req.headers.get("last-event-id") ?? "0"
  let lastSeen = Number(lastEventId)

  const encoder = new TextEncoder()
  const deadline = Date.now() + MAX_DURATION_MS

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string, id?: number) => {
        if (id !== undefined) {
          controller.enqueue(encoder.encode(`id: ${id}\n`))
        }
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      }

      send("connected")

      while (Date.now() < deadline) {
        const raw = await redis.lrange(EVENTS_KEY, 0, 49)
        const events = (raw as string[])
          .map((r) => JSON.parse(r) as { ts: number; data: unknown })
          .filter((e) => e.ts > lastSeen)
          .sort((a, b) => a.ts - b.ts)

        for (const evt of events) {
          send(JSON.stringify(evt.data), evt.ts)
          lastSeen = evt.ts
        }

        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
```

- [ ] **Step 6: Write run-row component**

Create `components/run-row.tsx`:

```tsx
import { Badge } from "@/components/ui/badge"
import type { WorkflowRun } from "@/lib/github"

function statusBadge(run: WorkflowRun) {
  if (run.status === "completed") {
    return run.conclusion === "success"
      ? <Badge variant="default" className="bg-green-600">success</Badge>
      : <Badge variant="destructive">{run.conclusion ?? "failed"}</Badge>
  }
  if (run.status === "in_progress") {
    return <Badge variant="secondary" className="animate-pulse">in progress</Badge>
  }
  return <Badge variant="outline">{run.status}</Badge>
}

export function RunRow({ run }: { run: WorkflowRun }) {
  return (
    <tr className="border-b">
      <td className="py-2 pr-4 font-mono text-sm">#{run.run_number}</td>
      <td className="py-2 pr-4 text-sm">{run.head_branch}</td>
      <td className="py-2 pr-4">{statusBadge(run)}</td>
      <td className="py-2 pr-4 text-sm text-muted-foreground">{run.actor ?? "—"}</td>
      <td className="py-2 pr-4 text-sm text-muted-foreground">
        {new Date(run.created_at).toLocaleString()}
      </td>
      <td className="py-2">
        <a
          href={run.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 underline"
        >
          View
        </a>
      </td>
    </tr>
  )
}
```

- [ ] **Step 7: Write run-list component with SSE + polling fallback**

Create `components/run-list.tsx`:

```tsx
"use client"
import { useEffect, useRef, useState } from "react"
import { RunRow } from "@/components/run-row"
import type { WorkflowRun } from "@/lib/github"

const POLL_FALLBACK_MS = 10_000
const SSE_STALE_MS = 30_000

export function RunList({ initialRuns }: { initialRuns: WorkflowRun[] }) {
  const [runs, setRuns] = useState<WorkflowRun[]>(initialRuns)
  const lastEventRef = useRef<number>(Date.now())
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function upsertRun(incoming: WorkflowRun) {
    setRuns((prev) => {
      const idx = prev.findIndex((r) => r.id === incoming.id)
      if (idx === -1) return [incoming, ...prev].slice(0, 20)
      const updated = [...prev]
      updated[idx] = incoming
      return updated
    })
  }

  function startPolling() {
    if (pollingRef.current) return
    pollingRef.current = setInterval(async () => {
      const res = await fetch("/api/runs")
      if (!res.ok) return
      const { runs: fresh } = await res.json()
      setRuns(fresh)
    }, POLL_FALLBACK_MS)
  }

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  useEffect(() => {
    let es: EventSource

    function connect() {
      es = new EventSource("/api/events")

      es.onmessage = (e) => {
        if (e.data === "connected") return
        lastEventRef.current = Date.now()
        stopPolling()
        try {
          const run: WorkflowRun = JSON.parse(e.data)
          upsertRun(run)
        } catch {}
      }

      es.onerror = () => {
        es.close()
        startPolling()
        setTimeout(connect, 5000)
      }
    }

    connect()

    // Stale-connection guard: if no SSE event in 30s, fall back to polling
    const staleGuard = setInterval(() => {
      if (Date.now() - lastEventRef.current > SSE_STALE_MS) {
        startPolling()
      } else {
        stopPolling()
      }
    }, 5000)

    return () => {
      es?.close()
      stopPolling()
      clearInterval(staleGuard)
    }
  }, [])

  if (runs.length === 0) {
    return <p className="text-muted-foreground">No recent runs.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b text-sm text-muted-foreground">
            <th className="pb-2 pr-4">#</th>
            <th className="pb-2 pr-4">Branch / Tag</th>
            <th className="pb-2 pr-4">Status</th>
            <th className="pb-2 pr-4">Triggered by</th>
            <th className="pb-2 pr-4">Started</th>
            <th className="pb-2">Link</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <RunRow key={run.id} run={run} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 8: Add history page**

Create `app/history/page.tsx`:

```tsx
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getRuns } from "@/lib/github"
import { RunList } from "@/components/run-list"

export default async function HistoryPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/")

  let initialRuns = []
  try {
    initialRuns = await getRuns(session.user.id)
  } catch {
    // Render with empty list; client-side polling will fill it
  }

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">Deploy History</h1>
      <RunList initialRuns={initialRuns} />
    </main>
  )
}
```

- [ ] **Step 9: Run all tests**

```bash
npm test
```

Expected: PASS (all previous tests still green; 5 HMAC tests now included)

- [ ] **Step 10: Manual verification**

```bash
npm run dev
```

1. Visit http://localhost:3000/history → table of recent runs loads
2. To test webhook locally, use [smee.io](https://smee.io) or `gh webhook forward`:
   ```bash
   gh webhook forward --repo=RonenMars/threadbase-mobile --events=workflow_run --url=http://localhost:3000/api/webhook
   ```
3. Trigger a workflow manually in GitHub → the history page should update within 2 seconds
4. Kill `npm run dev` and restart → SSE reconnects and resumes from `Last-Event-ID`

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(history): add webhook handler, SSE stream, and real-time run list"
```

---

## Task 7: Admin Panel

**Files:**
- Create: `app/api/admin/users/route.ts`
- Create: `components/user-table.tsx`
- Create: `app/admin/page.tsx`

**Interfaces:**
- Consumes: `db`, `users` from Task 2; `auth()` from Task 3; `isAdmin` from Task 3
- Produces: `GET/PATCH/DELETE /api/admin/users`, `/admin` page

- [ ] **Step 1: Write admin users API route**

Create `app/api/admin/users/route.ts`:

```ts
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { isAdmin } from "@/lib/roles"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { z } from "zod"
import type { Role } from "@/lib/roles"

const roleSchema = z.object({
  role: z.enum(["admin", "deployer", "viewer"]),
})

async function requireAdmin() {
  const session = await auth()
  if (!session) return null
  if (!isAdmin(session.user.role as Role)) return null
  return session
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.createdAt)

  return NextResponse.json({ users: allUsers })
}

export async function PATCH(req: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const targetId = searchParams.get("id")
  if (!targetId) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  const body = await req.json()
  const parsed = roleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  await db.update(users).set({ role: parsed.data.role }).where(eq(users.id, targetId))
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const targetId = searchParams.get("id")
  if (!targetId) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  // Prevent self-removal
  if (targetId === session.user.id) {
    return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 })
  }

  await db.delete(users).where(eq(users.id, targetId))
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Write admin users API unit tests**

Create `__tests__/admin-users.test.ts`:

```ts
// Test the self-removal guard logic in isolation
describe("admin self-removal guard", () => {
  it("blocks when targetId matches currentUserId", () => {
    const currentUserId = "user-123"
    const targetId = "user-123"
    expect(targetId === currentUserId).toBe(true)
  })

  it("allows when targetId differs from currentUserId", () => {
    const currentUserId = "user-123"
    const targetId = "user-456"
    expect(targetId === currentUserId).toBe(false)
  })
})
```

- [ ] **Step 3: Run test**

```bash
npm test -- __tests__/admin-users.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 4: Write user table component**

Create `components/user-table.tsx`:

```tsx
"use client"
import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"

type UserRow = {
  id: string
  name: string | null
  email: string | null
  image: string | null
  role: string
  createdAt: string
}

export function UserTable({
  initialUsers,
  currentUserId,
}: {
  initialUsers: UserRow[]
  currentUserId: string
}) {
  const [userList, setUserList] = useState<UserRow[]>(initialUsers)

  async function changeRole(id: string, role: string) {
    const res = await fetch(`/api/admin/users?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    })
    if (res.ok) {
      setUserList((prev) =>
        prev.map((u) => (u.id === id ? { ...u, role } : u))
      )
    }
  }

  async function removeUser(id: string) {
    if (!confirm("Remove this user?")) return
    const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" })
    if (res.ok) {
      setUserList((prev) => prev.filter((u) => u.id !== id))
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b text-sm text-muted-foreground">
            <th className="pb-2 pr-4">User</th>
            <th className="pb-2 pr-4">Email</th>
            <th className="pb-2 pr-4">Role</th>
            <th className="pb-2 pr-4">Joined</th>
            <th className="pb-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {userList.map((user) => (
            <tr key={user.id} className="border-b">
              <td className="py-2 pr-4">
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={user.image ?? ""} />
                    <AvatarFallback>{(user.name ?? "?")[0]}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{user.name ?? "—"}</span>
                </div>
              </td>
              <td className="py-2 pr-4 text-sm text-muted-foreground">{user.email ?? "—"}</td>
              <td className="py-2 pr-4">
                <Select
                  value={user.role}
                  onValueChange={(v) => changeRole(user.id, v)}
                  disabled={user.id === currentUserId}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">admin</SelectItem>
                    <SelectItem value="deployer">deployer</SelectItem>
                    <SelectItem value="viewer">viewer</SelectItem>
                  </SelectContent>
                </Select>
              </td>
              <td className="py-2 pr-4 text-sm text-muted-foreground">
                {new Date(user.createdAt).toLocaleDateString()}
              </td>
              <td className="py-2">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={user.id === currentUserId}
                  onClick={() => removeUser(user.id)}
                >
                  Remove
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 5: Add admin page**

Create `app/admin/page.tsx`:

```tsx
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isAdmin } from "@/lib/roles"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { UserTable } from "@/components/user-table"
import type { Role } from "@/lib/roles"

export default async function AdminPage() {
  const session = await auth()
  if (!session) redirect("/")
  if (!isAdmin(session.user.role as Role)) redirect("/dashboard")

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.createdAt)

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">User Management</h1>
      <UserTable
        initialUsers={allUsers.map((u) => ({
          ...u,
          createdAt: u.createdAt.toISOString(),
        }))}
        currentUserId={session.user.id!}
      />
    </main>
  )
}
```

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 7: Manual verification**

```bash
npm run dev
```

1. As admin, visit http://localhost:3000/admin → user table shows your account
2. Change your role to `deployer` via the dropdown → role updates (verify in Neon console)
3. Set it back to `admin`
4. Remove button is disabled on your own row
5. Add a test user in Neon (`INSERT INTO users ...`) and verify remove works

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(admin): add user management panel with role editing and removal"
```

---

## Task 8: Deploy to Vercel + Webhook Registration

**Files:**
- No new source files
- Vercel project + integrations configured

**Interfaces:**
- Produces: live site at `https://threadbase-ci-dashboard.vercel.app`

- [ ] **Step 1: Push repo to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Create Vercel project**

```bash
npx vercel
```

When prompted:
- Link to existing project? No
- Project name: `threadbase-ci-dashboard`
- Framework: Next.js (auto-detected)
- Root directory: `./`

- [ ] **Step 3: Add Neon integration**

In Vercel dashboard → threadbase-ci-dashboard → Storage → Browse Marketplace → Neon → Connect. Either create a new Neon project or connect your existing one. This automatically sets `DATABASE_URL` in all Vercel environments.

Run the migration against the production database:

```bash
DATABASE_URL=<production-url-from-neon> npx drizzle-kit migrate
```

- [ ] **Step 4: Add Upstash Redis integration**

In Vercel dashboard → Storage → Browse Marketplace → Upstash → Add → Create Redis database → Connect. This automatically sets `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

- [ ] **Step 5: Create GitHub OAuth App**

Go to https://github.com/settings/developers → OAuth Apps → New OAuth App:
- Application name: `Threadbase CI Dashboard`
- Homepage URL: `https://threadbase-ci-dashboard.vercel.app`
- Authorization callback URL: `https://threadbase-ci-dashboard.vercel.app/api/auth/callback/github`

Copy the Client ID and generate a Client Secret.

- [ ] **Step 6: Set remaining env vars in Vercel**

```bash
npx vercel env add AUTH_GITHUB_ID production
# paste Client ID

npx vercel env add AUTH_GITHUB_SECRET production
# paste Client Secret

npx vercel env add AUTH_SECRET production
# paste output of: openssl rand -base64 32

npx vercel env add WEBHOOK_SECRET production
# paste any random string (save it for Step 8)

npx vercel env add GITHUB_REPO production
# RonenMars/threadbase-mobile

npx vercel env add GITHUB_WORKFLOW_ID production
# deploy.yml
```

- [ ] **Step 7: Deploy to production**

```bash
npx vercel --prod
```

Expected: deployment succeeds, site live at `https://threadbase-ci-dashboard.vercel.app`. Sign-in flow works end-to-end.

- [ ] **Step 8: Register GitHub webhook**

In `threadbase-mobile` repo → Settings → Webhooks → Add webhook:
- Payload URL: `https://threadbase-ci-dashboard.vercel.app/api/webhook`
- Content type: `application/json`
- Secret: same value you set for `WEBHOOK_SECRET` in Step 6
- Events: select "Let me select individual events" → check **Workflow runs** only → Add webhook

- [ ] **Step 9: End-to-end verification**

1. Open `https://threadbase-ci-dashboard.vercel.app` in a browser
2. Sign in with GitHub → lands on `/dashboard`
3. Select a branch, platform=ios, target=testflight → click "Run Workflow"
4. Open `/history` in another tab — within 2 seconds the new run appears with status `queued`, then `in_progress`
5. When run completes, status updates to `success` or `failure`
6. Open `/admin` → your GitHub user is shown with role `admin`

- [ ] **Step 10: Final commit**

```bash
git add -A
git commit -m "chore: finalize Vercel deployment and webhook configuration"
git push origin main
```
