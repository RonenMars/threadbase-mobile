import type { Message, MessageContent } from '@/types/api'
import { parseMarkdown, type MarkdownBlock } from '@/lib/markdown'

/** The message's text blocks as the agent wrote them — markdown source. */
export function messageMarkdown(message: Message): string {
  return message.content
    .flatMap((b) => (b.type === 'text' ? [b.text] : []))
    .join('\n\n')
    .trim()
}

function blockPlainText(block: MarkdownBlock): string {
  switch (block.kind) {
    case 'code':
      return block.code
    case 'rule':
      return ''
    case 'table':
      return [block.header, ...block.rows].map((row) => row.map((cell) => cell.map((s) => s.text).join('')).join('\t')).join('\n')
    case 'listItem':
      return `${'  '.repeat(block.depth)}${block.marker} ${block.spans.map((s) => s.text).join('')}`
    case 'heading':
    case 'quote':
    case 'paragraph':
      return block.spans.map((s) => s.text).join('')
  }
}

/** What the reader sees: markdown markers removed, list markers and code kept. */
export function messagePlainText(message: Message): string {
  return parseMarkdown(messageMarkdown(message))
    .map(blockPlainText)
    .filter((line) => line.length > 0)
    .join('\n')
}

/** Every fenced code block's body, blank-line separated. Empty when there is none. */
export function messageCodeBlocks(message: Message): string {
  return parseMarkdown(messageMarkdown(message))
    .flatMap((b) => (b.kind === 'code' ? [b.code] : []))
    .join('\n\n')
}

export function quoteAsMarkdown(text: string): string {
  return text
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')
}

/** The copyable text of a non-prose block, as a one-block text message the menu can act on. */
export function blockAsMessage(message: Message, block: MessageContent): Message {
  let text = ''
  switch (block.type) {
    case 'text':
      text = block.text
      break
    case 'thinking':
      text = block.thinking
      break
    case 'tool_use':
      text = `${block.name}\n${JSON.stringify(block.input, null, 2)}`
      break
    case 'tool_result':
      text = block.content
      break
    case 'diff':
      text = block.filename
      break
    case 'question_answer':
      text = block.items.map((i) => `${i.question}\n${i.answer}`).join('\n\n')
      break
  }
  return { ...message, content: [{ type: 'text', text }] }
}
