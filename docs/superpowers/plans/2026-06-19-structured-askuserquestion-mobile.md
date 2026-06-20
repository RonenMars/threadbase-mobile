# Structured AskUserQuestion — Mobile Implementation Plan (v1, single-select)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render Claude Code `AskUserQuestion` prompts as a native form in the live-chat view from structured data, and submit the answer via a structured endpoint — replacing PTY-text scraping for that view (single-select; multiSelect/"Other" deferred to v2).

**Architecture:** A new `question` WS message from tb-streamer carries `{toolUseId, questions[]}`. A `useActiveQuestion` hook holds the active question per session and clears it on `question_cancelled`. `QuestionCard` is widened to render structured questions (header, descriptions) and submits through a new `respondToQuestion` mutation hitting `POST /api/sessions/:id/answer`. `parseQuestionBlock` is kept as a fallback for the raw terminal view and hardened.

**Tech Stack:** React Native + Expo, TypeScript, @tanstack/react-query, Jest (`__tests__/unit`), existing WS plumbing in `useConversationStream`/the session layout.

## Global Constraints

- No `unknown`/`any` in new code without explicit approval — use interfaces / type guards / generics. (CLAUDE.md)
- No emojis in UI — Phosphor icons only (`phosphor-react-native`). (CLAUDE.md)
- No inline multi-branch conditional text in JSX — extract to a named `const`. (CLAUDE.md)
- Lint staged files before commit: `npx eslint <staged>`; fix errors (warnings OK). (CLAUDE.md)
- Run unit tests with: `npm run test:unit` (single file: `npx jest <path> -c jest.config.js` or `npx jest <path>`).
- Contracts are frozen in `docs/superpowers/specs/2026-06-19-structured-askuserquestion-design.md` — match field names exactly.
- This is the **mobile** track. The streamer track (detection, `/answer` endpoint, keystroke translation) is a separate plan; until it ships, the structured path is dormant and the PTY fallback remains active. Do NOT block mobile tasks on the streamer.

---

## File structure

- `types/api.ts` — add `AskQuestion`, `AskOption` types and the `question`/`question_cancelled` WS message shapes. Widen nothing here that breaks existing `MessageContent`.
- `utils/stripAnsi.ts` — **new**, single shared ANSI stripper (extracted from `parseQuestionBlock`).
- `utils/parseQuestionBlock.ts` — adopt new `QuestionBlock` shape (`source:'pty'`, `questions[]`); use shared `stripAnsi`; widen indent rule; reject border headers.
- `hooks/useActiveQuestion.ts` — **new**, subscribes to `question`/`question_cancelled` WS for a session, exposes the active structured `QuestionBlock | null`.
- `hooks/useSessionActions.ts` — add `respondToQuestion` mutation.
- `components/terminal/QuestionCard.tsx` — render the widened `QuestionBlock` (structured + pty), submit via callback.
- `components/conversation/ThinkingBubble.tsx` — prefer structured question; fall back to PTY scrape; route submit to `/answer`.
- `components/terminal/TerminalOutput.tsx` — adapt to widened `QuestionBlock`; keep PTY scrape.
- Tests under `__tests__/unit/...` mirroring each.

---

### Task 1: Types for the structured question

**Files:**
- Modify: `types/api.ts` (append after the `MessageContent` union block, ~line 124)
- Test: `__tests__/unit/types/askQuestion.types.test.ts` (type-level compile check)

**Interfaces:**
- Produces: `AskOption`, `AskQuestion`, `QuestionWsMessage`, `QuestionCancelledWsMessage`.

- [x] **Step 1: Add the types**

In `types/api.ts`, append:

```ts
export interface AskOption {
  label: string
  description: string
  preview?: string
}

export interface AskQuestion {
  question: string
  header: string
  multiSelect: boolean
  options: AskOption[]
}

export interface QuestionWsMessage {
  type: 'question'
  sessionId: string
  toolUseId: string
  questions: AskQuestion[]
}

export interface QuestionCancelledWsMessage {
  type: 'question_cancelled'
  sessionId: string
  toolUseId: string
}
```

- [x] **Step 2: Add a compile-time test**

Create `__tests__/unit/types/askQuestion.types.test.ts`:

```ts
import type { AskQuestion, QuestionWsMessage } from '@/types/api'

describe('AskQuestion types', () => {
  it('accepts a well-formed structured question message', () => {
    const msg: QuestionWsMessage = {
      type: 'question',
      sessionId: 's1',
      toolUseId: 'toolu_1',
      questions: [
        {
          question: 'How should I format the output?',
          header: 'Format',
          multiSelect: false,
          options: [
            { label: 'Summary', description: 'Brief overview' },
            { label: 'Detailed', description: 'Full explanation', preview: 'a\nb' },
          ],
        },
      ],
    }
    expect(msg.questions[0].options).toHaveLength(2)
    const q: AskQuestion = msg.questions[0]
    expect(q.multiSelect).toBe(false)
  })
})
```

