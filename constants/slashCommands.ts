export interface SlashCommand {
  /** The command string without the leading slash */
  id: string
  /** Ionicons icon name */
  icon: string
  /** Short display title */
  title: string
  /** One-line description shown as subtitle */
  description: string
  /**
   * Whether this command requires an argument.
   * - false / undefined → execute immediately by sending the raw slash string
   * - true → open the arg input modal before sending
   */
  needsArgs?: boolean
  /**
   * Optional placeholder shown in the arg input field.
   * Only relevant when needsArgs is true.
   */
  argPlaceholder?: string
  /**
   * Optional short label shown above the arg input (e.g. "Model name").
   * Falls back to the command title when omitted.
   */
  argLabel?: string
}

export const SLASH_COMMANDS: SlashCommand[] = [
  // ── No-arg commands (execute immediately) ────────────────────────────────
  {
    id: 'clear',
    icon: 'trash-outline',
    title: 'Clear',
    description: 'Clear conversation history and free context',
  },
  {
    id: 'compact',
    icon: 'albums-outline',
    title: 'Compact',
    description: 'Compress context with a summary to save tokens',
  },
  {
    id: 'review',
    icon: 'checkmark-circle-outline',
    title: 'Review',
    description: 'Review recent changes and provide feedback',
  },
  {
    id: 'help',
    icon: 'help-circle-outline',
    title: 'Help',
    description: 'Show available commands and usage tips',
  },
  {
    id: 'status',
    icon: 'pulse-outline',
    title: 'Status',
    description: 'Show current session status and context usage',
  },
  {
    id: 'cost',
    icon: 'receipt-outline',
    title: 'Cost',
    description: 'Display token usage and estimated cost so far',
  },
  {
    id: 'doctor',
    icon: 'medkit-outline',
    title: 'Doctor',
    description: 'Run diagnostics and check environment setup',
  },
  {
    id: 'bug',
    icon: 'bug-outline',
    title: 'Bug',
    description: 'Open a prefilled bug report for Claude Code',
  },
  {
    id: 'release-notes',
    icon: 'newspaper-outline',
    title: 'Release Notes',
    description: 'Show what\'s new in the current Claude Code version',
  },
  {
    id: 'logout',
    icon: 'log-out-outline',
    title: 'Logout',
    description: 'Sign out of your Anthropic account',
  },
  // ── Commands that require an argument ────────────────────────────────────
  {
    id: 'model',
    icon: 'sparkles-outline',
    title: 'Model',
    description: 'Switch the active Claude model for this session',
    needsArgs: true,
    argLabel: 'Model name',
    argPlaceholder: 'e.g. claude-opus-4-5, claude-sonnet-4-5…',
  },
  {
    id: 'effort',
    icon: 'speedometer-outline',
    title: 'Effort',
    description: 'Set reasoning effort level (low / medium / high)',
    needsArgs: true,
    argLabel: 'Effort level',
    argPlaceholder: 'low, medium, or high',
  },
  {
    id: 'schedule',
    icon: 'calendar-outline',
    title: 'Schedule',
    description: 'Schedule a prompt to run at a specific time',
    needsArgs: true,
    argLabel: 'Schedule expression',
    argPlaceholder: 'e.g. "tomorrow at 9am: run tests"',
  },
  {
    id: 'permissions',
    icon: 'shield-checkmark-outline',
    title: 'Permissions',
    description: 'Allow or deny a specific tool or file path',
    needsArgs: true,
    argLabel: 'Permission rule',
    argPlaceholder: 'e.g. allow bash, deny write /etc',
  },
  {
    id: 'config',
    icon: 'settings-outline',
    title: 'Config',
    description: 'Read or write a Claude Code configuration key',
    needsArgs: true,
    argLabel: 'Config key or key=value',
    argPlaceholder: 'e.g. theme, theme=dark',
  },
  {
    id: 'memory',
    icon: 'bookmark-outline',
    title: 'Memory',
    description: 'Add or update a persistent memory entry',
    needsArgs: true,
    argLabel: 'Memory content',
    argPlaceholder: 'What should Claude remember?',
  },
  {
    id: 'init',
    icon: 'document-text-outline',
    title: 'Init',
    description: 'Create or update CLAUDE.md for this project',
    needsArgs: true,
    argLabel: 'Project path (optional)',
    argPlaceholder: 'Leave empty for current directory',
  },
]
