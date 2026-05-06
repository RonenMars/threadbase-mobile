# Claude Code Prompt: Expo App UI Impact for ProjectChat + `project_id` Migration

## Purpose

You are working on the Expo app / React Native UI for an existing chat application.

The app/package is the Expo frontend project:

```txt
threadbase-mobile
```

The backend is being changed to introduce a normalized `projects` table and migrate from using `project_path` as the primary project identity to using `project_id`.

This prompt explains how the backend change should affect the Expo UI, which existing frontend libraries should be used, and how to update the Zustand store structure safely.

The goal is **not** to rewrite the UI.

The goal is to adapt the existing screens, state, cache, and API usage to the new backend model while preserving compatibility during migration.

---

# Existing Expo Libraries Relevant to This Change

The project already uses these libraries:

```txt
@tanstack/react-query
@tanstack/query-async-storage-persister
@tanstack/react-query-persist-client
@react-native-async-storage/async-storage
zustand
expo-secure-store
```

The project does **not** currently use:

```txt
react-native-mmkv
expo-sqlite
```

Recommendation:

```txt
Do not add react-native-mmkv for this migration.
Do not add expo-sqlite for this migration.
Use TanStack Query + AsyncStorage persistence for server/cache data.
Use Zustand only for local UI/client state.
Use SecureStore only for secrets or small sensitive user-owned local data.
```

---

# Backend Context

The backend currently has two types of project chats:

```txt
Session       = active/live chat
Conversation = historical/resumable chat scanned from HDD
ProjectChat  = UI-facing union of Session or Conversation
```

Previously, both sessions and conversations included:

```ts
project_path
```

That path was effectively used as the project identity.

The backend is moving toward:

```ts
project_id
```

as the primary identity, with:

```ts
project_path
```

kept temporarily as compatibility/display/debug metadata.

---

# Important Backend Lifecycle

A key lifecycle detail:

```txt
session created successfully
  ↓
conversation is created on disk immediately after
  ↓
projects/conversation cache is updated from the new disk conversation
```

Sessions should not be treated as an independent source of unknown project paths.

Project discovery is based on conversations scanned/indexed from HDD.

The backend may now use this optimization:

```txt
Check latest conversation created on HDD.
If latest conversation id is the same as the app/backend cache already knows:
  no need to reload projects/conversations.
If latest conversation id changed:
  refresh or incrementally update projects/conversations.
```

---

# New UI Mental Model

The Expo app should treat the chat list as a list of `ProjectChat` items.

```txt
ProjectChat = either an active session or a historical conversation
```

The UI should not need to deeply care whether the item came from:

```txt
SessionStore
HDD conversation cache
```

But it does need to render different states/actions.

---

# Target API Shape

The backend may expose a unified endpoint like:

```txt
GET /project-chats
GET /project-chats?refreshConversations=1
```

# Shared Backend/UI API Contract

This section is important because the backend and Expo app must agree on the exact contract.

## Endpoint

The Expo app should use:

```txt
GET /project-chats
GET /project-chats?refreshConversations=1
```

Do not use `refresh=1` from the Expo app for the unified endpoint.

Backend may support `refresh=1` as a backward-compatible alias, but the frontend should standardize on:

```txt
refreshConversations=1
```

Meaning:

```txt
refreshConversations=1
  -> force refresh historical conversations/projects from the backend side

normal GET /project-chats
  -> let backend decide whether refresh is needed by checking latest HDD conversation id
```

## Response shape

Prefer a response envelope instead of returning a bare array.

Recommended response:

```ts
export type ListProjectChatsResponse = {
  items: ProjectChat[];
  lastConversationId?: string | null;
  refreshed?: boolean;
};
```

Meaning:

```txt
items:
  unified ProjectChat list

lastConversationId:
  latest conversation id known by backend after its cache/latest-HDD check

refreshed:
  whether backend refreshed conversations/projects during this request
```

The UI should render from:

```ts
response.items
```

The UI may use `lastConversationId` and `refreshed` for diagnostics/debugging, but should not duplicate backend refresh logic.

## Field casing

Backend DB/storage may use snake_case:

```txt
project_id
project_path
latest_message_at
resumed_from_conversation_id
```

HTTP API responses consumed by the Expo app should use camelCase:

```ts
projectId
projectPath
latestMessageAt
resumedFromConversationId
```

The Expo app should not depend on snake_case API fields.

If the backend temporarily returns snake_case during migration, normalize it in the API adapter layer only, not inside UI components.

## Session creation response

After session creation succeeds, the backend lifecycle is:

```txt
create session
  -> create conversation on disk
  -> upsert/link project
  -> update project/conversation cache metadata
  -> return created session
```

Recommended response contract:

```ts
export type CreateSessionResponse = {
  id: string;
  projectId: string;
  projectPath?: string | null;
  conversationId?: string | null;
};
```

The backend should return `projectId` if the conversation-on-disk/project-link flow completed synchronously.

If the backend cannot guarantee `projectId` immediately during migration, the Expo app should:

