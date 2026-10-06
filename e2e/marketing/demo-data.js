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

module.exports = { MACHINES }