- [x] **Step 3: Run test**

Run: `npx jest __tests__/unit/types/askQuestion.types.test.ts`
Expected: PASS (and `tsc` clean).

- [x] **Step 4: Commit**

```bash
git add types/api.ts __tests__/unit/types/askQuestion.types.test.ts
git commit -m "feat(chat): add structured AskUserQuestion message types"
```

---

### Task 2: Shared `stripAnsi` util

**Files:**
- Create: `utils/stripAnsi.ts`
- Test: `__tests__/unit/utils/stripAnsi.test.ts`

**Interfaces:**
- Produces: `stripAnsi(s: string): string` (handles CSI, OSC with BEL or ST terminator, and 2-char ESC sequences).

- [x] **Step 1: Write the failing test**

Create `__tests__/unit/utils/stripAnsi.test.ts`:

```ts
import { stripAnsi } from '@/utils/stripAnsi'

describe('stripAnsi', () => {
  it('strips CSI color codes', () => {
    expect(stripAnsi('\x1b[32mhi\x1b[0m')).toBe('hi')
  })
  it('strips OSC sequences terminated by BEL', () => {
    expect(stripAnsi('\x1b]0;title\x07rest')).toBe('rest')
  })
  it('strips OSC sequences terminated by ST (ESC backslash)', () => {
    expect(stripAnsi('\x1b]8;;http://x\x1b\\link')).toBe('link')
  })
  it('leaves plain text untouched', () => {
    expect(stripAnsi('plain ❯ text')).toBe('plain ❯ text')
  })
})
```

- [x] **Step 2: Run to verify it fails**

Run: `npx jest __tests__/unit/utils/stripAnsi.test.ts`
Expected: FAIL — cannot find module `@/utils/stripAnsi`.

- [x] **Step 3: Implement**

Create `utils/stripAnsi.ts` (lift the stronger regex from `parseQuestionBlock.ts`):

```ts
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b(\[[0-9;?]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[A-Z\\])/g

export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '')
}
```

- [x] **Step 4: Run to verify it passes**

Run: `npx jest __tests__/unit/utils/stripAnsi.test.ts`
Expected: PASS (4 tests).

- [x] **Step 5: Commit**

```bash
git add utils/stripAnsi.ts __tests__/unit/utils/stripAnsi.test.ts
git commit -m "feat(chat): extract shared stripAnsi util"
```

---

### Task 3: Widen `QuestionBlock` + harden `parseQuestionBlock`

**Files:**
- Modify: `utils/parseQuestionBlock.ts`
- Test: `__tests__/unit/utils/parseQuestionBlock.test.ts` (existing — adapt + add cases)

**Interfaces:**
- Consumes: `stripAnsi` from Task 2.
- Produces: widened `QuestionBlock`, `QuestionItem`, `QuestionOption`; `parseQuestionBlock(lines: string[]): QuestionBlock | null` returning `source:'pty'`.

- [x] **Step 1: Update the type and adapt existing tests to the new shape**

Replace the `QuestionBlock` interface at the top of `utils/parseQuestionBlock.ts`:

```ts
export interface QuestionOption {
  label: string
  description?: string
  preview?: string
}
export interface QuestionItem {
  question: string
  header?: string
  multiSelect: boolean
  options: QuestionOption[]
}
export interface QuestionBlock {
  source: 'structured' | 'pty'
  toolUseId?: string
  questions: QuestionItem[]
  /** PTY-scrape only: index of the ❯ cursor row among options of questions[0] */
  selectedIndex?: number
  /** PTY-scrape only: index in source lines[] where the question line sits */
  questionLineIndex?: number
}
```

Import the shared stripper and delete the local copy:

```ts
import { stripAnsi } from '@/utils/stripAnsi'
```

Update both `return` sites to the new shape, e.g. Format 1:

```ts
if (options.length > 0) {
  return {
    source: 'pty',
    questions: [{ question: questionText, multiSelect: false, options: options.map(label => ({ label })) }],
    selectedIndex,
    questionLineIndex,
  }
}
```

and Format 2 likewise with `questionLineIndex: qIdx`.

- [x] **Step 2: Update existing test assertions to the new shape**

In `__tests__/unit/utils/parseQuestionBlock.test.ts`, the existing cases assert `result!.questionText` / `result!.options` (string[]). Change them to read the first question, e.g.:

```ts
const q = result!.questions[0]
expect(q.question).toBe('Add fallback to ConversationCache?')
expect(q.options.map(o => o.label)).toEqual(['both (Recommended)', 'indicator only', 'discriminator only', 'Nothing.'])
expect(result!.selectedIndex).toBe(0)
```