```txt
navigate by session id
invalidate/refetch projectChats immediately
prefer projectId from the refetched ProjectChat list
```

But the desired final contract is:

```txt
createSession returns sessionId + projectId + optional projectPath
```

## Resume conversation response

Recommended response contract:

```ts
export type ResumeConversationResponse = {
  conversationId: string;
  sessionId: string;
  projectId: string;
  projectPath?: string | null;
  status: "resumed";
};
```

The UI should navigate to the returned `sessionId`.

The UI should invalidate/refetch `projectChats` after resume succeeds.

## Persistence rule

Persist through TanStack Query only:

```txt
ProjectChat list
lightweight project/session/conversation metadata
server info
```

Do not persist full message bodies unless product/security explicitly approves it.

This is stricter than “persist if acceptable” because message content can be sensitive.



Expected item shape:

```ts
type ProjectChat =
  | {
      type: "session";
      id: string;
      projectId: string;
      projectPath?: string | null;
      title: string;
      latestMessageAt: string | null;
      updatedAt?: string | null;
      createdAt?: string | null;
      status: "active";
      source: "session-store";
      resumedFromConversationId?: string | null;
    }
  | {
      type: "conversation";
      id: string;
      projectId: string;
      projectPath?: string | null;
      title: string;
      latestMessageAt: string | null;
      updatedAt?: string | null;
      createdAt?: string | null;
      status: "archived" | "resumable";
      source: "hdd-cache";
      indexedAt?: string | null;
      fileMtime?: string | null;
      filePath?: string | null;
      sourceHash?: string | null;
    };
```

Use actual backend field names if they differ.

---

# UI Migration Principle

Prefer:

```ts
projectId
```

for identity, selection, cache keys, navigation params, and grouping.

Keep:

```ts
projectPath
```

only for:

```txt
display
debugging
fallback compatibility
legacy API calls during migration
```

Do not continue using `projectPath` as the primary key in the UI.

---

# Existing Frontend Store Structure

The app currently has eight Zustand stores.

## `sessions.ts` — `useSessionsStore`

Current purpose:

```txt
In-memory only.
Per-session prompt queues keyed by `${serverId}::${sessionId}`.
```

Current state:

```ts
promptQueues: Record<string, QueuedPrompt[]>
```

Current mutators:

```txt
setQueue
addToQueue
removeFromQueue
reorderQueue
```

Recommendation:

```txt
Keep this store in-memory only.
Do not persist prompt queues.
Do not move server project-chat data here.
```

Reason:

```txt
Prompt queues are runtime UI/session behavior, not authoritative server data.
```

Adjust key usage only if needed:

```txt
Keep queue key = `${serverId}::${sessionId}`.
Do not key queues by projectPath.
Do not key queues by projectId unless queue behavior becomes project-level.
```

---

## `sessionNames.ts` — `useSessionNamesStore`

Current purpose:

```txt
Persisted to expo-secure-store under threadbase_session_names.
Stores user-visible names for sessions and each name's origin.
```

Current state:

```ts
names: Record<string, string>
nameOrigin: Record<string, "manual" | "auto" | "ai">
```

Current key:

```txt
`${serverId}::${sessionId}`
```

Recommendation:

```txt
Keep this store, but consider renaming or extending it later.
For now, do not migrate manual session names to projectId automatically.
```

Reason:

```txt
Manual names are attached to a specific session, not necessarily the whole project.
```

Recommended near-term behavior:

```txt
Continue keying session names by `${serverId}::${sessionId}`.
When rendering a session ProjectChat, local manual name may override server title.
When rendering a conversation ProjectChat, use backend title unless there is a separate conversation-name feature.
```

Optional future improvement:

```txt
Create a more generic chatNames store if both sessions and conversations can have local names.
```

Possible future key:

```txt
`${serverId}::${type}::${id}`
```

Avoid using:

```txt
`${serverId}::${projectPath}`
```

---

## `settings.ts` — `useSettingsStore`

Current purpose:

```txt
Persisted to AsyncStorage under threadbase_settings.
Global app preferences.
```

Current state includes:

```txt
theme
notifications
historyMessageDisplay
addServerAction
sessionsLayout
mergeChats
locale
session-naming flags
runtime-only knobs
```

Recommendation:

```txt
Keep this as the place for global UI preferences only.
Do not store server ProjectChat lists here.
Do not store project cache metadata here unless it is purely UI preference.
```

Relevant setting:

```txt
mergeChats
```

Recommendation for `mergeChats`:

```txt
Review whether `mergeChats` overlaps with the new backend unified ProjectChat list.
If the backend now returns unified/deduped ProjectChat[], the UI should avoid doing a second opinionated merge unless this setting is explicitly a product feature.
```

Possible handling:

```txt
mergeChats=true:
  show unified ProjectChat list.

mergeChats=false:
  optionally render separate sections:
    Active Sessions
    Historical Conversations

But both modes should still consume ProjectChat[] and use projectId/type/id identity.
```

---

## `drafts.ts` — `useDraftsStore`

Current purpose:

```txt
Persisted to expo-secure-store under threadbase_session_drafts.
Stores unsent message drafts per session.
```

