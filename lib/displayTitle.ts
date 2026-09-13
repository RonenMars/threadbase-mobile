export interface DisplayTitleInput {
  /** User rename from the session-names store, if any. Always wins. */
  customName?: string | null
  /** Raw first user message text (or the server's session_name, which is usually that same text). */
  firstMessage?: string | null
  /** First assistant message text, for the fallback chain and the subtitle. */
  firstAssistantMessage?: string | null
  projectName?: string | null
  branch?: string | null
}

export interface DisplayTitle {
  title: string
  /** First assistant sentence; omitted when it would repeat the title or when there is none. */
  subtitle?: string
  /** Which step produced the title, for tests and the grouped-noise rows. */
  source: 'rename' | 'message' | 'assistant' | 'project'
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
// Tags the CLIs inject around the user's own words; isCodexInjectedContext only classifies
// whole messages, so the tag bodies have to be cut out here.
const INJECTED_TAG =
  /<(user_action|context|system-reminder|INSTRUCTIONS|permissions instructions|environment_context)>[\s\S]*?<\/\1>/gi
const LS_LINE = /^(?:total \d+|[-dlcbps][rwxsStT-]{9}[@+]?\s+\d+\s+.*)$/gm
const URL = /https?:\/\/([^\s/?#]+)\S*/gi
const ABSOLUTE_PATH = /(?<![\w:/])\/(?:[\w.@+~-]+\/)*([\w.@+~-]+)\/?/g
const BARE_PATH = /^\/?[\w.@+~-]+(?:\/[\w.@+~-]+)+\/?$/
const HEX_ID = /^[0-9a-f]{7,}$/i
const NON_ALNUM = /[^\p{L}\p{N}]/gu

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

/** Step 2 of the title pipeline: normalise a raw first prompt into one line of the user's words. */
export function cleanFirstMessage(raw: string): string {
  let text = raw
    .replace(HEADING_MARKS, '')
    .replace(FENCED_CODE, ' ')
    .replace(IMAGE_TAG, ' ')
    .replace(IMAGE_PLACEHOLDER, ' ')
    .replace(INJECTED_TAG, ' ')
  text = stripJsonBlobs(text)
  // URLs before paths: the path pass would otherwise eat a URL's path segment first.
  text = text.replace(LS_LINE, '').replace(URL, '$1').replace(ABSOLUTE_PATH, '$1')
  text = collapseWhitespace(text)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Step 3 of the title pipeline: true when a cleaned first message says nothing worth a title. */
export function isRejectedTitle(cleaned: string): boolean {
  const text = cleaned.trim()
  if (text === '') return true
  if (GREETINGS.has(text.toLowerCase())) return true
  if (BARE_PATH.test(text) || HEX_ID.test(text)) return true
  if (text.split(' ').length < 3) return true
  const nonAlnum = text.match(NON_ALNUM)?.length ?? 0
  return nonAlnum / text.length > 0.6
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

function resolveTitle(input: DisplayTitleInput): Pick<DisplayTitle, 'title' | 'source'> {
  const customName = input.customName?.trim()
  if (customName) return { title: customName, source: 'rename' }

  const cleaned = cleanFirstMessage(input.firstMessage ?? '')
  if (!isRejectedTitle(cleaned)) return { title: cleaned, source: 'message' }

  const assistant = firstSentence(input.firstAssistantMessage ?? '')
  if (assistant) return { title: assistant, source: 'assistant' }

  // Relative time is a render concern. With no project name either, the title is left empty
  // so the caller can substitute its own translated placeholder.
  const parts = [input.projectName?.trim(), input.branch?.trim()].filter((part) => part)
  return { title: parts.join(' · '), source: 'project' }
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
