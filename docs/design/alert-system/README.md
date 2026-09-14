# Alert system redesign

Severity-routed alerts for Threadbase mobile. One arbiter (`AlertHost`), four
levels, one surface each. Implementation prompt: [`PROMPT.md`](./PROMPT.md).

The visual spec is **`Alert System Redesign.dc.html`** in the Claude-Design
project *Threadbase session list redesign*. Prefer that live document — local
HTML snapshots go stale.

## Shipping shape

The hybrid recommended on option 1c's card:

- **1c** for anything scoped to visible content (inline).
- **1b** header pill + Status sheet for everything else.
- **1a** untruncated banner copy only when every server is down.

| Level | Surface |
|---|---|
| `critical` | Modal dialog. Blocks. Never auto-dismisses. |
| `error` | Inline in the failing scope, or the pill + Status sheet when that scope is off-screen. |
| `warning` | Header status pill only. |
| `info` | Toast, 5s. The only auto-dismissing surface. |

## Step sequence

1. `AlertHost` arbiter (`feat/alert-host-arbiter`)
2. Header status pill
3. Status sheet
4. Inline-first failures
5. Critical dialogs
6. Demotions and deletions