Apply the same `.questions[0]` + `.options.map(o => o.label)` transform to every existing assertion in the file.

- [x] **Step 3: Add the new hardening cases (failing)**

Append to the same test file:

```ts
it('accepts 3-space-indented options (aligned numbered lists)', () => {
  const lines = ['? Pick one', '❯ 1. First', '   2. Second', '   3. Third']
  const q = parseQuestionBlock(lines)!.questions[0]
  expect(q.options.map(o => o.label)).toEqual(['First', 'Second', 'Third'])
})

it('does not treat a box-drawing border as the question (Format 2)', () => {
  const lines = ['────────────', '❯ Option A', '  Option B']
  expect(parseQuestionBlock(lines)).toBeNull()
})

it('reports source as pty', () => {
  const lines = ['? Q', '❯ A', '  B']
  expect(parseQuestionBlock(lines)!.source).toBe('pty')
})
```

- [x] **Step 4: Run, expect new cases to fail**

Run: `npx jest __tests__/unit/utils/parseQuestionBlock.test.ts`
Expected: the 3-space and border-rejection cases FAIL (indent rule too strict; border accepted as question).

- [x] **Step 5: Implement the two rule changes**

In `utils/parseQuestionBlock.ts`:

Widen the unselected-option regex:

```ts
// Accept 2–3 leading spaces (aligned numbered lists indent to 3). 4+ = tool output.
const UNSELECTED_OPTION_RE = /^ {2,3}(\S.*)$/
```

In Format 2, after computing `questionText`, extend the reject guard:

```ts
// Reject footers AND borders/box-drawing/blank-bracket headers — not real questions.
if (/Enter to select|↑|↓|Esc to cancel/.test(questionText)) return null
if (/^[\s│─┌┐└┘├┤┬┴┼╭╮╰╯=_-]+$/.test(questionText)) return null
```

- [x] **Step 6: Run, expect all pass**

Run: `npx jest __tests__/unit/utils/parseQuestionBlock.test.ts`
Expected: PASS (all existing + 3 new).

- [x] **Step 7: Commit**

```bash
git add utils/parseQuestionBlock.ts utils/stripAnsi.ts __tests__/unit/utils/parseQuestionBlock.test.ts
git commit -m "refactor(chat): widen QuestionBlock shape and harden PTY question parser"
```

---

### Task 4: `mapAskQuestionToBlock` adapter

**Files:**
- Create: `utils/mapAskQuestionToBlock.ts`
- Test: `__tests__/unit/utils/mapAskQuestionToBlock.test.ts`

**Interfaces:**
- Consumes: `AskQuestion` (Task 1), `QuestionBlock`/`QuestionItem` (Task 3).
- Produces: `mapAskQuestionToBlock(toolUseId: string, questions: AskQuestion[]): QuestionBlock` returning `source:'structured'` (no `selectedIndex`/`questionLineIndex`).

- [x] **Step 1: Write the failing test**

Create `__tests__/unit/utils/mapAskQuestionToBlock.test.ts`:

```ts
import { mapAskQuestionToBlock } from '@/utils/mapAskQuestionToBlock'
import type { AskQuestion } from '@/types/api'

const qs: AskQuestion[] = [{
  question: 'How should I format the output?',
  header: 'Format',
  multiSelect: false,
  options: [
    { label: 'Summary', description: 'Brief' },
    { label: 'Detailed', description: 'Full', preview: 'x\ny' },
  ],
}]

describe('mapAskQuestionToBlock', () => {
  it('maps to a structured QuestionBlock preserving header/description/preview', () => {
    const block = mapAskQuestionToBlock('toolu_1', qs)
    expect(block.source).toBe('structured')
    expect(block.toolUseId).toBe('toolu_1')
    expect(block.selectedIndex).toBeUndefined()
    expect(block.questions[0].header).toBe('Format')
    expect(block.questions[0].options[1].preview).toBe('x\ny')
  })
})
```

- [x] **Step 2: Run to verify it fails**

Run: `npx jest __tests__/unit/utils/mapAskQuestionToBlock.test.ts`
Expected: FAIL — module not found.

- [x] **Step 3: Implement**

Create `utils/mapAskQuestionToBlock.ts`:

```ts
import type { AskQuestion } from '@/types/api'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'

export function mapAskQuestionToBlock(toolUseId: string, questions: AskQuestion[]): QuestionBlock {
  return {
    source: 'structured',
    toolUseId,
    questions: questions.map(q => ({
      question: q.question,
      header: q.header,
      multiSelect: q.multiSelect,
      options: q.options.map(o => ({ label: o.label, description: o.description, preview: o.preview })),
    })),
  }
}
```

- [x] **Step 4: Run to verify it passes**

