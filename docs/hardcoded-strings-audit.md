# Pre-existing Hardcoded UI Strings

Audit of user-facing English strings not yet routed through i18n (`react-i18next`).
Scope: `app/` and `components/`, excluding already-localized files
(`app/session/[id].tsx`, `components/terminal/TerminalOutput.tsx`) and worktrees/tests.
Read-only research — nothing here has been fixed yet.

## app/index.tsx
- L340: `accessibilityLabel="Server status"` — header cloud/status button
- L352: `accessibilityLabel="Search"` — header search toggle button

## app/_layout.tsx
- L344: `accessibilityLabel="Back"` — custom header back button
- L360: `title: 'Browse'` — Stack.Screen title
- L361: `headerBackTitle: 'Cancel'` — header back title, Browse modal
- L366: `title: 'Settings'` — Stack.Screen title
- L370: `title: 'Manage Favorites'` — Stack.Screen title

## app/browse.tsx
- L200: `Alert.alert('Error', err.message)` — generic browse error
- L414: `placeholder="Folder name"` — new-folder input
- L432-433: `label: 'Claude'`, `label: 'Codex'` — provider filter options

## app/conversation/[id].tsx
- L373: `Alert.alert('Favorites error', 'Failed to update favorites')`
- L585: `accessibilityLabel="Conversation info"` — header info button
- L798-810: info modal field labels: `'ID'`, `'Title'`, `'Session Name'`, `'Project Path'`, `'Repo URL'`, `'File Path'`, `'Branch'`, `'Account'`, `'Provider'`, `'Model'`, `'Message Count'`, `'Total Tokens'`, `'Last Activity'`

## components/ui/FAB.tsx
- L40: `accessibilityLabel="New session"`

## components/ui/AvatarMenu.tsx
- L15: `accessibilityLabel="Settings"`

## components/shared/InfoModal.tsx
- L67: `accessibilityLabel="Close"`

## components/shared/SlashCommandArgModal.tsx
- L79, L107: `accessibilityLabel="Cancel"` — dismiss X and bottom Cancel button

## components/queue/PromptQueueSheet.tsx
- L107: `placeholder="Add a prompt to queue..."`
- L116: `accessibilityLabel="Add prompt to queue"`

## components/queue/PlanPreviewSheet.tsx
- L103: `placeholder="Edit the prompt before proceeding..."`

## components/servers/ServersStatusModal.tsx
- L172: `accessibilityLabel="Server options"`

## components/servers/NoServersWelcome.tsx
- L41: `accessibilityLabel="Add Server"`

## components/servers/ServerEditModal.tsx
- L78: `Alert.alert('Discard changes?', 'Your unsaved changes will be lost.', [...])` with buttons `'Keep Editing'` / `'Discard'`
- L174: `accessibilityLabel="Scan QR code"`
- L183: `placeholder="Paste your API token here"`

## components/servers/ServerListCard.tsx
- ~L80: `server.label || 'Server'` — fallback display text
- L89: `accessibilityLabel="View connection error"`
- L98: `accessibilityLabel="Delete server"`
- L106: `accessibilityLabel="Edit server"`
- L114: `accessibilityLabel="Refresh server info"`

## components/servers/AddServerScreen.tsx
- L54: `title: 'Add Server'`
- L201: `accessibilityLabel="Scan pairing QR"`
- L261: `placeholder="Work Mac, Home Server…"`
- L275: `placeholder="Paste your API token here"`

## components/servers/FilterSortSheet.tsx
- L36-38: `label: 'Tree'`, `'Hub'`, `'Classic'` — view-mode options
- L42-45: `label: 'Last message'`, `'Project name'`, `'Created date'`, `'Status'` — sort options
- L115-117: `label: 'Running'`, `'Active'`, `'Idle'` — status filter chips
- L289-291: `label: 'All'`, `'Claude'`, `'Codex'` — provider filter chips

## components/servers/SortSheet.tsx
- L22-25: `label: 'Project name'`, `'Last message'`, `'Created date'`, `'Status'`

## components/servers/ServerFilterSheet.tsx
- L27-28: `label: 'Running'`, `'Idle'`
- L33-34: `label: 'Last activity'`, `'Started'`

## components/servers/AddServerActionSheet.tsx
- L23: `label: 'Add to displayed'`
- L28: `label: 'Display only the new server'`
- L33: `label: 'Change nothing'`

## components/conversation/ConversationHistoryList.tsx
- L225: `accessibilityLabel="Scroll to top"`

## components/conversation/ConversationList.tsx
- L203: `placeholder="Search conversations…"`
- L244: `accessibilityLabel="Scroll to top"`
- L254: `accessibilityLabel="Scroll to bottom"`

## components/conversation/ChatComposer.tsx
- L128: `accessibilityLabel="Attach file"`
- L197, L223: `accessibilityLabel="Expand input"`
- L268: `accessibilityLabel="Minimize input"`

## components/conversation/LiveConversationView.tsx
- L215: `Alert.alert('Not connected', 'Waiting for connection — try again in a moment.')`
- L224: `Alert.alert('Send failed', ...)`

## components/terminal/TerminalView.tsx
- L54: `Alert.alert('Send failed', ...)`

## components/sessions/SessionCard.tsx
- L125: `Alert.alert('Session Actions', session.projectName, [...])`
- L128: `{ text: 'Dismiss', style: 'cancel' }`
- ~L145: accessibilityLabel template embeds hardcoded word "status"

## components/sessions/hub/SessionRow.tsx
- L45: `options: ['Cancel Session', 'Cancel']` (ActionSheetIOS)
- L49: `Alert.alert('Cancel Session', 'Are you sure?', [...])`
- L52: `{ text: 'No', style: 'cancel' }`
- L55: `text: 'Yes'`
- L64: `Alert.alert('Session Actions', session.projectName, [...])`
- L65: `{ text: 'Cancel Session', style: 'destructive' }`
- L66: `{ text: 'Dismiss', style: 'cancel' }`
- L74: `session.branch || 'no git'`
- ~L77: manual `` `${count} prompt${count===1?'':'s'}` `` pluralization

## components/tour/TourOverlay.tsx
- L86: `<Text>Skip tour</Text>`

## components/tour/FirstShowBanner.tsx
- L35: `<Text>Got it</Text>`

## components/onboarding/components/TokenTooltip.tsx
- L30: `<Text>Got it</Text>`

## components/onboarding/components/InfoTooltip.tsx
- L38: `<Text>Got it</Text>`

## components/onboarding/steps/NotificationsStep.tsx
- L73: `<Text>Wake me only when it counts.</Text>` — onboarding headline
- L90: `<Text>THREADBASE</Text>` — likely intentional brand name in preview mockup, flag only, probably exclude

## Already checked, clean
`app/settings.tsx`, `app/paired-devices.tsx`, `app/session/new.tsx`,
`components/RootErrorBoundary.tsx`, `components/help-feedback.tsx`, `app/backup-restore.tsx`.

## Notes
- Not exhaustive — broad grep-based sweep, prioritized by directory. A full pass
  would also need `app/settings/*`, `app/onboarding/*` steps beyond Notifications,
  and remaining `components/**` not listed above.
- `THREADBASE` brand name and similar intentional non-translatable strings should
  be excluded from any follow-up localization pass.
