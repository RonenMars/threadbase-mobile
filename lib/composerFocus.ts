/**
 * Where the composer's focus is, and what should happen to it next.
 *
 * Focus used to be an emergent result of mounting, `autoFocus`, `AppState` and
 * whatever each overlay happened to do, so it was restored inconsistently: the
 * expanded editor and the slash-argument modal handed it back to nobody, while
 * a background/foreground cycle could hand it back from anywhere.
 *
 * The rule this encodes: never invent focus. Only a subflow the composer itself
 * started gives focus back, and only to the input that had it.
 * See docs/audits/composer-keyboard/04-refactor-proposal.md, decision D2.
 */

export type FocusTarget = 'inline' | 'expanded'
export type RestoreTo = FocusTarget | 'none'

/** Overlays that take focus from the composer. */
export type Overlay = 'slashArgs' | 'attach' | 'leaveDialog' | 'rename' | 'modelEffort' | 'review'

/** Composer-owned subflows: the user is still writing the same message. */
const RESTORING_OVERLAYS: ReadonlySet<Overlay> = new Set<Overlay>(['slashArgs', 'attach', 'leaveDialog'])

export type FocusState =
  | { kind: 'idle' }
  | { kind: 'typing'; target: FocusTarget }
  | { kind: 'lent'; restoreTo: RestoreTo }
  | { kind: 'disabled' }
  | { kind: 'away'; restoreTo: RestoreTo }

export type FocusEvent =
  | { type: 'focus'; target: FocusTarget }
  | { type: 'blur' }
  | { type: 'expand' }
  | { type: 'minimize' }
  | { type: 'lend'; overlay: Overlay }
  | { type: 'return'; overlay: Overlay }
  | { type: 'disable' }
  | { type: 'enable' }
  | { type: 'background' }
  | { type: 'foreground'; screenFocused: boolean }

export type FocusEffect =
  | { kind: 'none' }
  | { kind: 'dismiss' }
  | { kind: 'focus'; target: FocusTarget }

const NONE: FocusEffect = { kind: 'none' }
export const INITIAL_FOCUS_STATE: FocusState = { kind: 'idle' }

function focusing(state: FocusState): FocusTarget | null {
  return state.kind === 'typing' ? state.target : null
}

export function composerFocus(state: FocusState, event: FocusEvent): [FocusState, FocusEffect] {
  switch (event.type) {
    case 'focus':
      // A disabled composer cannot be focused; anything else follows the input.
      if (state.kind === 'disabled') return [state, NONE]
      return [{ kind: 'typing', target: event.target }, NONE]

    case 'blur':
      // While an overlay holds focus this is the blur that lending caused.
      if (state.kind === 'lent' || state.kind === 'away') return [state, NONE]
      if (state.kind === 'disabled') return [state, NONE]
      return [{ kind: 'idle' }, NONE]

    case 'expand':
      if (state.kind === 'disabled') return [state, NONE]
      // The editor's own input autofocuses, so this only records where focus went.
      return [{ kind: 'typing', target: 'expanded' }, NONE]

    case 'minimize':
      if (state.kind === 'disabled') return [state, NONE]
      // Continuing the same message: the inline input takes focus back.
      if (focusing(state) === 'expanded') {
        return [{ kind: 'typing', target: 'inline' }, { kind: 'focus', target: 'inline' }]
      }
      return [{ kind: 'idle' }, NONE]

    case 'lend': {
      const target = focusing(state)
      const restoreTo: RestoreTo = target && RESTORING_OVERLAYS.has(event.overlay) ? target : 'none'
      return [{ kind: 'lent', restoreTo }, NONE]
    }

    case 'return':
      if (state.kind !== 'lent') return [state, NONE]
      if (state.restoreTo === 'none') return [{ kind: 'idle' }, NONE]
      return [
        { kind: 'typing', target: state.restoreTo },
        { kind: 'focus', target: state.restoreTo },
      ]

    case 'disable':
      return [{ kind: 'disabled' }, focusing(state) ? { kind: 'dismiss' } : NONE]

    case 'enable':
      // Never focus on becoming enabled; the user asks for the keyboard.
      return state.kind === 'disabled' ? [{ kind: 'idle' }, NONE] : [state, NONE]

    case 'background': {
      const target = focusing(state)
      return [{ kind: 'away', restoreTo: target ?? 'none' }, NONE]
    }

    case 'foreground': {
      if (state.kind !== 'away') return [state, NONE]
      // Another screen is on top: restoring focus here would open the keyboard
      // over it.
      if (state.restoreTo === 'none' || !event.screenFocused) return [{ kind: 'idle' }, NONE]
      return [
        { kind: 'typing', target: state.restoreTo },
        { kind: 'focus', target: state.restoreTo },
      ]
    }
  }
}