Current key:

```txt
`${serverId}::${sessionId}`
```

Recommendation:

```txt
Keep drafts keyed by session id.
Do not key drafts by projectPath.
Do not migrate drafts to projectId unless users can draft at project-level before a session exists.
```

Reason:

```txt
Drafts belong to an active chat input context.
For current behavior, that context is a session.
```

Conversation behavior:

```txt
If user opens/resumes a historical conversation, wait until backend returns a sessionId.
Then use `${serverId}::${sessionId}` as the draft key.
```

Optional future improvement:

```txt
If the UI allows typing into a conversation before resume completes, use a temporary key:
`${serverId}::conversation::${conversationId}`
Then migrate that draft to `${serverId}::session::${sessionId}` after resume succeeds.
```

---

## `servers.ts` — `useServersStore`

Current purpose:

```txt
Persisted to expo-secure-store.
Stores multi-server registry and API keys.
```

Current key behavior:

```txt
Server metadata under threadbase_servers.
Each API key under threadbase_api_key_<serverId>.
```

Recommendation:

```txt
Keep this store as-is for server registry and credentials.
Do not place project chats or project cache data here.
```

Important for this migration:

```txt
All query keys and local identity keys should include serverId.
```

Example:

```ts
["projectChats", serverId]
["session", serverId, sessionId]
["conversation", serverId, conversationId]
["project", serverId, projectId]
```

Reason:

```txt
projectId is server-scoped.
The same projectId may theoretically exist on two different configured servers.
```

---

## `quickAccess.ts` — `useQuickAccessStore`

Current purpose:

```txt
Persisted to AsyncStorage under threadbase_quick_access.
State for the Quick Access strip.
```

Current `FavoriteItem`:

```txt
type: "dir" | "session"
id
label
optional serverId
```

Recommendation:

```txt
Update this store to support ProjectChat identity without using projectPath.
```

Suggested type expansion:

```ts
type FavoriteItem =
  | {
      type: "dir";
      id: string;
      label: string;
      serverId?: string;
    }
  | {
      type: "session";
      id: string;
      sessionId: string;
      projectId?: string;
      label: string;
      serverId: string;
    }
  | {
      type: "conversation";
      id: string;
      conversationId: string;
      projectId?: string;
      label: string;
      serverId: string;
    }
  | {
      type: "project-chat";
      id: string;
      chatType: "session" | "conversation";
      chatId: string;
      projectId: string;
      label: string;
      serverId: string;
    };
```

Recommended simpler direction:

```txt
Prefer introducing `project-chat` favorite items and migrate old `session` favorites gradually.
```

Suggested stable favorite id:

```ts
const favoriteId = `${serverId}::${item.type}::${item.id}`;
```

Do not use:

```ts
projectPath
```

as the favorite id.

Migration behavior:

```txt
Existing session favorites can remain valid.
New favorites should store serverId + type + id + projectId.
If old favorite lacks serverId or projectId, resolve from current ProjectChat list when possible.
If not resolvable, keep it but mark as legacy or remove only after user action.
```

---

## `loading-state.ts` — `useLoadingStateStore`

Current purpose:

```txt
In-memory only.
Tracks slow queries and errors by category.
```

Current categories:

```txt
"sessions" | "messages" | "session-detail" | "browse" | "other"
```

Recommendation:

```txt
Update categories to reflect the new unified list.
```

Suggested categories:

```ts
type QueryCategory =
  | "project-chats"
  | "sessions"
  | "conversations"
  | "messages"
  | "session-detail"
  | "browse"
  | "other";
```

Or, if migrating fully:

```txt
Replace list-level "sessions" usage with "project-chats".
Keep "sessions" only for active-session-specific operations.
Keep "conversations" only for explicit refresh/resume/history operations.
```

Reason:

```txt
The main hub/list is no longer purely sessions.
It is ProjectChat[].
```

---

## `slow-query.ts` — `useSlowQueryStore`

Current purpose:

```txt
In-memory only.
Legacy/simple global slow counter.
```

Recommendation:

```txt
Check if this store is still used.
If unused, remove it.
If still used, migrate usage to loading-state.ts and delete slow-query.ts later.
```

Reason:

```txt
loading-state.ts already has per-category slow tracking and errors.
Keeping both can create inconsistent UI behavior.
```

Suggested Claude Code instruction:

```txt
Search all usages of useSlowQueryStore.
If usage is small and duplicative, replace with useLoadingStateStore.
If usage is broad, leave it for a separate cleanup PR.
```

---

# Store Structure Recommendations Summary

## Keep Zustand for client-owned state only

Use Zustand for:

```txt
prompt queues
drafts
manual local names
settings
server registry
quick access UI state
loading/error UI state
```

Do not use Zustand as the primary cache for server ProjectChat data.

---

## Use TanStack Query for server-owned state

Use TanStack Query for:

```txt
ProjectChat[]
session details
messages
conversation resume mutation
session creation mutation
server /api/info queries
browse queries if server-backed
```

Reason:

