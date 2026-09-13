import { cleanFirstMessage, isRejectedTitle, resolveDisplayTitle } from '@/lib/displayTitle'

describe('cleanFirstMessage', () => {
  it('strips leading markdown heading marks', () => {
    expect(cleanFirstMessage('## Fix the login flow')).toBe('Fix the login flow')
  })

  it('strips fenced code blocks', () => {
    expect(cleanFirstMessage('why does this fail\n```ts\nconst x = 1\n```\non startup')).toBe(
      'Why does this fail on startup',
    )
  })

  it('strips image tags and image placeholders', () => {
    expect(
      cleanFirstMessage('<image name="shot.png" path="/tmp/shot.png"> what is wrong here [Image #1]'),
    ).toBe('What is wrong here')
  })

  it('strips injected-context tags with their bodies', () => {
    expect(
      cleanFirstMessage(
        '<user_action>opened file</user_action><context>cwd=/x</context><system-reminder>noise</system-reminder> rename the helper please',
      ),
    ).toBe('Rename the helper please')
  })

  it('strips JSON blobs', () => {
    expect(cleanFirstMessage('parse this payload {"a": [1, 2], "b": {"c": null}} for me')).toBe(
      'Parse this payload for me',
    )
    expect(cleanFirstMessage('and this list [1, "two", 3] too please')).toBe('And this list too please')
  })

  it('leaves a brace span that is not JSON alone', () => {
    expect(cleanFirstMessage('use {name} as the placeholder')).toBe('Use {name} as the placeholder')
  })

  it('strips ls -la style listing lines', () => {
    expect(
      cleanFirstMessage(
        'what are these files\n-rw-r--r--  1 ronen  staff   1234 Sep 13 10:00 index.ts\ndrwxr-xr-x  3 ronen  staff     96 Sep 13 10:00 lib\nin the folder',
      ),
    ).toBe('What are these files in the folder')
  })

  it('reduces absolute paths to their basename', () => {
    expect(cleanFirstMessage('open /Users/ronen/dev/app/lib/sessionPresentation.ts and fix it')).toBe(
      'Open sessionPresentation.ts and fix it',
    )
  })

  it('reduces URLs to their host', () => {
    expect(cleanFirstMessage('fetch https://api.github.com/repos/x/y/pulls?state=open now')).toBe(
      'Fetch api.github.com now',
    )
  })

  it('collapses whitespace to one line', () => {
    expect(cleanFirstMessage('  fix\n\n  the   thing\t\tnow  ')).toBe('Fix the thing now')
  })

  it('sentence-cases only the first character', () => {
    expect(cleanFirstMessage('does teh currnetly running SESSION resume')).toBe(
      'Does teh currnetly running SESSION resume',
    )
  })
})

describe('isRejectedTitle', () => {
  it('rejects fewer than three words', () => {
    expect(isRejectedTitle('Fix login')).toBe(true)
    expect(isRejectedTitle('Fix the login')).toBe(false)
  })

  it('rejects greetings case-insensitively', () => {
    expect(isRejectedTitle('Hello There')).toBe(true)
    expect(isRejectedTitle('good morning')).toBe(true)
    expect(isRejectedTitle('Testing')).toBe(true)
  })

  it('rejects mostly non-alphanumeric strings', () => {
    expect(isRejectedTitle('--- === !!! ??? a b')).toBe(true)
  })

  it('rejects a bare path', () => {
    expect(isRejectedTitle('/Users/ronen/dev/app')).toBe(true)
    expect(isRejectedTitle('src/lib/thing.ts')).toBe(true)
  })

  it('rejects a hex id', () => {
    expect(isRejectedTitle('9480b97c')).toBe(true)
    expect(isRejectedTitle('9480b97c2f1a4e6d')).toBe(true)
  })

  it('rejects an empty string', () => {
    expect(isRejectedTitle('')).toBe(true)
    expect(isRejectedTitle('   ')).toBe(true)
  })
})

describe('resolveDisplayTitle', () => {
  it('prefers a non-empty custom name', () => {
    expect(
      resolveDisplayTitle({
        customName: '  My session  ',
        firstMessage: 'fix the login flow',
        firstAssistantMessage: 'Sure, looking now.',
      }),
    ).toEqual({ title: 'My session', subtitle: 'Sure, looking now.', source: 'rename' })
  })

  it('ignores a blank custom name and uses the cleaned first message', () => {
    expect(
      resolveDisplayTitle({
        customName: '   ',
        firstMessage: '# fix the login flow',
        firstAssistantMessage: 'Sure, looking now.',
      }),
    ).toEqual({ title: 'Fix the login flow', subtitle: 'Sure, looking now.', source: 'message' })
  })

  it('falls back to the first assistant sentence when the message is rejected', () => {
    expect(
      resolveDisplayTitle({
        firstMessage: 'hi',
        firstAssistantMessage: 'The login flow fails because the token expires. Here is a fix.',
        projectName: 'app',
        branch: 'main',
      }),
    ).toEqual({ title: 'The login flow fails because the token expires.', source: 'assistant' })
  })

  it('falls back to project and branch when there is no usable text', () => {
    expect(resolveDisplayTitle({ firstMessage: 'yo', projectName: 'app', branch: 'main' })).toEqual({
      title: 'app · main',
      source: 'project',
    })
  })

  it('omits the branch part when the branch is missing', () => {
    expect(resolveDisplayTitle({ firstMessage: 'yo', projectName: 'app' })).toEqual({
      title: 'app',
      source: 'project',
    })
  })

  it('returns an empty project title when nothing at all is known', () => {
    expect(resolveDisplayTitle({})).toEqual({ title: '', source: 'project' })
  })

  it('omits the subtitle when the assistant echoes the title', () => {
    expect(
      resolveDisplayTitle({
        firstMessage: 'fix the login flow',
        firstAssistantMessage: 'Fix   the login flow… ',
      }),
    ).toEqual({ title: 'Fix the login flow', source: 'message' })
  })

  it('omits the subtitle when the title came from the assistant', () => {
    expect(
      resolveDisplayTitle({
        firstMessage: 'test',
        firstAssistantMessage: 'Running the suite now! Results follow.',
      }),
    ).toEqual({ title: 'Running the suite now!', source: 'assistant' })
  })

  it('clips the subtitle at 140 characters with an ellipsis', () => {
    const long = 'a'.repeat(200)
    const result = resolveDisplayTitle({ firstMessage: 'fix the login flow', firstAssistantMessage: long })
    expect(result.subtitle).toBe(`${'a'.repeat(139)}…`)
    expect(result.subtitle).toHaveLength(140)
  })

  it('does not split the subtitle on a period without a following space', () => {
    expect(
      resolveDisplayTitle({
        firstMessage: 'fix the login flow',
        firstAssistantMessage: 'Edit lib/sessionPresentation.ts to gate on liveness. Then rerun.',
      }).subtitle,
    ).toBe('Edit lib/sessionPresentation.ts to gate on liveness.')
  })

  it('never truncates the title by character count', () => {
    const result = resolveDisplayTitle({
      firstMessage: 'Does the currently running session resume after the app restarts?',
    })
    expect(result.title).toBe('Does the currently running session resume after the app restarts?')
    expect(result.title).not.toBe('does-the-currently-r')
  })
})
