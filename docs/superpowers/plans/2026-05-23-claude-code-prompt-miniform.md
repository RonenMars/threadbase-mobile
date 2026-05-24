# Plan — Native mini-form for Claude Code interactive prompts

**Status:** queued (stub — flesh out when picked up)
**Created:** 2026-05-23
**Touches:** `tb-mobile` + `tb-streamer` (PTY stream contract)

## Problem

Claude Code (the CLI) emits interactive prompts inline in its TTY output — numbered selection lists, single-choice radio-style questions, and multi-select checkboxes. Today these render in the mobile app as raw scrollback text inside the PTY view; the user has to scroll to find the question and type the matching number/letter into the input. On a phone screen this is awkward, error-prone (mis-typed numbers), and visually mixes the prompt with surrounding tool output.

## Goal

When Claude Code asks an interactive question, render it in the mobile UI as a native mini-form:

- Single-choice prompts → radio-style list, tap to select, "Submit" button
- Multi-choice prompts → checkbox list with multi-select + submit
- Free-text follow-ups (if applicable) → stay as PTY text or get their own input affordance — TBD
- The raw text version of the prompt in the PTY view should be hidden or visually de-emphasized while the form is active so there's no "two places to answer" confusion

## Open design questions

These need answers before implementation — the plan stub doesn't pretend to know them yet:

1. **Detection.** How does the mobile app know a prompt has started and finished?
   - **Option A — Regex on PTY stream.** Fragile across Claude Code versions; whitespace/ANSI variations will break it.
   - **Option B — Structured marker from `tb-streamer`.** Have the streamer detect the prompt shape and emit a typed WS event (e.g. `{ type: 'prompt', shape: 'single'|'multi', options: [...], promptId }`). Mobile renders the form from the event, not from PTY bytes.
   - **Option C — Cooperation from Claude Code itself.** If Claude Code can emit a machine-readable sidechannel (env-flag-gated structured stdout, OSC escape, control sequence), the streamer can pass it through cleanly. Best long-term, but depends on upstream.
   - **Recommendation to validate:** start with B (streamer-side detection + WS event) because it keeps mobile dumb and lets us iterate on the detection logic in one place.

2. **Suppressing the duplicate in PTY.** Once the form renders, do we:
   - Hide the lines in scrollback (risk: misalignment with terminal cursor),
   - Render an inline placeholder ("[answered via form ↑]"), or
   - Leave the raw text and accept the duplication?

3. **Submission.** What gets written to stdin?
   - Single-choice: the option's number/letter exactly as Claude Code expects (e.g. `1\n`).
   - Multi-choice: Claude Code's multi-select TUI uses arrow keys + space + enter — this is the hard one. Either replay the key sequence, or rely on a future Claude Code flag that accepts a comma-list.

4. **Cancel / dismiss.** What happens if the user backgrounds the app, swipes the form away, or the prompt times out streamer-side?

5. **Unknown shapes.** If detection fires but the parsed shape doesn't match a known form (e.g. a typed-input prompt with no options), fall back to PTY text — never block the user.

## Cross-repo coordination

Likely shape, pending design:

- **`tb-streamer`:** new prompt detector module + WS event type + stdin-injection endpoint that accepts a structured answer (`{ promptId, answer }`). The detector lives streamer-side so detection logic can be hot-fixed without a mobile rebuild.
- **`tb-mobile`:** subscribes to the new WS event, renders a `<PromptForm>` overlay/inline above the chat input when active, posts the answer back via the existing WS or a sibling REST endpoint, masks the corresponding PTY lines.

## Component sketch (mobile side)

```
<SessionDetailScreen>
  <ChatScrollback>             // existing
  {activePrompt && (
    <PromptForm                 // new — overlay or above-input slot
      shape={activePrompt.shape}
      options={activePrompt.options}
      onSubmit={answer => submitPrompt(activePrompt.promptId, answer)}
      onDismiss={() => clearActivePrompt()}
    />
  )}
  <ChatInput />                 // existing
</SessionDetailScreen>
```

`activePrompt` lives in the session-detail store (zustand), populated by the WS handler.

## Risks

- Regex-based detection will fail on edge cases (long option labels with embedded newlines, ANSI color codes mid-prompt, scroll-clipped output). Streamer-side detection helps but doesn't eliminate.
- Multi-select TUI on Claude Code's side currently uses interactive cursor keys — submitting a multi-answer cleanly may not be possible without an upstream change. The plan should validate this before committing to the multi-select form variant.
- Adding this is a behavior change in a path users have already learned to live with — make sure the form is clearly better than the typed number, otherwise it'll feel like friction.

## Acceptance criteria (preliminary — refine when picked up)

- [ ] Single-choice prompts render as a radio list and submit correctly
- [ ] Multi-choice prompts at least render correctly (even if submit is gated on upstream support)
- [ ] PTY scrollback doesn't show a duplicate "type your answer" prompt while the form is open
- [ ] Unknown prompt shapes fall back to PTY rendering with no errors
- [ ] Form is keyboard-accessible (a11y) and respects the user's theme + language
- [ ] No regression in non-prompt PTY output (tool output, code blocks, etc.)

## Out of scope

- Free-text "what should I name this?" style prompts (separate UX problem)
- Replacing the chat input itself
- Anything that requires forking Claude Code
