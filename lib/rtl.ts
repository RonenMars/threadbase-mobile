import { I18nManager } from 'react-native';

/**
 * RTL utility functions for consistent layout handling across the app.
 */

export const isRTL = I18nManager.isRTL;

/**
 * Returns the appropriate flex direction based on RTL setting.
 * Use this for horizontal layouts that should flip in RTL.
 */
export function flexRow(): 'row' | 'row-reverse' {
  return isRTL ? 'row-reverse' : 'row';
}

/**
 * Returns the inverted flex direction.
 * Use when you want the opposite of the natural RTL behavior.
 */
export function flexRowReverse(): 'row' | 'row-reverse' {
  return isRTL ? 'row' : 'row-reverse';
}

/**
 * Returns margin/padding direction for start edge (left in LTR, right in RTL).
 */
export function directionStart(): 'Left' | 'Right' {
  return isRTL ? 'Right' : 'Left';
}

/**
 * Returns margin/padding direction for end edge (right in LTR, left in RTL).
 */
export function directionEnd(): 'Left' | 'Right' {
  return isRTL ? 'Left' : 'Right';
}

/**
 * Returns 1 or -1 for RTL-aware transformations (rotations, translations).
 */
export function rtlMultiplier(): 1 | -1 {
  return isRTL ? -1 : 1;
}

/**
 * Style object with RTL-aware flex direction set to 'row' or 'row-reverse'.
 */
export const styles = {
  flexRow: { flexDirection: flexRow() },
  flexRowReverse: { flexDirection: flexRowReverse() },
} as const;
