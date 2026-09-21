const PASTED_BLOCK = /<pasted_content(?:\s[^>]*)?>\n?([\s\S]*?)\n?<\/pasted_content(?:\s[^>]*)?>/g
const COMMAND_TAG = /<command-(name|message|args)>([\s\S]*?)<\/command-\1>/g

/**
 * Claude Code records a pasted prompt inside `<pasted_content>` and a slash command as
 * `<command-name>`/`<command-message>`/`<command-args>` tags. Return what the user sent,
 * so the bubble reads as typed and matches the optimistic echo of the same send.
 */
export function cliPromptText(text: string): string {
  const unwrapped = text.replace(PASTED_BLOCK, '$1')
  if (unwrapped !== text) return unwrapped.trim()

  let name = ''
  let args = ''
  const rest = text.replace(COMMAND_TAG, (_match, tag: string, value: string) => {
    if (tag === 'name') name = value.trim()
    if (tag === 'args') args = value.trim()
    return ''
  })
  if (!name || rest.trim() !== '') return text
  return args ? `${name} ${args}` : name
}