Run: `npx jest __tests__/unit/utils/mapAskQuestionToBlock.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add utils/mapAskQuestionToBlock.ts __tests__/unit/utils/mapAskQuestionToBlock.test.ts
git commit -m "feat(chat): map structured AskUserQuestion to QuestionBlock"
```

---

### Task 5: `useActiveQuestion` hook

**Files:**
- Create: `hooks/useActiveQuestion.ts`
- Test: `__tests__/unit/hooks/useActiveQuestion.test.tsx`

**Interfaces:**
- Consumes: `mapAskQuestionToBlock` (Task 4); the app's WS subscription mechanism. **Read `hooks/useConversationStream.ts` first** to copy its exact WS connection pattern (how it gets the socket for `serverId`/`sessionId` and registers a message handler) — mirror it; do not invent a new transport.
- Produces: `useActiveQuestion(serverId: string, sessionId: string): { question: QuestionBlock | null; clear: () => void }`. On a `question` message for this `sessionId`, sets `question = mapAskQuestionToBlock(...)`. On `question_cancelled` matching the held `toolUseId`, sets `null`.

- [x] **Step 1: Write the failing test** (drive the reducer logic directly so it doesn't depend on live WS)

Create `__tests__/unit/hooks/useActiveQuestion.test.tsx`:

```ts
import { renderHook, act } from '@testing-library/react-native'
import { useActiveQuestionReducer } from '@/hooks/useActiveQuestion'
import type { QuestionWsMessage, QuestionCancelledWsMessage } from '@/types/api'

const qMsg: QuestionWsMessage = {
  type: 'question', sessionId: 's1', toolUseId: 't1',
  questions: [{ question: 'Q?', header: 'H', multiSelect: false, options: [{ label: 'A', description: 'a' }, { label: 'B', description: 'b' }] }],
}

describe('useActiveQuestionReducer', () => {
  it('sets the active question on a matching question message', () => {
    const { result } = renderHook(() => useActiveQuestionReducer('s1'))
    act(() => result.current.onMessage(qMsg))
    expect(result.current.question?.toolUseId).toBe('t1')
    expect(result.current.question?.source).toBe('structured')
  })
  it('ignores a question for another session', () => {
    const { result } = renderHook(() => useActiveQuestionReducer('OTHER'))
    act(() => result.current.onMessage(qMsg))
    expect(result.current.question).toBeNull()
  })
  it('clears on question_cancelled matching the held toolUseId', () => {
    const { result } = renderHook(() => useActiveQuestionReducer('s1'))
    act(() => result.current.onMessage(qMsg))
    const cancel: QuestionCancelledWsMessage = { type: 'question_cancelled', sessionId: 's1', toolUseId: 't1' }
    act(() => result.current.onMessage(cancel))
    expect(result.current.question).toBeNull()
  })
})
```

- [x] **Step 2: Run to verify it fails**

Run: `npx jest __tests__/unit/hooks/useActiveQuestion.test.tsx`
Expected: FAIL — module not found.

- [x] **Step 3: Implement the reducer + the WS-wired hook**

Create `hooks/useActiveQuestion.ts`. The reducer is pure and exported for tests; the public hook wires it to the WS exactly as `useConversationStream` does.

```ts
import { useCallback, useState } from 'react'
import { mapAskQuestionToBlock } from '@/utils/mapAskQuestionToBlock'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'
import type { QuestionWsMessage, QuestionCancelledWsMessage } from '@/types/api'

type Incoming = QuestionWsMessage | QuestionCancelledWsMessage

export function useActiveQuestionReducer(sessionId: string) {
  const [question, setQuestion] = useState<QuestionBlock | null>(null)
  const onMessage = useCallback((msg: Incoming) => {
    if (msg.sessionId !== sessionId) return
    if (msg.type === 'question') {
      setQuestion(mapAskQuestionToBlock(msg.toolUseId, msg.questions))
    } else if (msg.type === 'question_cancelled') {
      setQuestion(prev => (prev?.toolUseId === msg.toolUseId ? null : prev))
    }
  }, [sessionId])
  const clear = useCallback(() => setQuestion(null), [])
  return { question, onMessage, clear }
}

// Public hook: subscribe to the session WS and feed messages into the reducer.
// MIRROR the subscription pattern in hooks/useConversationStream.ts (same socket source).
export function useActiveQuestion(serverId: string, sessionId: string) {
  const { question, onMessage, clear } = useActiveQuestionReducer(sessionId)
  // TODO-DURING-IMPL: register onMessage on the same WS used by useConversationStream,
  // filtering to msg.type === 'question' | 'question_cancelled'. Unsubscribe on cleanup.
  return { question, onMessage, clear }
}
```

NOTE: the `useActiveQuestion` wrapper's WS wiring must be copied from `useConversationStream` — replace the `TODO-DURING-IMPL` with the real subscription using that file's exact socket accessor. The reducer (tested above) carries all the logic; the wrapper only plumbs messages in.

- [x] **Step 4: Run to verify it passes**

Run: `npx jest __tests__/unit/hooks/useActiveQuestion.test.tsx`
Expected: PASS (3 tests).

- [x] **Step 5: Commit**

```bash
git add hooks/useActiveQuestion.ts __tests__/unit/hooks/useActiveQuestion.test.tsx
git commit -m "feat(chat): add useActiveQuestion hook for structured prompts"
```

---

### Task 6: `respondToQuestion` mutation

**Files:**
- Modify: `hooks/useSessionActions.ts` (add alongside `respondToPlan`)
- Test: `__tests__/unit/hooks/useSessionActions.respondToQuestion.test.tsx`

**Interfaces:**
- Consumes: existing `createApiForServer(serverId)` and the `useMutation` pattern already in the file.
- Produces: `respondToQuestion` mutation with `mutationFn: (vars: { toolUseId: string; answers: Record<string, string | string[]> }) => api.post(\`/api/sessions/${sessionId}/answer\`, vars)`, exposed on the hook's return object.

- [x] **Step 1: Write the failing test** (mock the api client, assert the POST shape)

Create `__tests__/unit/hooks/useSessionActions.respondToQuestion.test.tsx`:

```ts
import { renderHook, act, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const post = jest.fn().mockResolvedValue({})
jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({ post, delete: jest.fn() }),
}))

import { useSessionActions } from '@/hooks/useSessionActions'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient()
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('respondToQuestion', () => {
  it('POSTs toolUseId + answers to /answer', async () => {
    const { result } = renderHook(() => useSessionActions('srv1', 'sess1'), { wrapper })
    await act(async () => {
      result.current.respondToQuestion.mutate({ toolUseId: 't1', answers: { 'Q?': 'A' } })
    })
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/sessions/sess1/answer', { toolUseId: 't1', answers: { 'Q?': 'A' } }))
  })
})
```

- [x] **Step 2: Run to verify it fails**

Run: `npx jest __tests__/unit/hooks/useSessionActions.respondToQuestion.test.tsx`
Expected: FAIL — `respondToQuestion` is undefined.

- [x] **Step 3: Implement**

In `hooks/useSessionActions.ts`, after the `respondToPlan` mutation, add:

```ts
const respondToQuestion = useMutation({
  mutationFn: (vars: { toolUseId: string; answers: Record<string, string | string[]> }) =>
    api.post(`/api/sessions/${sessionId}/answer`, vars),
})
```

and include `respondToQuestion` in the hook's returned object (match how `respondToPlan` is returned).

- [x] **Step 4: Run to verify it passes**

Run: `npx jest __tests__/unit/hooks/useSessionActions.respondToQuestion.test.tsx`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add hooks/useSessionActions.ts __tests__/unit/hooks/useSessionActions.respondToQuestion.test.tsx
git commit -m "feat(chat): add respondToQuestion mutation"
```

---

### Task 7: `QuestionCard` renders the widened block

**Files:**
- Modify: `components/terminal/QuestionCard.tsx`
- Test: `__tests__/unit/components/terminal/QuestionCard.test.tsx` (existing — adapt + add)

**Interfaces:**
- Consumes: widened `QuestionBlock` (Task 3).
- Produces: `QuestionCard` props `{ block: QuestionBlock; onSelect: (questionIndex: number, optionIndex: number) => void }`. v1 renders `block.questions[0]` as single-select radios; shows `header` (if present) and each option's `description` (if present). `preview` rendered in a monospace `<Text>` when present.

- [x] **Step 1: Adapt existing tests to the new props + shape**

The existing `QuestionCard.test.tsx` builds a `QuestionBlock` with `questionText`/`options: string[]` and calls `onSelect(index)`. Update the fixture to the new shape and the callback to `(0, index)`:

```ts
const block = {
  source: 'structured' as const,
  toolUseId: 't1',
  questions: [{
    question: 'Choose', header: 'Pick', multiSelect: false,
    options: [{ label: 'A', description: 'first' }, { label: 'B', description: 'second' }],
  }],
}
// onSelect now receives (questionIndex, optionIndex)
```

Update the press assertion to expect `onSelect).toHaveBeenCalledWith(0, 1)` for the second option.

- [x] **Step 2: Add new rendering cases (failing)**

```ts
it('renders the header and option descriptions', () => {
  const { getByText } = render(<QuestionCard block={block} onSelect={jest.fn()} />)
  expect(getByText('Pick')).toBeTruthy()
  expect(getByText('first')).toBeTruthy()
})
it('renders a preview block when present', () => {
  const b = { ...block, questions: [{ ...block.questions[0], options: [{ label: 'A', description: 'd', preview: 'L1\nL2' }, { label: 'B', description: 'd2' }] }] }
  const { getByText } = render(<QuestionCard block={b} onSelect={jest.fn()} />)
  expect(getByText(/L1/)).toBeTruthy()
})
```

- [x] **Step 3: Run, expect new cases to fail**

Run: `npx jest __tests__/unit/components/terminal/QuestionCard.test.tsx`
Expected: FAIL — header/description/preview not rendered; old prop shape.

- [x] **Step 4: Implement the widened render**

Rewrite `QuestionCard.tsx` body to read `const q = block.questions[0]`, render `q.header` (when truthy) as a chip above the question, map `q.options` to rows showing `option.label` and (when truthy) `option.description` on a secondary line, and render `option.preview` in a `<Text style={styles.preview}>` (monospace) when truthy. Keep the existing radio visuals; selection highlight may key off a local `selected` state (structured questions have no pre-selection — start unselected). Call `onSelect(0, index)` on press. Extract any multi-branch label strings to a named `const` (CLAUDE.md). Add a `preview` style: `{ fontFamily: 'monospace', fontSize: 12, color: '#8b949e', marginTop: 4 }`.

- [x] **Step 5: Run, expect all pass**

Run: `npx jest __tests__/unit/components/terminal/QuestionCard.test.tsx`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add components/terminal/QuestionCard.tsx __tests__/unit/components/terminal/QuestionCard.test.tsx
git commit -m "feat(chat): render structured fields in QuestionCard"
```

