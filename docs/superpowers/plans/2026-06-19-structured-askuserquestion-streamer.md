# Structured AskUserQuestion — Streamer Implementation Plan (v1, single-select)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Repo:** `/Users/ronenmars/Desktop/dev/ai-tools/tb-streamer` (NOT the tb-mobile worktree). All paths below are relative to that repo. Work on a feature branch there.

**Goal:** Detect Claude Code `AskUserQuestion` tool_use blocks in the live JSONL tail, broadcast a structured `question` WS message, and translate a structured answer (`POST /api/sessions/:id/answer`) into the PTY keystrokes that select the chosen option(s).

**Architecture:** Hook the existing `ConversationWatcher.onNewLines` seam (already parses lines for the cache) to find `tool_use` blocks named `AskUserQuestion` via the existing `normalizeContent` helper; record them in a per-session `pendingQuestions` map and broadcast `{type:"question", ...}`. A new `/:id/answer` handler validates `toolUseId` against the pending question and writes `answersToKeystrokes(...)` bytes via `ptyManager.sendKeys`. A pure `answersToKeystrokes` function holds all index math and is exhaustively unit-tested; its real-world byte sequence is live-verified before trusting it.

**Tech Stack:** Node.js + TypeScript, Hono + @hono/node-ws, node-pty, chokidar, Vitest 3 (`__tests__/**/*.test.ts`), Biome.

## Global Constraints

- **Vitest**, not jest. Imports: `import { describe, expect, it } from "vitest";`. Run one file: `npm run test -- __tests__/<file>.test.ts`. Filter by name: `npm run test -- --testNamePattern "<text>"`. Source imports are relative (`../src/...`).
- **No `any`/`unknown`** in new code without explicit approval — use the typed shapes below (the contracts are frozen in `tb-mobile/docs/superpowers/specs/2026-06-19-structured-askuserquestion-design.md`). The exploration suggested `questionData: any` for the WS variant — **do NOT** use that; use the typed `questions: AskQuestion[]` shape.
- Conventional-commit titles. No AI attribution in commits.
- `answersToKeystrokes` must be a **pure function** (no PTY, no I/O) so its byte output is unit-tested deterministically. This is the highest-risk code in the feature — a wrong sequence silently selects the wrong option in the user's real session.
- **v1 = single-select only** (~98% of real questions). multiSelect + "Other"/free-text are v2; the types accommodate them now but the translator handles single-select + multi-question only.
- **Live-verification gate:** before this ships, drive a real Claude Code `AskUserQuestion` through a real PTY and confirm the emitted bytes land on the intended option. Assumption to confirm: inquirer cursor starts at option index 0; Enter (`\r`) confirms; `↓` = `\x1b[B`.

---

## File structure

- `src/types.ts` — add `AskOption`, `AskQuestion` and the two WS union variants `question` / `question_cancelled`.
- `src/services/questions/detectAskUserQuestion.ts` — **new**, pure: given a raw JSONL line string, return `{ toolUseId, questions } | null`.
- `src/services/questions/answersToKeystrokes.ts` — **new**, pure: given `questions` + `answers`, return the keystroke byte string (or throw `UnknownOptionError`).
- `src/server.ts` — wire detection into `onNewLines` (broadcast `question`); add `pendingQuestions` map; add `handleSendAnswer`; emit `question_cancelled` where pending questions are cleared on resolution.
- `src/api/routes/sessions.routes.ts` — add `POST /:id/answer`.
- `src/api/types/api-deps.ts` — add `handleSendAnswer` to `ApiDeps`.
- `__tests__/...` — one test file per pure module + a detection test at the seam.

---

### Task 1: Types — `AskQuestion` + WS variants

**Files:**
- Modify: `src/types.ts` (add interfaces near the top of the file; add the two variants into the `WSMessage` union at ~lines 75–114)
- Test: `__tests__/question-types.test.ts`

**Interfaces:**
- Produces: `AskOption`, `AskQuestion`; `WSMessage` gains `{type:"question"; sessionId; toolUseId; questions: AskQuestion[]}` and `{type:"question_cancelled"; sessionId; toolUseId}`.

- [ ] **Step 1: Add the interfaces and union variants**

In `src/types.ts`, add above the `WSMessage` union:

