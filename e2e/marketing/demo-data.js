'use strict'

// Demo corpus for the marketing capture flows (e2e/marketing/*.yaml).
//
// Three streamers, one per port, each with its own machine name, live sessions
// and history — the app pairs all three, so every machine label it draws comes
// from a server it genuinely believes is separate.
//
// Timestamps are minutes before server start, not fixed dates: a fixed date
// drifts into the hub's collapsed "Earlier" bucket and the rows the flows wait
// for stop rendering.

const NOW = Date.now()
const ago = (minutes) => new Date(NOW - minutes * 60_000).toISOString()

const STREAMER = '/code/threadbase-streamer'
const MOBILE = '/code/threadbase-mobile'
const DASHBOARD = '/code/demo-dashboard'

// [role, text] pairs, spaced one minute apart ending at `endedMinutesAgo`.
function transcript(endedMinutesAgo, turns) {
  return turns.map(([role, text], i) => ({
    uuid: `m-${i}`,
    role,
    message_index: i,
    timestamp: ago(endedMinutesAgo + (turns.length - 1 - i)),
    text,
    content: [{ type: 'text', text }],
  }))
}

function conversation({ id, title, projectPath, branch, provider, endedMinutesAgo, turns }) {
  return {
    id,
    title,
    projectPath,
    branch,
    provider,
    lastActivity: ago(endedMinutesAgo),
    messages: transcript(endedMinutesAgo, turns),
  }
}

function session({ id, provider, status, projectPath, branch, sessionName, lastOutput, startedMinutesAgo, promptCount, conversationId, extra }) {
  return {
    id,
    provider,
    status,
    subStatus: null,
    ptyAttached: true,
    lifecycle: 'attached',
    ownership: 'managed',
    projectPath,
    projectName: projectPath.split('/').pop(),
    branch,
    sessionName,
    lastOutput,
    elapsedMs: startedMinutesAgo * 60_000,
    promptCount,
    messageCount: promptCount * 2,
    startedAt: ago(startedMinutesAgo),
    lastActivityAt: ago(1),
    statusUpdatedAt: ago(1),
    conversationId,
    ...extra,
  }
}

