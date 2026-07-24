# Accessibility, theme, and performance (U12)

Audit notes for the hardening landed with `feat/a11y-theme-perf`.

## Done in this pass

| Area | Change |
|------|--------|
| Reduce Motion | `useReducedMotion` gates enter animations on `MessageItem` and `SessionCard` |
| Touch targets | Terminal jump/copy controls and DiffViewer copy use `MIN_TOUCH_TARGET` (44) |
| Dynamic Type | Monospace terminal/diff text capped via `MAX_FONT_SIZE_MULTIPLIER_MONO` |
| Screen readers | Terminal lines expose `accessibilityLabel` (`terminal:a11y.line`); DiffViewer container labeled by filename |
| Review entry | Session header Review control already ships with an accessibility label |

## Remaining / follow-ups

- Full accordion Virtualization audit across hub project trees under pathological fan-out
- TalkBack-specific Maestro flows on Android
- Contrast tokens audit for every theme variant (esp. glass + light)
- Long Hebrew/Arabic truncation passes on every settings row

## Manual checks

1. Enable Reduce Motion → new session cards and live chat rows should appear without FadeInDown.
2. Bump Dynamic Type to accessibility sizes → terminal remains readable without horizontal blowouts.
3. VoiceOver on a live terminal → each line announces “Line N: …”.