---

### Task 8: Wire `ThinkingBubble` to prefer the structured question

**Files:**
- Modify: `components/conversation/ThinkingBubble.tsx`
- Test: `__tests__/unit/components/conversation/ThinkingBubble.question.test.tsx`

**Interfaces:**
- Consumes: `useActiveQuestion` (Task 5) via a new optional prop `activeQuestion?: QuestionBlock | null` (the parent `LiveConversationView` supplies it from the hook — keeps `ThinkingBubble` pure/testable); `respondToQuestion` via a new optional prop `onAnswer?: (toolUseId: string, answers: Record<string, string | string[]>) => void`.
- Produces: when `activeQuestion` is present, render `QuestionCard` from it and route selection to `onAnswer`; otherwise fall back to the existing PTY `parseQuestionBlock(lines.slice(-30))` + `onSendKeys` path.

- [x] **Step 1: Write the failing test**

Create `__tests__/unit/components/conversation/ThinkingBubble.question.test.tsx`:

```ts
import { render, fireEvent } from '@testing-library/react-native'
import React from 'react'
import { ThinkingBubble } from '@/components/conversation/ThinkingBubble'

const aq = {
  source: 'structured' as const, toolUseId: 't1',
  questions: [{ question: 'Q?', header: 'H', multiSelect: false, options: [{ label: 'A', description: 'a' }, { label: 'B', description: 'b' }] }],
}

describe('ThinkingBubble structured question', () => {
  it('renders the structured QuestionCard and routes answers to onAnswer', () => {
    const onAnswer = jest.fn()
    const { getByLabelText } = render(
      <ThinkingBubble lines={[]} isStreaming={false} activeQuestion={aq} onAnswer={onAnswer} />,
    )
    fireEvent.press(getByLabelText('B'))
    expect(onAnswer).toHaveBeenCalledWith('t1', { 'Q?': 'B' })
  })
})
```