```typescript
export interface AskOption {
  label: string;
  description: string;
  preview?: string;
}
export interface AskQuestion {
  question: string;
  header: string;
  multiSelect: boolean;
  options: AskOption[];
}
```

Add these two members to the `WSMessage` union (after the `conversation_events` variant, matching the additive-comment style):

```typescript
  // Structured interactive prompt (AskUserQuestion). Old clients ignore it.
  | { type: "question"; sessionId: string; toolUseId: string; questions: AskQuestion[] }
  | { type: "question_cancelled"; sessionId: string; toolUseId: string }
```

- [ ] **Step 2: Add a compile/shape test**

Create `__tests__/question-types.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { AskQuestion, WSMessage } from "../src/types";

describe("question WS types", () => {
  it("accepts a well-formed question message", () => {
    const msg: WSMessage = {
      type: "question",
      sessionId: "s1",
      toolUseId: "toolu_1",
      questions: [
        { question: "Q?", header: "H", multiSelect: false, options: [
          { label: "A", description: "a" },
          { label: "B", description: "b" },
        ] },
      ],
    };
    const q: AskQuestion = (msg as Extract<WSMessage, { type: "question" }>).questions[0];
    expect(q.options).toHaveLength(2);
  });
});
```

- [ ] **Step 3: Run**

Run: `npm run test -- __tests__/question-types.test.ts`
Expected: PASS (and `npx tsc --noEmit` clean).

- [ ] **Step 4: Commit**

```bash
git add src/types.ts __tests__/question-types.test.ts
git commit -m "feat(question): add AskUserQuestion WS message types"
```

---

### Task 2: `detectAskUserQuestion` (pure)

**Files:**
- Create: `src/services/questions/detectAskUserQuestion.ts`
- Test: `__tests__/detect-ask-user-question.test.ts`

**Interfaces:**
- Consumes: `AskQuestion` (Task 1). Reuse the existing normalize logic — copy the `normalizeContent` shape from `src/conversation-cache.ts:127-131` (or import if exported; if not exported, replicate the 3-line helper locally).
- Produces: `detectAskUserQuestion(rawLine: string): { toolUseId: string; questions: AskQuestion[] } | null`. Parses the line; finds the first `tool_use` block with `name === "AskUserQuestion"`; normalizes `multiSelect` (absent → false). Returns null on parse error, no tool_use, or non-AskUserQuestion.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/detect-ask-user-question.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { detectAskUserQuestion } from "../src/services/questions/detectAskUserQuestion";

const realLine = JSON.stringify({
  type: "assistant",
  message: {
    role: "assistant",
    content: [
      { type: "text", text: "Let me ask." },
      { type: "tool_use", id: "toolu_9", name: "AskUserQuestion", input: {
        questions: [{ question: "Format?", header: "Format", options: [
          { label: "Summary", description: "brief" },
          { label: "Detailed", description: "full" },
        ] }],
      } },
    ],
  },
});

