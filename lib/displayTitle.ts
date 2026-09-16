import { isCodexInjectedContext } from './codexInjectedContext'

export interface DisplayTitleInput {
  /** User rename from the session-names store, if any. Always wins. */
  customName?: string | null
  /** Raw first user message text (or the server's session_name, which is usually that same text). */
  firstMessage?: string | null
  /**
   * Later user turns. Tried only when message one is a dump / envelope with no
   * leftover instruction — a greeting still falls through to assistant / identity.
   */
  laterUserMessages?: readonly string[] | null
  /** First assistant message text, for the fallback chain and the subtitle. */
  firstAssistantMessage?: string | null
  projectName?: string | null
  branch?: string | null
}

export interface DisplayTitle {
  title: string
  /** First assistant sentence; omitted when it would repeat the title or when there is none. */
  subtitle?: string
  /**
   * Which rung of the ladder produced the title. `command` (the work itself,
   * e.g. "git pull") and `untitled` (identity: project · branch) are the quiet
   * rungs; a list may render those lighter but never hides them.
   */
  source: 'rename' | 'message' | 'assistant' | 'command' | 'untitled'
}

const SUBTITLE_MAX_CHARS = 140

const GREETINGS = new Set([
  'hi',
  'hey',
  'hello',
  'hello there',
  'ahoy',
  'yo',
  'sup',
  'hi there',
  'hey there',
  'good morning',
  'good evening',
  'test',
  'testing',
])