const MACHINES = {
  7071: {
    machineName: 'Work Mac',
    platform: 'darwin',
    sessions: [
      // Started with a bare `claude` in a terminal, so the streamer discovered
      // it rather than spawning it.
      session({
        id: 'wm-claude-persistence',
        provider: 'claude-code',
        status: 'running',
        projectPath: STREAMER,
        branch: 'main',
        sessionName: 'Summarize session persistence',
        lastOutput: 'Reading src/sessions/store.ts',
        startedMinutesAgo: 4,
        promptCount: 1,
        conversationId: 'conv-wm-persistence',
        extra: { ownership: 'external', pid: 48211, processLiveness: 'alive', model: 'Opus 5.5' },
      }),
      session({
        id: 'wm-codex-auth',
        provider: 'codex-cli',
        status: 'waiting_input',
        projectPath: MOBILE,
        branch: 'fix/auth-callback',
        sessionName: 'Fix authentication callback',
        lastOutput: 'Two options for the callback fix — which should I take?',
        startedMinutesAgo: 22,
        promptCount: 3,
        conversationId: 'conv-wm-auth-callback',
      }),
    ],
    terminal: {
      'wm-claude-persistence': [
        '❯ Inspect this repository and summarize how session persistence works. Do not modify files.',
        '',
        '⏺ I will trace how a session is written, reloaded and resumed.',
        '',
        '  Read src/sessions/store.ts',
        '  Read src/sessions/rehydrate.ts',
        '  Read src/db/schema.sql',
        '',
        '⏺ Session persistence, in three parts:',
        '',
        '  1. Every session row lives in SQLite (sessions table), written on',
        '     spawn and on each status change.',
        '  2. On startup the streamer rehydrates rows whose process is gone',
        '     as idle stubs, so history survives a restart.',
        '  3. Resume re-attaches by conversation id — the transcript on disk',
        '     is the source of truth, not the row.',
      ],
      'wm-codex-auth': [
        '› Fix the authentication callback so it works on every environment.',
        '',
        '• The callback URL is hard-coded to the production host, so local and',
        '  staging logins bounce back to the wrong origin.',
        '',
        '• Two ways to fix it:',
        '',
        '  1. Derive the callback from the request origin (recommended)',
        '  2. Add one allow-listed callback per environment',
        '',
        '• Which approach should I take?',
      ],
    },
    conversations: [
      conversation({
        id: 'conv-wm-persistence',
        title: 'Summarize session persistence',
        projectPath: STREAMER,
        branch: 'main',
        provider: 'claude-code',
        endedMinutesAgo: 2,
        turns: [
          ['user', 'Inspect this repository and summarize how session persistence works. Do not modify files.'],
          ['assistant', 'Session persistence has three parts.\n\n1. Every session row lives in SQLite, written on spawn and on each status change.\n2. On startup the streamer rehydrates rows whose process is gone as idle stubs, so history survives a restart.\n3. Resume re-attaches by conversation id — the transcript on disk is the source of truth, not the row.'],
        ],
      }),
      conversation({
        id: 'conv-wm-auth-callback',
        title: 'Fix authentication callback',
        projectPath: MOBILE,
        branch: 'fix/auth-callback',
        provider: 'codex-cli',
        endedMinutesAgo: 6,
        turns: [
          ['user', 'Fix the authentication callback so it works on every environment.'],
          ['assistant', 'The callback URL is hard-coded to the production host, so local and staging logins bounce back to the wrong origin.\n\nTwo ways to fix it:\n\n1. Derive the callback from the request origin (recommended)\n2. Add one allow-listed callback per environment\n\nWhich approach should I take?'],
        ],
      }),
      conversation({
        id: 'conv-wm-auth0',
        title: 'Auth0 login fails on localhost',
        projectPath: MOBILE,
        branch: 'fix/auth0-callback',
        provider: 'claude-code',
        endedMinutesAgo: 60 * 26,
        turns: [
          ['user', 'Auth0 login works in production but the localhost callback fails with "Callback URL mismatch". We have multiple environments — local, staging and production — and I do not want three separate Auth0 apps.'],
          ['assistant', 'The Auth0 application only lists the production callback, so the localhost callback is rejected before your code runs.\n\nKeep one Auth0 app and list one callback per environment under Allowed Callback URLs:\n\n- http://localhost:8081/callback\n- https://staging.example.dev/callback\n- https://app.example.dev/callback\n\nThen read the callback from config instead of hard-coding it, so multiple environments share the same code path.'],
          ['user', 'Do the logout URLs need the same treatment?'],
          ['assistant', 'Yes. Allowed Logout URLs is a separate list with the same rule: one entry per environment. Missing it is why logout on localhost lands on the Auth0 error page.'],
        ],
      }),
      conversation({
        id: 'conv-wm-auth-retry',
        title: 'Retry authentication after a dropped token refresh',
        projectPath: MOBILE,
        branch: 'feat/auth-retry',
        provider: 'codex-cli',
        endedMinutesAgo: 60 * 50,
        turns: [
          ['user', 'When the token refresh request drops on a flaky network the app signs the user out. Add an authentication retry instead.'],
          ['assistant', 'Added an authentication retry around the refresh call: three attempts with exponential backoff, and sign-out only on a 401. A dropped connection now retries silently instead of ending the session.'],
        ],
      }),
    ],
  },

  7072: {
    machineName: 'Home Mac',
    platform: 'darwin',
    sessions: [],
    terminal: {},
    conversations: [
      conversation({
        id: 'conv-hm-onboarding',
        title: 'Review mobile onboarding',
        projectPath: MOBILE,
        branch: 'review/onboarding',
        provider: 'claude-code',
        endedMinutesAgo: 40,
        turns: [
          ['user', 'Review the mobile onboarding flow and list anything confusing.'],
          ['assistant', 'Review complete. Three suggestions for onboarding:\n\n1. The pairing step never says the code expires — add a countdown and an authentication retry.\n2. "Not now" on notifications should explain what is lost.\n3. The final step can link straight to the first live session.'],
        ],
      }),
      conversation({
        id: 'conv-hm-sqlite',
        title: 'Keep sessions alive across a streamer restart',
        projectPath: STREAMER,
        branch: 'feat/session-persistence',
        provider: 'claude-code',
        endedMinutesAgo: 60 * 30,
        turns: [
          ['user', 'Sessions vanish whenever the streamer restarts. I want session persistence so a phone can still resume them.'],
          ['assistant', 'Decision: store session persistence in SQLite rather than a JSON file.\n\n- One sessions table, written on spawn and on every status change.\n- On startup, rows whose process is gone come back as idle stubs.\n- Resume re-attaches by conversation id, so the transcript stays the source of truth.\n\nSQLite gives atomic writes, which the JSON file could not: a crash mid-write used to lose every session.'],
          ['user', 'What happens to a session that was mid-turn when the streamer stopped?'],
          ['assistant', 'It is rehydrated as idle with interruptedStatus set, so the app can say it was interrupted and offer resume instead of showing it as finished.'],
        ],
      }),
      conversation({
        id: 'conv-hm-auth-retry',
        title: 'Pairing handshake gives up too early',
        projectPath: STREAMER,
        branch: 'fix/pair-retry',
        provider: 'claude-code',
        endedMinutesAgo: 60 * 54,
        turns: [
          ['user', 'The pairing handshake fails once and never tries again. Should authentication retry here?'],
          ['assistant', 'Only for transient failures. I added an authentication retry for timeouts and 5xx replies, capped at three attempts. A rejected key is permanent, so that case surfaces immediately instead of looping.'],
        ],
      }),
    ],
  },

  7073: {
    machineName: 'Linux Devbox',
    platform: 'linux',
    sessions: [
      session({
        id: 'ld-codex-search',
        provider: 'codex-cli',
        status: 'running',
        projectPath: STREAMER,
        branch: 'feat/search-ranking',
        sessionName: 'Improve session search',
        lastOutput: 'Running search ranking benchmarks',
        startedMinutesAgo: 12,
        promptCount: 2,
        conversationId: 'conv-ld-search',
      }),
    ],
    terminal: {
      'ld-codex-search': [
        '› Improve session search so exact phrase matches rank first.',
        '',
        '• Search currently ranks by recency only. Adding a phrase-match',
        '  boost ahead of the recency sort.',
        '',
        '• Edited src/search/rank.ts',
        '• Running search ranking benchmarks',
        '',
        '  phrase-match   412 queries   p95 18ms',
        '  recency-only   412 queries   p95 17ms',
      ],
    },
    conversations: [
      conversation({
        id: 'conv-ld-search',
        title: 'Improve session search',
        projectPath: STREAMER,
        branch: 'feat/search-ranking',
        provider: 'codex-cli',
        endedMinutesAgo: 3,
        turns: [
          ['user', 'Improve session search so exact phrase matches rank first.'],
          ['assistant', 'Search currently ranks by recency only. I am adding a phrase-match boost ahead of the recency sort and running the ranking benchmarks.'],
        ],
      }),
      conversation({
        id: 'conv-ld-dashboard',
        title: 'Speed up the usage chart',
        projectPath: DASHBOARD,
        branch: 'perf/usage-chart',
        provider: 'claude-code',
        endedMinutesAgo: 60 * 28,
        turns: [
          ['user', 'The usage chart on the dashboard stutters when the date range is a full year.'],
          ['assistant', 'The chart re-renders every point on hover. I bucketed the series by week past 90 days and memoised the scale, which takes a year range from 14 fps to a steady 60.'],
        ],
      }),
      conversation({
        id: 'conv-ld-onboarding',
        title: 'Add an onboarding checklist to the dashboard',
        projectPath: DASHBOARD,
        branch: 'feat/onboarding-checklist',
        provider: 'codex-cli',
        endedMinutesAgo: 60 * 52,
        turns: [
          ['user', 'New accounts land on an empty dashboard. Add an onboarding checklist.'],
          ['assistant', 'Added an onboarding checklist card with three steps — connect a source, invite a teammate, create a chart. It hides itself once all three are done.'],
        ],
      }),
    ],
  },
}

