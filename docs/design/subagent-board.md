# Sub-agent board

Design for the **Sub-agents** segment on the home screen (Now | Projects | Sub-agents), showing every sub-agent across the active servers, grouped under its parent.

Design artifact (four boards: Board, Manage sheet, Read-only transcript, Degraded and empty states): https://claude.ai/artifact/UxtqKjMHTNW1V9DDfFREsL

## Built

- Third segment on the home screen, local state, not persisted.
- Active / All filter, summary strip (active now, parents, total), groups by parent.
- A row opens the read-only transcript; a group header opens the parent.
- Older streamer (ignores `include=subagents`): one plain line, no crash.

## Designed, not built

- Manage sheet: notify when finished, hide from board, copy id.
- Followed / Hidden / Recent chips and the "Last hour" stat.

Sub-agents have no PTY: no resume, no input, no stop.
