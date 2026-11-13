import { cliPromptText } from '@/lib/cliPromptText'

// Records copied from a Claude Code 2.1.278 transcript.
describe('cliPromptText', () => {
  it('unwraps a pasted prompt', () => {
    expect(cliPromptText('\n\n<pasted_content id="1643">\nHello, this is typing test\n</pasted_content id="1643">\n'))
      .toBe('Hello, this is typing test')
  })

  it('keeps text around a pasted block', () => {
    expect(cliPromptText('see this: <pasted_content id="a1f0">\nline one\nline two\n</pasted_content id="a1f0">'))
      .toBe('see this: line one\nline two')
  })

  it('turns a command record into the command the user sent', () => {
    expect(cliPromptText('<command-message>doctor</command-message>\n<command-name>/doctor</command-name>')).toBe('/doctor')
    expect(cliPromptText(
      '<command-name>/usage-credits</command-name>\n            <command-message>usage-credits</command-message>\n            <command-args></command-args>',
    )).toBe('/usage-credits')
  })

  it('appends command arguments', () => {
    expect(cliPromptText(
      '<command-name>/permissions</command-name>\n<command-message>permissions</command-message>\n<command-args>allow Bash(npm test)</command-args>',
    )).toBe('/permissions allow Bash(npm test)')
  })

  // The optimistic bubble holds what was typed, so the echo must read the same or the bubble sticks.
  it('turns a bash-mode record back into the `!` command the user typed', () => {
    expect(cliPromptText('<bash-input>git status</bash-input>')).toBe('!git status')
    expect(cliPromptText('<bash-input> ( cd /tmp; ls )</bash-input>')).toBe('! ( cd /tmp; ls )')
  })

  it('leaves prose that only mentions the tags alone', () => {
    expect(cliPromptText('is <bash-input>ls</bash-input> recorded?')).toBe('is <bash-input>ls</bash-input> recorded?')
    const prose = 'why does <command-name>/doctor</command-name> show up raw?'
    expect(cliPromptText(prose)).toBe(prose)
    expect(cliPromptText('what is <pasted_content id="1">?')).toBe('what is <pasted_content id="1">?')
    expect(cliPromptText('  plain prompt  ')).toBe('  plain prompt  ')
  })
})