```txt
ProjectChat data is server-owned and refresh/invalidation heavy.
TanStack Query already handles cache, staleTime, invalidation, retries, hydration, and persistence.
```

---

## Use AsyncStorage query persister for non-sensitive server cache

The project already has:

```txt
@tanstack/query-async-storage-persister
@tanstack/react-query-persist-client
@react-native-async-storage/async-storage
```

Use this for persisted React Query cache.

Appropriate persisted query data:

```txt
ProjectChat list
session metadata
conversation metadata
non-sensitive message lists if acceptable
server info
```

Be careful with:

```txt
message content
private conversation content
API keys
```

If message content is sensitive, consider excluding message queries from persistence or shortening their cache lifetime.

---

## Use SecureStore only for sensitive/small user-owned data

The app already uses `expo-secure-store`.

Appropriate for SecureStore:

```txt
API keys
server registry metadata if considered sensitive
manual session names if product considers them sensitive
drafts if drafts may contain private content
```

Not ideal for:

```txt
large server caches
large message lists
ProjectChat lists
frequently-changing query cache
```

---

## Do not add `expo-sqlite`

Do not add `expo-sqlite` for this migration.

Reason:

```txt
The backend owns the SQLite data model.
The Expo app should not duplicate backend project/conversation/session indexing locally.
```

Only consider `expo-sqlite` later if the product needs:

```txt
large offline-first local searchable history
local full-text search
complex relational local data
true offline session browsing
```

That is a separate feature, not needed for this migration.

---

## Do not add `react-native-mmkv`

Do not add `react-native-mmkv` for this migration.

Reason:

```txt
AsyncStorage is already installed and integrated with TanStack Query persistence.
The current needs are compatibility/migration and query invalidation, not ultra-low-latency key-value reads.
```

Only consider MMKV later if:

```txt
AsyncStorage performance becomes a measured bottleneck
large persisted settings/state become too slow
startup hydration is too slow and profiling proves storage is the cause
```

Do not add it preemptively.

---

# Recommended TanStack Query Usage

## Query keys

Always include `serverId`.

```ts
export const projectChatKeys = {
  all: ["projectChats"] as const,
  list: (serverId: string) => [...projectChatKeys.all, serverId] as const,
  detail: (serverId: string, type: ProjectChat["type"], id: string) =>
    [...projectChatKeys.list(serverId), type, id] as const,
};
```

Recommended keys:

```txt
["projectChats", serverId]
["session", serverId, sessionId]
["sessionMessages", serverId, sessionId]
["conversation", serverId, conversationId]
["project", serverId, projectId]
```

Avoid:

```txt
["project", projectPath]
["messages", projectPath]
```

---

## Main list query

```ts
export const useProjectChatsQuery = (serverId: string) => {
  return useQuery({
    queryKey: projectChatKeys.list(serverId),
    queryFn: async () => {
      const response = await listProjectChats({ serverId });
      return response.items;
    },
    staleTime: 15_000,
    gcTime: 24 * 60 * 60 * 1000,
  });
};
```

Reasonable `staleTime`:

```txt
15 seconds
```

This aligns with the backend's short session discovery cache and avoids aggressive refetching.

---

## Pull-to-refresh

Use a separate forced fetch, then replace/invalidate the normal query.

```ts
const refreshProjectChats = async () => {
  const response = await listProjectChats({
    serverId,
    refreshConversations: true,
  });

  queryClient.setQueryData(projectChatKeys.list(serverId), response.items);
};
```

Do not force `refreshConversations=1` on every screen focus.

---

## Session creation mutation

```ts
const createSessionMutation = useMutation({
  mutationFn: createSession,
  onSuccess: async (session) => {
    await queryClient.invalidateQueries({
      queryKey: projectChatKeys.list(serverId),
    });

    navigation.navigate("Chat", {
      type: "session",
      id: session.id,
      projectId: session.projectId,
      projectPath: session.projectPath,
    });
  },
});
```

Important:

```txt
After session creation succeeds, backend creates the conversation on disk and updates project/conversation cache.
The UI should invalidate/refetch ProjectChat list.
The UI should not manually synthesize a permanent project from projectPath.
```

---

## Resume conversation mutation

```ts
const resumeConversationMutation = useMutation({
  mutationFn: resumeConversation,
  onSuccess: async (result, conversation) => {
    await queryClient.invalidateQueries({
      queryKey: projectChatKeys.list(serverId),
    });

    navigation.navigate("Chat", {
      type: "session",
      id: result.sessionId,
      projectId: conversation.projectId,
      projectPath: conversation.projectPath,
      resumedFromConversationId: result.conversationId,
    });
  },
});
```

Important:

```txt
Do not hide the conversation optimistically before resume succeeds.
After resume succeeds, backend should dedupe the original conversation from the unified list.
The UI may also defensively dedupe.
```

---

# React Query Persistence Recommendations

Because the project already has:

```txt
@tanstack/query-async-storage-persister
@tanstack/react-query-persist-client
@react-native-async-storage/async-storage
```

Use persisted React Query cache for the ProjectChat list.

