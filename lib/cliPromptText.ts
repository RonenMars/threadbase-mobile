const PASTED_BLOCK = /<pasted_content(?:\s[^>]*)?>\n?([\s\S]*?)\n?<\/pasted_content(?:\s[^>]*)?>/g
const COMMAND_TAG = /<command-(name|message|args)>([\s\S]*?)<\/command-\1>/g
const BASH_INPUT = /^\s*<bash-input>([\s\S]*)<\/bash-input>\s*$/
const BASH_RESULT = /^\s*<bash-stdout>([\s\S]*?)<\/bash-stdout>\s*(?:<bash-stderr>([\s\S]*?)<\/bash-stderr>)?\s*$/

/**
 * Claude Code records a pasted prompt inside `<pasted_content>`, a slash command as
 * `<command-name>`/`<command-message>`/`<command-args>` tags, and a `!` bash-mode
 * command as `<bash-input>` with the `!` dropped, its result as `<bash-stdout>`/`<bash-stderr>`
 * (shown as a code block). Return what the user sent,
 * so the bubble reads as typed and matches the optimistic echo of the same send.
 */
export function cliPromptText(text: string): string {
  const bash = BASH_INPUT.exec(text)
  if (bash) return `!${bash[1]}`

  const result = BASH_RESULT.exec(text)
  if (result) {
    const output = [result[1], result[2]].filter(Boolean).join('\n')
    const longestRun = Math.max(2, ...(output.match(/`+/g) ?? []).map((run) => run.length))
    const fence = '`'.repeat(longestRun + 1)
    return output ? `${fence}\n${output}\n${fence}` : `${fence}\n${fence}`
  }

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
