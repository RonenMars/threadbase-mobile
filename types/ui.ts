/** `state` is the Now list's own order (Needs you → Working → history); the wire sorts it by recency. */
export type SortBy = 'state' | 'lastActivity' | 'projectName'
export type SortOrder = 'asc' | 'desc'
export type SessionsLayout = 'tree' | 'hub' | 'classic'