Recommended persistence behavior:

```txt
Persist project chat list.
Persist lightweight session/conversation metadata.
Do not persist full messages unless product/security explicitly approves it.
```

Suggested persister setup pattern:

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "threadbase_react_query_cache",
});
```

Use existing app setup if already present.

Recommended dehydration filter:

```ts
dehydrateOptions: {
  shouldDehydrateQuery: (query) => {
    const [root] = query.queryKey;

    return [
      "projectChats",
      "session",
      "conversation",
      "project",
      "serverInfo",
    ].includes(String(root));
  },
}
```

Do not add `sessionMessages` to the persisted allow-list unless product/security explicitly approves persisted message bodies.

Default:

```txt
Do not persist "sessionMessages".
Keep messages memory-only in React Query.
```

---

# Step 1: Inspect Existing Expo Code

Before changing code, inspect the Expo app for:

- Screens that list sessions
- Screens that list conversations
- Any existing "projects" list UI
- Query hooks / API clients for sessions and conversations
- TanStack Query setup and persistence setup
- Zustand stores and hydration flow
- Navigation route params
- Components using `project_path` or `projectPath`
- Components using path as React `key`
- Resume conversation flow
- Create session flow
- Pull-to-refresh behavior
- Optimistic updates
- Offline/cache behavior

Search for:

```txt
project_path
projectPath
session.project_path
conversation.project_path
sessions
conversations
listSessions
listConversations
refresh=1
resume
useSessionsStore
useSessionNamesStore
useSettingsStore
useDraftsStore
useServersStore
useQuickAccessStore
useLoadingStateStore
useSlowQueryStore
```

---

# Step 2: Introduce UI Types

Add or update a frontend type for `ProjectChat`.

Suggested location:

```txt
src/types/projectChat.ts
```

or follow the existing app convention.

Suggested type:

```ts
export type ProjectChatType = "session" | "conversation";

export type ProjectChatSource = "session-store" | "hdd-cache";

export type ProjectChatStatus = "active" | "archived" | "resumable";

export type ProjectChat =
  | {
      type: "session";
      id: string;
      projectId: string;
      projectPath?: string | null;
      title: string;
      latestMessageAt: string | null;
      updatedAt?: string | null;
      createdAt?: string | null;
      status: "active";
      source: "session-store";
      resumedFromConversationId?: string | null;
    }
  | {
      type: "conversation";
      id: string;
      projectId: string;
      projectPath?: string | null;
      title: string;
      latestMessageAt: string | null;
      updatedAt?: string | null;
      createdAt?: string | null;
      status: "archived" | "resumable";
      source: "hdd-cache";
      indexedAt?: string | null;
      fileMtime?: string | null;
      filePath?: string | null;
      sourceHash?: string | null;
    };
```

If the codebase uses generated API types, prefer using generated types and add UI helper types only if needed.

---

# Step 3: Add API Client for Unified Project Chats

Add a client function:

```ts
export const listProjectChats = async ({
  serverId,
  refreshConversations = false,
}: {
  serverId: string;
  refreshConversations?: boolean;
}): Promise<ListProjectChatsResponse> => {
  const params = refreshConversations
    ? { refreshConversations: "1" }
    : undefined;

  return apiForServer(serverId).get("/project-chats", { params });
};
```

Adapt to existing API client style.

If the backend still exposes old endpoints, create a temporary adapter:

```ts
export const listProjectChats = async ({ serverId }: { serverId: string }) => {
  const [sessions, conversations] = await Promise.all([
    listSessions({ serverId }),
    listConversations({ serverId }),
  ]);

  return mergeProjectChatsOnClient({
    sessions,
    conversations,
  });
};
```

Prefer server-side unified list once available.

---

# Step 4: Update Query Keys / Cache Keys

Wherever the app uses query/cache keys, stop keying by `projectPath`.

Prefer:

```ts
["projectChats", serverId]
["projectChat", serverId, item.type, item.id]
["project", serverId, projectId]
["session", serverId, sessionId]
["conversation", serverId, conversationId]
```

Avoid:

```ts
["project", projectPath]
["messages", projectPath]
```

If message fetching is session-specific, prefer:

```ts
["sessionMessages", serverId, sessionId]
```

If the app supports project-level grouping, prefer:

```ts
["projectMessages", serverId, projectId]
```

During migration, if `projectId` can be missing in older responses, use a compatibility helper:

```ts
export const getProjectIdentity = (item: {
  projectId?: string | null;
  projectPath?: string | null;
}) => {
  return item.projectId ?? item.projectPath ?? "";
};
```

But use this only as a temporary bridge.

---

# Step 5: Update Navigation Params

Do not pass only `projectPath` through navigation when opening a chat.

Preferred params:

```ts
{
  type: "session" | "conversation";
  id: string;
  projectId: string;
}
```

Optional compatibility params:

```ts
{
  projectPath?: string | null;
}
```

Example:

```ts
navigation.navigate("Chat", {
  type: item.type,
  id: item.id,
  projectId: item.projectId,
  projectPath: item.projectPath,
});
```

The chat screen should determine what to load based on:

```txt
type + id
```

not only project path.

Recommended:

```txt
type=session      -> load active session by session id
type=conversation -> load/resume historical conversation by conversation id
```

---

# Step 6: Update List Rendering

The chat list should render both sessions and conversations.

Recommended UI behavior:

```txt
session:
  show as active/live
  primary action: open chat
  optional badge: Active

