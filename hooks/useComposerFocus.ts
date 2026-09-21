import { useCallback, useEffect, useRef } from 'react'
import { AppState, Keyboard, type TextInput } from 'react-native'
import { useFocusEffect } from 'expo-router'
import {
  composerFocus,
  INITIAL_FOCUS_STATE,
  type FocusEvent,
  type FocusState,
  type FocusTarget,
  type Overlay,
} from '@/lib/composerFocus'

/**
 * Applies `composerFocus` to the composer's inputs.
 *
 * Overlays are spread across the session screen, the surfaces and
 * `useComposerState`, so they announce themselves through the module-level
 * `lendComposerFocus` / `returnComposerFocus` rather than through props. One
 * live session owns the composer at a time, and the subscription is replaced on
 * every mount, so the latest composer is always the one that answers.
 */
let dispatchToComposer: ((event: FocusEvent) => void) | null = null

export function lendComposerFocus(overlay: Overlay) {
  dispatchToComposer?.({ type: 'lend', overlay })
}

export function returnComposerFocus(overlay: Overlay) {
  dispatchToComposer?.({ type: 'return', overlay })
}

interface Options {
  inlineRef: React.RefObject<TextInput | null>
  expandedRef: React.RefObject<TextInput | null>
  disabled: boolean
}

export function useComposerFocus({ inlineRef, expandedRef, disabled }: Options) {
  const stateRef = useRef<FocusState>(INITIAL_FOCUS_STATE)
  const screenFocusedRef = useRef(true)

  const dispatch = useCallback(
    (event: FocusEvent) => {
      const [next, effect] = composerFocus(stateRef.current, event)
      stateRef.current = next
      if (effect.kind === 'dismiss') Keyboard.dismiss()
      if (effect.kind === 'focus') {
        const ref = effect.target === 'inline' ? inlineRef : expandedRef
        ref.current?.focus()
      }
    },
    [inlineRef, expandedRef],
  )

  useEffect(() => {
    dispatchToComposer = dispatch
    return () => {
      if (dispatchToComposer === dispatch) dispatchToComposer = null
    }
  }, [dispatch])

  useFocusEffect(
    useCallback(() => {
      screenFocusedRef.current = true
      return () => {
        screenFocusedRef.current = false
      }
    }, []),
  )

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') dispatch({ type: 'foreground', screenFocused: screenFocusedRef.current })
      // 'inactive' is a transient iOS state (Control Centre, an incoming call
      // banner); only a real background ends the typing session.
      if (next === 'background') dispatch({ type: 'background' })
    })
    return () => sub.remove()
  }, [dispatch])

  useEffect(() => {
    dispatch({ type: disabled ? 'disable' : 'enable' })
  }, [disabled, dispatch])

  return {
    onInputFocus: (target: FocusTarget) => dispatch({ type: 'focus', target }),
    onInputBlur: () => dispatch({ type: 'blur' }),
    onExpand: () => dispatch({ type: 'expand' }),
    onMinimize: () => dispatch({ type: 'minimize' }),
  }
}
