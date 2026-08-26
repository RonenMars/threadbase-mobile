import { useMemo } from 'react';
import i18next from 'i18next';
import { useTranslation } from 'react-i18next';

/**
 * RTL utility functions for consistent layout handling across the app.
 *
 * Direction comes from i18next, never from `I18nManager`. `I18nManager.isRTL`
 * reports the direction the native layer booted with, so it cannot follow an
 * in-app language switch without an app restart, while `i18n.dir()` follows
 * `changeLanguage` immediately. The app therefore never calls `forceRTL` or
 * `allowRTL`; the resolved direction is painted as a Yoga `direction` style on
 * the app root (see `app/_layout.tsx`), which Yoga inherits down the tree.
 */

export type Direction = 'ltr' | 'rtl';

export type AppDirection = {
  language: string;
  direction: Direction;
  isRTL: boolean;
};

/**
 * Direction of an explicit language tag, or of the active language when the
 * tag is omitted. Non-reactive — use `useAppDirection` inside components.
 */
export function localeDirection(language?: string): Direction {
  return i18next.dir(language) === 'rtl' ? 'rtl' : 'ltr';
}

/**
 * The app's current language and layout direction.
 *
 * `useTranslation` re-subscribes to i18next's `languageChanged` event, so a
 * runtime `changeLanguage` re-renders every consumer with the new direction.
 */
export function useAppDirection(): AppDirection {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;

  return useMemo(() => {
    const direction: Direction = i18n.dir(language) === 'rtl' ? 'rtl' : 'ltr';
    return { language, direction, isRTL: direction === 'rtl' };
  }, [i18n, language]);
}

/**
 * A memoised `{ direction }` style for subtrees Yoga cannot reach from the app
 * root: React Native's `<Modal>` renders its children into `RCTModalHostView`,
 * a separate native host whose Yoga root direction comes from `I18nManager`
 * (see `Modal.js`, which even hard-codes `const side = I18nManager.getConstants().isRTL ? 'right' : 'left'`
 * at module load). Compose it onto the modal's *outermost* view —
 * `style={[styles.overlay, directionStyle]}` — so the whole overlay, not just
 * one content box, follows the selected language.
 */
export function useDirectionStyle(): { direction: Direction } {
  const { direction } = useAppDirection();
  return useMemo(() => ({ direction }), [direction]);
}

export type TextDirectionStyle = {
  direction: Direction;
  writingDirection: Direction;
  textAlign: 'auto';
};

/** Runtime text/input direction. Apply at the presentation boundary. */
export function textDirectionStyle(direction: Direction): TextDirectionStyle {
  return { direction, writingDirection: direction, textAlign: 'auto' };
}

/** Full-width variant so `textAlign: 'auto'` has a box to align inside. */
export function blockTextDirectionStyle(direction: Direction): TextDirectionStyle & { width: '100%' } {
  return { ...textDirectionStyle(direction), width: '100%' };
}

/**
 * Technical tokens that must stay LTR inside an RTL layout: paths, URLs,
 * hostnames, server names, API keys, breadcrumbs, and numeric identifiers.
 */
export const ltrContentStyle: TextDirectionStyle = textDirectionStyle('ltr');

export function useTextDirectionStyle(): TextDirectionStyle {
  const { direction } = useAppDirection();
  return useMemo(() => textDirectionStyle(direction), [direction]);
}

/**
 * Returns the appropriate flex direction based on RTL setting.
 * Use this for horizontal layouts that should flip in RTL.
 */
export function flexRow(isRTL: boolean): 'row' | 'row-reverse' {
  return isRTL ? 'row-reverse' : 'row';
}

/**
 * Returns the inverted flex direction.
 * Use when you want the opposite of the natural RTL behavior.
 */
export function flexRowReverse(isRTL: boolean): 'row' | 'row-reverse' {
  return isRTL ? 'row' : 'row-reverse';
}

/**
 * Returns margin/padding direction for start edge (left in LTR, right in RTL).
 */
export function directionStart(isRTL: boolean): 'Left' | 'Right' {
  return isRTL ? 'Right' : 'Left';
}

/**
 * Returns margin/padding direction for end edge (right in LTR, left in RTL).
 */
export function directionEnd(isRTL: boolean): 'Left' | 'Right' {
  return isRTL ? 'Left' : 'Right';
}

/**
 * Returns 1 or -1 for RTL-aware transformations (rotations, translations).
 */
export function rtlMultiplier(isRTL: boolean): 1 | -1 {
  return isRTL ? -1 : 1;
}
