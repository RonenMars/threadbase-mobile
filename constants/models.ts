/**
 * Model aliases the streamer accepts wherever a Claude model name is taken —
 * the `--model` CLI flag on a server, and the per-session `/model` switch.
 * Nothing on the wire enumerates models, so this list is the client's own.
 */
export const MODEL_ALIASES = ['sonnet', 'opus', 'haiku'] as const

/**
 * Mirrors the streamer's `MODEL_NAME_RE`: an alias or a full model name.
 * Validated here so an invalid name never costs a round trip for a 400.
 */
export const MODEL_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

/** Reasoning-effort tiers the streamer pins for `/effort`. */
export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const

export type EffortLevel = (typeof EFFORT_LEVELS)[number]