conversation:
  show as historical/resumable
  primary action: resume/open
  optional badge: Resumable or Archived
```

Suggested helper:

```ts
export const getProjectChatBadge = (item: ProjectChat): string | null => {
  if (item.type === "session") return "Active";
  if (item.status === "resumable") return "Resumable";
  if (item.status === "archived") return "Archived";
  return null;
};
```

React key should not be based on `projectPath`.

Use:

```tsx
keyExtractor={(item) => `${item.type}:${item.id}`}
```

Do not use:

```tsx
keyExtractor={(item) => item.projectPath}
```

---

# Step 7: Handle Resume Flow

When user taps a conversation:

Recommended flow:

```txt
If item.type === "session":
  navigate to active chat by session id

If item.type === "conversation":
  call resume endpoint
  receive sessionId + conversationId
  update/invalidate project chats query
  navigate to session chat
```

Pseudo-code:

```ts
const handleOpenProjectChat = async (item: ProjectChat) => {
  if (item.type === "session") {
    navigation.navigate("Chat", {
      type: "session",
      id: item.id,
      projectId: item.projectId,
      projectPath: item.projectPath,
    });

    return;
  }

  const result = await resumeConversation({
    serverId,
    conversationId: item.id,
  });

  await queryClient.invalidateQueries({
    queryKey: projectChatKeys.list(serverId),
  });

  navigation.navigate("Chat", {
    type: "session",
    id: result.sessionId,
    projectId: item.projectId,
    projectPath: item.projectPath,
    resumedFromConversationId: result.conversationId,
  });
};
```

After resume, the backend unified list should hide the original conversation and show the active session.

The UI should still invalidate/refetch the list after resume.

---

# Step 8: Handle Session Creation

When a session is created successfully, backend behavior is:

```txt
session created
conversation created on disk
projects/conversation cache updated if latest conversation id changed
```

UI recommendation:

```txt
After create session success:
  invalidate/refetch projectChats
  navigate to created session
```

Do not manually create a fake project based only on `projectPath`.

If using optimistic UI, use a temporary item keyed by session id, not project path.

Pseudo-code:

```ts
const createSessionMutation = useMutation({
  mutationFn: createSession,
  onSuccess: async (session) => {
    await queryClient.invalidateQueries({
      queryKey: projectChatKeys.list(serverId),
    });

    navigation.navigate("Chat", {
      type: "session",
      id: session.id,
      projectId: session.projectId,
      projectPath: session.projectPath,
    });
  },
});
```

If backend can return the created session without `projectId` during migration, handle this carefully:

```txt
Do not block navigation if session id exists.
Refetch projectChats immediately.
Prefer projectId from refetched list.
```

---

# Step 9: Refresh Behavior in UI

Existing behavior may have pull-to-refresh or manual refresh.

Recommended semantics:

```txt
Normal load:
  GET /project-chats

Pull-to-refresh:
  GET /project-chats?refreshConversations=1
```

But do not over-refresh automatically.

Because backend can now check latest HDD conversation id, the UI can usually call:

```txt
GET /project-chats
```

and let backend decide if refresh is needed.

Use explicit refresh only when the user asks for it.

Suggested behavior:

```txt
Screen focus:
  normal refetch, no forced refresh

Pull-to-refresh:
  forced refreshConversations=1

After create session:
  invalidate projectChats

After resume conversation:
  invalidate projectChats
```

---

# Step 10: Avoid Client-Side Full Reload Logic Based on `projectPath`

Do not implement logic like:

```txt
If project_path differs, reload everything.
```

The backend owns:

```txt
latest conversation id check
conversation cache refresh
projects cache refresh
project_id mapping
```

The UI should consume the resulting `ProjectChat[]`.

If the backend includes metadata such as:

```ts
lastConversationId
```

the UI may store it for diagnostics, but should not duplicate backend refresh logic unless explicitly needed.

---

# Step 11: Loading and Empty States

Because conversations are historical and may require HDD indexing, distinguish loading states:

```txt
Initial loading:
  show normal loading state

Pull-to-refresh:
  show refresh indicator

Refresh conversations/index:
  optional text: "Refreshing conversations..."

Empty:
  "No project chats yet"
```

Avoid exposing internal terms like:

```txt
HDD cache
SessionStore
SQLite cache
```

to end users.

User-facing language should be simple:

```txt
Chats
Active
Recent
Archived
Resumable
```

---

# Step 12: Sorting Expectations

Backend should return sorted list.

But UI can defensively sort if needed.

Sort order:

```txt
latestMessageAt DESC
updatedAt DESC
createdAt DESC
title ASC
```

Suggested helper:

```ts
const getSortTime = (item: ProjectChat) => {
  const value = item.latestMessageAt ?? item.updatedAt ?? item.createdAt;
  return value ? new Date(value).getTime() : 0;
};