// Hero video profile (DEMO_PROFILE=hero): one agent per machine — a Claude
// session blocked on a permission gate, a Codex session working, a Copilot
// session working — so the hub reads Claude / Codex / Copilot at a glance.
const ACME_API = '/code/acme-api'
const ACME_WEB = '/code/acme-web'
const INFRA = '/code/infra'
const ACME_DIRECTORIES = [{ name: 'acme-api' }, { name: 'acme-web' }, { name: 'infra' }]
const ALL_PROVIDERS = ['claude-code', 'codex-cli', 'copilot']

const HERO_MACHINES = {
  7071: {
    machineName: 'Work Mac',
    platform: 'darwin',
    providers: ALL_PROVIDERS,
    directories: ACME_DIRECTORIES,
    sessions: [
      session({
        id: 'wm-claude-auth',
        provider: 'claude-code',
        status: 'waiting_input',
        projectPath: ACME_API,
        branch: 'fix/auth-callback',
        sessionName: 'Fix authentication callback',
        lastOutput: 'Do you want to proceed? Bash(npm test)',
        startedMinutesAgo: 9,
        promptCount: 1,
        conversationId: 'conv-wm-auth',
        extra: { statusSource: 'turn-signal', model: 'Opus 5.5' },
      }),
    ],
    // The gate the Claude session is blocked on. Sent as a `permission` frame
    // when the session is subscribed; answering it resumes the turn with
    // `answeredLines`.
    gate: {
      sessionId: 'wm-claude-auth',
      permission: {
        prompt: 'Do you want to proceed?',
        detail: 'Bash command\nnpm test\nRun the test suite',
        options: [
          { index: 1, label: 'Yes' },
          { index: 2, label: "Yes, and don't ask again for similar commands in acme-api" },
          { index: 3, label: 'No, and tell Claude what to do differently (esc)' },
        ],
        contentKey: 'bash:npm test',
        gateId: 'gate-npm-test',
      },
      answeredLines: ['  Bash(npm test)', '  ✓ 42 tests passed (3.1s)', '  Read tests/callback.spec.ts'],
    },
    inputReply: ['⏺ Adding tests for the callback.', '', '  Read tests/callback.spec.ts', '  Edit tests/callback.spec.ts'],
    terminal: {
      'wm-claude-auth': [
        '❯ Fix the authentication callback so it works on every environment.',
        '',
        '⏺ The callback URL is hard-coded to the production host, so local and',
        '  staging logins bounce back to the wrong origin.',
        '',
        '  Read src/auth/callback.ts',
        '  Edit src/auth/callback.ts',
        '',
        '⏺ Derived the callback from the request origin. Running the suite',
        '  before touching the tests.',
      ],
    },
    conversations: [
      conversation({
        id: 'conv-wm-auth',
        title: 'Fix authentication callback',
        projectPath: ACME_API,
        branch: 'fix/auth-callback',
        provider: 'claude-code',
        endedMinutesAgo: 3,
        turns: [
          ['user', 'Fix the authentication callback so it works on every environment.'],
          ['assistant', 'The callback URL is hard-coded to the production host, so local and staging logins bounce back to the wrong origin. I derived the callback from the request origin and am running the suite before touching the tests.'],
        ],
      }),
      conversation({
        id: 'conv-wm-sessions',
        title: 'Expire idle sessions',
        projectPath: ACME_API,
        branch: 'feat/session-expiry',
        provider: 'claude-code',
        endedMinutesAgo: 60 * 27,
        turns: [
          ['user', 'Sessions never expire. Add an idle timeout of 30 minutes.'],
          ['assistant', 'Added a 30-minute idle timeout: the session store stamps lastSeen on every request and a sweeper drops rows past the limit. Existing sessions pick it up on their next request.'],
        ],
      }),
    ],
  },

  7072: {
    machineName: 'Home Mac',
    platform: 'darwin',
    providers: ALL_PROVIDERS,
    directories: ACME_DIRECTORIES,
    sessions: [
      session({
        id: 'hm-codex-webhooks',
        provider: 'codex-cli',
        status: 'running',
        projectPath: ACME_WEB,
        branch: 'feat/webhooks',
        sessionName: 'Migrate billing webhooks',
        lastOutput: 'Rewriting the Stripe webhook handler',
        startedMinutesAgo: 14,
        promptCount: 2,
        conversationId: 'conv-hm-webhooks',
      }),
    ],
    terminal: {
      'hm-codex-webhooks': [
        '› Migrate the billing webhooks to the new Stripe event format.',
        '',
        '• Three handlers still read the legacy payload shape. Migrating them',
        '  one event type at a time.',
        '',
        '• Edited src/billing/webhooks/invoice.ts',
        '• Edited src/billing/webhooks/subscription.ts',
        '• Rewriting the Stripe webhook handler',
      ],
    },
    conversations: [
      conversation({
        id: 'conv-hm-webhooks',
        title: 'Migrate billing webhooks',
        projectPath: ACME_WEB,
        branch: 'feat/webhooks',
        provider: 'codex-cli',
        endedMinutesAgo: 2,
        turns: [
          ['user', 'Migrate the billing webhooks to the new Stripe event format.'],
          ['assistant', 'Three handlers still read the legacy payload shape. I am migrating them one event type at a time, starting with invoices and subscriptions.'],
        ],
      }),
      conversation({
        id: 'conv-hm-checkout',
        title: 'Fix the checkout double-submit',
        projectPath: ACME_WEB,
        branch: 'fix/checkout-double-submit',
        provider: 'claude-code',
        endedMinutesAgo: 60 * 5,
        turns: [
          ['user', 'Customers can submit the checkout form twice and get charged twice.'],
          ['assistant', 'The submit button stayed enabled while the request was in flight. Disabled it on submit and added an idempotency key to the charge call, so a repeat click is a no-op on the server as well.'],
        ],
      }),
      conversation({
        id: 'conv-hm-dashboard',
        title: 'Speed up the usage dashboard',
        projectPath: ACME_WEB,
        branch: 'perf/usage-dashboard',
        provider: 'codex-cli',
        endedMinutesAgo: 60 * 29,
        turns: [
          ['user', 'The usage dashboard takes six seconds to load for large accounts.'],
          ['assistant', 'The page issued one query per project. Replaced them with a single aggregated query and cached the result for a minute, which brings large accounts under 400ms.'],
        ],
      }),
    ],
  },

  7073: {
    machineName: 'Linux Devbox',
    platform: 'linux',
    providers: ALL_PROVIDERS,
    directories: ACME_DIRECTORIES,
    sessions: [
      session({
        id: 'ld-copilot-ratelimit',
        provider: 'copilot',
        status: 'running',
        projectPath: INFRA,
        branch: 'feat/rate-limit',
        sessionName: 'Add rate limiting to /ingest',
        lastOutput: 'Wiring the token bucket into the gateway',
        startedMinutesAgo: 6,
        promptCount: 1,
        conversationId: 'conv-ld-ratelimit',
      }),
    ],
    terminal: {
      'ld-copilot-ratelimit': [
        '❯ Add rate limiting to the /ingest endpoint: 100 requests per minute per API key.',
        '',
        '⏺ The gateway has no per-key limiter yet. Adding a token bucket keyed on',
        '  the API key, 100 tokens refilled per minute.',
        '',
        '  Read gateway/routes/ingest.ts',
        '  Edit gateway/middleware/rate-limit.ts',
        '  Wiring the token bucket into the gateway',
      ],
    },
    conversations: [
      conversation({
        id: 'conv-ld-ratelimit',
        title: 'Add rate limiting to /ingest',
        projectPath: INFRA,
        branch: 'feat/rate-limit',
        provider: 'copilot',
        endedMinutesAgo: 1,
        turns: [
          ['user', 'Add rate limiting to the /ingest endpoint: 100 requests per minute per API key.'],
          ['assistant', 'The gateway has no per-key limiter yet. I am adding a token bucket keyed on the API key, refilled at 100 tokens per minute, and wiring it into the ingest route.'],
        ],
      }),
      conversation({
        id: 'conv-ld-tls',
        title: 'Rotate the ingest TLS certificate',
        projectPath: INFRA,
        branch: 'chore/tls-rotation',
        provider: 'claude-code',
        endedMinutesAgo: 60 * 31,
        turns: [
          ['user', 'The ingest certificate expires next week. Automate the rotation.'],
          ['assistant', 'Added a cert-manager Certificate resource with a 30-day renewal window and pointed the ingress at the managed secret. The next rotation happens without a deploy.'],
        ],
      }),
    ],
  },
}

module.exports = { MACHINES: process.env.DEMO_PROFILE === 'hero' ? HERO_MACHINES : MACHINES }