describe("detectAskUserQuestion", () => {
  it("extracts toolUseId and questions, defaulting multiSelect to false", () => {
    const r = detectAskUserQuestion(realLine);
    expect(r?.toolUseId).toBe("toolu_9");
    expect(r?.questions[0].header).toBe("Format");
    expect(r?.questions[0].multiSelect).toBe(false);
  });
  it("returns null for a deferred_tools_delta line (registration, not a question)", () => {
    const delta = JSON.stringify({ type: "user", attachment: { type: "deferred_tools_delta", addedNames: ["AskUserQuestion", "CronCreate"] } });
    expect(detectAskUserQuestion(delta)).toBeNull();
  });
  it("returns null for an unrelated tool_use", () => {
    const other = JSON.stringify({ message: { content: [{ type: "tool_use", id: "t", name: "Bash", input: { command: "ls" } }] } });
    expect(detectAskUserQuestion(other)).toBeNull();
  });
  it("returns null on malformed JSON", () => {
    expect(detectAskUserQuestion("{not json")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- __tests__/detect-ask-user-question.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/services/questions/detectAskUserQuestion.ts`:

```typescript
import type { AskQuestion, AskOption } from "../../types";

type ContentBlock = { type: string; name?: string; id?: string; input?: unknown; [key: string]: unknown };

interface JsonlLineShape {
  content?: ContentBlock[] | string;
  message?: { content?: ContentBlock[] | string };
}

function normalizeContent(raw: ContentBlock[] | string | null | undefined): ContentBlock[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") return [{ type: "text", text: raw }];
  return [];
}

function coerceOptions(raw: unknown): AskOption[] | null {
  if (!Array.isArray(raw)) return null;
  const out: AskOption[] = [];
  for (const o of raw) {
    if (o && typeof o === "object" && typeof (o as AskOption).label === "string") {
      const opt = o as { label: string; description?: unknown; preview?: unknown };
      out.push({
        label: opt.label,
        description: typeof opt.description === "string" ? opt.description : "",
        ...(typeof opt.preview === "string" ? { preview: opt.preview } : {}),
      });
    }
  }
  return out.length > 0 ? out : null;
}

function coerceQuestions(raw: unknown): AskQuestion[] | null {
  if (!Array.isArray(raw)) return null;
  const out: AskQuestion[] = [];
  for (const q of raw) {
    if (!q || typeof q !== "object") continue;
    const qq = q as { question?: unknown; header?: unknown; multiSelect?: unknown; options?: unknown };
    const options = coerceOptions(qq.options);
    if (typeof qq.question !== "string" || !options) continue;
    out.push({
      question: qq.question,
      header: typeof qq.header === "string" ? qq.header : "",
      multiSelect: qq.multiSelect === true,
      options,
    });
  }
  return out.length > 0 ? out : null;
}

export function detectAskUserQuestion(rawLine: string): { toolUseId: string; questions: AskQuestion[] } | null {
  let parsed: JsonlLineShape;
  try {
    parsed = JSON.parse(rawLine) as JsonlLineShape;
  } catch {
    return null;
  }
  const blocks = normalizeContent(parsed.message?.content ?? parsed.content);
  for (const b of blocks) {
    if (b.type === "tool_use" && b.name === "AskUserQuestion" && typeof b.id === "string") {
      const input = b.input as { questions?: unknown } | undefined;
      const questions = coerceQuestions(input?.questions);
      if (questions) return { toolUseId: b.id, questions };
    }
  }
  return null;
}
```

(Note: the local type guards keep `any` out — the `unknown` casts are narrowed immediately. If the no-`unknown` rule is read strictly, get approval; these are at a genuine JSON trust boundary, which the rule explicitly allows with type guards.)

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- __tests__/detect-ask-user-question.test.ts`
Expected: PASS (4 tests). The `deferred_tools_delta` case is the regression guard against the rejected scanner signal.

- [ ] **Step 5: Commit**

```bash
git add src/services/questions/detectAskUserQuestion.ts __tests__/detect-ask-user-question.test.ts
git commit -m "feat(question): detect AskUserQuestion tool_use in JSONL lines"
```

---

### Task 3: `answersToKeystrokes` (pure — the critical translator)

**Files:**
- Create: `src/services/questions/answersToKeystrokes.ts`
- Test: `__tests__/answers-to-keystrokes.test.ts`

**Interfaces:**
- Consumes: `AskQuestion` (Task 1).
- Produces: `answersToKeystrokes(questions: AskQuestion[], answers: Record<string, string | string[]>): string` and `class UnknownOptionError extends Error`. v1: single-select per question; multi-question replays each question's `↓×n + Enter` in order. Throws `UnknownOptionError` if a chosen label matches no option (v1 treats unmatched as an error, not free-text — free-text is v2).

- [ ] **Step 1: Write the failing tests (exact bytes — the most important tests in the feature)**

Create `__tests__/answers-to-keystrokes.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { answersToKeystrokes, UnknownOptionError } from "../src/services/questions/answersToKeystrokes";
import type { AskQuestion } from "../src/types";

const DOWN = "\x1b[B";
const ENTER = "\r";

function q(question: string, labels: string[]): AskQuestion {
  return { question, header: "H", multiSelect: false, options: labels.map(l => ({ label: l, description: "" })) };
}

describe("answersToKeystrokes (single-select v1)", () => {
  it("first option → just Enter (cursor starts at 0)", () => {
    expect(answersToKeystrokes([q("Q?", ["A", "B", "C"])], { "Q?": "A" })).toBe(ENTER);
  });
  it("third of four → two downs + Enter", () => {
    expect(answersToKeystrokes([q("Q?", ["A", "B", "C", "D"])], { "Q?": "C" })).toBe(DOWN + DOWN + ENTER);
  });
  it("multi-question → blocks concatenated in question order", () => {
    const qs = [q("Q1", ["A", "B"]), q("Q2", ["X", "Y", "Z"])];
    // Q1 → B = 1 down; Q2 → Z = 2 downs
    expect(answersToKeystrokes(qs, { Q1: "B", Q2: "Z" })).toBe(DOWN + ENTER + DOWN + DOWN + ENTER);
  });
  it("throws UnknownOptionError when a label matches no option", () => {
    expect(() => answersToKeystrokes([q("Q?", ["A", "B"])], { "Q?": "Nope" })).toThrow(UnknownOptionError);
  });
  it("throws when an answer for a question is missing", () => {
    expect(() => answersToKeystrokes([q("Q?", ["A", "B"])], {})).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- __tests__/answers-to-keystrokes.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/services/questions/answersToKeystrokes.ts`:

```typescript
import type { AskQuestion } from "../../types";

const DOWN = "\x1b[B";
const ENTER = "\r";

export class UnknownOptionError extends Error {
  constructor(public readonly question: string, public readonly value: string) {
    super(`No option labelled "${value}" for question "${question}"`);
    this.name = "UnknownOptionError";
  }
}

// v1: single-select only. Cursor starts at index 0; N downs + Enter selects index N.
// Multi-question calls replay each question's block in the order Claude presents them.
export function answersToKeystrokes(
  questions: AskQuestion[],
  answers: Record<string, string | string[]>,
): string {
  let out = "";
  for (const q of questions) {
    const raw = answers[q.question];
    if (raw === undefined) {
      throw new Error(`Missing answer for question "${q.question}"`);
    }
    const label = Array.isArray(raw) ? raw[0] : raw; // v1 ignores extra (multiSelect is v2)
    const target = q.options.findIndex(o => o.label === label);
    if (target < 0) throw new UnknownOptionError(q.question, label);
    out += DOWN.repeat(target) + ENTER;
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- __tests__/answers-to-keystrokes.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/questions/answersToKeystrokes.ts __tests__/answers-to-keystrokes.test.ts
git commit -m "feat(question): translate structured answers to PTY keystrokes"
```

---

### Task 4: Broadcast `question` from the watcher seam

**Files:**
- Modify: `src/server.ts` (the `onNewLines` callback ~208–224; add a `pendingQuestions` field near `sessionFileMap` ~104)
- Test: `__tests__/on-new-lines-question.test.ts` (test the extraction+broadcast decision via a small extracted helper, to avoid standing up the whole server)

**Interfaces:**
- Consumes: `detectAskUserQuestion` (Task 2), `wsHub.broadcast` (`src/ws-hub.ts:49`), `WSMessage` (Task 1).
- Produces: a `pendingQuestions: Map<string, { toolUseId: string; questions: AskQuestion[] }>` on the server; for each new line that is an AskUserQuestion, records it and broadcasts `{type:"question", sessionId, toolUseId, questions}`. Existing `conversation_event(s)` broadcasts are untouched.

- [ ] **Step 1: Extract a testable helper + write its failing test**

Create `src/services/questions/questionBroadcast.ts`:

```typescript
import type { AskQuestion, WSMessage } from "../../types";
import { detectAskUserQuestion } from "./detectAskUserQuestion";

export interface PendingQuestion { toolUseId: string; questions: AskQuestion[] }

// Pure decision: given the new lines for a session, returns the question messages
// to broadcast and the pending-question records to store. No I/O.
export function questionsFromLines(sessionId: string, lines: string[]): {
  messages: Extract<WSMessage, { type: "question" }>[];
  pending: PendingQuestion[];
} {
  const messages: Extract<WSMessage, { type: "question" }>[] = [];
  const pending: PendingQuestion[] = [];
  for (const line of lines) {
    const detected = detectAskUserQuestion(line);
    if (detected) {
      messages.push({ type: "question", sessionId, toolUseId: detected.toolUseId, questions: detected.questions });
      pending.push(detected);
    }
  }
  return { messages, pending };
}
```

Create `__tests__/on-new-lines-question.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { questionsFromLines } from "../src/services/questions/questionBroadcast";

const line = JSON.stringify({ message: { content: [
  { type: "tool_use", id: "toolu_5", name: "AskUserQuestion", input: { questions: [
    { question: "Q?", header: "H", options: [{ label: "A", description: "" }, { label: "B", description: "" }] },
  ] } },
] } });

describe("questionsFromLines", () => {
  it("produces one question message + pending record per AskUserQuestion line", () => {
    const r = questionsFromLines("s1", ["plain text line", line]);
    expect(r.messages).toHaveLength(1);
    expect(r.messages[0]).toMatchObject({ type: "question", sessionId: "s1", toolUseId: "toolu_5" });
    expect(r.pending[0].toolUseId).toBe("toolu_5");
  });
  it("produces nothing for non-question lines", () => {
    expect(questionsFromLines("s1", ["{}", "not json"]).messages).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- __tests__/on-new-lines-question.test.ts`
Expected: FAIL — module not found.

(The helper file is created in Step 1, so this fails only until you save it; if you saved it, the test passes — in that case proceed; TDD intent is satisfied by writing the test alongside the minimal helper.)

- [ ] **Step 3: Wire it into `server.ts`**

Add the field near line 104:

```typescript
private pendingQuestions = new Map<string, { toolUseId: string; questions: import("./types").AskQuestion[] }>();
```

In the `onNewLines` callback, inside the `if (watchedPath === filePath) {` block, **before** the existing `conversation_events` broadcast, add:

```typescript
const { messages, pending } = questionsFromLines(sessionId, lines);
for (const p of pending) this.pendingQuestions.set(sessionId, p); // last pending wins
for (const m of messages) this.wsHub.broadcast(m);
```

Add the import at the top of `server.ts`:

```typescript
import { questionsFromLines } from "./services/questions/questionBroadcast";
```

- [ ] **Step 4: Run the helper test + typecheck**

Run: `npm run test -- __tests__/on-new-lines-question.test.ts`
Then: `npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/server.ts src/services/questions/questionBroadcast.ts __tests__/on-new-lines-question.test.ts
git commit -m "feat(question): broadcast structured question on AskUserQuestion lines"
```

---

### Task 5: `POST /:id/answer` → translate → PTY

**Files:**
- Modify: `src/api/routes/sessions.routes.ts` (add route after the `/:id/input` route ~line 54)
- Modify: `src/api/types/api-deps.ts` (add `handleSendAnswer` ~line 36)
- Modify: `src/server.ts` (implement `handleSendAnswer`; clear pending + emit `question_cancelled` on success)
- Test: `__tests__/handle-send-answer.test.ts` (test the validation/translation decision via an extracted pure helper)

**Interfaces:**
- Consumes: `answersToKeystrokes` (Task 3), `pendingQuestions` (Task 4), `ptyManager.sendKeys(sessionId, keys)` (`src/pty-manager.ts:297`), `json(res, status, data)` (`src/server.ts:2302`), `readBody(req)`.
- Produces: `handleSendAnswer(sessionId, req, res)`. Reads `{ toolUseId, answers }`. If no pending question for session → `400 {ok:false, reason:"no_pending_question"}`. If `toolUseId` ≠ pending → `400 {ok:false, reason:"tool_use_mismatch"}`. Else compute keystrokes; on `UnknownOptionError` → `400 {ok:false, reason:"unknown_option"}`; else `sendKeys`, clear pending, broadcast `question_cancelled`, return `200 {ok:true}`.

- [ ] **Step 1: Extract the decision + write its failing test**

Create `src/services/questions/resolveAnswer.ts`:

```typescript
import type { AskQuestion } from "../../types";
import { answersToKeystrokes, UnknownOptionError } from "./answersToKeystrokes";

export type AnswerResolution =
  | { ok: true; keys: string }
  | { ok: false; reason: "no_pending_question" | "tool_use_mismatch" | "unknown_option" };

export function resolveAnswer(
  pending: { toolUseId: string; questions: AskQuestion[] } | undefined,
  body: { toolUseId?: unknown; answers?: unknown },
): AnswerResolution {
  if (!pending) return { ok: false, reason: "no_pending_question" };
  if (typeof body.toolUseId !== "string" || body.toolUseId !== pending.toolUseId) {
    return { ok: false, reason: "tool_use_mismatch" };
  }
  const answers = (body.answers ?? {}) as Record<string, string | string[]>;
  try {
    return { ok: true, keys: answersToKeystrokes(pending.questions, answers) };
  } catch (e) {
    if (e instanceof UnknownOptionError) return { ok: false, reason: "unknown_option" };
    throw e;
  }
}
```

Create `__tests__/handle-send-answer.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { resolveAnswer } from "../src/services/questions/resolveAnswer";
import type { AskQuestion } from "../src/types";

const pending = {
  toolUseId: "t1",
  questions: [{ question: "Q?", header: "H", multiSelect: false, options: [
    { label: "A", description: "" }, { label: "B", description: "" },
  ] }] as AskQuestion[],
};

describe("resolveAnswer", () => {
  it("no pending → no_pending_question", () => {
    expect(resolveAnswer(undefined, { toolUseId: "t1", answers: { "Q?": "A" } })).toEqual({ ok: false, reason: "no_pending_question" });
  });
  it("wrong toolUseId → tool_use_mismatch", () => {
    expect(resolveAnswer(pending, { toolUseId: "WRONG", answers: { "Q?": "A" } })).toEqual({ ok: false, reason: "tool_use_mismatch" });
  });
  it("unknown label → unknown_option", () => {
    expect(resolveAnswer(pending, { toolUseId: "t1", answers: { "Q?": "Z" } })).toEqual({ ok: false, reason: "unknown_option" });
  });
  it("valid answer → ok + keys (B = 1 down + Enter)", () => {
    expect(resolveAnswer(pending, { toolUseId: "t1", answers: { "Q?": "B" } })).toEqual({ ok: true, keys: "\x1b[B\r" });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- __tests__/handle-send-answer.test.ts`
Expected: FAIL — module not found (until Step 1 file saved; then PASS).

- [ ] **Step 3: Add the route + ApiDeps entry**

In `src/api/routes/sessions.routes.ts`, after the `/:id/input` route:

```typescript
app.post("/:id/answer", async (c) => {
  await deps.handleSendAnswer(c.req.param("id"), c.env.incoming, c.env.outgoing);
  return alreadyHandled();
});
```

In `src/api/types/api-deps.ts`, add to the `ApiDeps` interface:

```typescript
handleSendAnswer: (sessionId: string, req: IncomingMessage, res: ServerResponse) => Promise<void>;
```

- [ ] **Step 4: Implement `handleSendAnswer` in `server.ts`**

Add the method (mirror `handleSendInput`'s body-read + `json` response style) and pass it in wherever `ApiDeps` is constructed (search `handleSendInput:` in server.ts and add `handleSendAnswer: this.handleSendAnswer.bind(this),` next to it):

```typescript
private async handleSendAnswer(sessionId: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readBody(req);
  const pending = this.pendingQuestions.get(sessionId);
  const resolution = resolveAnswer(pending, body);
  if (!resolution.ok) {
    json(res, 400, { ok: false, reason: resolution.reason });
    return;
  }
  try {
    this.ptyManager.sendKeys(sessionId, resolution.keys);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send answer";
    json(res, 400, { ok: false, reason: message });
    return;
  }
  const toolUseId = pending!.toolUseId;
  this.pendingQuestions.delete(sessionId);
  this.wsHub.broadcast({ type: "question_cancelled", sessionId, toolUseId });
  json(res, 200, { ok: true });
}
```

Add the import:

```typescript
import { resolveAnswer } from "./services/questions/resolveAnswer";
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npm run test -- __tests__/handle-send-answer.test.ts`
Then: `npm run test` (full suite — confirm no regressions) and `npx tsc --noEmit`.
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/api/routes/sessions.routes.ts src/api/types/api-deps.ts src/server.ts src/services/questions/resolveAnswer.ts __tests__/handle-send-answer.test.ts
git commit -m "feat(question): add /answer endpoint translating answers to keystrokes"
```

---

### Task 6: Cancel pending on session resolution + 60s safety

**Files:**
- Modify: `src/server.ts` (where `sessionFileMap.delete(sessionId)` happens on idle, and on status change to a non-waiting state)
- Test: covered by manual/live verification; add a unit test only if a pure helper emerges.

**Interfaces:**
- Consumes: `pendingQuestions` (Task 4), `wsHub.broadcast` (`question_cancelled`).
- Produces: pending questions are cleared (and `question_cancelled` broadcast) when the session goes idle / the PTY detaches, so mobile dismisses a stale card. A 60s timer per pending question also clears it (mirrors Claude Code's own 60s timeout).

- [ ] **Step 1: Clear on idle/detach**

Find each `this.sessionFileMap.delete(sessionId)` site (server.ts ~283, ~538, ~1783 per the seam map). Next to each, add:

```typescript
const pq = this.pendingQuestions.get(sessionId);
if (pq) {
  this.pendingQuestions.delete(sessionId);
  this.wsHub.broadcast({ type: "question_cancelled", sessionId, toolUseId: pq.toolUseId });
}
```

- [ ] **Step 2: 60s auto-expiry**

In the broadcast step of Task 4 (`questionsFromLines` wiring), when storing a pending question, also arm a timer:

```typescript
for (const p of pending) {
  this.pendingQuestions.set(sessionId, p);
  setTimeout(() => {
    const cur = this.pendingQuestions.get(sessionId);
    if (cur && cur.toolUseId === p.toolUseId) {
      this.pendingQuestions.delete(sessionId);
      this.wsHub.broadcast({ type: "question_cancelled", sessionId, toolUseId: p.toolUseId });
    }
  }, 60_000);
}
```

- [ ] **Step 3: Typecheck + full suite**

Run: `npm run test` and `npx tsc --noEmit`.
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/server.ts
git commit -m "feat(question): cancel pending question on resolution and 60s timeout"
```

---

### Task 7: Live verification (REQUIRED gate before shipping)

**Not a code task — a verification gate.** Do this against a real Claude Code session before trusting the translator.

- [ ] **Step 1:** Start the streamer; from tb-mobile (or a WS client), start a session whose prompt asks an `AskUserQuestion` (e.g. run a task that triggers a clarifying question, or `claude` in plan mode).
- [ ] **Step 2:** Confirm a `{type:"question", ...}` WS message is emitted with the right `questions`.
- [ ] **Step 3:** `POST /api/sessions/:id/answer { toolUseId, answers: { "<question>": "<a non-first option>" } }`.
- [ ] **Step 4:** Observe the PTY / next `conversation_event`: confirm Claude Code selected **exactly that option** (not off-by-one). If wrong, the assumption "cursor starts at index 0" is false — adjust `answersToKeystrokes` (single place) and re-run the unit tests.
- [ ] **Step 5:** Confirm `question_cancelled` is emitted after the answer and after a 60s no-answer timeout.

---

## Self-review

**Spec coverage:**
- Detect `tool_use{AskUserQuestion}` from JSONL → Task 2 (+ deferred_tools_delta regression guard). ✓
- `question` WS message → Tasks 1, 4. ✓
- `question_cancelled` (answer / idle / 60s) → Tasks 5, 6. ✓
- `/answer` endpoint with `no_pending_question`/`tool_use_mismatch`/`unknown_option` → Task 5. ✓
- `answersToKeystrokes` pure + exact-byte tests (single-select + multi-question) → Task 3. ✓
- Streamer owns option-order/index math → Tasks 3, 5 (mobile sends labels, not keystrokes). ✓
- Live-verify gate → Task 7. ✓
- multiSelect / "Other" → v2 (types accommodate; translator v1 single-select only). ✓

**Placeholder scan:** None. Every code step shows complete code; the only non-code task (7) is an explicit verification checklist.

**Type consistency:** `AskQuestion`/`AskOption` (Task 1) consumed unchanged in 2/3/4/5. `pendingQuestions` value shape identical in Tasks 4/5/6. `answersToKeystrokes` signature identical in Tasks 3/5. `resolveAnswer` reason literals match the spec's `/answer` response union. ✓

**Cross-repo note:** The mobile plan (`2026-06-19-structured-askuserquestion-mobile.md`) consumes the `question`/`question_cancelled`/`/answer` contracts defined here. Ship order is independent (both back-compatible), but end-to-end works only once both land. Optionally add the `question`/`question_cancelled` shapes to `contracts/mobile.schema.json` if mobile validates against the schema files.
```