- [x] **Step 2: Run to verify it fails**

Run: `npx jest __tests__/unit/components/conversation/ThinkingBubble.question.test.tsx`
Expected: FAIL — `activeQuestion`/`onAnswer` props not handled.

- [x] **Step 3: Implement**

In `ThinkingBubble.tsx`:
- Extend `Props` with `activeQuestion?: QuestionBlock | null` and `onAnswer?: (toolUseId: string, answers: Record<string, string | string[]>) => void` (import `QuestionBlock` type).
- Replace the question render block (lines ~62–72, 108–110) with: if `activeQuestion` present, render `<QuestionCard block={activeQuestion} onSelect={(qi, oi) => { const q = activeQuestion.questions[qi]; onAnswer?.(activeQuestion.toolUseId!, { [q.question]: q.options[oi].label }) }} />`; else keep the existing `questionBlock = onSendKeys ? parseQuestionBlock(...) : null` fallback rendering with the old `handleOptionSelect` keystroke path (now adapted to the `(qi, oi)` signature: compute target = oi, `arrow.repeat(Math.abs(oi - (questionBlock.selectedIndex ?? 0))) + '\r'`).

- [x] **Step 4: Run to verify it passes**

Run: `npx jest __tests__/unit/components/conversation/ThinkingBubble.question.test.tsx`
Expected: PASS. Also run the existing ThinkingBubble tests to confirm no regression: `npx jest __tests__/unit/components/conversation/ThinkingBubble`.

