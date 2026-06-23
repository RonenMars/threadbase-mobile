// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b(\[[0-9;?]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[A-Z\\])/g

export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '')
}
