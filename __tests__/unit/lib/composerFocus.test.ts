/**
 * composerFocus — where the composer's focus goes next.
 *
 * The rule under test is "never invent focus": only a composer-owned subflow
 * hands focus back, and only to the input that had it.
 */
import { composerFocus, INITIAL_FOCUS_STATE, type FocusState } from '@/lib/composerFocus'

const typingInline: FocusState = { kind: 'typing', target: 'inline' }
const typingExpanded: FocusState = { kind: 'typing', target: 'expanded' }

describe('composerFocus', () => {
  it('follows the input the user tapped', () => {
    const [state, effect] = composerFocus(INITIAL_FOCUS_STATE, { type: 'focus', target: 'inline' })
    expect(state).toEqual(typingInline)
    expect(effect).toEqual({ kind: 'none' })
  })

  it('goes idle on a blur the user caused', () => {
    const [state] = composerFocus(typingInline, { type: 'blur' })
    expect(state).toEqual({ kind: 'idle' })
  })

  describe('overlays', () => {
    it('hands focus back to the input that had it, for a composer subflow', () => {
      const [lent] = composerFocus(typingInline, { type: 'lend', overlay: 'slashArgs' })
      expect(lent).toEqual({ kind: 'lent', restoreTo: 'inline' })

      const [state, effect] = composerFocus(lent, { type: 'return', overlay: 'slashArgs' })
      expect(state).toEqual(typingInline)
      expect(effect).toEqual({ kind: 'focus', target: 'inline' })
    })

    it('returns to the expanded editor when the subflow started there', () => {
      const [lent] = composerFocus(typingExpanded, { type: 'lend', overlay: 'attach' })
      const [state, effect] = composerFocus(lent, { type: 'return', overlay: 'attach' })
      expect(state).toEqual(typingExpanded)
      expect(effect).toEqual({ kind: 'focus', target: 'expanded' })
    })

    it.each(['rename', 'modelEffort', 'review'] as const)(
      'does not restore after %s, a separate task',
      (overlay) => {
        const [lent] = composerFocus(typingInline, { type: 'lend', overlay })
        expect(lent).toEqual({ kind: 'lent', restoreTo: 'none' })

        const [state, effect] = composerFocus(lent, { type: 'return', overlay })
        expect(state).toEqual({ kind: 'idle' })
        expect(effect).toEqual({ kind: 'none' })
      },
    )

    it('never invents focus for an overlay opened while unfocused', () => {
      const [lent] = composerFocus(INITIAL_FOCUS_STATE, { type: 'lend', overlay: 'attach' })
      const [state, effect] = composerFocus(lent, { type: 'return', overlay: 'attach' })
      expect(state).toEqual({ kind: 'idle' })
      expect(effect).toEqual({ kind: 'none' })
    })

    it('ignores the blur that lending itself caused', () => {
      const [lent] = composerFocus(typingInline, { type: 'lend', overlay: 'slashArgs' })
      const [state] = composerFocus(lent, { type: 'blur' })
      expect(state).toEqual(lent)
    })
  })

  describe('the expanded editor', () => {
    it('records the move into it', () => {
      const [state] = composerFocus(typingInline, { type: 'expand' })
      expect(state).toEqual(typingExpanded)
    })

    it('hands focus back to the inline input on minimize', () => {
      const [state, effect] = composerFocus(typingExpanded, { type: 'minimize' })
      expect(state).toEqual(typingInline)
      expect(effect).toEqual({ kind: 'focus', target: 'inline' })
    })

    it('summons no keyboard on minimize if the editor was not focused', () => {
      const [state, effect] = composerFocus(INITIAL_FOCUS_STATE, { type: 'minimize' })
      expect(state).toEqual({ kind: 'idle' })
      expect(effect).toEqual({ kind: 'none' })
    })
  })

  describe('app lifecycle', () => {
    it('restores the input that was in use on return', () => {
      const [away] = composerFocus(typingExpanded, { type: 'background' })
      expect(away).toEqual({ kind: 'away', restoreTo: 'expanded' })

      const [state, effect] = composerFocus(away, { type: 'foreground', screenFocused: true })
      expect(state).toEqual(typingExpanded)
      expect(effect).toEqual({ kind: 'focus', target: 'expanded' })
    })

    it('restores nothing when another screen is on top', () => {
      const [away] = composerFocus(typingInline, { type: 'background' })
      const [state, effect] = composerFocus(away, { type: 'foreground', screenFocused: false })
      expect(state).toEqual({ kind: 'idle' })
      expect(effect).toEqual({ kind: 'none' })
    })

    it('restores nothing when the user was not typing', () => {
      const [away] = composerFocus(INITIAL_FOCUS_STATE, { type: 'background' })
      const [state, effect] = composerFocus(away, { type: 'foreground', screenFocused: true })
      expect(state).toEqual({ kind: 'idle' })
      expect(effect).toEqual({ kind: 'none' })
    })
  })

  describe('while disabled', () => {
    it('dismisses the keyboard if it was in use', () => {
      const [state, effect] = composerFocus(typingInline, { type: 'disable' })
      expect(state).toEqual({ kind: 'disabled' })
      expect(effect).toEqual({ kind: 'dismiss' })
    })

    it('refuses focus', () => {
      const [state] = composerFocus({ kind: 'disabled' }, { type: 'focus', target: 'inline' })
      expect(state).toEqual({ kind: 'disabled' })
    })

    it('does not focus on becoming enabled', () => {
      const [state, effect] = composerFocus({ kind: 'disabled' }, { type: 'enable' })
      expect(state).toEqual({ kind: 'idle' })
      expect(effect).toEqual({ kind: 'none' })
    })

    it('leaves an enabled composer alone', () => {
      const [state] = composerFocus(typingInline, { type: 'enable' })
      expect(state).toEqual(typingInline)
    })
  })
})