- [x] **Step 5: Commit**

```bash
git add components/conversation/ThinkingBubble.tsx __tests__/unit/components/conversation/ThinkingBubble.question.test.tsx
git commit -m "feat(chat): prefer structured question in ThinkingBubble with PTY fallback"
```

---

### Task 9: Supply the active question + answer handler from `LiveConversationView`, and adapt `TerminalOutput`

**Files:**
- Modify: `components/conversation/LiveConversationView.tsx`
- Modify: `components/terminal/TerminalOutput.tsx`
- Test: `__tests__/unit/components/terminal/TerminalOutput.test.tsx` (adapt to widened block if it exists; else add a minimal smoke test)

**Interfaces:**
- Consumes: `useActiveQuestion(serverId, sessionId)` (Task 5), `useSessionActions(...).respondToQuestion` (Task 6).
- Produces: `LiveConversationView` passes `activeQuestion={question}` and `onAnswer={(toolUseId, answers) => respondToQuestion.mutate({ toolUseId, answers })}` into `ThinkingBubble`. `TerminalOutput`'s `handleOptionSelect` is updated to the `(questionIndex, optionIndex)` callback and the widened `QuestionBlock` (read `block.questions[0].options`), still sending keystrokes (raw terminal view keeps PTY path).

- [x] **Step 1: Adapt `TerminalOutput` to the widened block (compile-level)**

In `components/terminal/TerminalOutput.tsx`:
- `questionBlock` stays `parseQuestionBlock(lines.slice(-30))` (now returns the widened shape).
- Update `<QuestionCard>` `onSelect` to `(qi, oi)` and `handleOptionSelect` to:

```ts
const handleOptionSelect = useCallback((_qi: number, optionIndex: number) => {
  if (!onSendKeys || !questionBlock) return
  const start = questionBlock.selectedIndex ?? 0
  const delta = optionIndex - start
  const arrow = delta > 0 ? '\x1b[B' : '\x1b[A'
  onSendKeys(arrow.repeat(Math.abs(delta)) + '\r')
}, [onSendKeys, questionBlock])
```

- [x] **Step 2: Wire `LiveConversationView`**

In `components/conversation/LiveConversationView.tsx`, where `ThinkingBubble` is rendered:
- Add `const { question } = useActiveQuestion(serverId, sessionId)` (use the existing serverId/sessionId in scope).
- Add `const { respondToQuestion } = useSessionActions(serverId, sessionId)` if `useSessionActions` isn't already used here; otherwise destructure `respondToQuestion` from the existing call.
- Pass `activeQuestion={question}` and `onAnswer={(toolUseId, answers) => respondToQuestion.mutate({ toolUseId, answers })}` to `<ThinkingBubble .../>`.

- [x] **Step 3: Run unit tests + typecheck**

Run: `npm run test:unit`
Then: `npx tsc --noEmit` (expect no new type errors from the widened shape).
Expected: PASS. Fix any call sites still using `.questionText`/`.options: string[]` (search: `git grep -n "\.questionText"` and `git grep -n "questionBlock.options"`).

- [x] **Step 4: Lint touched files**

Run: `npx eslint components/conversation/LiveConversationView.tsx components/terminal/TerminalOutput.tsx components/conversation/ThinkingBubble.tsx components/terminal/QuestionCard.tsx hooks/useActiveQuestion.ts hooks/useSessionActions.ts utils/parseQuestionBlock.ts utils/stripAnsi.ts utils/mapAskQuestionToBlock.ts`
Expected: no errors.

- [x] **Step 5: Commit**

```bash
git add components/conversation/LiveConversationView.tsx components/terminal/TerminalOutput.tsx __tests__/unit/components/terminal/TerminalOutput.test.tsx
git commit -m "feat(chat): supply structured question + answer handler in live view"
```

---

## Self-review

**Spec coverage:**
- WS `question` / `question_cancelled` types → Task 1. ✓
- Widened `QuestionBlock` (dual-source) → Task 3. ✓
- `/answer` mutation → Task 6. ✓
- Structured render (header/description/preview, single-select) → Task 7. ✓
- Live-view prefers structured, PTY fallback → Tasks 8–9. ✓
- Parser fixes (3-space indent, border header, shared stripAnsi) → Tasks 2–3. ✓
- Arrow-delta race removed for structured case (answers go via `/answer`, not keystrokes) → Tasks 8–9. ✓
- **Streamer-side** detection, endpoint, `answersToKeystrokes`, live-verify → **separate plan** (`2026-06-19-structured-askuserquestion-streamer.md`). Not in this mobile plan by design. ✓
- multiSelect / "Other" → v2, out of scope here (contracts already accommodate). ✓