const HEADING_MARKS = /^[ \t]*#{1,6}[ \t]+/gm
const FENCED_CODE = /```[\s\S]*?(?:```|$)/g
const IMAGE_TAG = /<image\b[^>]*>/gi
const IMAGE_PLACEHOLDER = /\[Image #\d+\]/gi
// Composer @/abs/path file refs (not @/alias imports). Path collapse would otherwise leave @file.
const FILE_AT_PATH = /@\/(?:[^/\s]+\/){2,}[^\s]+/g
const FILE_AT_BASENAME = /(?<![\w])@[\w.+~-]+\b/gi
// Tags the CLIs inject around the user's own words; isCodexInjectedContext only classifies
// whole messages, so the tag bodies have to be cut out here. The streamer slices a session
// name to 80 chars, so a closing tag is routinely missing: an unclosed tag runs to the end.
const INJECTED_TAG =
  /<(user_action|context|system-reminder|INSTRUCTIONS|permissions instructions|environment_context|bash-input|bash-stdout|bash-stderr)>[\s\S]*?(?:<\/\1>|$)/gi
const LS_LINE = /^(?:total \d+|[-dlcbps][rwxsStT-]{9}[@+]?\s+\d+\s+.*)$/gm
const URL = /https?:\/\/([^\s/?#]+)\S*/gi
const ABSOLUTE_PATH = /(?<![\w:/<])\/(?:[\w.@+~-]+\/)*([\w.@+~-]+)\/?/g
const BARE_PATH = /^\/?[\w.@+~-]+(?:\/[\w.@+~-]+)+\/?$/
const HEX_ID = /^[0-9a-f]{7,}$/i
const NON_ALNUM = /[^\p{L}\p{N}]/gu
const IMPORT_LINE =
  /^(?:import(?:\s+type)?\s+.+\sfrom\s+['"][^'"]+['"];?|import\s+['"][^'"]+['"];?|export\s+default\b.*|export\s+(?:type\s+)?\{.*|export\s+\*\s+from\s+['"][^'"]+['"];?|export\s+(?:async\s+)?(?:function|class|const|let|var|type|interface|enum)\b.*)$/gm
const IMPORT_OPEN = /^(?:import(?:\s+type)?|export(?:\s+type)?)\s*\{?\s*$/gm
const FROM_CLAUSE = /^\}?\s*from\s+['"][^'"]+['"];?\s*$/gm
const DESTRUCTURE_MEMBER = /^[A-Za-z_$][\w$]*(?:\s+as\s+[A-Za-z_$][\w$]*)?\s*,?\s*$/gm
const STACK_FRAME = /^\s*at\s+.+$/gm
const ERROR_LINE = /^(?:[A-Za-z]*Error|Error):.+$/gm
const USE_DIRECTIVE = /^['"]use (?:client|server|strict)['"];?\s*$/gm
const ENVELOPE_OPEN = /<(?:user_action|action|bash-input|context|system-reminder|INSTRUCTIONS|permissions instructions|environment_context)\b/i
const CODE_LINE =
  /^(?:return|const|let|var|function|type|interface|enum|class|if|for|while|switch|await|async|throw|try|catch|finally|else|case|default|new)\b|^(?:this\.|module\.|require\()|^[{}();[\],]+$|^(?:<\/?[A-Z][\w.]*|<[a-z][\w-]*[\s/>])/

const BRACKET_PAIRS: Record<string, string> = { '{': '}', '[': ']' }

function stripJsonBlobs(text: string): string {
  let out = ''
  let i = 0
  while (i < text.length) {
    const open = text[i]
    const close = BRACKET_PAIRS[open]
    if (!close) {
      out += open
      i += 1
      continue
    }
    let depth = 0
    let end = -1
    for (let j = i; j < text.length; j += 1) {
      const ch = text[j]
      if (ch === '{' || ch === '[') depth += 1
      else if (ch === '}' || ch === ']') depth -= 1
      if (depth === 0) {
        end = j
        break
      }
    }
    // ponytail: a bare depth counter ignores brackets inside JSON strings; JSON.parse is the
    // real validator, so a false span just fails to parse and is kept as the user's words.
    if (end !== -1 && isJsonContainer(text.slice(i, end + 1))) {
      out += ' '
      i = end + 1
      continue
    }
    out += open
    i += 1
  }
  return out
}

// The span always opens with { or [, so a successful parse is necessarily an object or array.
function isJsonContainer(span: string): boolean {
  try {
    JSON.parse(span)
    return true
  } catch {
    return false
  }
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Cut the tooling noise out of a raw message and flatten it to one line; '' when nothing is left. */
export function stripMessageNoise(raw: string): string {
  if (isCodexInjectedContext(raw)) return ''
  let text = raw
    .replace(HEADING_MARKS, '')
    .replace(FENCED_CODE, ' ')
    .replace(IMAGE_TAG, ' ')
    .replace(IMAGE_PLACEHOLDER, ' ')
    .replace(FILE_AT_PATH, ' ')
    .replace(INJECTED_TAG, ' ')
  text = stripJsonBlobs(text)
  // URLs before paths: the path pass would otherwise eat a URL's path segment first.
  text = text.replace(LS_LINE, '').replace(URL, '$1').replace(ABSOLUTE_PATH, '$1').replace(FILE_AT_BASENAME, ' ')
  return collapseWhitespace(text)
}

/** Step 2 of the title pipeline: normalise a raw first prompt into one line of the user's words. */
export function cleanFirstMessage(raw: string): string {
  const text = stripMessageNoise(raw)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** True when a cleaned message carries no words of its own: empty, a greeting, a path, an id, or punctuation. */
function isNoise(cleaned: string): boolean {
  const text = cleaned.trim()
  if (text === '') return true
  if (GREETINGS.has(text.toLowerCase())) return true
  if (BARE_PATH.test(text) || HEX_ID.test(text)) return true
  const nonAlnum = text.match(NON_ALNUM)?.length ?? 0
  return nonAlnum / text.length > 0.6
}

/** Step 3 of the title pipeline: true when a cleaned first message says nothing worth a title. */
export function isRejectedTitle(cleaned: string): boolean {
  return isNoise(cleaned) || cleaned.trim().split(' ').length < 3
}

function firstSentence(text: string): string {
  const flat = collapseWhitespace(text)
  const match = flat.match(/^(.*?[.!?])(?=\s|$)/)
  return match ? match[1] : flat
}

function clipSubtitle(sentence: string): string {
  if (sentence.length <= SUBTITLE_MAX_CHARS) return sentence
  return `${sentence.slice(0, SUBTITLE_MAX_CHARS - 1)}…`
}

function normaliseForEcho(text: string): string {
  return collapseWhitespace(text)
    .toLowerCase()
    .replace(/(?:…|\.\.\.)$/, '')
    .trim()
}

/**
 * Rung 2 of the ladder: when message one is a tool envelope, the instruction
 * lives inside it (usually `<action>…</action>`), not in the leftover after
 * the tags are stripped. An unclosed envelope is the streamer's 80-char cut.
 */
function extractEnvelopeInstruction(raw: string): string {
  const action = raw.match(/<action>([\s\S]*?)<\/action>/i)
  if (action) return collapseWhitespace(action[1].replace(/<[^>]+>/g, ' '))
  const closed = raw.match(/<user_action>([\s\S]*?)<\/user_action>/i)
  if (!closed) return ''
  return collapseWhitespace(closed[1].replace(/<[^>]+>/g, ' '))
}

function hasMatch(raw: string, re: RegExp): boolean {
  re.lastIndex = 0
  const found = re.test(raw)
  re.lastIndex = 0
  return found
}

/** True when message one is a paste, stack trace, fenced dump, or tool envelope. */
function looksLikeDump(raw: string): boolean {
  if (!raw.trim()) return false
  if (ENVELOPE_OPEN.test(raw) || raw.includes('```')) return true
  return (
    hasMatch(raw, IMPORT_LINE) ||
    hasMatch(raw, IMPORT_OPEN) ||
    hasMatch(raw, FROM_CLAUSE) ||
    hasMatch(raw, STACK_FRAME)
  )
}

function looksLikeCode(line: string): boolean {
  return CODE_LINE.test(line)
}

/**
 * After the dump bodies are gone, keep the leftover prose — "fix this crash"
 * after a stack trace, or the instruction under a pasted `_layout.tsx`.
 */
function extractDumpInstruction(raw: string): string {
  const leftover = raw
    .replace(HEADING_MARKS, '')
    .replace(FENCED_CODE, '\n')
    .replace(IMAGE_TAG, ' ')
    .replace(IMAGE_PLACEHOLDER, ' ')
    .replace(INJECTED_TAG, '\n')
    .replace(IMPORT_LINE, '\n')
    .replace(IMPORT_OPEN, '\n')
    .replace(FROM_CLAUSE, '\n')
    .replace(DESTRUCTURE_MEMBER, '\n')
    .replace(STACK_FRAME, '\n')
    .replace(ERROR_LINE, '\n')
    .replace(USE_DIRECTIVE, '\n')
  const prose = leftover
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !looksLikeCode(line))
    .join(' ')
  return collapseWhitespace(prose.replace(/<[^>]+>/g, ' '))
}

function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function rungFromInstruction(instruction: string): Pick<DisplayTitle, 'title' | 'source'> | null {
  if (!instruction) return null
  if (!isRejectedTitle(sentenceCase(instruction))) {
    return { title: sentenceCase(instruction), source: 'message' }
  }
  if (!isNoise(instruction)) return { title: instruction, source: 'command' }
  return null
}

/** Resolve one raw turn without walking to a later one. */
function titleFromRaw(raw: string): Pick<DisplayTitle, 'title' | 'source'> | null {
  if (looksLikeDump(raw)) {
    const instruction = extractEnvelopeInstruction(raw) || extractDumpInstruction(raw)
    const fromDump = rungFromInstruction(instruction)
    if (fromDump) return fromDump
    return null
  }

  const cleaned = cleanFirstMessage(raw)
  if (!isRejectedTitle(cleaned)) return { title: cleaned, source: 'message' }

  const fromEnvelope = rungFromInstruction(extractEnvelopeInstruction(raw))
  if (fromEnvelope) return fromEnvelope

  // The work itself: a session that only ran a command is its command, shown
  // as typed rather than sentence-cased.
  if (!isNoise(cleaned)) return { title: stripMessageNoise(raw), source: 'command' }
  return null
}

function resolveTitle(input: DisplayTitleInput): Pick<DisplayTitle, 'title' | 'source'> {
  const customName = input.customName?.trim()
  if (customName) return { title: customName, source: 'rename' }

  const first = titleFromRaw(input.firstMessage ?? '')
  if (first) return first

  if (looksLikeDump(input.firstMessage ?? '')) {
    for (const later of input.laterUserMessages ?? []) {
      const next = titleFromRaw(later)
      if (next) return next
    }
  }

  const assistant = firstSentence(input.firstAssistantMessage ?? '')
  if (assistant) return { title: assistant, source: 'assistant' }

  // Identity, never a path. With no project name either, the title is left empty
  // so the caller can substitute its own fallback.
  const parts = [input.projectName?.trim(), input.branch?.trim()].filter((part) => part)
  return { title: parts.join(' · '), source: 'untitled' }
}

export function resolveDisplayTitle(input: DisplayTitleInput): DisplayTitle {
  const resolved = resolveTitle(input)
  if (resolved.source === 'assistant') return resolved

  const assistant = input.firstAssistantMessage ?? ''
  if (collapseWhitespace(assistant) === '') return resolved

  const subtitle = clipSubtitle(firstSentence(assistant))
  if (normaliseForEcho(subtitle) === normaliseForEcho(resolved.title)) return resolved
  return { ...resolved, subtitle }
}
