# Threadbase Mobile — UI Kit

A high-fidelity recreation of the **Threadbase mobile** app — an Expo / React Native (NativeWind) **remote-control center** for Claude Code agent sessions running on a server.

## Structure (per `status-mobile.md`)

The mobile app's navigation goes:

1. **Onboarding** — server URL + API key, QR-code hint, SecureStore credential persist
2. **Kanban board** — 4 columns: Running / Waiting / Completed / Failed, with live WebSocket updates
3. **Session detail** — streamed terminal output (ANSI-stripped), jump-to-bottom, copy
4. **Prompt queue** — bottom-sheet modal, drag-to-reorder, plan preview
5. **Conversation history** — infinite-scroll list, search, conversation detail (markdown + tool cards)
6. **Settings** — per-event push-notification prefs, quiet hours, terminal max-lines

This kit recreates **the Kanban dashboard, a Session detail view, the Prompt queue bottom sheet, the Conversation history list, and the Onboarding screen** as click-thru screens inside an iOS device frame.

> ⚠️ **Caveat:** the `threadbase-mobile` repo is private and was not directly readable. The design here is reverse-engineered from the brand mark, the documented feature list, and the visual foundations established at the design-system root. Reconcile against the real source when accessible.

## Files

| File | What |
|---|---|
| `index.html` | Interactive iOS-frame demo wired together. Use this. |
| `MobileApp.jsx` | The shell — tab bar, header, screen router. |
| `KanbanScreen.jsx` | Lanes + session cards. |
| `SessionDetailScreen.jsx` | Streamed terminal view with controls. |
| `PromptQueueSheet.jsx` | Bottom sheet for queued prompts. |
| `HistoryScreen.jsx` | Conversation list + search bar. |
| `OnboardingScreen.jsx` | Server URL + API key entry. |