**Placeholder scan:** One intentional `TODO-DURING-IMPL` in Task 5 Step 3 — the WS subscription wiring, which must be copied from `useConversationStream`'s real socket accessor (a file the implementer reads in Task 5). The *logic* is fully implemented and tested via the exported reducer; only the transport plumbing is deferred to the file it must mirror. Acceptable because the testable behavior is complete and the deferred part is "mirror this exact existing pattern," not "design something."

**Type consistency:** `QuestionBlock`/`QuestionItem`/`QuestionOption` defined in Task 3, consumed identically in 4/5/7/8/9. `respondToQuestion` signature identical in Task 6 and Task 9. `onSelect(questionIndex, optionIndex)` consistent across Tasks 7/8/9. `AskQuestion`/`AskOption` (Task 1) consumed in Task 4. ✓

**Dependency note:** Tasks are ordered so each builds on prior produces. The mobile path is dormant (no structured events arrive) until the streamer plan ships — verify end-to-end only after both tracks land.

---

## Execution ledger

Worktree: `tb-mobile/.worktrees/fix/chat-flow-states` · Branch: `feat/live-chat-with-flow-fixes`.

| Task | Status | Commit | Review |
| --- | --- | --- | --- |
| T1 — structured question types | ✅ done | `5317f424` | clean |
| T2 — shared `stripAnsi` util | ✅ done | `6caec5f6` | clean (security pass: no ReDoS, display-only sinks) |
| T3 — widen `QuestionBlock` + harden parser | ✅ done | `4405ae6` | APPROVE (type matches frozen contract, border-reject `-` literal, surgical) |
| T4 — `mapAskQuestionToBlock` | ✅ done | `734e8bc` | folded into final review |
| T5 — `useActiveQuestion` | ✅ done | `1e5d441` (+ `ws-client.ts` union widening) | APPROVE (reducer correct, WS pattern mirrored, union widening justified) |
| T6 — `respondToQuestion` mutation | ✅ done | `ace46d2` | folded into final review |
| T7 — `QuestionCard` widened render | ✅ done | `d2262bc` + fix `fe2f6cb` | APPROVE w/ 1 must-fix (PTY highlight resync) — fixed |
| T8 — `ThinkingBubble` prefers structured | ✅ done | `5704a9f` | folded into final review |
| T9 — `LiveConversationView` + `TerminalOutput` | ✅ done | `68efdaa` | folded into final review |

**Verification gate (committed state):** `tsc --noEmit` clean; full unit suite 45 suites / 456 tests pass; no residual old-shape (`.questionText`) usages.

**Deviations from plan (all approved/justified):**
- T5 also modified `services/ws-client.ts` to add `QuestionWsMessage | QuestionCancelledWsMessage` to the `WSMessage` union — required so the WS handler can narrow `msg.type` without a forbidden `unknown` cast; reviewer confirmed it's the minimal way to mirror `useConversationStream`.
- T7 picked up a review-driven follow-up fix (`fe2f6cb`) resyncing the `QuestionCard` highlight when the PTY cursor moves.
- T9 (`68efdaa`) also carries pre-existing uncommitted live-chat fixes in `LiveConversationView.tsx` (dedup-by-uuid, `[historical, pending, live]` reorder, `session_update` WS subscription, auto-scroll) that were already in the working tree; combined into one commit per user decision (they were already security-reviewed).

**Test invocation in this worktree:** the repo's `testPathIgnorePatterns` contains `/.worktrees/`, so jest finds 0 tests from inside the worktree unless overridden. Use:
`npx jest --ci --forceExit --testPathIgnorePatterns '/node_modules/' '/.claude/' '/__tests__/unit/scripts/' --testPathPattern '<regex>'`. `--forceExit` is needed for react-query/RNTL tests (else jest hangs at teardown).

### Incident — stray commit on `main` (resolved 2026-06-20)

- **What happened:** the T2 implementer subagent committed the `stripAnsi` work to the `main` checkout (`/Users/ronenmars/Desktop/dev/ai-tools/tb-mobile`, commit `3cd0eb63`) instead of the feature-branch worktree. This violates the never-commit-to-`main` rule.
- **Recovery:** the commit was cherry-picked onto `feat/live-chat-with-flow-fixes` as `6caec5f6` (verified to add exactly `utils/stripAnsi.ts` + its test), then the `main` checkout was hard-reset to `origin/main` (`3c7c2b76`) — destroying nothing unique, since the only content `3cd0eb63` carried now lives on the feature branch. The untracked `docs/superpowers/specs/2026-06-19-stop-session-client.md` was confirmed unchanged (identical sha256 before/after the reset).
- **Outcome:** `main` == `origin/main`; the stray commit never reached the remote. No history rewrite was needed on the remote.
- **Prevention:** every subsequent implementer subagent is dispatched into the isolated worktree with an explicit instruction to never `cd` out of it or commit to `main`.
