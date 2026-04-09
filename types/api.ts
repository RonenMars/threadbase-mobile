export type SessionStatus = 'running' | 'waiting_input' | 'completed' | 'failed' | 'idle'

export interface Session {
  id: string
  status: SessionStatus
  projectPath: string
  projectName: string
  branch?: string
  machineName?: string
  lastOutput: string
  elapsedMs: number
  promptCount: number
  startedAt: string
  completedAt?: string
}

export interface Conversation {
  id: string
  title: string
  projectPath: string
  branch?: string
  messageCount: number
  lastActivity: string
  model?: string
  totalTokens?: number
}

export interface ConversationFilter {
  projectPath?: string
  dateFrom?: string
  dateTo?: string
  profileId?: string
}

export interface ConversationPage {
  conversations: Conversation[]
  hasMore: boolean
  offset: number
  total: number
}

export interface ConversationDetail extends Conversation {
  messages: Message[]
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: MessageContent[]
  timestamp: string
  tokens?: number
}

export type MessageContent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; toolName: string; content: string; isError?: boolean }
  | { type: 'diff'; filename: string; hunks: DiffHunk[] }

export interface DiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: DiffLine[]
}

export interface DiffLine {
  type: 'context' | 'addition' | 'deletion'
  content: string
}

export interface Profile {
  id: string
  name: string
  claudeConfigDir: string
  conversationCount: number
}

export interface ServerInfo {
  version: string
  machineName: string
  platform: string
  activeSessions: number
}

export interface QueuedPrompt {
  id: string
  text: string
  addedAt: string
  status: 'pending' | 'running' | 'completed' | 'cancelled'
}

export interface NotificationEvent {
  type: 'waiting_input' | 'session_complete' | 'session_failed' | 'diff_ready'
  sessionId: string
  projectName: string
  message?: string
}

export interface NotificationPreferences {
  waitingInput: boolean
  sessionComplete: boolean
  sessionFailed: boolean
  diffReady: boolean
  quietHoursEnabled: boolean
  quietHoursFrom: string
  quietHoursTo: string
  showBadge: boolean
}

export interface PushRegisterPayload {
  token: string
  platform: 'ios' | 'android'
}
