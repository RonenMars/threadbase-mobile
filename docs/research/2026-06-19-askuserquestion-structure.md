# Claude Code `AskUserQuestion` — structure reference

**Date:** 2026-06-19
**Status:** Reference (verified)
**Sources:** Agent SDK docs (authoritative schema) + empirical analysis of 954 real `AskUserQuestion` calls across 1,706 transcript files in `~/.claude/projects/`.

This documents the structure of Claude Code's interactive multiple-choice questions — both the **tool-call shape** (what Claude emits) and the **answer shape** (what comes back). It exists because tb-mobile is moving from scraping inquirer-style PTY text (`utils/parseQuestionBlock.ts`) to consuming the **structured** question. See [How it maps to tb-mobile](#how-it-maps-to-tb-mobile) at the bottom.

> Caveat: `AskUserQuestion` is essentially undocumented in the *Claude Code* docs themselves (one-line table entry only); the full schema lives in the **Agent SDK** `user-input` docs, and there is an open docs-gap issue (anthropics/claude-code#20275). The schema below is cross-checked against both the SDK doc and real transcripts.

---

## 1. Where it lives in the transcript

Claude Code session transcripts are JSONL — one JSON object per line — at:

```
~/.claude/projects/<encoded-cwd>/<session-id>.jsonl
```

(`<encoded-cwd>` is the working-directory path with `/` → `-`. Overridable via `CLAUDE_CONFIG_DIR`; files auto-deleted after `cleanupPeriodDays`, default 30.)

A question is a normal **assistant `tool_use` block**, nested at `obj.message.content[]`, paired later by `tool_use_id` with a **user `tool_result` block**:

```jsonc
// assistant line → message.content[] entry
{ "type": "tool_use", "id": "toolu_…", "name": "AskUserQuestion", "input": { "questions": [ … ] }, "caller": { "type": "direct" } }

// later user line → message.content[] entry
{ "type": "tool_result", "tool_use_id": "toolu_…", "content": "User has answered your questions: …" }
```

## 2. The question (tool `input`)

Exactly one top-level key — `questions` — an array of **1–4** question objects:

```jsonc
{
  "questions": [
    {
      "question": "How should I format the output?",   // full prose, ends with "?"
      "header": "Format",                                // short chip label, MAX 12 chars
      "multiSelect": false,                              // true = checkboxes; false/absent = single choice
      "options": [                                        // 2–4 options
        { "label": "Summary",  "description": "Brief overview of key points" },
        { "label": "Detailed", "description": "Full explanation with examples" }
      ]
    }
  ]
}
```

### Field reference

| Path | Type | Required | Notes |
|---|---|---|---|
| `questions` | array | yes | 1–4 items (the only top-level key) |
| `questions[].question` | string | yes | Full question text; the **join key** for answers (not `header`) |
| `questions[].header` | string | yes | Short label, **≤ 12 chars** |
| `questions[].multiSelect` | boolean | effectively yes | Omitted → treated as `false`. Single-select dominates ~40:1 |
| `questions[].options` | array | yes | **2–4** options |
| `questions[].options[].label` | string | yes | Short choice text |
| `questions[].options[].description` | string | yes | One-line explanation of the choice |
| `questions[].options[].preview` | string | no | Opt-in only (see below). ~3% of options |

### Empirical distributions (954 calls / 1,283 questions / 3,770 options)

- **Questions per call:** 1 → 694, 2 → 198, 3 → 47, 4 → 13.
- **Options per question:** 3 → 748, 2 → 310, 4 → 221 (rare 5–6 outliers exist; treat 4 as the soft cap).
- **`multiSelect`:** false 1,252 : true 30 : absent 1.
- `label` + `description` present on **3,770/3,770** options — both are reliably present.

### `preview` (optional, TypeScript-SDK-gated)

`preview` only appears when the host app sets `toolConfig.askUserQuestion.previewFormat`:

| `previewFormat` | `preview` contains |
|---|---|
| unset (default) | field absent — Claude generates no previews |
| `"markdown"` | ASCII art / fenced code blocks (a multi-line `\n`-joined string) |
| `"html"` | a sanitized `<div>` fragment (SDK strips `<script>`/`<style>`/`<!DOCTYPE>`) |

Claude adds `preview` only on single-select options where a visual comparison helps (layouts, color schemes) and omits it for yes/no or text-only choices. Always null-check before rendering. Example (markdown form, as seen in real transcripts):

```jsonc
{
  "label": "Time always visible",
  "description": "Today: '14:35' · Yesterday: 'Yesterday 14:35' · Older: 'Mon 14:35'",
  "preview": "Today:      14:35\nYesterday:  Yesterday 14:35\n2-6 days:   Mon 14:35\nSame year:  8 May 14:35"
}
```

## 3. The answer

Two layers — the **SDK contract** (structured) and the **transcript serialization** (string). They are different; know which one you're handling.

### 3a. SDK contract (what a host app returns)

The host returns an `answers` object plus the original `questions`:

```jsonc
{
  "questions": [ /* the original array, passed back unchanged — required */ ],
  "answers": {
    "How should I format the output?": "Summary",                    // key = question text, value = chosen label
    "Which sections should I include?": ["Introduction", "Conclusion"] // multiSelect → array (or ", "-joined string)
  },
  "response": "…"   // OPTIONAL: a freeform reply the user typed instead of answering any question
}
```

Rules:
- **Keyed by `question` text**, not by `header`.
- **multiSelect** → array of labels, or a `", "`-joined string.
- **"Other" / free text** → put the user's raw text in `answers[question]` (NOT the word "Other").
- **`response`** is only for when the user dismisses the card and types a general reply. When set, Claude receives `"The user responded: …"` instead of the per-answer list.

### 3b. Transcript serialization (what the JSONL `tool_result` stores)

In the transcript the result is **always a flat string** (954/954 — never structured JSON, never a list). Two prefixes:

- Normal answers:
  ```
  User has answered your questions: "<question>"="<label>", "<question2>"="<label2>". You can now continue with the user's answers in mind.
  ```
- multiSelect → labels comma-joined inside one value: `"What to keep?"="PUBLISH_TASK.md, conversation-log.md, SETUP.md"`.
- "Other"/free-text → the user's raw text replaces the label: `"Delete ai/?"="what about @/…/search.md ?"` (so a parser must NOT assume the value is one of the `label`s).
- If `response` was used: `The user responded: …`

## 4. Limits & behaviors

- **1–4 questions** per call, **2–4 options** each (soft caps; UI occasionally exceeds the option cap).
- **`header` ≤ 12 characters.**
- **60-second timeout** on the prompt.
- **Not available in subagents** spawned via the Agent/Task tool — only the top-level (`"caller": {"type": "direct"}`) agent asks.
- Triggered via the same `canUseTool` mechanism as permission prompts; especially common in **plan mode**.

## 5. Parsing gotcha

Matching results by string content fails: plan-mode boilerplate ("…use AskUserQuestion if you need to clarify…") contains the literal token and yields false positives. **Always pair by `tool_use_id`**: collect AskUserQuestion `tool_use.id`s, then match `tool_result.tool_use_id`. That yields the clean 954/954 above.

---

## How it maps to tb-mobile

The mobile app's `QuestionBlock` (`utils/parseQuestionBlock.ts`) is a flattened projection of the structured question:

| tb-mobile `QuestionBlock` | Structured `AskUserQuestion` source |
|---|---|
| `questionText` | `questions[i].question` |
| `options: string[]` | `questions[i].options[].label` |
| `selectedIndex` | (PTY-only artifact — the `❯` cursor row; **absent** in the structured form, which has no pre-selection) |
| `questionLineIndex` | (PTY-only artifact — line offset in the scraped buffer) |
| *(missing)* `header` | `questions[i].header` |
| *(missing)* `multiSelect` | `questions[i].multiSelect` |
| *(missing)* per-option `description` | `questions[i].options[].description` |
| *(missing)* per-option `preview` | `questions[i].options[].preview` |
| *(missing)* multi-question | a single call may carry up to 4 questions |

Implications for the structured path:
- A structured question has **no `selectedIndex`** (nothing is pre-highlighted) and **no line index**. Those two fields are inquirer-scrape artifacts; the structured model should not invent them.
- The structured model is **richer** (header, descriptions, multiSelect, up to 4 questions) and the `QuestionBlock` type / `QuestionCard` UI need to grow to carry it.
- The **answer path differs fundamentally**: the PTY path sends relative arrow keystrokes (`\x1b[B`/`\x1b[A` × delta + `\r`) to `POST /api/sessions/{id}/input {keys}`. A structured answer is a `{question: label}` map (or the SDK `answers` object) and needs its own non-keystroke reply contract — which is the central design question for the structured-question feature.

See the implementation spec at `docs/superpowers/specs/2026-06-19-structured-askuserquestion-design.md` (added by that feature).
