# Testing pagination vs virtualized lists

This doc explains **what** in the Threadbase mobile app is server-paginated / infinite-scroll vs **client-only** virtualization, and **how to verify** each behavior.

## What uses which pattern

### Paginated / infinite-scroll (server-backed)

| Surface | Mechanism | Server |
|---------|-----------|--------|
| **History → conversation list** (not search) | `useInfiniteQuery` + `onEndReached` → `offset` / `limit` (page size **50**) | `GET /api/conversations?offset=&limit=` |

Search mode uses `GET /api/search` with a fixed limit; there is no “load more” for search results.

### Virtualized list + **message pagination** (server-backed)

| Surface | UI | Server |
|---------|-----|--------|
| **Conversation detail → messages** | FlashList + **`onStartReached`** loads older chunks | `GET /api/conversations/:id?msg_limit=80` (tail), then `&before_index=<next>` for older slices. Response includes **`message_pagination`** (`has_more_older`, `next_before_index`, `total`). Each message has **`message_index`** for stable keys. |

**Backward compatibility:** requests **without** `msg_limit` / `before_index` still return **all** messages (legacy clients).

### Virtualized list only (no server paging)

| Surface | UI | Server |
|---------|-----|--------|
| **History rows** (including skeleton state) | FlashList | N/A for skeletons |

### Not paginated (whole payload at once)

| Surface | Notes |
|---------|--------|
| **Sessions** (Kanban) | `GET /api/sessions` returns the full list; columns use `FlatList` for scrolling, not paging. |

---

## How to test **pagination** (History list)

**Goal:** Prove that more than one page loads and the server is called with increasing `offset`.

### Prerequisites

You need **more than 50** conversations in the streamer index (page size is 50). If you have fewer, infinite scroll will never fire.

### In the app

1. Open **History** with the search field **empty** (not search mode).
2. Scroll **all the way to the bottom** until you briefly see **“Loading more…”** (or the list grows again).
3. Confirm **new** conversation rows appear (not a repeat of the first page only).

### On the streamer (verbose logging)

With `--verbose` (or your LaunchAgent logging), you should see lines like:

- `GET /api/conversations?limit=50&offset=0`
- then `offset=50`, then `offset=100`, …

**Tip:** For this test, avoid **pull-to-refresh** if you want to avoid `refresh=1`, which forces a **full index rebuild** on the server and looks “slow by design.”

### Without the app (optional `curl`)

Use the same **base URL**, **port**, and **API key** as the mobile app:

```bash
KEY="your_api_key_here"
BASE="http://127.0.0.1:8766"   # adjust host/port to match your streamer

curl -s "$BASE/api/conversations?limit=5&offset=0"  -H "Authorization: Bearer $KEY" | head -c 400
echo
curl -s "$BASE/api/conversations?limit=5&offset=5"  -H "Authorization: Bearer $KEY" | head -c 400
echo
```

If the payloads differ (different conversation `id`s), pagination is returning different slices.

---

## How to test **virtualization** (FlashList)

**Goal:** Long lists still scroll smoothly and stay responsive; you are **not** testing server paging (there is none for messages).

### History rows

1. Use the same large history as above (many conversations).
2. **Fling-scroll** up and down repeatedly.
3. Expect smooth scrolling; rendering every row as a non-recycled tree would usually jank on large sets.

### Messages (conversation detail)

1. Open a thread with **more than 80 messages** (or your `msg_limit`).
2. The **first** response should be the **newest** chunk (tail); scroll **to the top** of the thread to trigger loading **older** messages (spinner in the list header while fetching).
3. In verbose streamer logs you should see a first `GET .../api/conversations/<id>?msg_limit=80` (no `before_index`), then `before_index=...` as you scroll up.
4. Fling-scroll to confirm FlashList stays smooth.

### Optional dev tooling

- **React Native dev menu → Perf monitor:** watch JS FPS while flinging.
- **Flipper** (if configured): performance / layout while scrolling.

Message pagination is validated by **verbose logs** (`before_index` stepping) and by the **header spinner** when loading older chunks at the top; virtualization is still validated by **feel** and **FPS** while scrolling.

---

## Pull-to-refresh vs normal load

- **Normal History open** (no pull): first page should be `GET /api/conversations?limit=50&offset=0` **without** `refresh=1` (uses the streamer’s in-memory index after warm-up).
- **Pull-to-refresh** on History: the app sends **`refresh=1`** on the first page so the streamer **drops its cache and rescans disk**—that request can be slower **on purpose** so new files show up.

---

## Quick cheat sheet

| Goal | What to do |
|------|------------|
| **History pagination** | 50+ conversations → scroll to end → “Loading more” / new rows → logs show `offset` stepping (0, 50, 100, …). |
| **Message pagination** | 80+ messages in one thread → scroll to **top** of message list → header spinner → logs show `msg_limit=80` then `before_index` decreasing. |
| **Virtualization** | Long list → fast fling scroll → stable FPS / no long stalls. |