export const sortProjectChats = (a: ProjectChat, b: ProjectChat) => {
  const diff = getSortTime(b) - getSortTime(a);
  if (diff !== 0) return diff;

  return a.title.localeCompare(b.title);
};
```

Do not sort by `projectPath`.

---

# Step 13: Deduping Expectations

Backend should dedupe:

```txt
If session.resumedFromConversationId === conversation.id:
  show session
  hide conversation
```

UI should not need to dedupe in normal operation.

However, during migration, add a defensive client-side dedupe if duplicate items appear.

Suggested helper:

```ts
export const dedupeProjectChats = (items: ProjectChat[]): ProjectChat[] => {
  const resumedConversationIds = new Set(
    items
      .filter((item) => item.type === "session")
      .map((item) => item.resumedFromConversationId)
      .filter(Boolean),
  );

  return items.filter((item) => {
    if (item.type !== "conversation") return true;
    return !resumedConversationIds.has(item.id);
  });
};
```

Use this as a safety net, not as the primary source of truth.

---

# Step 14: Message Screen Changes

If the chat screen currently loads messages by `projectPath`, migrate it.

Preferred:

```txt
Session messages:
  load by sessionId

Conversation preview/history:
  load by conversationId

Project-level metadata:
  load by projectId
```

Recommended params:

```ts
type ChatRouteParams = {
  type: "session" | "conversation";
  id: string;
  projectId: string;
  projectPath?: string | null;
};
```

On active chat screen:

```txt
type=session
id=sessionId
```

For historical conversation:

```txt
type=conversation
id=conversationId
```

If the desired product behavior is to always resume before opening, then conversation items should call resume first and navigate to a session screen.

---

# Step 15: Offline/Local Cache Considerations

If the Expo app has local persistence:

- Migrate stored cache keys from `projectPath` to `projectId`.
- Keep a fallback reader for old persisted data.
- Clear or invalidate old cache if migration is too risky.
- Do not merge different projects by path unless backend provides same `projectId`.

Recommended local storage migration:

```txt
If cached ProjectChat has projectId:
  keep it
else:
  treat cached item as legacy and refetch from backend
```

This is safer than trying to generate project IDs on the client.

Never generate permanent `projectId` on the client.

---

# Step 16: Error Handling

Add clear UI handling for these cases:

## Missing projectId

During migration, backend may accidentally return an item without projectId.

UI should not crash.

Recommended:

```ts
const hasProjectId = Boolean(item.projectId);

if (!hasProjectId) {
  // Render item disabled or allow opening by id only if safe.
  // Log/report this as backend data issue.
}
```

Prefer logging:

```txt
ProjectChat missing projectId
```

with:

```txt
type
id
projectPath
```

## Resume failure

If resume fails:

```txt
Show toast/snackbar:
"Could not resume this chat. Please try again."
```

Do not remove the conversation from the list optimistically unless resume succeeded.

## Refresh failure

If pull-to-refresh fails:

```txt
Keep existing list
Show non-blocking error
```

---

# Step 17: Feature Flag / Safe Rollout

If possible, introduce a small compatibility layer.

Also add a small API response normalizer at the client boundary.

Responsibilities:

```txt
unwrap ListProjectChatsResponse.items
convert legacy snake_case fields to camelCase only if backend temporarily returns them
reject/log items missing both projectId and projectPath during migration
```

Do not spread response-shape compatibility logic into UI components.

Recommended approach:

```txt
If /project-chats exists:
  use unified ProjectChat endpoint

Else:
  fallback to old sessions + conversations endpoints and merge on client
```

This allows backend and UI to be merged/deployed more safely.

Example:

```ts
export const getProjectChats = async () => {
  try {
    return await listProjectChats();
  } catch (error) {
    if (isNotFound(error)) {
      return listLegacyProjectChats();
    }

    throw error;
  }
};
```

Only add this fallback if it fits the app architecture and deployment model.

---

# Step 18: Tests to Add

Add/update tests for:

## API adapter

- unwraps `ListProjectChatsResponse.items`
- maps backend `project_id` / `projectId` correctly if legacy response support is needed
- preserves `projectPath`
- handles missing optional fields
- supports `refreshConversations=1`
- does not send `refresh=1` for `/project-chats`
- handles `lastConversationId` and `refreshed` metadata without duplicating backend refresh logic

## Query persistence

- persists ProjectChat list through React Query persister
- does not persist sensitive message queries if excluded
- invalidates ProjectChat list after create session
- invalidates ProjectChat list after resume conversation

## Store behavior

- prompt queues remain keyed by session id
- drafts remain keyed by session id
- manual session names still prefer manual over server names
- quick access does not create new favorites keyed by projectPath
- loading-state supports project-chats category
- slow-query usage is either migrated or intentionally left unchanged

## List screen

- renders sessions and conversations
- shows active/resumable badges
- uses `type:id` as key
- does not use `projectPath` as key
- handles empty state
- handles refresh error without clearing list

## Navigation

- opening a session navigates with session id
- opening a conversation calls resume first
- after resume, navigates to returned session id
- route params include projectId

## Cache/query behavior

- normal screen focus does not force refresh conversations
- pull-to-refresh passes `refreshConversations=1`
- create session success invalidates projectChats
- resume success invalidates projectChats
- local cache does not use projectPath as primary identity

## Deduping safety

- if backend accidentally returns resumed conversation and session, UI hides duplicate conversation defensively

---

# Step 19: Search-and-Replace Guidance

Do not blindly replace every `projectPath` with `projectId`.

Use this decision table:

```txt
React key / cache key / identity:
  use projectId, sessionId, conversationId, or type:id

