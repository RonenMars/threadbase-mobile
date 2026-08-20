// Left-to-Right Isolate / Pop Directional Isolate. URLs and grouped hex
// get reordered token-by-token inside an RTL (he/ar) paragraph — the same
// trap that reverses a phone number. Isolating forces typed order in every
// locale; `writingDirection: 'ltr'` is a same-intent style hint, not a substitute.
export const LRI = '\u2066'
export const PDI = '\u2069'

export function isolateLtr(value: string): string {
  return `${LRI}${value}${PDI}`
}