Display path to user:
  projectPath is OK

Open active chat:
  use sessionId

Resume historical chat:
  use conversationId

Group by project:
  use projectId

Debug/logging:
  projectPath is OK

Backend request requiring legacy path:
  projectPath is OK temporarily
```

---

# Step 20: Recommended Implementation Order

1. Inspect existing Expo app data flow.
2. Inspect TanStack Query provider/persistence setup.
3. Inspect all eight Zustand stores and usages.
4. Add/adjust `ProjectChat` type.
5. Add unified `listProjectChats` API client.
6. Add compatibility adapter if backend endpoint is not guaranteed.
7. Add `projectChatKeys` query key factory with `serverId`.
8. Update query keys to use IDs, not paths.
9. Update list screen to render `ProjectChat[]`.
10. Update key extractor to `${type}:${id}`.
11. Update navigation params to include `type`, `id`, `projectId`, and optional `projectPath`.
12. Update conversation tap behavior to resume before opening.
13. Update create session success behavior to invalidate/refetch projectChats.
14. Update pull-to-refresh to use `refreshConversations=1`.
15. Update Quick Access favorite identity for new items.
16. Update loading-state query categories to include `project-chats`.
17. Check `slow-query.ts` usage and migrate/remove if safe.
18. Add defensive dedupe helper if needed.
19. Remove path-based identity assumptions.
20. Add tests.
21. Run typecheck, lint, and app tests.
22. Manually test session creation, resume, refresh, and app relaunch.

---

# Manual QA Checklist

Test these flows in the Expo app:

```txt
Open app with existing cached chats
Open active session
Open historical conversation and resume it
Confirm resumed conversation becomes active session
Confirm duplicate conversation disappears from list
Create a new session
Confirm new session appears in list
Confirm new conversation/project is reflected after backend update
Pull to refresh conversations
Kill/reopen app and confirm list loads correctly
Verify no React key warnings
Verify projectPath is not required for navigation identity
Verify missing/legacy projectId does not crash the app
Verify Quick Access favorites still work
Verify drafts still attach to the correct session
Verify manual session names still override server names
Verify query cache persists and hydrates as expected
```

---

# Do Not Do These

Do not:

- Use `projectPath` as a React key.
- Use `projectPath` as the main cache key.
- Generate permanent `projectId` on the client.
- Force refresh conversations on every screen focus.
- Reimplement backend latest-conversation-id refresh logic in the UI.
- Assume sessions and conversations have the same behavior.
- Remove `projectPath` display/debug usage too early.
- Open historical conversations as if they were active sessions unless backend says that is supported.
- Hide conversations optimistically before resume succeeds.
- Rewrite the whole app state layer.
- Add `expo-sqlite` for this migration.
- Add `react-native-mmkv` for this migration.
- Store server-owned ProjectChat lists in Zustand as the primary cache.
- Store large server query caches in SecureStore.

---

# Success Criteria

The UI migration is successful when:

```txt
Expo app consumes ListProjectChatsResponse from unified endpoint or compatibility adapter
UI uses projectId/type/id for identity
projectPath remains only compatibility/display/debug metadata
sessions open by session id
conversations resume by conversation id
create session invalidates/refetches projectChats
pull-to-refresh uses refreshConversations=1
no unnecessary forced refresh on normal screen focus
resumed conversations do not appear duplicated
local/query cache is not keyed primarily by projectPath
TanStack Query owns server ProjectChat cache from response.items
AsyncStorage persister is used for non-sensitive persisted query data
SecureStore remains for secrets/sensitive small data
Zustand remains focused on local UI/client-owned state
Quick Access no longer creates new path-keyed chat favorites
loading-state supports project-chats category
UI handles missing projectId safely during migration
tests cover list, navigation, resume, refresh, query cache, and store behavior
```

---

# Final UI Direction

The frontend should think in this model:

```txt
ProjectChat list = what the user sees
Session = active thing the user can chat with now
Conversation = historical thing the user can resume
Project = stable identity behind both
```

Use:

```txt
projectId for identity
sessionId for active chat loading
conversationId for resume/history loading
projectPath only for display/debug/legacy compatibility
TanStack Query for server state
Zustand for local UI state
AsyncStorage persister for non-sensitive query persistence
SecureStore for secrets and sensitive small local records
```
